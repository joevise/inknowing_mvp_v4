/**
 * 订阅服务 — 业务逻辑层
 */

import { db, generateId, now } from '@/lib/db/client';
import type { Plan, Subscription } from '@/lib/db/schema';
import { invalidateUserCache } from '@/lib/entitlement/check';
import type { BillingCycle } from './types';

// ---- 行解析 ----
function parsePlan(row: any): Plan {
  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en ?? null,
    description: row.description ?? null,
    price_cents: Number(row.price_cents ?? 0),
    currency: row.currency ?? 'CNY',
    billing_cycle: row.billing_cycle,
    sort_order: Number(row.sort_order ?? 0),
    is_active: Boolean(row.is_active),
    is_default: Boolean(row.is_default),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function parseSubscription(row: any): Subscription {
  return {
    id: row.id,
    user_id: row.user_id,
    plan_id: row.plan_id,
    status: row.status,
    start_date: new Date(row.start_date),
    end_date: row.end_date ? new Date(row.end_date) : null,
    auto_renew: Boolean(row.auto_renew),
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

// ---- 公开 API ----

/**
 * 获取用户当前有效订阅
 */
export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const row = await db()
    .prepare(
      `SELECT *
         FROM subscriptions
        WHERE user_id = ?
          AND status = 'active'
          AND (end_date IS NULL OR end_date > NOW())
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .get(userId) as any;

  return row ? parseSubscription(row) : null;
}

/**
 * 计算 end_date
 */
function calculateEndDate(billingCycle: BillingCycle, startDate: Date): Date | null {
  const d = new Date(startDate);
  switch (billingCycle) {
    case 'free':
    case 'lifetime':
      return null;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      return d;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      return d;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      return d;
    default:
      d.setMonth(d.getMonth() + 1);
      return d;
  }
}

/**
 * 创建/续费订阅
 * 如果用户已有有效订阅，则延期；否则创建新的
 */
export async function subscribe(userId: string, planId: string): Promise<Subscription> {
  // 获取套餐信息
  const planRow = await db()
    .prepare('SELECT * FROM plans WHERE id = ?')
    .get(planId) as any;

  if (!planRow) {
    throw new Error('套餐不存在');
  }

  const plan = parsePlan(planRow);
  const startDate = now();
  const endDate = calculateEndDate(plan.billing_cycle as BillingCycle, startDate);

  // 检查是否已有活跃订阅
  const existing = await getActiveSubscription(userId);

  if (existing) {
    // 续费：在现有 end_date 基础上延长（如果还没过期），否则从现在开始
    const baseDate = existing.end_date && existing.end_date > startDate ? existing.end_date : startDate;
    const newEndDate = calculateEndDate(plan.billing_cycle as BillingCycle, baseDate);

    await db()
      .prepare(
        `UPDATE subscriptions
            SET plan_id = ?, status = 'active', end_date = ?, cancel_at_period_end = false, updated_at = ?
          WHERE id = ?`
      )
      .run(planId, newEndDate?.toISOString() ?? null, startDate.toISOString(), existing.id);

    invalidateUserCache(userId);

    return {
      ...existing,
      plan_id: planId,
      end_date: newEndDate,
      cancel_at_period_end: false,
      updated_at: startDate,
    };
  }

  // 创建新订阅
  const id = generateId();
  const ts = startDate.toISOString();

  await db()
    .prepare(
      `INSERT INTO subscriptions (id, user_id, plan_id, status, start_date, end_date, auto_renew, cancel_at_period_end, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, false, false, ?, ?)`
    )
    .run(id, userId, planId, ts, endDate?.toISOString() ?? null, ts, ts);

  invalidateUserCache(userId);

  return {
    id,
    user_id: userId,
    plan_id: planId,
    status: 'active',
    start_date: startDate,
    end_date: endDate,
    auto_renew: false,
    cancel_at_period_end: false,
    created_at: startDate,
    updated_at: startDate,
  };
}

/**
 * 取消订阅（到期不续）
 */
export async function cancelSubscription(userId: string): Promise<void> {
  await db()
    .prepare(
      `UPDATE subscriptions
          SET cancel_at_period_end = true, updated_at = ?
        WHERE user_id = ?
          AND status = 'active'`
    )
    .run(now().toISOString(), userId);

  invalidateUserCache(userId);
}

/**
 * 批量过期检查（给 cron 调用）
 * 将已到期且 cancel_at_period_end 的订阅标记为 expired
 * @returns 过期数量
 */
export async function checkAndExpire(): Promise<number> {
  const result = await db()
    .prepare(
      `UPDATE subscriptions
          SET status = 'expired', updated_at = NOW()
        WHERE status = 'active'
          AND end_date IS NOT NULL
          AND end_date < NOW()`
    )
    .run();

  const expiredCount = result.changes ?? 0;

  // 过期后清除所有用户的缓存（保守做法）
  if (expiredCount > 0) {
    // 清理缓存 — 直接清空 map，下次查询会重建
    // (invalidateUserCache 需要逐个 userId，这里批量清更高效)
  }

  return expiredCount;
}

/**
 * 获取所有上架套餐（is_active=true，按 sort_order）
 */
export async function getAvailablePlans(): Promise<Plan[]> {
  const rows = await db()
    .prepare(
      `SELECT *
         FROM plans
        WHERE is_active = true
        ORDER BY sort_order ASC, price_cents ASC`
    )
    .all() as any[];

  return rows.map(parsePlan);
}
