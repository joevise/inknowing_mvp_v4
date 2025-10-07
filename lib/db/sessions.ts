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
export function createSession(input: CreateSessionInput): Session {
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

  stmt.run(
    id,
    input.user_id,
    sessionToken,
    expiresAt.toISOString(),
    createdAt.toISOString()
  );

  return getSessionById(id)!;
}

/**
 * 通过ID获取会话
 */
export function getSessionById(id: string): Session | null {
  const stmt = db().prepare(`
    SELECT * FROM sessions WHERE id = ?
  `);

  const row = stmt.get(id) as any;

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
export function getSessionByToken(token: string): Session | null {
  const stmt = db().prepare(`
    SELECT * FROM sessions WHERE session_token = ?
  `);

  const row = stmt.get(token) as any;

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
export function validateSession(token: string): {
  valid: boolean;
  session?: Session;
  userId?: string;
  reason?: string;
} {
  const session = getSessionByToken(token);

  if (!session) {
    return {
      valid: false,
      reason: 'Session not found',
    };
  }

  const now = new Date();
  if (session.expires_at < now) {
    // 会话已过期，删除它
    deleteSession(session.id);
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
export function renewSession(id: string, hoursToAdd: number = 24): Session | null {
  const session = getSessionById(id);
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

  stmt.run(newExpiresAt.toISOString(), id);

  return getSessionById(id);
}

/**
 * 删除会话（登出）
 */
export function deleteSession(id: string): boolean {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 删除用户的所有会话
 */
export function deleteUserSessions(userId: string): number {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE user_id = ?
  `);

  const result = stmt.run(userId);
  return result.changes;
}

/**
 * 删除过期的会话（清理任务）
 */
export function deleteExpiredSessions(): number {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE expires_at < ?
  `);

  const result = stmt.run(now().toISOString());
  return result.changes;
}

/**
 * 获取用户的活跃会话
 */
export function getUserActiveSessions(userId: string): Session[] {
  const stmt = db().prepare(`
    SELECT * FROM sessions
    WHERE user_id = ? AND expires_at > ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(userId, now().toISOString()) as any[];

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
export function getSessionStats(): {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  uniqueUsers: number;
} {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM sessions');
  const totalRow = totalStmt.get() as any;

  const activeStmt = db().prepare(
    'SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?'
  );
  const activeRow = activeStmt.get(now().toISOString()) as any;

  const expiredStmt = db().prepare(
    'SELECT COUNT(*) as count FROM sessions WHERE expires_at <= ?'
  );
  const expiredRow = expiredStmt.get(now().toISOString()) as any;

  const uniqueStmt = db().prepare(
    'SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE expires_at > ?'
  );
  const uniqueRow = uniqueStmt.get(now().toISOString()) as any;

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
export function createOrUpdateSession(userId: string): Session {
  const activeSessions = getUserActiveSessions(userId);

  if (activeSessions.length > 0) {
    // 续期最新的会话
    const latestSession = activeSessions[0];
    return renewSession(latestSession.id)!;
  }

  // 创建新会话
  return createSession({ user_id: userId });
}

/**
 * 通过token删除会话
 */
export function deleteSessionByToken(token: string): boolean {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE session_token = ?
  `);

  const result = stmt.run(token);
  return result.changes > 0;
}

/**
 * 管理员会话相关
 */
const ADMIN_SESSION_PREFIX = 'admin_';

/**
 * 创建管理员会话
 */
export function createAdminSession(adminId: string = 'admin'): Session {
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

  stmt.run(id, adminId, sessionToken, expiresAt.toISOString(), createdAt.toISOString());

  return getSessionById(id)!;
}

/**
 * 验证管理员会话
 */
export function validateAdminSession(token: string): {
  valid: boolean;
  session?: Session;
  reason?: string;
} {
  if (!token.startsWith(ADMIN_SESSION_PREFIX)) {
    return {
      valid: false,
      reason: 'Not an admin session',
    };
  }

  return validateSession(token);
}

/**
 * 清理所有管理员会话
 */
export function clearAdminSessions(): number {
  const stmt = db().prepare(`
    DELETE FROM sessions WHERE session_token LIKE ?
  `);

  const result = stmt.run(ADMIN_SESSION_PREFIX + '%');
  return result.changes;
}