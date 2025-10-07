/**
 * POST /api/admin/books/recognize
 * AI识别书籍信息
 * 符合 inknowing-api-spec.yaml 的 /admin/books/identify 端点（路径调整为recognize以更准确）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { recognizeBook } from '@/lib/services/book-service';

export async function POST(request: NextRequest) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    // 解析请求体
    const body = await request.json();
    const { title } = body;

    // 验证输入
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: '请提供书籍名称' },
        { status: 400 }
      );
    }

    // 调用AI识别服务
    console.log(`[Admin] Recognizing book: ${title}`);
    const result = await recognizeBook(title.trim());

    // 返回识别结果
    return NextResponse.json({
      book_info: {
        title: result.bookInfo.title,
        author: result.bookInfo.author,
        description: result.bookInfo.description,
        publisher: result.bookInfo.publisher,
        publish_date: result.bookInfo.publishDate,
        category: result.bookInfo.category,
        tags: result.bookInfo.tags,
      },
      ai_score: result.aiScore,
      cover_options: result.coverOptions,
      requires_document: result.requiresDocument,
    });
  } catch (error) {
    console.error('[Admin] Book recognition error:', error);

    // 返回友好的错误信息
    if (error instanceof Error) {
      if (error.message.includes('API')) {
        return NextResponse.json(
          { error: 'AI服务暂时不可用，请稍后重试' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '识别书籍时发生错误' },
      { status: 500 }
    );
  }
}