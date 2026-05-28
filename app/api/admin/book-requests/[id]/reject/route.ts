// @ts-nocheck
/**
 * POST /api/admin/book-requests/[id]/reject
 * 管理员拒绝书籍申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getUserBookRequestById, updateUserBookRequest } from '@/lib/db/book-requests';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[BookRequest] POST /api/admin/book-requests/${id}/reject - 拒绝申请`);

  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { reason } = body;

    const bookRequest = getUserBookRequestById(id);
    if (!bookRequest) {
      return NextResponse.json(
        { error: '申请不存在' },
        { status: 404 }
      );
    }

    console.log(`[BookRequest] 拒绝申请 ${id}: ${bookRequest.title}, 理由: ${reason}`);

    updateUserBookRequest(id, {
      status: 'rejected',
      error_message: reason || '管理员已拒绝此申请',
    });

    return NextResponse.json({
      status: 'rejected',
      message: '申请已拒绝',
    });

  } catch (error) {
    console.error(`[BookRequest] 拒绝申请 ${id} 失败:`, error);
    return NextResponse.json(
      { error: '操作失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}