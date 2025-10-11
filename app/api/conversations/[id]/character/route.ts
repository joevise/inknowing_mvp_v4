/**
 * 对话角色切换 API
 * PUT /api/conversations/:id/character - 切换对话角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getConversationById,
  updateConversation,
  userOwnsConversation,
} from '@/lib/db/conversations';
import { getCharacterById } from '@/lib/db/characters';

/**
 * PUT /api/conversations/:id/character
 * 切换对话角色
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 验证用户身份
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 2. 验证对话权限
    if (!userOwnsConversation(user.id, params.id)) {
      return NextResponse.json(
        { error: '无权访问此对话' },
        { status: 403 }
      );
    }

    // 3. 获取当前对话
    const conversation = getConversationById(params.id);
    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      );
    }

    // 4. 解析请求体
    const body = await request.json();
    const { characterId } = body;

    // 如果characterId为null，表示切换回书籍对话
    if (characterId === null) {
      updateConversation(params.id, {
        character_id: null,
        type: 'book',
        updated_at: new Date(),
      });

      console.log('[API] 切换回书籍对话成功:', {
        conversationId: params.id,
      });

      const updatedConversation = getConversationById(params.id);
      return NextResponse.json({
        success: true,
        conversation: updatedConversation,
      });
    }

    // 5. 验证角色是否存在且属于同一本书
    if (!characterId) {
      return NextResponse.json(
        { error: '缺少 characterId 参数' },
        { status: 400 }
      );
    }

    const character = getCharacterById(characterId);
    if (!character) {
      return NextResponse.json(
        { error: '角色不存在' },
        { status: 404 }
      );
    }

    if (character.book_id !== conversation.book_id) {
      return NextResponse.json(
        { error: '该角色不属于当前书籍' },
        { status: 400 }
      );
    }

    // 6. 更新对话的角色
    updateConversation(params.id, {
      character_id: characterId,
      type: 'character',
      updated_at: new Date(),
    });

    console.log('[API] 角色切换成功:', {
      conversationId: params.id,
      oldCharacterId: conversation.character_id,
      newCharacterId: characterId,
    });

    // 7. 返回更新后的对话信息
    const updatedConversation = getConversationById(params.id);

    return NextResponse.json({
      success: true,
      conversation: updatedConversation,
      character,
    });

  } catch (error) {
    console.error('[API] 切换角色失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '切换角色失败',
      },
      { status: 500 }
    );
  }
}
