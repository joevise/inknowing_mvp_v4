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
export async function createMessage(input: CreateMessageInput): Promise<Message> {
  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO messages (
      id, conversation_id, role, content, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  await stmt.run(
    id,
    input.conversation_id,
    input.role,
    input.content,
    toJson(input.metadata || {}),
    timestamp
  );

  // 更新对话的最后活动时间
  await touchConversation(input.conversation_id);

  return (await getMessageById(id))!;
}

/**
 * 通过ID获取消息
 */
export async function getMessageById(id: string): Promise<Message | null> {
  const stmt = db().prepare(`
    SELECT * FROM messages WHERE id = ?
  `);

  const row = await stmt.get(id) as any;

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
export async function getMessagesByConversationId(
  conversationId: string,
  options?: {
    limit?: number;
    offset?: number;
    order?: 'asc' | 'desc';
  }
): Promise<Message[]> {
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
    ? await stmt.all(conversationId, limit, offset)
    : await stmt.all(conversationId);

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
export async function getLastMessages(
  conversationId: string,
  count: number = 10
): Promise<Message[]> {
  const stmt = db().prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = await stmt.all(conversationId, count) as any[];

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
export async function getMessageWithMetadata(id: string): Promise<MessageWithMetadata | null> {
  const message = await getMessageById(id);
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
export async function bulkCreateMessages(messages: CreateMessageInput[]): Promise<Message[]> {
  return transaction(async () => {
    const created: Message[] = [];

    for (const messageInput of messages) {
      const message = await createMessage(messageInput);
      created.push(message);
    }

    return created;
  });
}

/**
 * 删除消息
 */
export async function deleteMessage(id: string): Promise<boolean> {
  const stmt = db().prepare(`
    DELETE FROM messages WHERE id = ?
  `);

  const result = await stmt.run(id);
  return result.changes > 0;
}

/**
 * 删除对话的所有消息
 */
export async function deleteMessagesByConversationId(conversationId: string): Promise<number> {
  const stmt = db().prepare(`
    DELETE FROM messages WHERE conversation_id = ?
  `);

  const result = await stmt.run(conversationId);
  return result.changes;
}

/**
 * 搜索消息内容
 */
export async function searchMessages(
  conversationId: string,
  query: string
): Promise<Message[]> {
  const stmt = db().prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ? AND content LIKE ?
    ORDER BY created_at DESC
    LIMIT 50
  `);

  const searchPattern = `%${query}%`;
  const rows = await stmt.all(conversationId, searchPattern) as any[];

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
export async function getMessageStats(conversationId?: string): Promise<{
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  averageLength: number;
  ragMessages: number;
}> {
  const baseWhere = conversationId ? 'WHERE conversation_id = ?' : '';
  const params = conversationId ? [conversationId] : [];

  const totalStmt = db().prepare(
    `SELECT COUNT(*) as count FROM messages ${baseWhere}`
  );
  const totalRow = await totalStmt.get(...params) as any;

  const userStmt = db().prepare(
    `SELECT COUNT(*) as count FROM messages ${baseWhere}
     ${conversationId ? 'AND' : 'WHERE'} role = 'user'`
  );
  const userRow = await userStmt.get(...params) as any;

  const assistantStmt = db().prepare(
    `SELECT COUNT(*) as count FROM messages ${baseWhere}
     ${conversationId ? 'AND' : 'WHERE'} role = 'assistant'`
  );
  const assistantRow = await assistantStmt.get(...params) as any;

  const avgStmt = db().prepare(
    `SELECT AVG(LENGTH(content)) as average FROM messages ${baseWhere}`
  );
  const avgRow = await avgStmt.get(...params) as any;

  // RAG消息：metadata中包含sources字段
  const ragStmt = db().prepare(
    `SELECT COUNT(*) as count FROM messages ${baseWhere}
     ${conversationId ? 'AND' : 'WHERE'} metadata LIKE '%"sources"%'`
  );
  const ragRow = await ragStmt.get(...params) as any;

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
export async function getConversationContext(
  conversationId: string,
  maxMessages: number = 20
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const messages = await getLastMessages(conversationId, maxMessages);

  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * 保存AI响应
 */
export async function saveAIResponse(
  conversationId: string,
  content: string,
  metadata?: {
    routing_strategy?: 'ai_native' | 'rag_retrieval' | 'hybrid';
    sources?: string[];
    model?: string;
    tokens?: number;
    [key: string]: any;
  }
): Promise<Message> {
  return await createMessage({
    conversation_id: conversationId,
    role: 'assistant',
    content,
    metadata: metadata || {},
  });
}

/**
 * 保存用户消息
 */
export async function saveUserMessage(
  conversationId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<Message> {
  return await createMessage({
    conversation_id: conversationId,
    role: 'user',
    content,
    metadata: metadata || {},
  });
}

/**
 * 获取RAG增强的消息
 */
export async function getRAGMessages(conversationId?: string): Promise<Array<Message & { sources: string[] }>> {
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
    ? await stmt.all(conversationId)
    : await stmt.all();

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
export async function clearConversationHistory(conversationId: string): Promise<number> {
  return await deleteMessagesByConversationId(conversationId);
}
