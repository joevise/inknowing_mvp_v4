// @ts-nocheck
/**
 * POST /api/admin/book-requests/[id]/retry
 * 管理员重试处理书籍申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getUserBookRequestById, updateUserBookRequest } from '@/lib/db/book-requests';
import { recognizeAndCreateBook } from '@/lib/services/book-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[BookRequest] POST /api/admin/book-requests/${id}/retry - 重试处理申请`);

  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const bookRequest = await getUserBookRequestById(id);
    if (!bookRequest) {
      return NextResponse.json(
        { error: '申请不存在' },
        { status: 404 }
      );
    }

    console.log(`[BookRequest] 开始重试处理申请 ${id}: ${bookRequest.title}`);

    await updateUserBookRequest(id, { status: 'processing' });

    const { book, recognitionResult } = await recognizeAndCreateBook(bookRequest.title);

    const hasAuthor = book.author && book.author !== '未知' && book.author.trim().length > 0;
    const hasDescription = book.description && book.description.length >= 50;

    if (!hasAuthor || !hasDescription) {
      console.log(`[BookRequest] 重试识别信息不完整，进入wishlist: author=${!!hasAuthor}, description=${book.description?.length}`);
      await updateUserBookRequest(id, {
        status: 'wishlist',
        book_id: book.id,
        ai_confidence: recognitionResult.aiScore / 10,
      });
      return NextResponse.json({
        status: 'wishlist',
        book_id: book.id,
        message: '识别信息不完整，已加入许愿池',
        recognition: {
          author: book.author,
          description_length: book.description?.length || 0,
          ai_confidence: recognitionResult.aiScore / 10,
        }
      });
    }

    await updateUserBookRequest(id, {
      status: 'created',
      book_id: book.id,
      ai_confidence: recognitionResult.aiScore / 10,
    });

    console.log(`[BookRequest] 重试成功，书籍已创建: ${book.id}`);

    return NextResponse.json({
      status: 'created',
      book_id: book.id,
      message: '处理成功，书籍已创建',
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
      }
    });

  } catch (error) {
    console.error(`[BookRequest] 重试处理申请 ${id} 失败:`, error);
    await updateUserBookRequest(id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : '处理失败',
    });
    return NextResponse.json(
      { error: '处理失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}