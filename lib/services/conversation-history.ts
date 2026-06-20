/**
 * 对话历史管理服务
 * 管理用户的对话历史、搜索、恢复上下文等功能
 */

import {
  getUserConversations,
  getConversationById,
  deleteConversation,
  updateConversationTitle,
} from '../db/conversations';
import {
  getMessagesByConversationId,
  getConversationContext,
} from '../db/messages';
import { getBookById } from '../db/books';
import type { Conversation, Message } from '../db/schema';

// 历史对话项（带扩展信息）
export interface ConversationHistoryItem extends Conversation {
  bookTitle?: string;
  messageCount?: number;
  lastMessage?: string;
  lastMessageTime?: Date;
}

// 按书籍分组的对话
export interface GroupedConversations {
  bookId: string;
  bookTitle: string;
  conversations: ConversationHistoryItem[];
}

/**
 * 获取用户的对话历史（时间轴）
 */
export async function getConversationHistory(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    bookId?: string;
    type?: 'book' | 'character';
  }
): Promise<ConversationHistoryItem[]> {
  const conversations = await getUserConversations(userId, options);

  // 丰富对话信息
  const enriched = [];
  for (const conv of conversations) {
    const book = await getBookById(conv.book_id);
    const messages = await getMessagesByConversationId(conv.id, { limit: 1 }); // 只获取最后一条消息

    enriched.push({
      ...conv,
      bookTitle: book?.title,
      messageCount: await getMessageCount(conv.id),
      lastMessage: messages[messages.length - 1]?.content?.substring(0, 100),
      lastMessageTime: messages[messages.length - 1]?.created_at,
    });
  }
  return enriched;
}

/**
 * 按书籍分组获取对话
 */
export async function getConversationsGroupedByBook(
  userId: string
): Promise<GroupedConversations[]> {
  const conversations = await getConversationHistory(userId);
  const grouped = new Map<string, ConversationHistoryItem[]>();

  // 按书籍分组
  for (const conv of conversations) {
    if (!grouped.has(conv.book_id)) {
      grouped.set(conv.book_id, []);
    }
    grouped.get(conv.book_id)!.push(conv);
  }

  // 转换为数组
  const result: GroupedConversations[] = [];
  for (const [bookId, convs] of grouped.entries()) {
    const book = await getBookById(bookId);
    result.push({
      bookId,
      bookTitle: book?.title || '未知书籍',
      conversations: convs,
    });
  }

  // 按最近活动排序
  result.sort((a, b) => {
    const aLatest = Math.max(
      ...a.conversations.map(c => new Date(c.updated_at).getTime())
    );
    const bLatest = Math.max(
      ...b.conversations.map(c => new Date(c.updated_at).getTime())
    );
    return bLatest - aLatest;
  });

  return result;
}

/**
 * 搜索历史对话
 */
export async function searchConversationHistory(
  userId: string,
  query: string
): Promise<ConversationHistoryItem[]> {
  const allConversations = await getConversationHistory(userId);

  if (!query || query.trim().length === 0) {
    return allConversations;
  }

  const lowerQuery = query.toLowerCase();

  return allConversations.filter(conv => {
    // 搜索对话标题
    if (conv.title.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 搜索书籍标题
    if (conv.bookTitle?.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 搜索最后一条消息
    if (conv.lastMessage?.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });
}

/**
 * 恢复对话上下文
 */
export async function restoreConversationContext(
  conversationId: string,
  contextSize: number = 10
): Promise<{
  conversation: Conversation | null;
  messages: Message[];
  context: Array<{ role: string; content: string }>;
}> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    return {
      conversation: null,
      messages: [],
      context: [],
    };
  }

  const messages = await getMessagesByConversationId(conversationId);
  const context = await getConversationContext(conversationId, contextSize);

  return {
    conversation,
    messages,
    context,
  };
}

/**
 * 继续历史对话
 */
export async function continueConversation(
  conversationId: string,
  userId: string
): Promise<{
  conversation: Conversation | null;
  canContinue: boolean;
  reason?: string;
}> {
  // 验证对话存在
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    return {
      conversation: null,
      canContinue: false,
      reason: '对话不存在',
    };
  }

  // 验证所有权
  if (conversation.user_id !== userId) {
    return {
      conversation: null,
      canContinue: false,
      reason: '无权访问此对话',
    };
  }

  // 验证书籍仍然可用
  const book = await getBookById(conversation.book_id);
  if (!book || book.status !== 'published') {
    return {
      conversation,
      canContinue: false,
      reason: '书籍已下架或不可用',
    };
  }

  return {
    conversation,
    canContinue: true,
  };
}

/**
 * 删除对话（包含所有消息）
 */
export async function removeConversation(
  conversationId: string,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      return {
        success: false,
        error: '对话不存在',
      };
    }

    if (conversation.user_id !== userId) {
      return {
        success: false,
        error: '无权删除此对话',
      };
    }

    await deleteConversation(conversationId);

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除失败',
    };
  }
}

/**
 * 更新对话标题
 */
export async function renameConversation(
  conversationId: string,
  userId: string,
  newTitle: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      return {
        success: false,
        error: '对话不存在',
      };
    }

    if (conversation.user_id !== userId) {
      return {
        success: false,
        error: '无权修改此对话',
      };
    }

    if (!newTitle || newTitle.trim().length === 0) {
      return {
        success: false,
        error: '标题不能为空',
      };
    }

    await updateConversationTitle(conversationId, newTitle.trim());

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新失败',
    };
  }
}

/**
 * 获取对话统计信息
 */
export async function getConversationStats(userId: string): Promise<{
  totalConversations: number;
  totalMessages: number;
  bookCount: number;
  characterConversations: number;
  bookConversations: number;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}> {
  const conversations = await getUserConversations(userId);

  const stats = {
    totalConversations: conversations.length,
    totalMessages: 0,
    bookCount: new Set(conversations.map(c => c.book_id)).size,
    characterConversations: conversations.filter(c => c.type === 'character').length,
    bookConversations: conversations.filter(c => c.type === 'book').length,
    recentActivity: [] as Array<{ date: string; count: number }>,
  };

  // 计算总消息数
  for (const conv of conversations) {
    stats.totalMessages += await getMessageCount(conv.id);
  }

  // 计算最近7天的活动
  const now = new Date();
  const activityMap = new Map<string, number>();

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    activityMap.set(dateStr, 0);
  }

  for (const conv of conversations) {
    const dateStr = conv.updated_at.toISOString().split('T')[0];
    if (activityMap.has(dateStr)) {
      activityMap.set(dateStr, activityMap.get(dateStr)! + 1);
    }
  }

  stats.recentActivity = Array.from(activityMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return stats;
}

/**
 * 辅助函数：获取消息数量
 */
async function getMessageCount(conversationId: string): Promise<number> {
  try {
    const messages = await getMessagesByConversationId(conversationId);
    return messages.length;
  } catch {
    return 0;
  }
}

/**
 * 构建上下文窗口（用于继续对话）
 */
export async function buildContextWindow(
  conversationId: string,
  windowSize: number = 10
): Promise<Array<{ role: string; content: string }>> {
  return await getConversationContext(conversationId, windowSize);
}
