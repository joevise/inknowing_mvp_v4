/**
 * 默认套餐 seed 数据
 * 在 DB 初始化后调用，创建免费/月度/年度三档套餐
 */

import { db, generateId, now } from '@/lib/db/client';

interface SeedPlan {
  id: string;
  name: string;
  name_en: string;
  description: string;
  price_cents: number;
  currency: string;
  billing_cycle: 'free' | 'monthly' | 'yearly';
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  features: Record<string, string>;
}

const SEED_PLANS: SeedPlan[] = [
  {
    id: 'plan_free',
    name: '免费',
    name_en: 'Free',
    description: '体验基础对话功能',
    price_cents: 0,
    currency: 'CNY',
    billing_cycle: 'free',
    sort_order: 0,
    is_active: true,
    is_default: true,
    features: {
      daily_message_limit: '20',
      max_active_characters: '1',
      premium_books: 'false',
      custom_characters: 'false',
      multi_language: 'false',
      advanced_models: 'false',
    },
  },
  {
    id: 'plan_monthly',
    name: '月度会员',
    name_en: 'Monthly',
    description: '无限对话 + 全部角色',
    price_cents: 2900,
    currency: 'CNY',
    billing_cycle: 'monthly',
    sort_order: 1,
    is_active: true,
    is_default: false,
    features: {
      daily_message_limit: '-1',
      max_active_characters: '-1',
      premium_books: 'true',
      custom_characters: 'true',
      multi_language: 'false',
      advanced_models: 'false',
    },
  },
  {
    id: 'plan_yearly',
    name: '年度会员',
    name_en: 'Yearly',
    description: '全部功能解锁，最超值',
    price_cents: 29900,
    currency: 'CNY',
    billing_cycle: 'yearly',
    sort_order: 2,
    is_active: true,
    is_default: false,
    features: {
      daily_message_limit: '-1',
      max_active_characters: '-1',
      premium_books: 'true',
      custom_characters: 'true',
      multi_language: 'true',
      advanced_models: 'true',
    },
  },
];

/**
 * 初始化默认套餐（幂等：已存在的跳过）
 */
export async function seedDefaultPlans(): Promise<void> {
  const ts = now().toISOString();

  for (const plan of SEED_PLANS) {
    // 检查是否已存在
    const existing = await db()
      .prepare('SELECT id FROM plans WHERE id = ?')
      .get(plan.id) as any;

    if (existing) continue;

    // 插入套餐
    await db()
      .prepare(
        `INSERT INTO plans (id, name, name_en, description, price_cents, currency, billing_cycle, sort_order, is_active, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        plan.id, plan.name, plan.name_en, plan.description,
        plan.price_cents, plan.currency, plan.billing_cycle,
        plan.sort_order, plan.is_active, plan.is_default, ts, ts
      );

    // 插入功能
    for (const [key, value] of Object.entries(plan.features)) {
      await db()
        .prepare(
          `INSERT INTO plan_features (id, plan_id, feature_key, feature_value, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(generateId(), plan.id, key, value, ts);
    }

    console.log(`[Seed] Plan "${plan.name}" (${plan.id}) created`);
  }
}
