/**
 * GET /api/books
 * 获取已上架书籍列表（前台用户访问）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllBooks } from '@/lib/services/book-service';
import { localizeBook } from '@/lib/db/i18n-helpers';

/**
 * GET /api/books
 * 获取所有已上架的书籍，支持分类和标签筛选
 */
export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 解析标签参数（支持多个标签）
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined;

    // 读取界面语言（i18n middleware 设置的 cookie）
    const lang = request.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh';

    // 只获取已上架的书籍
    const result = await getAllBooks({
      status: 'published' as any, // 前台只显示已上架的书籍
      category: category as any,
      tags,
      limit,
      offset
    });

    // 格式化返回数据，移除敏感信息；按 lang 切换 title/description
    const formattedBooks = result.books.map(book => {
      const localized = localizeBook(book, lang);
      return {
        id: localized.id,
        title: localized.title,
        author: localized.author,
        description: localized.description,
        cover_url: localized.cover_url,
        category: localized.category,
        tags: localized.tags,
        favorite_count: (book as any).favorite_count || 0,
        // 不返回 ai_knowledge_level 等管理信息
      };
    });

    return NextResponse.json({
      books: formattedBooks,
      total: result.total,
      pagination: {
        limit,
        offset,
        has_more: offset + limit < result.total
      }
    });
  } catch (error) {
    console.error('[Public] Get books error:', error);
    return NextResponse.json(
      { error: '获取书籍列表失败' },
      { status: 500 }
    );
  }
}