// @ts-nocheck
/**
 * GET /api/user/my-requests
 * 获取当前用户的书籍申请列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getUserBookRequests } from '@/lib/db/book-requests';

export async function GET(request: NextRequest) {
  console.log('[BookRequest] GET /api/user/my-requests - 获取用户申请列表');

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await getUserBookRequests(user.id, { status, limit, offset });

    const formattedRequests = result.requests.map(req => ({
      id: req.id,
      title: req.title,
      author: req.author,
      status: req.status,
      book_id: req.book_id,
      ai_confidence: req.ai_confidence,
      error_message: req.error_message,
      created_at: req.created_at,
      updated_at: req.updated_at,
    }));

    return NextResponse.json({
      requests: formattedRequests,
      total: result.total,
      pagination: {
        limit,
        offset,
        has_more: offset + limit < result.total,
      }
    });
  } catch (error) {
    console.error('[BookRequest] 获取申请列表失败:', error);
    return NextResponse.json(
      { error: '获取申请列表失败' },
      { status: 500 }
    );
  }
}