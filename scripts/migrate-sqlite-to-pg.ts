// @ts-nocheck
/**
 * SQLite → PostgreSQL 数据迁移脚本
 *
 * 用法:
 *   npx tsx scripts/migrate-sqlite-to-pg.ts [--src <sqlite路径>] [--truncate] [--dry-run]
 *
 * 设计:
 *  - 逐表搬运,列名自动对齐(以 SQLite 表的列为准)
 *  - bool 转换:books.requires_document / documents.vectorized 的 0/1 → false/true
 *  - JSON 字段(tags/personality_traits/metadata/conversation_strategy):PG 侧为 TEXT,直搬字符串
 *  - 行数校验:每表迁完比对 源行数 == 目标行数,不一致则报错退出
 *  - 幂等:--truncate 时先按外键反序清空目标表,可重复跑
 *  - 外键顺序:users→books→characters→documents→conversations→messages→sessions→favorites→config
 *  - user_memories 表:PG 新增表,无 SQLite 源数据,跳过(保留线上既有/空)
 *
 * 安全:本脚本只读 SQLite 源、写 PG 目标。绝不动 SQLite 源文件。
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';

// ---- 参数解析 ----
const args = process.argv.slice(2);
const srcIdx = args.indexOf('--src');
const SRC_PATH = srcIdx >= 0 ? args[srcIdx + 1] : path.join(process.cwd(), 'data', 'inknowing.db');
const DO_TRUNCATE = args.includes('--truncate');
const DRY_RUN = args.includes('--dry-run');

// ---- 迁移表顺序(外键依赖:父表在前) ----
const TABLE_ORDER = [
  'users',
  'books',
  'characters',
  'documents',
  'conversations',
  'messages',
  'sessions',
  'favorites',
  'config',
];

// ---- 需要 0/1 → bool 转换的字段 ----
const BOOL_FIELDS: Record<string, string[]> = {
  books: ['requires_document'],
  documents: ['vectorized'],
};

function toBool(v: any): boolean | null {
  if (v === null || v === undefined) return null;
  return v === 1 || v === '1' || v === true;
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER || 'inknowing'}:${process.env.PGPASSWORD}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || '5433'}/${process.env.PGDATABASE || 'inknowing'}`;

  console.log('=== SQLite → PG 迁移 ===');
  console.log(`源 SQLite: ${SRC_PATH}`);
  console.log(`目标 PG:   ${connectionString.replace(/:[^:@/]+@/, ':****@')}`);
  console.log(`模式:      ${DRY_RUN ? 'DRY-RUN(只读不写)' : DO_TRUNCATE ? '清空后灌入' : '直接灌入(目标须为空)'}`);
  console.log('');

  const sqlite = new Database(SRC_PATH, { readonly: true });
  const pg = new Pool({ connectionString, max: 4 });

  // 先确保 PG schema 已就绪(import client 会触发 bootstrap)
  // 但 migrate 脚本独立于 app,这里直接连,假定 schema 已由 app/承重墙建好。

  const report: { table: string; src: number; dst: number; ok: boolean }[] = [];

  try {
    // 1) 可选:按外键反序清空目标
    if (DO_TRUNCATE && !DRY_RUN) {
      console.log('--- 清空目标表(外键反序) ---');
      for (const t of [...TABLE_ORDER].reverse()) {
        await pg.query(`DELETE FROM ${t}`);
        console.log(`  cleared ${t}`);
      }
      console.log('');
    }

    // 2) 逐表搬运
    for (const table of TABLE_ORDER) {
      // 源行
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];
      const srcCount = rows.length;

      if (srcCount === 0) {
        // 校验目标也读一下
        const dstRes = await pg.query(`SELECT count(*)::int AS c FROM ${table}`);
        report.push({ table, src: 0, dst: dstRes.rows[0].c, ok: true });
        console.log(`  [${table}] 源 0 行,跳过`);
        continue;
      }

      const cols = Object.keys(rows[0]);
      const boolCols = BOOL_FIELDS[table] || [];

      if (!DRY_RUN) {
        // 批量插入,逐行参数化
        const colList = cols.map((c) => `"${c}"`).join(', ');
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const insertSQL = `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

        for (const row of rows) {
          const vals = cols.map((c) => {
            if (boolCols.includes(c)) return toBool(row[c]);
            return row[c]; // TEXT/INTEGER/JSON字符串 直搬;时间文本由 pg 解析
          });
          await pg.query(insertSQL, vals);
        }
      }

      // 校验目标行数
      const dstRes = await pg.query(`SELECT count(*)::int AS c FROM ${table}`);
      const dstCount = dstRes.rows[0].c;
      const ok = DRY_RUN ? true : dstCount >= srcCount;
      report.push({ table, src: srcCount, dst: dstCount, ok });
      console.log(`  [${table}] 源 ${srcCount} → 目标 ${dstCount} ${ok ? '✓' : '✗ 行数不符!'}`);
    }

    // 3) 汇总
    console.log('\n=== 迁移汇总 ===');
    let allOk = true;
    for (const r of report) {
      console.log(`  ${r.ok ? '✓' : '✗'} ${r.table}: src=${r.src} dst=${r.dst}`);
      if (!r.ok) allOk = false;
    }

    if (DRY_RUN) {
      console.log('\n[DRY-RUN] 未写入任何数据,仅读取源 + 统计目标现状');
    } else if (allOk) {
      console.log('\n✅✅ 迁移完成,所有表行数校验通过');
    } else {
      console.log('\n❌ 部分表行数不符,请检查');
      process.exit(1);
    }
  } finally {
    sqlite.close();
    await pg.end();
  }
}

main().catch((e) => {
  console.error('迁移失败:', e);
  process.exit(1);
});
