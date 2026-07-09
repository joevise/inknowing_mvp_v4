/**
 * 单条邀请码操作 API
 * DELETE /api/admin/invite-codes/:id  - 删除
 * PATCH  /api/admin/invite-codes/:id  - 停用
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { deleteInviteCode, disableInviteCode, getInviteCodeById } from '@/lib/db/invite-codes';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const id = params.id;
    const existing = await getInviteCodeById(id);
    if (!existing) {
      return NextResponse.json({ error: '邀请码不存在' }, { status: 404 });
    }
    const ok = await deleteInviteCode(id);
    return NextResponse.json({ success: ok });
  } catch (error) {
    console.error('[Admin] delete invite code failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除邀请码失败' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const id = params.id;
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action !== 'disable') {
      return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
    }

    const existing = await getInviteCodeById(id);
    if (!existing) {
      return NextResponse.json({ error: '邀请码不存在' }, { status: 404 });
    }

    const updated = await disableInviteCode(id);
    return NextResponse.json({ success: true, code: updated });
  } catch (error) {
    console.error('[Admin] disable invite code failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '停用邀请码失败' },
      { status: 500 }
    );
  }
}