/**
 * Session表CRUD操作
 */

import { db, generateId, now } from './client';
import type { Session } from './schema';
import { randomBytes } from 'crypto';

export interface CreateSessionInput {
  user_id: string;
  expires_in_hours?: number; // 默认24小时
}

/**
 * 生成安全的session token
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * 创建新会话
 */
export async function createSession(input: CreateSessionInput): Promise<Session> {
  const id = generateId();
  const sessionToken = generateSessionToken();
  const createdAt = new Date();

  // 默认24小时过期
  const expiresInHours = input.expires_in_hours || 24;
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  const stmt = db().prepare(`
    INSERT INTO sessions (
      id, user_id, session_token, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  await stmt.run(
    id,
    input.user_id,
    sessionToken,
    expiresAt.toISOString(),
    createdAt.toISOString()
  );

  return (await getSessionById(id))!;
}

/**
 * 通过ID获取会话
 */
export async function getSessionById(id: string): Promise<Session | null> {
  const stmt = db().prepare(`
    SELECT * FROM sessions WHERE id = ?
  `);

  const row = await stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    session_token: row.session_token,
    expires_at: new Date(row.expires_at),
    created_at: new Date(row.created_at),
  };
}

/**
 * 通过token获取会话
 */
export async function getSessionByToken(token: string): Promise<Session | null> {
  const stmt = db().prepare(`
    SELECT * FROM sessions WHERE session_token = ?
  `);

  const row = await stmt.get(token) as any;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    session_token: row.session_token,
    expires_at: new Date(row.expires_at),
    created_at: new Date(row.created_at),
  };
}

/**
 * 验证会话是否有效
 */
export async function validateSession(token: string): Promise<{
  valid: boolean;
  session?: Session;
  userId?: string;
  reason?: string;
}> {
  const session = await getSessionByToken(token);

  if (!session) {
    return {
      valid: false,
      reason: 'Session not found',
    };
  }

  const nowDate = new Date();
  if (session.expires_at < nowDate) {
    // 会话已过期，删除它
    await deleteSession(session.id);
    return {
      valid: false,
      reason: 'Session expired',
    };
  }

  return {
    valid: true,
    session,
    userId: session.user_id,
  };
}

/**
 * 续期会话
 */
export async function renewSession(id: string, hoursToAdd: number = 24): Promise<Session | null> {
  const session = await getSessionById(id);
  if (!session) {
    throw new Error('Session not found');
  }

  const newExpiresAt = new Date();
  newExpiresAt.setHours(newExpiresAt.getHours() + hoursToAdd);

  const stmt = db().prepare(`
    UPDATE sessions
    SET expires_at = ?
    WHERE id = ?
  `);

  await stmt.run(newExpiresAt.toISOString(), id);

  return await getSessionById(id);
}

/**
 * 删除会话（登出）
 */
export async function deleteSession(id: string): Promise<boolean> {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE id = ?
  `);

  const result = await stmt.run(id);
  return result.changes > 0;
}

/**
 * 删除用户的所有会话
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE user_id = ?
  `);

  const result = await stmt.run(userId);
  return result.changes;
}

/**
 * 删除过期的会话（清理任务）
 */
export async function deleteExpiredSessions(): Promise<number> {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE expires_at < ?
  `);

  const result = await stmt.run(now().toISOString());
  return result.changes;
}

/**
 * 获取用户的活跃会话
 */
export async function getUserActiveSessions(userId: string): Promise<Session[]> {
  const stmt = db().prepare(`
    SELECT * FROM sessions
    WHERE user_id = ? AND expires_at > ?
    ORDER BY created_at DESC
  `);

  const rows = await stmt.all(userId, now().toISOString()) as any[];

  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    session_token: row.session_token,
    expires_at: new Date(row.expires_at),
    created_at: new Date(row.created_at),
  }));
}

/**
 * 获取会话统计信息
 */
export async function getSessionStats(): Promise<{
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  uniqueUsers: number;
}> {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM sessions');
  const totalRow = await totalStmt.get() as any;

  const activeStmt = db().prepare(
    'SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?'
  );
  const activeRow = await activeStmt.get(now().toISOString()) as any;

  const expiredStmt = db().prepare(
    'SELECT COUNT(*) as count FROM sessions WHERE expires_at <= ?'
  );
  const expiredRow = await expiredStmt.get(now().toISOString()) as any;

  const uniqueStmt = db().prepare(
    'SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE expires_at > ?'
  );
  const uniqueRow = await uniqueStmt.get(now().toISOString()) as any;

  return {
    totalSessions: totalRow.count,
    activeSessions: activeRow.count,
    expiredSessions: expiredRow.count,
    uniqueUsers: uniqueRow.count,
  };
}

/**
 * 创建或更新会话
 * 如果用户已有活跃会话，续期；否则创建新会话
 */
export async function createOrUpdateSession(userId: string): Promise<Session> {
  const activeSessions = await getUserActiveSessions(userId);

  if (activeSessions.length > 0) {
    // 续期最新的会话
    const latestSession = activeSessions[0];
    return (await renewSession(latestSession.id))!;
  }

  // 创建新会话
  return await createSession({ user_id: userId });
}

/**
 * 通过token删除会话
 */
export async function deleteSessionByToken(token: string): Promise<boolean> {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE session_token = ?
  `);

  const result = await stmt.run(token);
  return result.changes > 0;
}

/**
 * 管理员会话相关
 */
const ADMIN_SESSION_PREFIX = 'admin_';

/**
 * 创建管理员会话
 */
export async function createAdminSession(adminId: string = 'admin'): Promise<Session> {
  const id = generateId();
  const sessionToken = ADMIN_SESSION_PREFIX + generateSessionToken();
  const createdAt = new Date();

  // 管理员会话默认8小时过期
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + 8);

  const stmt = db().prepare(`
    INSERT INTO sessions (
      id, user_id, session_token, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  await stmt.run(id, adminId, sessionToken, expiresAt.toISOString(), createdAt.toISOString());

  return (await getSessionById(id))!;
}

/**
 * 验证管理员会话
 */
export async function validateAdminSession(token: string): Promise<{
  valid: boolean;
  session?: Session;
  reason?: string;
}> {
  if (!token.startsWith(ADMIN_SESSION_PREFIX)) {
    return {
      valid: false,
      reason: 'Not an admin session',
    };
  }

  return await validateSession(token);
}

/**
 * 清理所有管理员会话
 */
export async function clearAdminSessions(): Promise<number> {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE session_token LIKE ?
  `);

  const result = await stmt.run(ADMIN_SESSION_PREFIX + '%');
  return result.changes;
}
