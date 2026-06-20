/**
 * 用户表CRUD操作
 */

import { db, generateId, now, transaction } from './client';
import type { User } from './schema';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  username: string;
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
  const { username, email, password } = input;

  // 检查邮箱是否已存在
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('Email already exists');
  }

  // 哈希密码
  const passwordHash = await bcrypt.hash(password, 10);

  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  await stmt.run(id, username, email, passwordHash, timestamp, timestamp);

  return (await getUserById(id))!;
}

/**
 * 通过ID获取用户
 */
export async function getUserById(id: string): Promise<User | null> {
  const stmt = db().prepare(`
    SELECT * FROM users WHERE id = ?
  `);

  const row = await stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    username: row.username || '',
    email: row.email,
    password_hash: row.password_hash,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 通过邮箱获取用户
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const stmt = db().prepare(`
    SELECT * FROM users WHERE email = ?
  `);

  const row = await stmt.get(email) as any;

  if (!row) return null;

  return {
    id: row.id,
    username: row.username || '',
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
  const user = await getUserByEmail(email);

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
  const user = await getUserById(id);
  if (!user) {
    throw new Error('User not found');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (input.email !== undefined) {
    // 检查新邮箱是否已被使用
    const existing = await getUserByEmail(input.email);
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

  await stmt.run(...values);

  return await getUserById(id);
}

/**
 * 删除用户
 */
export async function deleteUser(id: string): Promise<boolean> {
  const stmt = db().prepare(`
    DELETE FROM users WHERE id = ?
  `);

  const result = await stmt.run(id);
  return result.changes > 0;
}

/**
 * 获取所有用户（分页）
 */
export async function listUsers(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ users: User[]; total: number }> {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // 获取总数
  const countStmt = db().prepare('SELECT COUNT(*) as total FROM users');
  const countRow = await countStmt.get() as any;
  const total = countRow.total;

  // 获取用户列表
  const stmt = db().prepare(`
    SELECT * FROM users
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = await stmt.all(limit, offset) as any[];

  const users = rows.map(row => ({
    id: row.id,
    username: row.username || '',
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
export async function searchUsers(query: string): Promise<User[]> {
  const stmt = db().prepare(`
    SELECT * FROM users
    WHERE email LIKE ?
    ORDER BY created_at DESC
    LIMIT 50
  `);

  const rows = await stmt.all(`%${query}%`) as any[];

  return rows.map(row => ({
    id: row.id,
    username: row.username || '',
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
export async function getUserStats(): Promise<{
  totalUsers: number;
  todayRegistrations: number;
  activeUsers: number;
}> {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM users');
  const totalRow = await totalStmt.get() as any;

  const todayStmt = db().prepare(`
    SELECT COUNT(*) as count FROM users
    WHERE DATE(created_at) = DATE('now')
  `);
  const todayRow = await todayStmt.get() as any;

  // 活跃用户：有对话记录的用户
  const activeStmt = db().prepare(`
    SELECT COUNT(DISTINCT user_id) as count FROM conversations
  `);
  const activeRow = await activeStmt.get() as any;

  return {
    totalUsers: totalRow.count,
    todayRegistrations: todayRow.count,
    activeUsers: activeRow.count,
  };
}
