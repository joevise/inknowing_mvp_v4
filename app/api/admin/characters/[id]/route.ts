/**
 * 单个角色管理 API
 * GET /api/admin/characters/:id - 获取角色详情
 * PUT /api/admin/characters/:id - 更新角色信息
 * DELETE /api/admin/characters/:id - 删除角色
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCharacterById,
  updateCharacter,
  deleteCharacter,
} from '@/lib/db/characters';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

/**
 * GET /api/admin/characters/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const character = await getCharacterById(params.id);
    if (!character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, character });
  } catch (error) {
    console.error('[API] 获取角色详情失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取角色失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/characters/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const character = await getCharacterById(params.id);
    if (!character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    const body = await request.json();

    const updated = await updateCharacter(params.id, {
      name: body.name,
      description: body.description,
      personality_traits: body.personalityTraits,
      speaking_style: body.speakingStyle,
      background_story: body.backgroundStory,
      prompt_template: body.promptTemplate,
    });

    return NextResponse.json({
      success: true,
      character: updated,
      message: '角色更新成功',
    });
  } catch (error) {
    console.error('[API] 更新角色失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新角色失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/characters/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const character = await getCharacterById(params.id);
    if (!character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    await deleteCharacter(params.id);

    return NextResponse.json({
      success: true,
      message: '角色已删除',
    });
  } catch (error) {
    console.error('[API] 删除角色失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除角色失败' },
      { status: 500 }
    );
  }
}
