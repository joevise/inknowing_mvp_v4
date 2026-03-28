// @ts-nocheck
/**
 * 对话表CRUD操作
 */

import { db, generateId, now, transaction } from './client';
import type { Conversation } from './schema';

export interface CreateConversationInput {
  user_id: string;
  book_id: string;
  character_id?: string | null;
  type: 'book' | 'character';
  title?: string;
}

export interface UpdateConversationInput {
  title?: string;
  type?: 'book' | 'character';
  character_id?: string | null;
}

/**
 * 创建新对话
 */
export function createConversation(input: CreateConversationInput): Conversation {
  const id = generateId();
  const timestamp = now().toISOString();

  // 如果是角色对话，必须有character_id
  if (input.type === 'character' && !input.character_id) {
    throw new Error('Character conversation requires character_id');
  }

  // 如果是书籍对话，不应该有character_id
  if (input.type === 'book' && input.character_id) {
    throw new Error('Book conversation should not have character_id');
  }

  const stmt = db().prepare(`
    INSERT INTO conversations (
      id, user_id, book_id, character_id, type, title,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.user_id,
    input.book_id,
    input.character_id || null,
    input.type,
    input.title || null,
    timestamp,
    timestamp
  );

  return getConversationById(id)!;
}

/**
 * 通过ID获取对话
 */
export function getConversationById(id: string): Conversation | null {
  const stmt = db().prepare(`
    SELECT * FROM conversations WHERE id = ?
  `);

  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    character_id: row.character_id,
    type: row.type,
    title: row.title,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 获取用户的所有对话
 */
export function getConversationsByUserId(
  userId: string,
  options?: {
    book_id?: string;
    type?: 'book' | 'character';
    limit?: number;
    offset?: number;
  }
): { conversations: Conversation[]; total: number } {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // 构建查询条件
  const conditions: string[] = ['user_id = ?'];
  const values: any[] = [userId];

  if (options?.book_id) {
    conditions.push('book_id = ?');
    values.push(options.book_id);
  }

  if (options?.type) {
    conditions.push('type = ?');
    values.push(options.type);
  }

  const whereClause = conditions.join(' AND ');

  // 获取总数
  const countStmt = db().prepare(`
    SELECT COUNT(*) as total FROM conversations
    WHERE ${whereClause}
  `);
  const countRow = countStmt.get(...values) as any;
  const total = countRow.total;

  // 获取对话列表 (JOIN books和characters表获取额外信息)
  values.push(limit, offset);
  const stmt = db().prepare(`
    SELECT
      c.*,
      b.title as book_title,
      ch.name as character_name
    FROM conversations c
    JOIN books b ON c.book_id = b.id
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE ${whereClause}
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...values) as any[];

  const conversations = rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    character_id: row.character_id,
    type: row.type,
    title: row.title,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    book_title: row.book_title,
    character_name: row.character_name,
  }));

  return { conversations, total };
}

/**
 * 获取对话详情（包含额外信息）
 */
export function getConversationDetail(id: string): {
  conversation: Conversation;
  book_title: string;
  character_name?: string;
  message_count: number;
} | null {
  const stmt = db().prepare(`
    SELECT
      c.*,
      b.title as book_title,
      ch.name as character_name,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    JOIN books b ON c.book_id = b.id
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE c.id = ?
  `);

  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    conversation: {
      id: row.id,
      user_id: row.user_id,
      book_id: row.book_id,
      character_id: row.character_id,
      type: row.type,
      title: row.title,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    },
    book_title: row.book_title,
    character_name: row.character_name,
    message_count: row.message_count,
  };
}

/**
 * 获取对话摘要列表
 */
