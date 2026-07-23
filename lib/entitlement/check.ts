/**
 * 权限检查模块
 * 业务层统一入口：所有功能权限检查都走这里
 *
 * 缓存策略：简单的 Map + 30秒 TTL，避免每次都查库
 */

import { db, generateId, now } from '@/lib/db/client';
import type { Plan, PlanFeature } from '@/lib/db/schema';
import { getTodayUsage } from '@/lib/db/daily-usage';
import type { FeatureKey, PlanFeatures, CheckResult } from './types';

// ---- 缓存 ----
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const planCache = new Map<string, CacheEntry<Plan>>();
const featuresCache = new Map<string, CacheEntry<PlanFeatures>>();
const CACHE_TTL_MS = 30_000; // 30秒

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttl = CACHE_TTL_MS): void {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

function getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

/** 清除指定用户的缓存（修改订阅后调用） */
export function invalidateUserCache(userId: string): void {
  planCache.delete(userId);
  featuresCache.delete(userId);
}

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

/** 默认免费功能集 */
const DEFAULT_FREE_FEATURES: PlanFeatures = {
  daily_message_limit: 20,
  max_active_characters: 1,
  premium_books: false,
  custom_characters: false,
  multi_language: false,
  advanced_models: false,
};

// ---- 公开 API ----

/**
 * 查用户当前套餐
 * 先查 subscriptions 表有效订阅，无则返回默认免费套餐
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const cached = getCache(planCache, userId);
  if (cached) return cached;

  // 查有效订阅
  const subRow = await db()
    .prepare(
      `SELECT p.*
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = ?
          AND s.status = 'active'
          AND (s.end_date IS NULL OR s.end_date > NOW())
        ORDER BY s.created_at DESC
        LIMIT 1`
    )
    .get(userId) as any;

  let plan: Plan;

  if (subRow) {
    plan = parsePlan(subRow);
  } else {
    // 查默认免费套餐
    const defaultRow = await db()
      .prepare(
        `SELECT * FROM plans WHERE is_default = true AND is_active = true LIMIT 1`
      )
      .get() as any;

    if (defaultRow) {
      plan = parsePlan(defaultRow);
    } else {
      // 极端 fallback：硬编码免费套餐
      plan = {
        id: 'plan_free',
        name: '免费',
        name_en: 'Free',
        description: null,
        price_cents: 0,
        currency: 'CNY',
        billing_cycle: 'free',
        sort_order: 0,
        is_active: true,
        is_default: true,
        created_at: new Date(0),
        updated_at: new Date(0),
      };
    }
  }

  setCache(planCache, userId, plan);
  return plan;
}

/**
 * 拿到套餐对应的功能配置
 */
export async function getUserFeatures(userId: string): Promise<PlanFeatures> {
  const cached = getCache(featuresCache, userId);
  if (cached) return cached;

  const plan = await getUserPlan(userId);

  const rows = await db()
    .prepare(
      `SELECT feature_key, feature_value
         FROM plan_features
        WHERE plan_id = ?`
    )
    .all(plan.id) as any[];

  const features: PlanFeatures = { ...DEFAULT_FREE_FEATURES };

  for (const row of rows) {
    const key = row.feature_key as string;
    const val = row.feature_value as string;

    // 尝试解析为数字或布尔
    if (val === 'true') {
      (features as any)[key] = true;
    } else if (val === 'false') {
      (features as any)[key] = false;
    } else if (/^-?\d+$/.test(val)) {
      (features as any)[key] = parseInt(val, 10);
    } else {
      (features as any)[key] = val;
    }
  }

  setCache(featuresCache, userId, features);
  return features;
}

/**
 * 检查单个权限
 */
export async function checkPermission(
  userId: string,
  feature: FeatureKey
): Promise<CheckResult> {
  const features = await getUserFeatures(userId);
  const val = features[feature];

  // 布尔型权限
  if (typeof val === 'boolean') {
    return {
      allowed: val,
      reason: val ? undefined : `当前套餐不支持「${feature}」`,
    };
  }

  // 数字型权限（-1 = 无限）
  if (typeof val === 'number') {
    if (val === -1) {
      return { allowed: true, limit: -1 };
    }
    return { allowed: true, limit: val };
  }

  return { allowed: false, reason: '未知权限' };
}

/**
 * 专门查每日消息限额（结合 daily_usage 表）
 */
export async function checkDailyLimit(userId: string): Promise<CheckResult> {
  const features = await getUserFeatures(userId);
  const limit = features.daily_message_limit;

  if (limit === -1) {
    return { allowed: true, limit: -1 };
  }

  const used = await getTodayUsage(userId);

  if (used >= limit) {
    return {
      allowed: false,
      limit,
      current: used,
      reason: `今日消息已达上限（${limit}条），升级套餐可解锁无限对话`,
    };
  }

  return { allowed: true, limit, current: used };
}

/**
 * 检查角色数量限制
 * （当前仅检查限额，不实际查活跃角色数 — 后续按需补充）
 */
export async function checkCharacterLimit(userId: string): Promise<CheckResult> {
  const features = await getUserFeatures(userId);
  const limit = features.max_active_characters;

  if (limit === -1) {
    return { allowed: true, limit: -1 };
  }

  // TODO: 实际查用户的活跃角色数，暂返回限额
  return { allowed: true, limit };
}
