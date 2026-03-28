/**
 * Cookie管理工具
 * 负责Session Cookie的设置、获取和清除
 * 使用Next.js的cookies API
 */

import { cookies } from 'next/headers';

// Cookie名称常量
export const SESSION_COOKIE_NAME = 'session';
export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';

// Cookie配置
const COOKIE_OPTIONS = {
  httpOnly: true,        // 防止JavaScript访问，增加安全性
  secure: false, // 生产环境使用HTTPS
  sameSite: 'lax' as const,      // CSRF保护
  maxAge: 60 * 60 * 24,  // 24小时
  path: '/',             // 全站可用
};

/**
 * 设置用户Session Cookie
 * @param token Session Token
 * @param expiresAt Session过期时间
 */
export async function setSessionCookie(token: string, expiresAt?: Date) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    expires: expiresAt || new Date(Date.now() + COOKIE_OPTIONS.maxAge * 1000),
  });

  console.log('[Cookie] Set session cookie');
}

/**
 * 设置管理员Session Cookie
 * @param token Session Token
 * @param expiresAt Session过期时间
 */
export async function setAdminSessionCookie(token: string, expiresAt?: Date) {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    expires: expiresAt || new Date(Date.now() + COOKIE_OPTIONS.maxAge * 1000),
  });

  console.log('[Cookie] Set admin session cookie');
}

/**
 * 获取用户Session Cookie
 * @returns Session Token或null
 */
export async function getSessionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (cookie?.value) {
    console.log('[Cookie] Retrieved session cookie');
    return cookie.value;
  }

  console.log('[Cookie] No session cookie found');
  return null;
}

/**
 * 获取管理员Session Cookie
 * @returns Session Token或null
 */
export async function getAdminSessionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ADMIN_SESSION_COOKIE_NAME);

  if (cookie?.value) {
    console.log('[Cookie] Retrieved admin session cookie');
    return cookie.value;
  }

  console.log('[Cookie] No admin session cookie found');
  return null;
}

/**
 * 清除用户Session Cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });

  console.log('[Cookie] Cleared session cookie');
}

/**
 * 清除管理员Session Cookie
 */
export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });

  console.log('[Cookie] Cleared admin session cookie');
}

/**
 * 清除所有认证相关的Cookie
 */
export async function clearAllAuthCookies() {
  await clearSessionCookie();
  await clearAdminSessionCookie();

  console.log('[Cookie] Cleared all auth cookies');
}

/**
 * 检查是否有有效的Session Cookie
 * @returns 是否存在Session Cookie
 */
export async function hasSessionCookie(): Promise<boolean> {
  const session = await getSessionFromCookie();
  return session !== null;
}

/**
 * 检查是否有有效的管理员Session Cookie
 * @returns 是否存在管理员Session Cookie
 */
export async function hasAdminSessionCookie(): Promise<boolean> {
  const session = await getAdminSessionFromCookie();
  return session !== null;
}