import { NextRequest, NextResponse } from 'next/server';
import { getPopularCharacters } from '@/lib/db/characters';

/**
 * GET /api/characters/popular
 * 获取热门角色列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const characters = getPopularCharacters(limit);

    return NextResponse.json({
      success: true,
      characters,
    });
  } catch (error) {
    console.error('[API] Get popular characters error:', error);
    return NextResponse.json(
      { error: 'Failed to get popular characters' },
      { status: 500 }
    );
  }
}
