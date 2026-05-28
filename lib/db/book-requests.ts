// @ts-nocheck
/**
 * 用户书籍申请表CRUD操作
 */

import { db, generateId, now, toJson, parseJson, transaction } from './client';
import type { UserBookRequest } from './schema';

export interface CreateUserBookRequestInput {
  user_id: string;
  title: string;
  author?: string;
}

export interface UpdateUserBookRequestInput {
  title?: string;
  author?: string;
  status?: 'pending' | 'processing' | 'created' | 'wishlist' | 'rejected' | 'failed';
  book_id?: string;
  ai_confidence?: number;
  error_message?: string;
}

function parseRow(row: any): UserBookRequest {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    author: row.author,
    status: row.status,
    book_id: row.book_id,
    ai_confidence: row.ai_confidence,
    error_message: row.error_message,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 创建用户书籍申请
 */
export function createUserBookRequest(input: CreateUserBookRequestInput): UserBookRequest {
  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO user_book_requests (
      id, user_id, title, author, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.user_id,
    input.title,
    input.author || null,
    'pending',
    timestamp,
    timestamp
  );

  return getUserBookRequestById(id)!;
}

/**
 * 通过ID获取申请
 */
export function getUserBookRequestById(id: string): UserBookRequest | null {
  const stmt = db().prepare(`
    SELECT * FROM user_book_requests WHERE id = ?
  `);

  const row = stmt.get(id) as any;

  if (!row) return null;

  return parseRow(row);
}

/**
 * 更新申请状态
 */
export function updateUserBookRequest(id: string, input: UpdateUserBookRequestInput): UserBookRequest | null {
  const request = getUserBookRequestById(id);
  if (!request) {
    throw new Error('UserBookRequest not found');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }

  if (input.book_id !== undefined) {
    updates.push('book_id = ?');
    values.push(input.book_id);
  }

  if (input.ai_confidence !== undefined) {
    updates.push('ai_confidence = ?');
    values.push(input.ai_confidence);
  }

  if (input.error_message !== undefined) {
    updates.push('error_message = ?');
    values.push(input.error_message);
  }

  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }

  if (input.author !== undefined) {
    updates.push('author = ?');
    values.push(input.author);
  }

  if (updates.length === 0) {
    return request;
  }

  updates.push('updated_at = ?');
  values.push(now().toISOString());
  values.push(id);

  const stmt = db().prepare(`
    UPDATE user_book_requests
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  return getUserBookRequestById(id);
}

/**
 * 删除申请
 */
export function deleteUserBookRequest(id: string): boolean {
  const stmt = db().prepare(`
    DELETE FROM user_book_requests WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 获取用户的所有申请
 */
export function getUserBookRequests(userId: string, options?: {
  status?: 'pending' | 'processing' | 'created' | 'wishlist' | 'rejected' | 'failed';
  limit?: number;
  offset?: number;
}): { requests: UserBookRequest[]; total: number } {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  const conditions: string[] = ['user_id = ?'];
  const values: any[] = [userId];

  if (options?.status) {
    conditions.push('status = ?');
    values.push(options.status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countStmt = db().prepare(`
    SELECT COUNT(*) as total FROM user_book_requests ${whereClause}
  `);
  const countRow = countStmt.get(...values) as any;
  const total = countRow.total;

  const stmt = db().prepare(`
    SELECT * FROM user_book_requests
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...values, limit, offset) as any[];

  return {
    requests: rows.map(parseRow),
    total,
  };
}

/**
 * 获取所有申请（管理员用）
 */
export function listUserBookRequests(options?: {
  status?: 'pending' | 'processing' | 'created' | 'wishlist' | 'rejected' | 'failed';
  user_id?: string;
  limit?: number;
  offset?: number;
}): { requests: (UserBookRequest & { username?: string })[]; total: number } {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const conditions: string[] = [];
  const values: any[] = [];

  if (options?.status) {
    conditions.push('ubr.status = ?');
    values.push(options.status);
  }

  if (options?.user_id) {
    conditions.push('ubr.user_id = ?');
    values.push(options.user_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countStmt = db().prepare(`
    SELECT COUNT(*) as total FROM user_book_requests ubr ${whereClause}
  `);
  const countRow = countStmt.get(...values) as any;
  const total = countRow.total;

  const stmt = db().prepare(`
    SELECT ubr.*, u.username
    FROM user_book_requests ubr
    LEFT JOIN users u ON ubr.user_id = u.id
    ${whereClause}
    ORDER BY ubr.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...values, limit, offset) as any[];

  return {
    requests: rows.map(row => ({
      ...parseRow(row),
      username: row.username,
    })),
    total,
  };
}

/**
 * 统计用户今天的申请数量
 */
export function getUserRequestCountToday(userId: string): number {
  const stmt = db().prepare(`
    SELECT COUNT(*) as count FROM user_book_requests
    WHERE user_id = ? AND DATE(created_at) = DATE('now')
  `);

  const row = stmt.get(userId) as any;
  return row.count;
}

/**
 * 检查是否已有相同标题的申请或书籍
 */
export function checkDuplicateRequest(userId: string, title: string): { hasBook: boolean; hasRequest: boolean; book_id?: string; request_id?: string } {
  const bookStmt = db().prepare(`
    SELECT id FROM books WHERE title LIKE ? LIMIT 1
  `);
  const bookRow = bookStmt.get(`%${title}%`) as any;

  const requestStmt = db().prepare(`
    SELECT id, status FROM user_book_requests
    WHERE user_id = ? AND title LIKE ? AND status NOT IN ('rejected', 'failed')
    ORDER BY created_at DESC LIMIT 1
  `);
  const requestRow = requestStmt.get(userId, `%${title}%`) as any;

  return {
    hasBook: !!bookRow,
    hasRequest: !!requestRow,
    book_id: bookRow?.id,
    request_id: requestRow?.id,
  };
}