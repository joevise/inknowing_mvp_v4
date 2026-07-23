/**
 * 获取当前用户订阅状态
 * GET /api/subscription/current
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getActiveSubscription, getAvailablePlans } from '@/lib/subscription/service';
import { getUserFeatures, getUserPlan } from '@/lib/entitlement/check';
import { getPlanFeatures } from '@/lib/subscription/admin';

export async function GET(request: NextRequest) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  try {
    const userId = session.user.id;

    const [subscription, plan, features, availablePlans] = await Promise.all([
      getActiveSubscription(userId),
      getUserPlan(userId),
      getUserFeatures(userId),
      getAvailablePlans(),
    ]);

    // 当前套餐的功能权限
    const currentPlanFeatures = await getPlanFeatures(plan.id);

    return NextResponse.json({
      success: true,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            startDate: subscription.start_date,
            endDate: subscription.end_date,
            autoRenew: subscription.auto_renew,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          }
        : null,
      currentPlan: {
        id: plan.id,
        name: plan.name,
        nameEn: plan.name_en,
        billingCycle: plan.billing_cycle,
        priceCents: plan.price_cents,
        currency: plan.currency,
      },
      features,
      planFeatures: currentPlanFeatures,
      availablePlans: availablePlans.map(p => ({
        id: p.id,
        name: p.name,
        nameEn: p.name_en,
        description: p.description,
        priceCents: p.price_cents,
        currency: p.currency,
        billingCycle: p.billing_cycle,
      })),
    });
  } catch (error) {
    console.error('[Subscription] current failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取订阅信息失败' },
      { status: 500 }
    );
  }
}
