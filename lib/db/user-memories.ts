/**
 * 用户跨会话全局记忆 DAO
 * 以 user_id 隔离，跨书籍/角色共享。
 */

import { db, now } from './client';
import type { UserMemory } from './schema';
import { randomUUID } from 'crypto';

export interface CreateUserMemoryInput {
  user_id: string;
  memory_type: UserMemory['memory_type'];
  content: string;
  source_conversation_id?: string | null;
  source_book_id?: string | null;
  importance?: number;
}

function rowToUserMemory(row: any): UserMemory {
  return {
    id: row.id,
    user_id: row.user_id,
    memory_type: row.memory_type,
    content: row.content,
    source_conversation_id: row.source_conversation_id ?? null,
    source_book_id: row.source_book_id ?? null,
    importance: row.importance ?? 0.5,
    access_count: row.access_count ?? 0,
    last_accessed_at: row.last_accessed_at ? new Date(row.last_accessed_at) : null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 创建一条用户记忆
 */
export async function createUserMemory(input: CreateUserMemoryInput): Promise<UserMemory> {
  const id = randomUUID();
  const timestamp = now().toISOString();
  const importance = input.importance ?? 0.5;

  const stmt = db().prepare(`
    INSERT INTO user_memories (
      id, user_id, memory_type, content,
      source_conversation_id, source_book_id,
      importance, access_count, last_accessed_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await stmt.run(
    id,
    input.user_id,
    input.memory_type,
    input.content,
    input.source_conversation_id ?? null,
    input.source_book_id ?? null,
    importance,
    0,
    null,
    timestamp,
    timestamp
  );

  return (await getUserMemoryById(id))!;
}

/**
 * 通过 ID 获取单条记忆
 */
export async function getUserMemoryById(id: string): Promise<UserMemory | null> {
  const stmt = db().prepare(`
    SELECT * FROM user_memories WHERE id = ?
  `);

  const row = await stmt.get(id) as any;
  if (!row) return null;
  return rowToUserMemory(row);
}

/**
 * 获取用户的记忆列表
 */
export async function getUserMemories(
  userId: string,
  options?: {
    limit?: number;
    memoryType?: UserMemory['memory_type'];
    minImportance?: number;
  }
): Promise<UserMemory[]> {
  const conditions: string[] = ['user_id = ?'];
  const values: any[] = [userId];

  if (options?.memoryType) {
    conditions.push('memory_type = ?');
    values.push(options.memoryType);
  }

  if (options?.minImportance !== undefined) {
    conditions.push('importance >= ?');
    values.push(options.minImportance);
  }

  const limit = options?.limit ?? 20;
  values.push(limit);

  const stmt = db().prepare(`
    SELECT * FROM user_memories
    WHERE ${conditions.join(' AND ')}
    ORDER BY importance DESC, updated_at DESC
    LIMIT ?
  `);

  const rows = await stmt.all(...values) as any[];
  return rows.map(rowToUserMemory);
}

/**
 * 获取最高重要度的记忆，用于注入对话上下文
 */
export async function getTopMemoriesForInjection(
  userId: string,
  limit: number = 12
): Promise<UserMemory[]> {
  const stmt = db().prepare(`
    SELECT * FROM user_memories
    WHERE user_id = ?
    ORDER BY importance DESC, updated_at DESC
    LIMIT ?
  `);

  const rows = await stmt.all(userId, limit) as any[];
  return rows.map(rowToUserMemory);
}

/**
 * 更新记忆重要度
 */
export async function updateMemoryImportance(id: string, importance: number): Promise<void> {
  const stmt = db().prepare(`
    UPDATE user_memories
    SET importance = ?
    WHERE id = ?
  `);

  await stmt.run(importance, id);
}

/**
 * 更新记忆访问计数
 */
export async function touchMemoryAccess(id: string): Promise<void> {
  const stmt = db().prepare(`
    UPDATE user_memories
    SET access_count = access_count + 1,
        last_accessed_at = ?
    WHERE id = ?
  `);

  await stmt.run(now().toISOString(), id);
}

/**
 * 删除单条记忆
 */
export async function deleteUserMemory(id: string): Promise<void> {
  const stmt = db().prepare(`
    DELETE FROM user_memories WHERE id = ?
  `);

  await stmt.run(id);
}

/**
 * 统计用户记忆数量
 */
export async function countUserMemories(userId: string): Promise<number> {
  const stmt = db().prepare(`
    SELECT COUNT(*) as count FROM user_memories WHERE user_id = ?
  `);

  const row = await stmt.get(userId) as any;
  return row.count ?? 0;
}
