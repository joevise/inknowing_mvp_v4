/**
 * AI识别书籍 API
 * POST /api/admin/books/identify
 *
 * 根据书名使用AI识别书籍信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { recognizeBook } from '@/lib/services/book-service';

export async function POST(request: NextRequest) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { bookTitle } = await request.json();

    if (!bookTitle || typeof bookTitle !== 'string' || bookTitle.trim().length === 0) {
      return NextResponse.json(
        { error: '请提供书籍名称' },
        { status: 400 }
      );
    }

    console.log('[Admin Book Identify API] Identifying book:', bookTitle);

    // 调用AI识别服务
    const result = await recognizeBook(bookTitle.trim());

    console.log('[Admin Book Identify API] Identification complete:', {
      title: result.bookInfo.title,
      aiScore: result.aiScore,
      requiresDocument: result.requiresDocument
    });

    return NextResponse.json({
      success: true,
      data: {
        bookInfo: result.bookInfo,
        aiScore: result.aiScore,
        coverOptions: result.coverOptions,
        requiresDocument: result.requiresDocument
      }
    });

  } catch (error) {
    console.error('[Admin Book Identify API] Error:', error);
    return NextResponse.json(
      {
        error: '书籍识别失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
