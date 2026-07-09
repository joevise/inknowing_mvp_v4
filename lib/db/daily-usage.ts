/**
 * 每日对话配额表
 * 记录每个用户当天已发送消息条数,用于频率限制(每用户每天 20 轮)。
 * 每日 0 点(UTC)随 usage_date 自然滚动,无需定时任务清理。
 */

import { db, generateId, now } from './client';
import type { DailyUsage } from './schema';

export const DAILY_MESSAGE_LIMIT = 20;

async function parseRow(row: any): Promise<DailyUsage> {
  return {
    id: row.id,
    user_id: row.user_id,
    usage_date:
      row.usage_date instanceof Date
        ? row.usage_date.toISOString().slice(0, 10)
        : String(row.usage_date),
    message_count: Number(row.message_count ?? 0),
    created_at: new Date(row.created_at),
  };
}

/**
 * 获取用户今日已用条数
 * 没有记录返回 0
 */
export async function getTodayUsage(userId: string): Promise<number> {
  const row = await db()
    .prepare(
      `SELECT message_count
         FROM daily_usage
        WHERE user_id = ?
          AND usage_date = CURRENT_DATE`
    )
    .get(userId) as any;
  return Number(row?.message_count ?? 0);
}

/**
 * UPSERT: 用户当天的计数 +1,返回新的总数
 * 若当天记录不存在则创建
 */
export async function incrementUsage(userId: string): Promise<number> {
  const row = await db()
    .prepare(
      `SELECT id, message_count
         FROM daily_usage
        WHERE user_id = ?
          AND usage_date = CURRENT_DATE`
    )
    .get(userId) as any;

  if (row) {
    const newCount = Number(row.message_count ?? 0) + 1;
    await db()
      .prepare(
        `UPDATE daily_usage
            SET message_count = ?
          WHERE id = ?`
      )
      .run(newCount, row.id);
    return newCount;
  }

  const id = generateId();
  const ts = now().toISOString();
  await db()
    .prepare(
      `INSERT INTO daily_usage (id, user_id, usage_date, message_count, created_at)
       VALUES (?, ?, CURRENT_DATE, 1, ?)`
    )
    .run(id, userId, ts);
  return 1;
}

/**
 * 获取用户当天的完整记录(便于展示进度条等)
 */
export async function getTodayUsageRecord(userId: string): Promise<DailyUsage | null> {
  const row = await db()
    .prepare(
      `SELECT *
         FROM daily_usage
        WHERE user_id = ?
          AND usage_date = CURRENT_DATE`
    )
    .get(userId) as any;
  if (!row) return null;
  return parseRow(row);
}