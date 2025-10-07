/**
 * 管理员认证模块
 * 处理管理员登录和会话管理
 * 使用环境变量中的ADMIN_PASSWORD进行验证
 */

import { createAdminSession as dbCreateAdminSession } from '@/lib/db/sessions';
import { setAdminSessionCookie } from './cookie';

/**
 * 获取管理员密码
 * 从环境变量中读取，没有设置则使用默认密码
 */
function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.warn('[Admin] No ADMIN_PASSWORD set in environment, using default');
    return 'admin123456'; // MVP默认密码，生产环境必须设置环境变量
  }

  return password;
}

/**
 * 验证管理员密码
 * @param password 输入的密码
 * @returns 密码是否正确
 */
export function verifyAdminPassword(password: string): boolean {
  const adminPassword = getAdminPassword();
  const isValid = password === adminPassword;

  console.log('[Admin] Password verification:', isValid ? 'success' : 'failed');
  return isValid;
}

/**
 * 创建管理员会话
 * @param adminId 管理员ID（可选，默认为admin）
 * @returns Session信息
 */
export async function createAdminSession(adminId: string = 'admin') {
  try {
    // 使用数据库层的 createAdminSession 创建带 admin_ 前缀的 token
    const session = dbCreateAdminSession(adminId);

    // 设置管理员cookie
    await setAdminSessionCookie(session.session_token, session.expires_at);

    console.log('[Admin] Admin session created successfully');
    return {
      success: true,
      session: session.session_token,
      expiresAt: session.expires_at,
    };
  } catch (error) {
    console.error('[Admin] Error creating admin session:', error);
    throw new Error('Failed to create admin session');
  }
}

/**
 * 检查是否设置了管理员密码
 * @returns 是否设置了密码
 */
export function hasAdminPasswordSet(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

/**
 * 获取管理员配置信息
 * @returns 配置信息（不包含密码）
 */
export function getAdminConfig() {
  return {
    hasPassword: hasAdminPasswordSet(),
    sessionDuration: '24 hours',
    features: {
      bookManagement: true,
      userManagement: true,
      aiConfig: true,
      analytics: false, // MVP阶段暂不支持
    },
  };
}