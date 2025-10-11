/**
 * AI识别书籍 API
 * POST /api/admin/books/identify
 *
 * 根据书名使用AI识别书籍信息，并自动从豆瓣抓取封面
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { recognizeBook } from '@/lib/services/book-service';
import { fetchDoubanCover } from '@/lib/services/douban-service';

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

    // 自动从豆瓣抓取封面并保存到本地
    let coverUrl: string | undefined;
    try {
      console.log('[Admin Book Identify API] Fetching Douban cover for:', result.bookInfo.title);
      const coverResult = await fetchDoubanCover(result.bookInfo.title);
      if (coverResult.success) {
        // 优先使用本地路径，如果下载失败则使用原始URL
        coverUrl = coverResult.localPath || coverResult.coverUrl;
        console.log('[Admin Book Identify API] Douban cover fetched:', coverUrl);
      } else {
        console.log('[Admin Book Identify API] Douban cover not found');
      }
    } catch (coverError) {
      console.warn('[Admin Book Identify API] Failed to fetch Douban cover:', coverError);
      // 继续处理，即使封面获取失败
    }

    return NextResponse.json({
      success: true,
      data: {
        bookInfo: {
          ...result.bookInfo,
          // 如果成功获取到豆瓣封面，则添加到bookInfo中
          cover_url: coverUrl || result.bookInfo.cover_url
        },
        aiScore: result.aiScore,
        coverOptions: result.coverOptions,
        requiresDocument: result.requiresDocument,
        doubanCoverUrl: coverUrl // 额外返回豆瓣封面URL
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
