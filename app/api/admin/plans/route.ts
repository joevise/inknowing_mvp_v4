/**
 * 套餐管理 API（Admin）
 * GET  /api/admin/plans       - 列出所有套餐
 * POST /api/admin/plans       - 创建套餐
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import {
  createPlan,
  getAllPlans,
  type CreatePlanInput,
} from '@/lib/subscription/admin';

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const plans = await getAllPlans();
    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error('[Admin] list plans failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取套餐列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    const data: CreatePlanInput = {
      name: body.name,
      name_en: body.name_en,
      description: body.description,
      price_cents: parseInt(body.price_cents, 10) || 0,
      currency: body.currency || 'CNY',
      billing_cycle: body.billing_cycle || 'monthly',
      sort_order: parseInt(body.sort_order, 10) || 0,
      is_active: body.is_active ?? true,
      is_default: body.is_default ?? false,
    };

    if (!data.name) {
      return NextResponse.json({ error: '套餐名称不能为空' }, { status: 400 });
    }

    const plan = await createPlan(data);
    return NextResponse.json({ success: true, plan }, { status: 201 });
  } catch (error) {
    console.error('[Admin] create plan failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建套餐失败' },
      { status: 500 }
    );
  }
}
