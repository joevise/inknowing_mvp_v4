/**
 * 套餐详情管理 API（Admin）
 * GET    /api/admin/plans/[id]  - 获取套餐详情
 * PUT    /api/admin/plans/[id]  - 更新套餐
 * DELETE /api/admin/plans/[id]  - 删除（软删除）套餐
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import {
  updatePlan,
  deletePlan,
  getPlanFeatures,
  getAllPlans,
  type UpdatePlanInput,
} from '@/lib/subscription/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const plans = await getAllPlans();
    const plan = plans.find(p => p.id === params.id);

    if (!plan) {
      return NextResponse.json({ error: '套餐不存在' }, { status: 404 });
    }

    const features = await getPlanFeatures(plan.id);

    return NextResponse.json({ success: true, plan, features });
  } catch (error) {
    console.error('[Admin] get plan failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取套餐失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const data: UpdatePlanInput = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.name_en !== undefined) data.name_en = body.name_en;
    if (body.description !== undefined) data.description = body.description;
    if (body.price_cents !== undefined) data.price_cents = parseInt(body.price_cents, 10);
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.billing_cycle !== undefined) data.billing_cycle = body.billing_cycle;
    if (body.sort_order !== undefined) data.sort_order = parseInt(body.sort_order, 10);
    if (body.is_active !== undefined) data.is_active = body.is_active;
    if (body.is_default !== undefined) data.is_default = body.is_default;

    const plan = await updatePlan(params.id, data);
    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('[Admin] update plan failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新套餐失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await deletePlan(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] delete plan failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除套餐失败' },
      { status: 500 }
    );
  }
}
