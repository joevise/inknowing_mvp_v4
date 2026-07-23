/**
 * 公开 API：获取所有上架套餐及功能
 * GET /api/plans
 * 无需认证
 */

import { NextResponse } from 'next/server';
import { getAvailablePlans } from '@/lib/subscription/service';
import { getPlanFeatures } from '@/lib/subscription/admin';

export async function GET() {
  try {
    const plans = await getAvailablePlans();

    const plansWithFeatures = await Promise.all(
      plans.map(async (plan) => {
        const features = await getPlanFeatures(plan.id);
        return {
          id: plan.id,
          name: plan.name,
          nameEn: plan.name_en,
          description: plan.description,
          priceCents: plan.price_cents,
          currency: plan.currency,
          billingCycle: plan.billing_cycle,
          sortOrder: plan.sort_order,
          isDefault: plan.is_default,
          features,
        };
      })
    );

    return NextResponse.json({ plans: plansWithFeatures });
  } catch (error) {
    console.error('[API /plans] Failed to fetch plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}
