/**
 * 角色召唤日志表 CRUD
 * 用于"召唤书中角色"功能的每日配额统计与审计。
 * 配额规则:
 *   - 每个用户每天 (UTC) 最多 N 次"真正触发 AI 生成"的召唤
 *   - 命中全局去重(existed)与 AI 校验未通过(not_in_book)不计入配额
 */

import { db, generateId, now } from './client';
import type { CharacterSummonLog } from './schema';

export type SummonMode = 'main_cast' | 'named';
export type SummonStatus = 'success' | 'failed' | 'existed';

export interface CreateSummonLogInput {
  user_id: string;
  book_id: string;
  mode: SummonMode;
  character_name?: string | null;
  status: SummonStatus;
}

/**
 * 写入一条召唤日志
 */
export async function createSummonLog(input: CreateSummonLogInput): Promise<CharacterSummonLog> {
  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO character_summon_logs (
      id, user_id, book_id, mode, character_name, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  await stmt.run(
    id,
    input.user_id,
    input.book_id,
    input.mode,
    input.character_name ?? null,
    input.status,
    timestamp
  );

  return (await getSummonLogById(id))!;
}

/**
 * 通过 ID 获取日志
 */
export async function getSummonLogById(id: string): Promise<CharacterSummonLog | null> {
  const row = await db()
    .prepare('SELECT * FROM character_summon_logs WHERE id = ?')
    .get(id) as any;

  if (!row) return null;

  return parseRow(row);
}

/**
 * 统计某用户当天 UTC 范围内的"计费"召唤次数
 * (只统计 status='success',因为 failed/existed 不消耗配额)
 */
export async function countUserSummonsToday(userId: string): Promise<number> {
  // PG 与 SQLite 通用:DATE_TRUNC('day', created_at AT TIME ZONE 'UTC') =
  // DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
  const row = await db()
    .prepare(`
      SELECT COUNT(*) as count
      FROM character_summon_logs
      WHERE user_id = ?
        AND status = 'success'
        AND DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')
          = DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
    `)
    .get(userId) as any;

  return Number(row?.count ?? 0);
}

async function parseRow(row: any): Promise<CharacterSummonLog> {
  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    mode: row.mode,
    character_name: row.character_name,
    status: row.status,
    created_at: new Date(row.created_at),
  };
}