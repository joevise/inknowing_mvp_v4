/**
 * 邀请码管理 API
 * GET  /api/admin/invite-codes      - 列表
 * POST /api/admin/invite-codes      - 创建(可选 note)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { createInviteCode, listInviteCodes } from '@/lib/db/invite-codes';

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const codes = await listInviteCodes();
    return NextResponse.json({ success: true, codes });
  } catch (error) {
    console.error('[Admin] list invite codes failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取邀请码列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : undefined;
    const created = await createInviteCode(note);
    return NextResponse.json({ success: true, code: created }, { status: 201 });
  } catch (error) {
    console.error('[Admin] create invite code failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建邀请码失败' },
      { status: 500 }
    );
  }
}