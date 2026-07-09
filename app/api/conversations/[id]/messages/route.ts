/**
 * 对话消息 API
 * POST /api/conversations/:id/messages - 发送消息
 * GET /api/conversations/:id/messages - 获取消息列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/lib/services/conversation-service';
import { requireAuth } from '@/lib/auth/middleware';
import { userOwnsConversation, getConversationById } from '@/lib/db/conversations';
import { getMessagesByConversationId } from '@/lib/db/messages';
import { getBookById } from '@/lib/db/books';
import { getCharacterById } from '@/lib/db/characters';
import { localizeBook } from '@/lib/db/i18n-helpers';
import { getTodayUsage, incrementUsage, DAILY_MESSAGE_LIMIT } from '@/lib/db/daily-usage';

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
    if (!(await userOwnsConversation(user.id, params.id))) {
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

    // 4. 每日配额检查(管理员不限)
    if (user.id !== 'admin') {
      const used = await getTodayUsage(user.id);
      if (used >= DAILY_MESSAGE_LIMIT) {
        console.log('[API] 用户已达每日对话上限:', {
          userId: user.id,
          used,
          limit: DAILY_MESSAGE_LIMIT,
        });
        return NextResponse.json(
          {
            error: '今日对话已达上限',
            message: `免费用户每日限 ${DAILY_MESSAGE_LIMIT} 轮对话,明天再来吧`,
            remaining: 0,
            limit: DAILY_MESSAGE_LIMIT,
          },
          { status: 429 }
        );
      }
    }

    // 5. 发送消息并生成回复
    console.log('[API] 开始发送消息:', {
      conversationId: params.id,
      userId: user.id,
      contentLength: content.length,
    });

    // 读取界面语言（i18n middleware 设置的 cookie），让 AI 跟随界面语种
    const uiLang: 'zh' | 'en' =
      request.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh';

    const result = await conversationService.sendMessage({
      conversationId: params.id,
      userId: user.id,
      content: content.trim(),
      uiLang,
    });

    // 6. 成功后再 +1(管理员不计)
    if (user.id !== 'admin') {
      try {
        await incrementUsage(user.id);
      } catch (err) {
        console.error('[API] 配额自增失败(不影响主流程):', err);
      }
    }

    console.log('[API] 消息发送成功:', {
      messageId: result.message.assistantMessage.id,
      strategy: result.strategy,
      hasSource: !!result.sources,
      responseTime: result.responseTime,
    });

    // 7. 返回结果
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
    if (!(await userOwnsConversation(user.id, params.id))) {
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
    const messages = await getMessagesByConversationId(params.id, { limit, offset });

    // 5. 为没有头像信息的消息补充默认头像（使用书籍封面）
    const conversation = await getConversationById(params.id);
    const book = conversation ? await getBookById(conversation.book_id) : null;

    const lang = request.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh';
    const localizedTitle = book ? localizeBook(book, lang).title : undefined;

    const messagesWithAvatar = messages.map((msg: any) => {
      // 只处理assistant消息
      if (msg.role === 'assistant' && msg.metadata) {
        const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;

        // 统一按界面语言覆盖书名（历史metadata里固化的是中文），并补默认封面
        return {
          ...msg,
          metadata: {
            ...metadata,
            cover_url: metadata.cover_url || book?.cover_url || undefined,
            book_title: localizedTitle || metadata.book_title,
          }
        };
      }
      return msg;
    });

    // 6. 返回结果
    return NextResponse.json({
      success: true,
      messages: messagesWithAvatar,
      total: messagesWithAvatar.length,
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
