/**
 * 对话管理 API
 * POST /api/conversations - 创建新对话
 * GET /api/conversations - 获取用户所有对话列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/services/conversation-service';
import { requireAuth } from '@/lib/auth/middleware';
import { getConversationsByUserId } from '@/lib/db/conversations';

const conversationService = new ConversationService();

/**
 * POST /api/conversations
 * 创建新对话
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const authResult = await requireAuth(request);

    // 如果返回的是NextResponse，说明未认证
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 2. 解析请求体
    const body = await request.json();
    const { bookId, characterId, type } = body;

    if (!bookId || !type) {
      return NextResponse.json(
        { error: '缺少必要参数：bookId 和 type' },
        { status: 400 }
      );
    }

    if (type !== 'book' && type !== 'character') {
      return NextResponse.json(
        { error: 'type 必须是 book 或 character' },
        { status: 400 }
      );
    }

    if (type === 'character' && !characterId) {
      return NextResponse.json(
        { error: '角色对话需要提供 characterId' },
        { status: 400 }
      );
    }

    // 3. 创建对话
    const conversation = await conversationService.createConversation({
      userId: user.id,
      bookId,
      characterId,
      type,
      title: body.title,
    });

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      conversation,
    }, { status: 201 });

  } catch (error) {
    console.error('[API] 创建对话失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '创建对话失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations
 * 获取用户所有对话列表
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const authResult = await requireAuth(request);

    // 如果返回的是NextResponse，说明未认证
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 2. 获取查询参数
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 3. 获取对话列表
    const result = getConversationsByUserId(
      user.id,
      {
        book_id: bookId || undefined,
        type: (type as 'book' | 'character') || undefined,
        limit,
        offset,
      }
    );

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      conversations: result.conversations,
      total: result.total,
    });

  } catch (error) {
    console.error('[API] 获取对话列表失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '获取对话列表失败',
      },
      { status: 500 }
    );
  }
}
