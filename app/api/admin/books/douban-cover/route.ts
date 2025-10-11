/**
 * 豆瓣封面抓取API
 * POST /api/admin/books/douban-cover
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { fetchDoubanCover } from '@/lib/services/douban-service';

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { bookTitle } = body;

    if (!bookTitle) {
      return NextResponse.json(
        { error: '书名为必填项' },
        { status: 400 }
      );
    }

    const result = await fetchDoubanCover(bookTitle);

    if (result.success) {
      return NextResponse.json({
        success: true,
        coverUrl: result.coverUrl,
        localPath: result.localPath,
        bookTitle
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || '未找到封面图片'
      });
    }

  } catch (error) {
    console.error('[Douban Cover API] Error:', error);
    return NextResponse.json(
      { error: '获取豆瓣封面失败' },
      { status: 500 }
    );
  }
}
