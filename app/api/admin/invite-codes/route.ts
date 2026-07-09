/**
 * 邀请码管理 API
 * GET  /api/admin/invite-codes      - 列表
 * POST /api/admin/invite-codes      - 创建单条或批量
 *   - body: { note?: string }                       -> 单条创建
 *   - body: { action: 'batch', count, notePrefix }  -> 批量创建(count 上限 200)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import {
  batchCreateInviteCodes,
  createInviteCode,
  listInviteCodes,
} from '@/lib/db/invite-codes';

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
    const action = body?.action;

    if (action === 'batch') {
      const count = Number(body?.count ?? 10);
      if (!Number.isInteger(count) || count < 1) {
        return NextResponse.json(
          { error: 'count 必须为正整数' },
          { status: 400 }
        );
      }
      if (count > 200) {
        return NextResponse.json(
          { error: '单次批量最多 200 个邀请码' },
          { status: 400 }
        );
      }
      const notePrefix =
        typeof body?.notePrefix === 'string'
          ? body.notePrefix.trim().slice(0, 200)
          : '';
      const codes = await batchCreateInviteCodes(count, notePrefix);
      return NextResponse.json({ success: true, codes }, { status: 201 });
    }

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