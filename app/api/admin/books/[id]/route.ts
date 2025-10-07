/**
 * /api/admin/books/[id]
 * GET - 获取书籍详情
 * PUT - 更新书籍信息
 * DELETE - 删除书籍
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import {
  getBookById,
  updateBook,
  deleteBook,
  getBookCharacters
} from '@/lib/services/book-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/books/:id
 * 获取书籍详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    // 获取书籍信息
    const book = await getBookById(id);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 获取角色列表
    const characters = await getBookCharacters(id);

    return NextResponse.json({
      ...book,
      character_count: characters.length,
      characters: characters
    });
  } catch (error) {
    console.error('[Admin] Get book detail error:', error);
    return NextResponse.json(
      { error: '获取书籍详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/books/:id
 * 更新书籍信息
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();

    // 检查书籍是否存在
    const existingBook = await getBookById(id);
    if (!existingBook) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 准备更新数据
    const updates: any = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.author !== undefined) updates.author = body.author;
    if (body.description !== undefined) updates.description = body.description;
    if (body.cover_url !== undefined) updates.cover_url = body.cover_url;
    if (body.category !== undefined) updates.category = body.category;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.ai_score !== undefined) updates.ai_knowledge_level = body.ai_score;
    if (body.conversation_strategy !== undefined) {
      updates.conversation_strategy = body.conversation_strategy;
    }
    if (body.status !== undefined) updates.status = body.status;

    // 更新书籍
    console.log(`[Admin] Updating book ${id}:`, updates);
    const updatedBook = await updateBook(id, updates);

    if (!updatedBook) {
      return NextResponse.json(
        { error: '更新书籍失败' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedBook);
  } catch (error) {
    console.error('[Admin] Update book error:', error);
    return NextResponse.json(
      { error: '更新书籍失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/books/:id
 * 删除书籍及其所有相关数据
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    // 检查书籍是否存在
    const book = await getBookById(id);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 删除书籍（会级联删除相关数据）
    console.log(`[Admin] Deleting book ${id}: ${book.title}`);
    const success = await deleteBook(id);

    if (!success) {
      return NextResponse.json(
        { error: '删除书籍失败' },
        { status: 500 }
      );
    }

    // 返回204 No Content表示成功删除
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Admin] Delete book error:', error);
    return NextResponse.json(
      { error: '删除书籍失败' },
      { status: 500 }
    );
  }
}