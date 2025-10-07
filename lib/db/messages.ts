/**
 * 消息表CRUD操作
 */

import { db, generateId, now, toJson, parseJson, transaction } from './client';
import { touchConversation } from './conversations';
import type { Message } from './schema';

export interface CreateMessageInput {
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
}

export interface MessageWithMetadata extends Message {
  routing_strategy?: 'ai_native' | 'rag_retrieval' | 'hybrid';
  sources?: string[];
}

/**
 * 创建新消息
 */
export function createMessage(input: CreateMessageInput): Message {
  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO messages (
      id, conversation_id, role, content, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.conversation_id,
    input.role,
    input.content,
    toJson(input.metadata || {}),
    timestamp
  );

  // 更新对话的最后活动时间
  touchConversation(input.conversation_id);

  return getMessageById(id)!;
}

/**
 * 通过ID获取消息
 */
export function getMessageById(id: string): Message | null {
  const stmt = db().prepare(`
    SELECT * FROM messages WHERE id = ?
  `);

  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata) || {},
    created_at: new Date(row.created_at),
  };
}

/**
 * 获取对话的所有消息
 */
export function getMessagesByConversationId(
  conversationId: string,
  options?: {
    limit?: number;
    offset?: number;
    order?: 'asc' | 'desc';
  }
): Message[] {
  const limit = options?.limit;
  const offset = options?.offset || 0;
  const order = options?.order || 'asc';

  let sql = `
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ${order.toUpperCase()}
  `;

  if (limit !== undefined) {
    sql += ` LIMIT ? OFFSET ?`;
  }

  const stmt = db().prepare(sql);

  const rows = limit !== undefined
    ? stmt.all(conversationId, limit, offset)
    : stmt.all(conversationId);

  return (rows as any[]).map(row => ({
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata) || {},
    created_at: new Date(row.created_at),
  }));
}

/**
 * 获取对话的最后N条消息
 */
export function getLastMessages(
  conversationId: string,
  count: number = 10
): Message[] {
  const stmt = db().prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(conversationId, count) as any[];

  // 反转以获得正确的时间顺序
  return rows.reverse().map(row => ({
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata) || {},
    created_at: new Date(row.created_at),
  }));
}

/**
 * 获取带元数据的消息
 */
export function getMessageWithMetadata(id: string): MessageWithMetadata | null {
  const message = getMessageById(id);
  if (!message) return null;

  const metadata = message.metadata as any;

  return {
    ...message,
    routing_strategy: metadata?.routing_strategy,
    sources: metadata?.sources,
  };
}

/**
 * 批量创建消息
 */
export function bulkCreateMessages(messages: CreateMessageInput[]): Message[] {
  return transaction(() => {
    const created: Message[] = [];

    for (const messageInput of messages) {
      const message = createMessage(messageInput);
      created.push(message);
    }

    return created;
  });
}

/**
 * 删除消息
 */
export function deleteMessage(id: string): boolean {
  const stmt = db().prepare(`
    DELETE FROM messages WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 删除对话的所有消息
 */
export function deleteMessagesByConversationId(conversationId: string): number {
  const stmt = db().prepare(`
    DELETE FROM messages WHERE conversation_id = ?
  `);

  const result = stmt.run(conversationId);
  return result.changes;
}

/**
 * 搜索消息内容
 */
export function searchMessages(
  conversationId: string,
  query: string
): Message[] {
  const stmt = db().prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ? AND content LIKE ?
    ORDER BY created_at DESC
    LIMIT 50
  `);

  const searchPattern = `%${query}%`;
  const rows = stmt.all(conversationId, searchPattern) as any[];

  return rows.map(row => ({
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata) || {},
    created_at: new Date(row.created_at),
  }));
}

/**
 * 获取消息统计信息
 */
export function getMessageStats(conversationId?: string): {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  averageLength: number;
  ragMessages: number;
} {
  const baseWhere = conversationId ? 'WHERE conversation_id = ?' : '';
  const params = conversationId ? [conversationId] : [];

  const totalStmt = db().prepare(
    `SELECT COUNT(*) as count FROM messages ${baseWhere}`
  );
  const totalRow = totalStmt.get(...params) as any;

  const userStmt = db().prepare(
    `SELECT COUNT(*) as count FROM messages ${baseWhere}
     ${conversationId ? 'AND' : 'WHERE'} role = 'user'`
  );
  const userRow = userStmt.get(...params) as any;

  const assistantStmt = db().prepare(
    `SELECT COUNT(*) as count FROM messages ${baseWhere}
     ${conversationId ? 'AND' : 'WHERE'} role = 'assistant'`
  );
  const assistantRow = assistantStmt.get(...params) as any;

  const avgStmt = db().prepare(
    `SELECT AVG(LENGTH(content)) as average FROM messages ${baseWhere}`
  );
  const avgRow = avgStmt.get(...params) as any;

  // RAG消息：metadata中包含sources字段
  const ragStmt = db().prepare(
    `SELECT COUNT(*) as count FROM messages ${baseWhere}
     ${conversationId ? 'AND' : 'WHERE'} metadata LIKE '%"sources"%'`
  );
  const ragRow = ragStmt.get(...params) as any;

  return {
    totalMessages: totalRow.count,
    userMessages: userRow.count,
    assistantMessages: assistantRow.count,
    averageLength: Math.round(avgRow.average || 0),
    ragMessages: ragRow.count,
  };
}

/**
 * 获取对话上下文（用于AI生成）
 */
export function getConversationContext(
  conversationId: string,
  maxMessages: number = 20
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages = getLastMessages(conversationId, maxMessages);

  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * 保存AI响应
 */
export function saveAIResponse(
  conversationId: string,
  content: string,
  metadata?: {
    routing_strategy?: 'ai_native' | 'rag_retrieval' | 'hybrid';
    sources?: string[];
    model?: string;
    tokens?: number;
    [key: string]: any;
  }
): Message {
  return createMessage({
    conversation_id: conversationId,
    role: 'assistant',
    content,
    metadata: metadata || {},
  });
}

/**
 * 保存用户消息
 */
export function saveUserMessage(
  conversationId: string,
  content: string,
  metadata?: Record<string, any>
): Message {
  return createMessage({
    conversation_id: conversationId,
    role: 'user',
    content,
    metadata: metadata || {},
  });
}

/**
 * 获取RAG增强的消息
 */
export function getRAGMessages(conversationId?: string): Array<Message & { sources: string[] }> {
  let sql = `
    SELECT * FROM messages
    WHERE metadata LIKE '%"sources"%'
  `;

  if (conversationId) {
    sql = `
      SELECT * FROM messages
      WHERE conversation_id = ? AND metadata LIKE '%"sources"%'
    `;
  }

  sql += ' ORDER BY created_at DESC LIMIT 100';

  const stmt = db().prepare(sql);
  const rows = conversationId
    ? stmt.all(conversationId)
    : stmt.all();

  return (rows as any[]).map(row => {
    const metadata = parseJson(row.metadata) || {};
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      metadata,
      created_at: new Date(row.created_at),
      sources: metadata.sources || [],
    };
  });
}

/**
 * 清空对话历史（保留对话但删除所有消息）
 */
export function clearConversationHistory(conversationId: string): number {
  return deleteMessagesByConversationId(conversationId);
}