/**
 * PATCH /api/admin/books/[id]/status
 * 更新书籍状态（上架/下架）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getBookById, updateBook } from '@/lib/services/book-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/books/:id/status
 * 切换书籍上架/下架状态
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();

    // 验证状态值
    if (!body.status || !['online', 'offline'].includes(body.status)) {
      return NextResponse.json(
        { error: '无效的状态值，必须为 online 或 offline' },
        { status: 400 }
      );
    }

    // 检查书籍是否存在
    const book = await getBookById(id);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 映射状态值（API使用online/offline，数据库使用published/draft）
    const dbStatus = body.status === 'online' ? 'published' : 'draft';

    // 更新状态
    console.log(`[Admin] Updating book ${id} status from ${book.status} to ${dbStatus}`);
    const updatedBook = await updateBook(id, { status: dbStatus });

    if (!updatedBook) {
      return NextResponse.json(
        { error: '更新书籍状态失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      book: {
        id: updatedBook.id,
        title: updatedBook.title,
        status: updatedBook.status === 'published' ? 'online' : 'offline',
        updated_at: updatedBook.updated_at
      }
    });
  } catch (error) {
    console.error('[Admin] Update book status error:', error);
    return NextResponse.json(
      { error: '更新书籍状态失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/books/:id/status
 * 更新书籍状态（符合API规范的备用方法）
 */
export async function PUT(request: NextRequest, params: RouteParams) {
  return PATCH(request, params);
}