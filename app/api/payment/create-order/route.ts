/**
 * 创建支付订单
 * POST /api/payment/create-order
 * body: { planId, provider: 'wechat'|'alipay'|'stripe'|'mock' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { createOrder } from '@/lib/payment/service';

export async function POST(request: NextRequest) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { planId, provider } = body;

    if (!planId || !provider) {
      return NextResponse.json(
        { error: '缺少参数: planId, provider' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const { order, payResult } = await createOrder(userId, planId, provider);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      ...payResult,
    });
  } catch (error) {
    console.error('[Payment] create-order failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建订单失败' },
      { status: 500 }
    );
  }
}
