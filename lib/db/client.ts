/**
 * PostgreSQL 异步客户端 + better-sqlite3 兼容适配层
 *
 * 设计目标(承重墙):保持与原 better-sqlite3 完全一致的调用面
 *   db().prepare(sql).get(...args)   -> Promise<row | undefined>
 *   db().prepare(sql).all(...args)   -> Promise<row[]>
 *   db().prepare(sql).run(...args)   -> Promise<{ changes, lastInsertRowid }>
 *   transaction(fn)                   -> Promise<T>  (基于 AsyncLocalStorage 绑定连接)
 *
 * 这样 lib/db/*.ts 的迁移是"纯机械加 await",不触碰业务逻辑,
 * 用 `tsc --noEmit` 编译错误作为漏 await 的客观裁判。
 *
 * 规模前瞻:连接池(max=20,可经 PG_POOL_MAX 调)、参数化全程、
 * 占位符 ?->$N 在适配层统一转换。面向 10万级用户与并发隔离设计。
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { PG_SCHEMA_SQL, PG_TRIGGERS_SQL } from './schema';

// ---- 连接池 ----
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'inknowing'}:${process.env.PGPASSWORD || 'inknowing'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || '5433'}/${process.env.PGDATABASE || 'inknowing'}`;

const pool = new Pool({
  connectionString,
  max: parseInt(process.env.PG_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[PG] idle client error:', err.message);
});

// 事务上下文:在 transaction() 内执行的所有查询自动复用同一连接
const txStorage = new AsyncLocalStorage<PoolClient>();

// ---- Schema 引导(幂等,单例 promise 防并发竞态) ----
let schemaReady: Promise<void> | null = null;

async function bootstrapSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(PG_SCHEMA_SQL);
    await client.query(PG_TRIGGERS_SQL);
    // 虚拟 admin 用户(用于管理员 session)
    const r = await client.query('SELECT id FROM users WHERE id = $1', ['admin']);
    if (r.rowCount === 0) {
      const ts = new Date().toISOString();
      await client.query(
        `INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        ['admin', 'admin', 'admin@system', '', ts, ts]
      );
      console.log('[PG] Virtual admin user ensured');
    }
    console.log('[PG] Schema ensured');
  } finally {
    client.release();
  }
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = bootstrapSchema();
  return schemaReady;
}

// ---- 占位符转换: ? -> $1,$2,...  ----
// 本代码库 SQL 均为干净参数化(无字符串内字面量 ?),逐个递增即可,
// 且与 better-sqlite3 的位置参数语义 1:1 对齐。
function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ---- 底层执行:优先用事务连接,否则用池 ----
async function execSql(sql: string, params: any[]): Promise<QueryResult> {
  await ensureSchema();
  const pgSql = toPgPlaceholders(sql);
  const client = txStorage.getStore();
  if (client) return client.query(pgSql, params);
  return pool.query(pgSql, params);
}

// 事务内部使用(不重复 ensureSchema,避免引导期自引用)
async function execRaw(sql: string, params: any[]): Promise<QueryResult> {
  const pgSql = toPgPlaceholders(sql);
  const client = txStorage.getStore();
  if (client) return client.query(pgSql, params);
  return pool.query(pgSql, params);
}

// ---- better-sqlite3 兼容的 Statement ----
class AsyncStatement {
  constructor(private readonly sql: string) {}

  async get<T = any>(...params: any[]): Promise<T | undefined> {
    const r = await execSql(this.sql, params);
    return (r.rows[0] as T) ?? undefined;
  }

  async all<T = any>(...params: any[]): Promise<T[]> {
    const r = await execSql(this.sql, params);
    return r.rows as T[];
  }

  async run(...params: any[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const r = await execSql(this.sql, params);
    return { changes: r.rowCount ?? 0, lastInsertRowid: 0 };
  }
}

// db() 返回的适配对象,保持 .prepare()/.exec() 调用面
const adapter = {
  prepare(sql: string): AsyncStatement {
    return new AsyncStatement(sql);
  },
  async exec(sql: string): Promise<void> {
    await ensureSchema();
    await pool.query(sql);
  },
};

export type DbAdapter = typeof adapter;

// ---- 导出面(与原 better-sqlite3 client.ts 完全一致) ----
export const db = (): DbAdapter => adapter;

export function prepare(sql: string): AsyncStatement {
  return new AsyncStatement(sql);
}

/**
 * 事务:基于 AsyncLocalStorage 绑定单连接。
 * 支持嵌套(已在事务内则复用,不再 BEGIN)。
 * 注意:回调现在是 async,内部每个 db 调用都需 await。
 */
export async function transaction<T>(
  fn: (db: DbAdapter) => T | Promise<T>
): Promise<T> {
  await ensureSchema();
  const existing = txStorage.getStore();
  if (existing) {
    // 已在事务中,复用当前连接,不重复开启
    return await fn(adapter);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await txStorage.run(client, async () => await fn(adapter));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback error */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

/**
 * 重置数据库(危险,仅测试用)
 */
export async function resetDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS conversations CASCADE;
      DROP TABLE IF EXISTS favorites CASCADE;
      DROP TABLE IF EXISTS documents CASCADE;
      DROP TABLE IF EXISTS characters CASCADE;
      DROP TABLE IF EXISTS character_summon_logs CASCADE;
      DROP TABLE IF EXISTS user_memories CASCADE;
      DROP TABLE IF EXISTS user_book_requests CASCADE;
      DROP TABLE IF EXISTS daily_usage CASCADE;
      DROP TABLE IF EXISTS invite_codes CASCADE;
      DROP TABLE IF EXISTS copyright_reports CASCADE;
      DROP TABLE IF EXISTS books CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS config CASCADE;
    `);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  schemaReady = null;
  await ensureSchema();
  console.log('[PG] Database reset');
}

// ---- 辅助函数(保持原有签名) ----

// 生产级 UUID(替换原 Math.random 实现,满足规模/安全要求)
export function generateId(): string {
  return randomUUID();
}

export function now(): Date {
  return new Date();
}

export function parseJson<T = any>(json: string | null): T | null {
  if (json === null || json === undefined) return null;
  if (typeof json === 'object') return json as T; // PG 可能已返回对象
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function toJson(obj: any): string | null {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

export default { db, prepare, transaction, closeDb, resetDb };
