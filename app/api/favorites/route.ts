/**
 * 收藏API - 获取用户收藏列表、添加收藏
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getUserFavorites, addFavorite } from '@/lib/db/favorites';

/**
 * GET /api/favorites - 获取用户收藏列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const favorites = await getUserFavorites(user.id);

    return NextResponse.json({
      favorites: favorites.map(f => ({
        id: f.favorite.id,
        book_id: f.favorite.book_id,
        created_at: f.favorite.created_at,
        book: f.book,
      })),
    });
  } catch (error) {
    console.error('[API Favorites GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/favorites - 添加收藏
 * Body: { bookId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json(
        { error: 'Missing bookId' },
        { status: 400 }
      );
    }

    const favorite = await addFavorite(user.id, bookId);

    return NextResponse.json({
      favorite: {
        id: favorite.id,
        book_id: favorite.book_id,
        created_at: favorite.created_at,
      },
    });
  } catch (error) {
    console.error('[API Favorites POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add favorite' },
      { status: 500 }
    );
  }
}
