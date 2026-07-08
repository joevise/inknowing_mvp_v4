/**
 * 单个对话 API
 * GET /api/conversations/:id - 获取对话详情
 * DELETE /api/conversations/:id - 删除对话
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getConversationById,
  deleteConversation,
  userOwnsConversation,
} from '@/lib/db/conversations';
import { getMessagesByConversationId } from '@/lib/db/messages';
import { getBookById } from '@/lib/db/books';
import { getCharacterById } from '@/lib/db/characters';
import { getUserById } from '@/lib/db/users';
import { localizeBook, localizeCharacter } from '@/lib/db/i18n-helpers';

/**
 * GET /api/conversations/:id
 * 获取对话详情（包含消息历史）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 验证用户身份
    const authResult = await requireAuth(request);

    // 如果返回的是NextResponse，说明未认证
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 2. 验证对话权限
    if (!(await userOwnsConversation(user.id, params.id))) {
      return NextResponse.json(
        { error: '无权访问此对话' },
        { status: 403 }
      );
    }

    // 3. 获取对话详情
    const conversation = await getConversationById(params.id);
    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      );
    }

    // 4. 获取消息历史
    const messages = await getMessagesByConversationId(params.id);

    // 5. 获取额外信息（书籍/角色封面、用户信息）
    let cover_url: string | undefined;
    let book_title: string | undefined;
    let character_name: string | undefined;

    if (conversation.type === 'book') {
      const book = await getBookById(conversation.book_id);
      if (book) {
        const lang = request.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh';
        const localized = localizeBook(book, lang);
        cover_url = book.cover_url || undefined;
        book_title = localized.title;
      }
    } else if (conversation.type === 'character' && conversation.character_id) {
      const character = await getCharacterById(conversation.character_id);
      if (character) {
        const lang = request.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh';
        const localized = localizeCharacter(character, lang);
        cover_url = (character as any).avatar_url || undefined;
        character_name = localized.name;
      }
    }

    // 获取用户信息
    const conversationUser = await getUserById(conversation.user_id);

    // 6. 返回结果（包含封面和用户信息）
    return NextResponse.json({
      success: true,
      conversation: {
        ...conversation,
        cover_url,
        book_title,
        character_name,
        user: conversationUser ? {
          id: conversationUser.id,
          username: conversationUser.username,
        } : undefined,
      },
      messages,
    });

  } catch (error) {
    console.error('[API] 获取对话详情失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '获取对话详情失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id
 * 删除对话
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 验证用户身份
    const authResult = await requireAuth(request);

    // 如果返回的是NextResponse，说明未认证
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 2. 验证对话权限
    if (!(await userOwnsConversation(user.id, params.id))) {
      return NextResponse.json(
        { error: '无权删除此对话' },
        { status: 403 }
      );
    }

    // 3. 删除对话
    await deleteConversation(params.id);

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      message: '对话已删除',
    });

  } catch (error) {
    console.error('[API] 删除对话失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '删除对话失败',
      },
      { status: 500 }
    );
  }
}
