// @ts-nocheck
/**
 * /api/admin/books
 * GET - 获取所有书籍列表
 * POST - 创建新书籍
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import {
  createBook,
  getAllBooks,
  recognizeAndCreateBook
} from '@/lib/services/book-service';

/**
 * GET /api/admin/books
 * 获取所有书籍列表（管理员视图，包括下架的）
 */
export async function GET(request: NextRequest) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') as 'published' | 'draft' | undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 解析标签参数
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined;

    // 获取书籍列表
    const result = await getAllBooks({
      category: category as any,
      status: status as any,
      tags,
      limit,
      offset
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin] Get books error:', error);
    return NextResponse.json(
      { error: '获取书籍列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/books
 * 创建新书籍
 */
export async function POST(request: NextRequest) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // 验证必填字段
    if (!body.title || !body.author) {
      return NextResponse.json(
        { error: '书名和作者为必填项' },
        { status: 400 }
      );
    }

    // 如果提供了ai_score，使用recognizeAndCreateBook
    if (body.recognize_title) {
      console.log(`[Admin] Creating book with AI recognition: ${body.recognize_title}`);
      const result = await recognizeAndCreateBook(body.recognize_title, {
        coverUrl: body.cover_url,
        conversationStrategy: body.conversation_strategy,
      });

      return NextResponse.json(
        {
          ...result.book,
          recognition_result: result.recognitionResult
        },
        { status: 201 }
      );
    }

    // 直接创建书籍
    console.log(`[Admin] Creating book: ${body.title}`);
    const book = await createBook({
      title: body.title,
      author: body.author,
      description: body.description,
      coverUrl: body.cover_url,
      category: body.category,
      tags: body.tags,
      aiScore: body.ai_score,
      conversationStrategy: body.conversation_strategy,
      titleEn: body.title_en,
      descriptionEn: body.description_en,
      languageMode: body.language_mode,
    });

    return NextResponse.json(book, { status: 201 });
  } catch (error) {
    console.error('[Admin] Create book error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '创建书籍失败' },
      { status: 500 }
    );
  }
}