/**
 * 套餐管理 — Admin 接口
 */

import { db, generateId, now } from '@/lib/db/client';
import type { Plan } from '@/lib/db/schema';
import { invalidateUserCache } from '@/lib/entitlement/check';

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

export interface CreatePlanInput {
  id?: string;
  name: string;
  name_en?: string;
  description?: string;
  price_cents: number;
  currency?: string;
  billing_cycle: string;
  sort_order?: number;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UpdatePlanInput {
  name?: string;
  name_en?: string;
  description?: string;
  price_cents?: number;
  currency?: string;
  billing_cycle?: string;
  sort_order?: number;
  is_active?: boolean;
  is_default?: boolean;
}

/**
 * 创建套餐
 */
export async function createPlan(data: CreatePlanInput): Promise<Plan> {
  const id = data.id || generateId();
  const ts = now().toISOString();

  // 如果设为默认，先取消其他默认
  if (data.is_default) {
    await db()
      .prepare('UPDATE plans SET is_default = false WHERE is_default = true')
      .run();
  }

  await db()
    .prepare(
      `INSERT INTO plans (id, name, name_en, description, price_cents, currency, billing_cycle, sort_order, is_active, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      data.name,
      data.name_en ?? null,
      data.description ?? null,
      data.price_cents,
      data.currency ?? 'CNY',
      data.billing_cycle,
      data.sort_order ?? 0,
      data.is_active ?? true,
      data.is_default ?? false,
      ts,
      ts
    );

  const row = await db().prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
  return parsePlan(row);
}

/**
 * 更新套餐
 */
export async function updatePlan(id: string, data: UpdatePlanInput): Promise<Plan> {
  // 如果设为默认，先取消其他默认
  if (data.is_default) {
    await db()
      .prepare('UPDATE plans SET is_default = false WHERE is_default = true AND id != ?')
      .run(id);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
  if (data.name_en !== undefined) { updates.push('name_en = ?'); values.push(data.name_en); }
  if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
  if (data.price_cents !== undefined) { updates.push('price_cents = ?'); values.push(data.price_cents); }
  if (data.currency !== undefined) { updates.push('currency = ?'); values.push(data.currency); }
  if (data.billing_cycle !== undefined) { updates.push('billing_cycle = ?'); values.push(data.billing_cycle); }
  if (data.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(data.sort_order); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active); }
  if (data.is_default !== undefined) { updates.push('is_default = ?'); values.push(data.is_default); }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(now().toISOString());
    values.push(id);

    await db()
      .prepare(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  const row = await db().prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
  if (!row) throw new Error('套餐不存在');
  return parsePlan(row);
}

/**
 * 删除套餐（软删除：is_active=false）
 */
export async function deletePlan(id: string): Promise<void> {
  // 不允许删除默认套餐
  const row = await db().prepare('SELECT is_default FROM plans WHERE id = ?').get(id) as any;
  if (!row) throw new Error('套餐不存在');
  if (row.is_default) throw new Error('不能删除默认套餐');

  await db()
    .prepare('UPDATE plans SET is_active = false, updated_at = ? WHERE id = ?')
    .run(now().toISOString(), id);
}

/**
 * 批量更新套餐功能权限
 */
export async function updatePlanFeatures(
  planId: string,
  features: Record<string, string>
): Promise<void> {
  const ts = now().toISOString();

  // 先删除旧的，再插入新的（简单粗暴但可靠）
  await db().prepare('DELETE FROM plan_features WHERE plan_id = ?').run(planId);

  for (const [key, value] of Object.entries(features)) {
    await db()
      .prepare(
        `INSERT INTO plan_features (id, plan_id, feature_key, feature_value, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(generateId(), planId, key, value, ts);
  }

  // 清除所有用户缓存（因为套餐功能变了）
  // 保守做法：全部清除
  invalidateUserCache('__all__'); // 虽然不会匹配具体用户，但语义上表示全部失效
}

/**
 * 获取套餐的功能列表
 */
export async function getPlanFeatures(planId: string): Promise<Record<string, string>> {
  const rows = await db()
    .prepare('SELECT feature_key, feature_value FROM plan_features WHERE plan_id = ?')
    .all(planId) as any[];

  const features: Record<string, string> = {};
  for (const row of rows) {
    features[row.feature_key] = row.feature_value;
  }
  return features;
}

/**
 * 获取所有套餐（含已下架的，给 admin 用）
 */
export async function getAllPlans(): Promise<Plan[]> {
  const rows = await db()
    .prepare('SELECT * FROM plans ORDER BY sort_order ASC, price_cents ASC')
    .all() as any[];

  return rows.map(parsePlan);
}
