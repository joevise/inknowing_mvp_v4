/**
 * 套餐功能权限批量更新 API（Admin）
 * PUT /api/admin/plans/[id]/features
 * body: { features: { key: value, ... } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { updatePlanFeatures } from '@/lib/subscription/admin';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { features } = body;

    if (!features || typeof features !== 'object') {
      return NextResponse.json(
        { error: 'features 必须是 key-value 对象' },
        { status: 400 }
      );
    }

    await updatePlanFeatures(params.id, features);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] update plan features failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新功能权限失败' },
      { status: 500 }
    );
  }
}
