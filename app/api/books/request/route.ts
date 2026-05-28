// @ts-nocheck
/**
 * POST /api/books/request
 * 用户申请上架书籍
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  createUserBookRequest,
  getUserRequestCountToday,
  checkDuplicateRequest,
  updateUserBookRequest,
  getUserBookRequestById
} from '@/lib/db/book-requests';
import { searchBooks } from '@/lib/services/book-service';
import { recognizeAndCreateBook } from '@/lib/services/book-service';
import { fetchDoubanCover } from '@/lib/services/douban-service';

const DAILY_REQUEST_LIMIT = 5;

export async function POST(request: NextRequest) {
  console.log('[BookRequest] POST /api/books/request - 用户提交书籍申请');

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const body = await request.json();
    const { title, author } = body;

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: '书名为必填项', message: '请提供书名' },
        { status: 400 }
      );
    }

    const trimmedTitle = title.trim();
    const trimmedAuthor = author?.trim() || undefined;

    console.log(`[BookRequest] 用户 ${user.id} 申请书籍: ${trimmedTitle}${trimmedAuthor ? ` - ${trimmedAuthor}` : ''}`);

    const todayCount = getUserRequestCountToday(user.id);
    if (todayCount >= DAILY_REQUEST_LIMIT) {
      console.log(`[BookRequest] 用户 ${user.id} 今日申请数已达上限 (${todayCount})`);
      return NextResponse.json(
        { error: '申请过于频繁', message: `每天最多申请 ${DAILY_REQUEST_LIMIT} 本书，请明天再试` },
        { status: 429 }
      );
    }

    const duplicate = checkDuplicateRequest(user.id, trimmedTitle);
    if (duplicate.hasBook) {
      console.log(`[BookRequest] 书籍已存在: ${duplicate.book_id}`);
      return NextResponse.json(
        { status: 'already_exists', book_id: duplicate.book_id, message: '该书籍已在库中' },
        { status: 200 }
      );
    }

    if (duplicate.hasRequest) {
      console.log(`[BookRequest] 用户已有相同申请: ${duplicate.request_id}`);
      return NextResponse.json(
        { status: 'request_exists', request_id: duplicate.request_id, message: '您已申请过此书，请耐心等待处理' },
        { status: 200 }
      );
    }

    const bookRequest = createUserBookRequest({
      user_id: user.id,
      title: trimmedTitle,
      author: trimmedAuthor,
    });

    console.log(`[BookRequest] 创建申请记录: ${bookRequest.id}`);

    setTimeout(async () => {
      try {
        console.log(`[BookRequest] 异步处理申请 ${bookRequest.id}`);
        updateUserBookRequest(bookRequest.id, { status: 'processing' });

        // 先尝试拉豆瓣封面（失败不影响主流程）
        let coverUrl: string | undefined;
        try {
          const c = await fetchDoubanCover(trimmedTitle);
          if (c.success) coverUrl = c.localPath || c.coverUrl;
        } catch {}

        const { book, recognitionResult } = await recognizeAndCreateBook(trimmedTitle, {
          coverUrl,
          conversationStrategy: 'hybrid',
        });

        const hasAuthor = book.author && book.author !== '未知' && book.author.trim().length > 0;
        const hasDescription = book.description && book.description.length >= 50;

        if (!hasAuthor || !hasDescription) {
          console.log(`[BookRequest] AI识别信息不完整，进入wishlist: author=${!!hasAuthor}, description=${book.description?.length}`);
          updateUserBookRequest(bookRequest.id, {
            status: 'wishlist',
            book_id: book.id,
            ai_confidence: recognitionResult.aiScore / 10,
          });
          return;
        }

        updateUserBookRequest(bookRequest.id, {
          status: 'created',
          book_id: book.id,
          ai_confidence: recognitionResult.aiScore / 10,
        });
        console.log(`[BookRequest] 申请处理成功，书籍已创建: ${book.id}`);
      } catch (error) {
        console.error(`[BookRequest] 处理申请 ${bookRequest.id} 失败:`, error);
        updateUserBookRequest(bookRequest.id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : '处理失败',
        });
      }
    }, 100);

    const pendingRequest = getUserBookRequestById(bookRequest.id);
    return NextResponse.json({
      request_id: bookRequest.id,
      status: pendingRequest?.status || 'pending',
      message: '申请已提交，我们正在努力识别这本书',
    }, { status: 201 });

  } catch (error) {
    console.error('[BookRequest] 处理申请失败:', error);
    return NextResponse.json(
      { error: '提交申请失败', message: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}