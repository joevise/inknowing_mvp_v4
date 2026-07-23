// @ts-nocheck
/**
 * 批量书籍操作 API
 * PUT /api/admin/books/batch - 批量上架/下架
 * DELETE /api/admin/books/batch - 批量删除
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getAllBooks, updateBook, deleteBook } from '@/lib/db/books';

/**
 * PUT /api/admin/books/batch
 * 批量上架或下架书籍
 */
export async function PUT(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '缺少书籍ID列表' },
        { status: 400 }
      );
    }

    if (!action || !['publish', 'unpublish'].includes(action)) {
      return NextResponse.json(
        { error: 'action 必须是 publish 或 unpublish' },
        { status: 400 }
      );
    }

    const status = action === 'publish' ? 'published' : 'draft';
    const successCount = ids.filter(id => {
      try {
        updateBook(id, { status });
        return true;
      } catch (error) {
        console.error(`更新书籍 ${id} 失败:`, error);
        return false;
      }
    }).length;

    return NextResponse.json({
      success: true,
      message: `成功${action === 'publish' ? '上架' : '下架'} ${successCount} 本书籍`,
      successCount,
      totalCount: ids.length,
    });

  } catch (error) {
    console.error('[API] 批量操作失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '批量操作失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/books/batch
 * 批量删除书籍
 */
export async function DELETE(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '缺少书籍ID列表' },
        { status: 400 }
      );
    }

    const successCount = ids.filter(id => {
      try {
        deleteBook(id);
        return true;
      } catch (error) {
        console.error(`删除书籍 ${id} 失败:`, error);
        return false;
      }
    }).length;

    return NextResponse.json({
      success: true,
      message: `成功删除 ${successCount} 本书籍`,
      successCount,
      totalCount: ids.length,
    });

  } catch (error) {
    console.error('[API] 批量删除失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '批量删除失败',
      },
      { status: 500 }
    );
  }
}
