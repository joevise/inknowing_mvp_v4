/**
 * 流式对话 API
 * POST /api/conversations/:id/stream - 流式对话（SSE）
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/services/conversation-service';
import { getSessionFromCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';
import { userOwnsConversation } from '@/lib/db/conversations';

const conversationService = new ConversationService();

/**
 * POST /api/conversations/:id/stream
 * 流式对话（Server-Sent Events）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 验证用户身份
    const sessionToken = request.cookies.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: 'Session已过期' },
        { status: 401 }
      );
    }

    // 2. 验证对话权限
    if (!userOwnsConversation(session.user.id, params.id)) {
      return NextResponse.json(
        { error: '无权访问此对话' },
        { status: 403 }
      );
    }

    // 3. 解析请求体
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      );
    }

    // 4. 创建流式响应
    console.log('[API] 开始流式对话:', {
      conversationId: params.id,
      userId: session.user.id,
      contentLength: content.length,
    });

    // 创建可读流
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // 发送流式响应
          for await (const event of conversationService.streamResponse(
            params.id,
            session.user.id,
            content.trim()
          )) {
            // 发送SSE格式的数据
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            // 如果是完成或错误，关闭流
            if (event.type === 'done' || event.type === 'error') {
              controller.close();
              break;
            }
          }
        } catch (error) {
          console.error('[API] 流式对话错误:', error);
          // 发送错误事件
          const errorData = JSON.stringify({
            type: 'error',
            data: error instanceof Error ? error.message : '流式对话失败',
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },

      cancel() {
        console.log('[API] 流式对话被取消');
      },
    });

    // 5. 返回SSE响应
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用nginx缓冲
      },
    });

  } catch (error) {
    console.error('[API] 流式对话失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '流式对话失败',
      },
      { status: 500 }
    );
  }
}
