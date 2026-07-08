#!/usr/bin/env tsx
/**
 * 批量回填 books 的语义索引(全局 collection `books_semantic`)。
 *
 * 行为:
 *   - 遍历 status='published' 的全部书,逐本调 indexBookSemantic
 *   - 默认串行(避免打爆 embedding API + Chroma 写入),可经 BATCH_CONCURRENCY 调
 *   - 支持 --dry-run:不实际写入(不打 Chroma),仅打印"将处理 X 本"
 *
 * 用法:
 *   npx tsx scripts/index-books-semantic.ts             # 实际回填
 *   npx tsx scripts/index-books-semantic.ts --dry-run   # 只打印不写
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepare, closeDb } from '../lib/db/client';
import { indexBookSemantic } from '../lib/services/semantic-search';
import type { Book } from '../lib/db/schema';

// ===================== .env 解析(无 dotenv 依赖) =====================
function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  let raw: string;
  try {
    raw = readFileSync(envPath, 'utf-8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}
loadDotEnv();

const DRY_RUN = process.argv.slice(2).includes('--dry-run');
const CONCURRENCY = Math.max(1, parseInt(process.env.BATCH_CONCURRENCY || '2', 10));
const DELAY_MS = Math.max(0, parseInt(process.env.BATCH_DELAY_MS || '200', 10));

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL 未加载,db client 将使用内置默认值');
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type BookRow = {
  id: string;
  title: string;
  title_en: string | null;
  author: string;
  author_en: string | null;
  description: string | null;
  description_en: string | null;
  category: string | null;
  tags: string | null;
  tags_en: string | null;
};

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function rowToBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description ?? '',
    cover_url: '',
    category: row.category ?? '',
    tags: parseTags(row.tags),
    ai_knowledge_level: 0,
    requires_document: false,
    conversation_strategy: 'hybrid',
    status: 'published',
    language_mode: 'zh_native',
    title_en: row.title_en ?? undefined,
    description_en: row.description_en ?? undefined,
    author_en: row.author_en ?? undefined,
    tags_en: parseTags(row.tags_en),
    created_at: new Date(0),
    updated_at: new Date(0),
  } as Book;
}

async function worker(rows: BookRow[], idxOffset: number): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tag = `[${idxOffset + i + 1}] 《${row.title}》 (${row.id})`;
    try {
      if (DRY_RUN) {
        console.log(`  ${tag} DRY-RUN 跳过(将写入 books_semantic)`);
        ok++;
      } else {
        await indexBookSemantic(rowToBook(row));
        ok++;
        console.log(`  ✅ ${tag}`);
      }
    } catch (err: any) {
      fail++;
      console.error(`  ❌ ${tag} ${err?.message ?? err}`);
    }
    if (DELAY_MS > 0 && idxOffset + i < rows.length - 1) {
      await sleep(DELAY_MS);
    }
  }
  return { ok, fail };
}

async function main() {
  console.log('🚀 语义索引回填 (' + (DRY_RUN ? 'DRY-RUN' : 'WRITE') + ')');
  console.log(`   并发: ${CONCURRENCY}  |  间隔: ${DELAY_MS}ms`);
  console.log('='.repeat(60));

  const rows = await prepare(`
    SELECT id, title, title_en, author, author_en, description, description_en,
           category, tags, tags_en
      FROM books
     WHERE status = 'published'
     ORDER BY created_at ASC
  `).all<BookRow>();

  console.log(`📚 待处理: ${rows.length} 本`);
  console.log('');

  if (rows.length === 0) {
    console.log('无数据,退出。');
    return;
  }

  // 简易 worker pool(默认 2 并发,失败也不中断其他)
  const lanes: BookRow[][] = Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => []);
  rows.forEach((r, i) => lanes[i % lanes.length].push(r));

  const start = Date.now();
  const results = await Promise.all(
    lanes.map((lane, i) => worker(lane, i === 0 ? 0 : lanes.slice(0, i).reduce((s, x) => s + x.length, 0))),
  );
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const ok = results.reduce((s, r) => s + r.ok, 0);
  const fail = results.reduce((s, r) => s + r.fail, 0);

  console.log('');
  console.log('='.repeat(60));
  console.log('📊 汇总');
  console.log(`  成功: ${ok}  |  失败: ${fail}  |  共: ${rows.length}  |  耗时: ${elapsed}s`);
  if (DRY_RUN) console.log('  (DRY-RUN 模式,本次未实际写入)');
  if (fail > 0) process.exitCode = 1;
}

(async () => {
  try {
    await main();
  } catch (err: any) {
    console.error('❌ 脚本执行失败:', err?.message ?? err);
    process.exit(1);
  } finally {
    try {
      await closeDb();
    } catch {
      /* ignore */
    }
  }
})();
