/**
 * 对话消息 API
 * POST /api/conversations/:id/messages - 发送消息
 * GET /api/conversations/:id/messages - 获取消息列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/services/conversation-service';
import { requireAuth } from '@/lib/auth/middleware';
import { userOwnsConversation } from '@/lib/db/conversations';
import { getMessagesByConversationId } from '@/lib/db/messages';

const conversationService = new ConversationService();

/**
 * POST /api/conversations/:id/messages
 * 发送消息
 */
export async function POST(
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
    if (!userOwnsConversation(user.id, params.id)) {
      return NextResponse.json(
        { error: '无权访问此对话' },
        { status: 403 }
      );
    }

    // 3. 解析请求体
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      );
    }

    // 4. 发送消息并生成回复
    console.log('[API] 开始发送消息:', {
      conversationId: params.id,
      userId: user.id,
      contentLength: content.length,
    });

    const result = await conversationService.sendMessage({
      conversationId: params.id,
      userId: user.id,
      content: content.trim(),
    });

    console.log('[API] 消息发送成功:', {
      messageId: result.message.id,
      strategy: result.strategy,
      hasSource: !!result.sources,
      responseTime: result.responseTime,
    });

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      message: result.message,
      metadata: {
        strategy: result.strategy,
        queryType: result.queryType,
        sources: result.sources,
        responseTime: result.responseTime,
      },
    });

  } catch (error) {
    console.error('[API] 发送消息失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '发送消息失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/:id/messages
 * 获取对话的所有消息
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
    if (!userOwnsConversation(user.id, params.id)) {
      return NextResponse.json(
        { error: '无权访问此对话' },
        { status: 403 }
      );
    }

    // 3. 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 4. 获取消息列表
    const messages = getMessagesByConversationId(params.id, limit, offset);

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      messages,
      total: messages.length,
    });

  } catch (error) {
    console.error('[API] 获取消息列表失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '获取消息列表失败',
      },
      { status: 500 }
    );
  }
}
