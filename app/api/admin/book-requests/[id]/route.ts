// @ts-nocheck
/**
 * DELETE /api/admin/book-requests/[id]
 * 管理员删除书籍申请记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getUserBookRequestById, deleteUserBookRequest } from '@/lib/db/book-requests';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[BookRequest] DELETE /api/admin/book-requests/${id} - 删除申请`);

  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const bookRequest = await getUserBookRequestById(id);
    if (!bookRequest) {
      return NextResponse.json(
        { error: '申请不存在' },
        { status: 404 }
      );
    }

    console.log(`[BookRequest] 删除申请 ${id}: ${bookRequest.title}`);

    await deleteUserBookRequest(id);

    return NextResponse.json({
      message: '删除成功',
    });

  } catch (error) {
    console.error(`[BookRequest] 删除申请 ${id} 失败:`, error);
    return NextResponse.json(
      { error: '删除失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}