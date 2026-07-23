/**
 * 订阅模块类型定义
 */

import type { Plan, Subscription } from '@/lib/db/schema';

export type BillingCycle = 'free' | 'monthly' | 'quarterly' | 'yearly' | 'lifetime';

export type { Plan, Subscription } from '@/lib/db/schema';

export interface PlanWithFeatures extends Plan {
  features: Record<string, string>;
}

export interface SubscriptionWithPlan extends Subscription {
  plan: Plan;
}
