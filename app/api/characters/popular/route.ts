import { NextRequest, NextResponse } from 'next/server';
import { getPopularCharacters } from '@/lib/db/characters';

/**
 * GET /api/characters/popular
 * 获取热门角色列表（支持分页）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await getPopularCharacters(limit, offset);

    return NextResponse.json({
      success: true,
      characters: result.characters,
      total: result.total,
      pagination: {
        limit,
        offset,
        has_more: offset + limit < result.total,
      },
    });
  } catch (error) {
    console.error('[API] Get popular characters error:', error);
    return NextResponse.json(
      { error: 'Failed to get popular characters' },
      { status: 500 }
    );
  }
}