export function getConversationSummaries(
  userId: string,
  options?: {
    book_id?: string;
    limit?: number;
    offset?: number;
  }
): Array<{
  id: string;
  book_id: string;
  book_title: string;
  type: string;
  character_name?: string;
  created_at: Date;
  updated_at: Date;
  message_count: number;
  title?: string;
}> {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // 构建查询条件
  const conditions: string[] = ['c.user_id = ?'];
  const values: any[] = [userId];

  if (options?.book_id) {
    conditions.push('c.book_id = ?');
    values.push(options.book_id);
  }

  const whereClause = conditions.join(' AND ');
  values.push(limit, offset);

  const stmt = db().prepare(`
    SELECT
      c.id,
      c.book_id,
      c.type,
      c.created_at,
      c.updated_at,
      c.title,
      b.title as book_title,
      ch.name as character_name,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    JOIN books b ON c.book_id = b.id
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE ${whereClause}
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...values) as any[];

  return rows.map(row => ({
    id: row.id,
    book_id: row.book_id,
    book_title: row.book_title,
    type: row.type,
    character_name: row.character_name,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    message_count: row.message_count,
    title: row.title,
  }));
}

/**
 * 更新对话
 */
export function updateConversation(
  id: string,
  input: UpdateConversationInput
): Conversation | null {
  const conversation = getConversationById(id);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }

  if (input.type !== undefined) {
    updates.push('type = ?');
    values.push(input.type);
  }

  if (input.character_id !== undefined) {
    // 如果同时更新type为character，或者原本就是character类型，则允许设置character_id
    // 如果character_id为null且type为book，也允许（这是切换回书籍对话的情况）
    const targetType = input.type !== undefined ? input.type : conversation.type;
    if (targetType !== 'character' && input.character_id !== null) {
      throw new Error('Cannot set character_id for book conversation');
    }
    updates.push('character_id = ?');
    values.push(input.character_id);
  }

  if (updates.length === 0) {
    return conversation;
  }

  updates.push('updated_at = ?');
  values.push(now().toISOString());
  values.push(id);

  const stmt = db().prepare(`
    UPDATE conversations
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  return getConversationById(id);
}

/**
 * 更新对话的最后活动时间
 */
export function touchConversation(id: string): boolean {
  const stmt = db().prepare(`
    UPDATE conversations
    SET updated_at = ?
    WHERE id = ?
  `);

  const result = stmt.run(now().toISOString(), id);
  return result.changes > 0;
}

/**
 * 删除对话（会级联删除消息）
 */
export function deleteConversation(id: string): boolean {
  const stmt = db().prepare(`
    DELETE FROM conversations WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 搜索用户的对话历史
 */
export function searchConversations(
  userId: string,
  query: string
): Array<{
  conversation: Conversation;
  matched_content?: string;
  book_title: string;
  character_name?: string;
}> {
  // 搜索对话标题和消息内容
  const stmt = db().prepare(`
    SELECT DISTINCT
      c.*,
      b.title as book_title,
      ch.name as character_name,
      m.content as matched_content
    FROM conversations c
    JOIN books b ON c.book_id = b.id
    LEFT JOIN characters ch ON c.character_id = ch.id
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = ?
      AND (c.title LIKE ? OR m.content LIKE ?)
    ORDER BY c.updated_at DESC
    LIMIT 50
  `);

  const searchPattern = `%${query}%`;
  const rows = stmt.all(userId, searchPattern, searchPattern) as any[];

  // 去重（因为可能有多个消息匹配）
  const seen = new Set<string>();
  const results: any[] = [];

  for (const row of rows) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      results.push({
        conversation: {
          id: row.id,
          user_id: row.user_id,
          book_id: row.book_id,
          character_id: row.character_id,
          type: row.type,
          title: row.title,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
        },
        matched_content: row.matched_content,
        book_title: row.book_title,
        character_name: row.character_name,
      });
    }
  }

  return results;
}

/**
 * 获取用户最近的对话
 */
export function getRecentConversations(
  userId: string,
  limit: number = 5
): Conversation[] {
  const stmt = db().prepare(`
    SELECT * FROM conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(userId, limit) as any[];

  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    character_id: row.character_id,
    type: row.type,
    title: row.title,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 获取对话统计信息
 */
export function getConversationStats(): {
  totalConversations: number;
  bookConversations: number;
  characterConversations: number;
  activeToday: number;
  averageMessages: number;
} {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM conversations');
  const totalRow = totalStmt.get() as any;

  const bookStmt = db().prepare(
    "SELECT COUNT(*) as count FROM conversations WHERE type = 'book'"
  );
  const bookRow = bookStmt.get() as any;

  const characterStmt = db().prepare(
    "SELECT COUNT(*) as count FROM conversations WHERE type = 'character'"
  );
  const characterRow = characterStmt.get() as any;

  const todayStmt = db().prepare(`
    SELECT COUNT(*) as count FROM conversations
    WHERE DATE(updated_at) = DATE('now')
  `);
  const todayRow = todayStmt.get() as any;

  const avgStmt = db().prepare(`
    SELECT AVG(msg_count) as average
    FROM (
      SELECT COUNT(*) as msg_count
      FROM messages
      GROUP BY conversation_id
    )
  `);
  const avgRow = avgStmt.get() as any;

  return {
    totalConversations: totalRow.count,
    bookConversations: bookRow.count,
    characterConversations: characterRow.count,
    activeToday: todayRow.count,
    averageMessages: Math.round(avgRow.average || 0),
  };
}

/**
 * 检查用户是否有权限访问对话
 */
export function userOwnsConversation(userId: string, conversationId: string): boolean {
  const stmt = db().prepare(`
    SELECT COUNT(*) as count FROM conversations
    WHERE id = ? AND user_id = ?
  `);

  const row = stmt.get(conversationId, userId) as any;
  return row.count > 0;
}