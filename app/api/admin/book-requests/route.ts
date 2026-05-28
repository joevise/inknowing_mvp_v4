// @ts-nocheck
/**
 * /api/admin/book-requests
 * GET - 获取所有用户书籍申请列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { listUserBookRequests } from '@/lib/db/book-requests';

export async function GET(request: NextRequest) {
  console.log('[BookRequest] GET /api/admin/book-requests - 获取所有申请列表');

  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const user_id = searchParams.get('user_id') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = listUserBookRequests({ status, user_id, limit, offset });

    const formattedRequests = result.requests.map(req => ({
      id: req.id,
      user_id: req.user_id,
      username: req.username,
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