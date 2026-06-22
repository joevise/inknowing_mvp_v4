/**
 * 用户跨会话记忆服务层
 * 负责从对话中抽取记忆、去重、注入上下文。
 */

import { chat } from '@/lib/ai/chat';
import type { UserMemory } from '@/lib/db/schema';
import {
  createUserMemory,
  getTopMemoriesForInjection,
  getUserMemories,
  touchMemoryAccess,
} from '@/lib/db/user-memories';
import { getInteractedCharactersInBook } from '@/lib/db/conversations';

interface ExtractParams {
  userId: string;
  conversationId: string;
  bookId?: string | null;
  userMessage: string;
  aiResponse: string;
}

interface ExtractedMemoryItem {
  memory_type: string;
  content: string;
  importance: number;
}

const VALID_MEMORY_TYPES: UserMemory['memory_type'][] = [
  'fact',
  'preference',
  'profile',
  'interest',
  'event',
];

/**
 * 从一轮对话中抽取值得长期记住的用户事实/偏好/兴趣，并写入数据库。
 * 任何失败只记录日志，不影响主对话流程。
 */
export async function extractAndStoreMemories(params: ExtractParams): Promise<void> {
  try {
    const { userId, conversationId, bookId, userMessage, aiResponse } = params;

    const extractionPrompt = `
请阅读以下用户与 AI 的一轮对话，从中抽取关于用户的、值得跨会话长期记住的事实、偏好、兴趣或重要事件。

要求：
1. 只输出 JSON 数组，不要任何其他解释或 markdown 标记。
2. 每个元素格式：{ "memory_type": "...", "content": "...", "importance": 0.0-1.0 }
3. memory_type 必须是以下之一：fact（事实）、preference（偏好）、profile（画像）、interest（兴趣）、event（事件）。
4. content 必须是简洁的第三人称陈述，例如"用户偏好科幻题材"、"用户正在学习心理学"、"用户喜欢简短回答"。不要包含对话原文。
5. importance 表示该记忆对未来对话的价值，0 最低，1 最高。只有真正重要的信息才高于 0.7。
6. 如果没有值得记住的内容，请返回空数组 []。

用户说：
"""${userMessage}"""

AI 回复：
"""${aiResponse}"""
`;

    const result = await chat([
      { role: 'system', content: '你是一名用户画像提取助手，擅长从对话中提炼长期有效的用户记忆。' },
      { role: 'user', content: extractionPrompt },
    ]);

    const responseText = result.content || '[]';
    let items: ExtractedMemoryItem[] = [];

    try {
      const cleaned = responseText
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) {
        console.error('[memory] extract response is not an array:', responseText);
        return;
      }
    } catch (parseError) {
      console.error('[memory] failed to parse extraction response:', parseError, '\nraw:', responseText);
      return;
    }

    // 加载该用户已有记忆用于去重
    const existingMemories = await getUserMemories(userId, { limit: 500 });

    for (const item of items) {
      const normalizedType = item.memory_type?.toLowerCase().trim();
      if (!VALID_MEMORY_TYPES.includes(normalizedType as UserMemory['memory_type'])) {
        console.warn('[memory] skip invalid memory_type:', item.memory_type);
        continue;
      }

      const content = (item.content || '').trim();
      if (!content) continue;

      const importance = Math.max(0, Math.min(1, Number(item.importance) || 0.5));

      // 去重：完全相同或包含关系
      const duplicate = existingMemories.some(existing => {
        const existingContent = existing.content.trim();
        return (
          existingContent === content ||
          existingContent.includes(content) ||
          content.includes(existingContent)
        );
      });

      if (duplicate) {
        console.log('[memory] skip duplicate memory:', content);
        continue;
      }

      await createUserMemory({
        user_id: userId,
        memory_type: normalizedType as UserMemory['memory_type'],
        content,
        source_conversation_id: conversationId,
        source_book_id: bookId || null,
        importance,
      });

      console.log('[memory] stored:', content);
    }
  } catch (error) {
    console.error('[memory] extractAndStoreMemories failed:', error);
    // 绝不抛出，避免影响主对话
  }
}

/**
 * 构建用于注入对话上下文的记忆文本块（按书隔离）。
 * 无记忆时返回空字符串。
 */
export async function buildMemoryContextBlock(
  userId: string,
  bookId?: string | null
): Promise<string> {
  try {
    const memories = await getTopMemoriesForInjection(userId, bookId);
    if (memories.length === 0) {
      return '';
    }

    // 命中后更新访问计数（fire-and-forget）
    memories.forEach(memory => {
      touchMemoryAccess(memory.id).catch(error => {
        console.error('[memory] touchMemoryAccess failed:', error);
      });
    });

    const lines = memories.map(memory => `- ${memory.content}`).join('\n');
    return `\n\n[关于这位用户你已知道的信息]\n${lines}`;
  } catch (error) {
    console.error('[memory] buildMemoryContextBlock failed:', error);
    return '';
  }
}

/**
 * 构建「书内交互足迹」注入块：让同书其他角色自然知晓这位读者还和谁聊过。
 * 只暴露"和谁聊过"这一客观事实，不暴露聊天内容，避免角色串味。
 * 无足迹（这本书第一次开口）时返回空字符串。
 */
export async function buildBookInteractionBlock(
  userId: string,
  bookId: string,
  currentCharacterId: string | null | undefined,
  bookTitle: string
): Promise<string> {
  try {
    const names = await getInteractedCharactersInBook(userId, bookId, currentCharacterId);
    if (names.length === 0) {
      return '';
    }
    return `\n\n[这位读者在《${bookTitle}》中的交流足迹]\n该读者此前还与以下角色有过对话：${names.join('、')}。你与他们同属这本书的世界，可以自然地知晓这一点，就像听同伴提起过这位读者；但你并不知道他们具体聊了什么。`;
  } catch (error) {
    console.error('[memory] buildBookInteractionBlock failed:', error);
    return '';
  }
}
