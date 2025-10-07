/**
 * 用户表CRUD操作
 */

import { db, generateId, now, transaction } from './client';
import type { User } from './schema';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  email: string;
  password: string;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
}

/**
 * 创建新用户
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const { email, password } = input;

  // 检查邮箱是否已存在
  const existing = getUserByEmail(email);
  if (existing) {
    throw new Error('Email already exists');
  }

  // 哈希密码
  const passwordHash = await bcrypt.hash(password, 10);

  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO users (id, email, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, email, passwordHash, timestamp, timestamp);

  return getUserById(id)!;
}

/**
 * 通过ID获取用户
 */
export function getUserById(id: string): User | null {
  const stmt = db().prepare(`
    SELECT * FROM users WHERE id = ?
  `);

  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 通过邮箱获取用户
 */
export function getUserByEmail(email: string): User | null {
  const stmt = db().prepare(`
    SELECT * FROM users WHERE email = ?
  `);

  const row = stmt.get(email) as any;

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 验证用户密码
 */
export async function verifyUserPassword(
  email: string,
  password: string
): Promise<User | null> {
  const user = getUserByEmail(email);

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    return null;
  }

  return user;
}

/**
 * 更新用户
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<User | null> {
  const user = getUserById(id);
  if (!user) {
    throw new Error('User not found');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (input.email !== undefined) {
    // 检查新邮箱是否已被使用
    const existing = getUserByEmail(input.email);
    if (existing && existing.id !== id) {
      throw new Error('Email already in use');
    }
    updates.push('email = ?');
    values.push(input.email);
  }

  if (input.password !== undefined) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    updates.push('password_hash = ?');
    values.push(passwordHash);
  }

  if (updates.length === 0) {
    return user;
  }

  updates.push('updated_at = ?');
  values.push(now().toISOString());
  values.push(id);

  const stmt = db().prepare(`
    UPDATE users
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  return getUserById(id);
}

/**
 * 删除用户
 */
export function deleteUser(id: string): boolean {
  const stmt = db().prepare(`
    DELETE FROM users WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 获取所有用户（分页）
 */
export function listUsers(options?: {
  limit?: number;
  offset?: number;
}): { users: User[]; total: number } {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // 获取总数
  const countStmt = db().prepare('SELECT COUNT(*) as total FROM users');
  const countRow = countStmt.get() as any;
  const total = countRow.total;

  // 获取用户列表
  const stmt = db().prepare(`
    SELECT * FROM users
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset) as any[];

  const users = rows.map(row => ({
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));

  return { users, total };
}

/**
 * 搜索用户
 */
export function searchUsers(query: string): User[] {
  const stmt = db().prepare(`
    SELECT * FROM users
    WHERE email LIKE ?
    ORDER BY created_at DESC
    LIMIT 50
  `);

  const rows = stmt.all(`%${query}%`) as any[];

  return rows.map(row => ({
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 批量创建用户（用于测试）
 */
export async function bulkCreateUsers(
  users: CreateUserInput[]
): Promise<User[]> {
  return transaction(async () => {
    const created: User[] = [];

    for (const userInput of users) {
      const user = await createUser(userInput);
      created.push(user);
    }

    return created;
  });
}

/**
 * 获取用户统计信息
 */
export function getUserStats(): {
  totalUsers: number;
  todayRegistrations: number;
  activeUsers: number;
} {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM users');
  const totalRow = totalStmt.get() as any;

  const todayStmt = db().prepare(`
    SELECT COUNT(*) as count FROM users
    WHERE DATE(created_at) = DATE('now')
  `);
  const todayRow = todayStmt.get() as any;

  // 活跃用户：有对话记录的用户
  const activeStmt = db().prepare(`
    SELECT COUNT(DISTINCT user_id) as count FROM conversations
  `);
  const activeRow = activeStmt.get() as any;

  return {
    totalUsers: totalRow.count,
    todayRegistrations: todayRow.count,
    activeUsers: activeRow.count,
  };
}