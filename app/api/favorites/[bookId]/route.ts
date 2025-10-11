/**
 * 收藏API - 删除特定书籍的收藏、检查收藏状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { removeFavorite, isFavorited } from '@/lib/db/favorites';

/**
 * GET /api/favorites/[bookId] - 检查是否已收藏某本书
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { bookId: string } }
) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { bookId } = params;
    const favorited = isFavorited(user.id, bookId);

    return NextResponse.json({
      favorited,
    });
  } catch (error) {
    console.error('[API Favorites GET bookId] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check favorite status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/favorites/[bookId] - 移除收藏
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { bookId: string } }
) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { bookId } = params;
    const success = removeFavorite(user.id, bookId);

    if (!success) {
      return NextResponse.json(
        { error: 'Favorite not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Favorite removed successfully',
    });
  } catch (error) {
    console.error('[API Favorites DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove favorite' },
      { status: 500 }
    );
  }
}
