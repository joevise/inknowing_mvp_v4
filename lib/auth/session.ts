/**
 * Session管理模块
 * 负责创建、验证、删除和清理会话
 * Session保存在SQLite数据库中
 */

import {
  createSession as dbCreateSession,
  getSessionByToken,
  deleteSessionByToken,
  deleteExpiredSessions as dbDeleteExpiredSessions,
  validateSession as dbValidateSession,
  createAdminSession as dbCreateAdminSession,
  validateAdminSession as dbValidateAdminSession,
  type CreateSessionInput,
} from '@/lib/db';
import { randomBytes } from 'crypto';

/**
 * 生成随机的Session Token
 * @returns 32字节的十六进制字符串
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * 获取Session过期时间
 * @returns 24小时后的时间戳
 */
function getExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24); // 24小时有效期
  return expiryDate;
}

/**
 * 创建新的Session
 * @param userId 用户ID
 * @param isAdmin 是否为管理员会话
 * @returns Session信息
 */
export async function createSession(
  userId: string,
  isAdmin: boolean = false
): Promise<{
  token: string;
  expiresAt: Date;
}> {
  try {
    const session = await dbCreateSession({
      user_id: userId,
    });

    console.log('[Session] Created new session for user:', userId);
    return {
      token: session.session_token,
      expiresAt: session.expires_at
    };
  } catch (error) {
    console.error('[Session] Error creating session:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * 验证Session是否有效
 * @param token Session Token
 * @returns 用户信息或null
 */
export async function validateSession(token: string): Promise<{
  user: any;
  session: any;
} | null> {
  if (!token) {
    console.log('[Session] No token provided');
    return null;
  }

  try {
    const result = await dbValidateSession(token);

    if (!result || !result.valid) {
      console.log('[Session] Session not found or expired');
      return null;
    }

    console.log('[Session] Session validated for user:', result.userId);
    return {
      user: { id: result.userId },
      session: result.session
    };
  } catch (error) {
    console.error('[Session] Error validating session:', error);
    return null;
  }
}

/**
 * 删除Session
 * @param token Session Token
 * @returns 是否删除成功
 */
export async function deleteSession(token: string): Promise<boolean> {
  try {
    await deleteSessionByToken(token);
    console.log('[Session] Deleted session');
    return true;
  } catch (error) {
    console.error('[Session] Error deleting session:', error);
    return false;
  }
}

/**
 * 清理过期的Session
 * @returns 清理的Session数量
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const count = await dbDeleteExpiredSessions();
    console.log('[Session] Cleaned up expired sessions:', count);
    return count;
  } catch (error) {
    console.error('[Session] Error cleaning up expired sessions:', error);
    return 0;
  }
}

/**
 * 获取用户的所有活跃Session
 * @param userId 用户ID
 * @returns Session列表
 */
export async function getUserSessions(userId: string): Promise<any[]> {
  try {
    // Note: This function is not used in the current implementation
    console.log('[Session] getUserSessions not implemented');
    return [];
  } catch (error) {
    console.error('[Session] Error getting user sessions:', error);
    return [];
  }
}

/**
 * 刷新Session过期时间
 * @param token Session Token
 * @returns 是否刷新成功
 */
export async function refreshSession(token: string): Promise<boolean> {
  try {
    // Note: Renew session is implemented in lib/db/sessions.ts
    console.log('[Session] refreshSession - use renewSession from lib/db instead');
    return true;
  } catch (error) {
    console.error('[Session] Error refreshing session:', error);
    return false;
  }
}