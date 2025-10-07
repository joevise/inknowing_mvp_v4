/**
 * 认证中间件
 * 提供路由保护和用户认证功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, getAdminSessionFromCookie } from './cookie';
import { validateSession } from './session';

/**
 * 从请求中获取Session信息
 * @param request Next.js请求对象
 * @returns 用户信息或null
 */
export async function getSessionFromRequest(request?: NextRequest) {
  try {
    // 获取session token - 如果有request对象,从request读取cookie;否则使用cookies()
    let token: string | null = null;

    if (request) {
      // Route Handler: 从request.cookies读取
      token = request.cookies.get('session')?.value || null;
      console.log('[Middleware] Reading cookie from request object, token:', token ? token.substring(0, 20) + '...' : 'null');
    } else {
      // Server Component: 使用cookies()函数
      token = await getSessionFromCookie();
      console.log('[Middleware] Reading cookie from cookies() function, token:', token ? token.substring(0, 20) + '...' : 'null');
    }

    if (!token) {
      console.log('[Middleware] No session token found');
      return null;
    }

    // 验证session
    const sessionData = await validateSession(token);

    if (!sessionData) {
      console.log('[Middleware] Invalid session');
      return null;
    }

    console.log('[Middleware] Session validated for user:', sessionData.user.id);
    return sessionData;
  } catch (error) {
    console.error('[Middleware] Error getting session:', error);
    return null;
  }
}

/**
 * 从请求中获取管理员Session信息
 * @param request Next.js请求对象
 * @returns 管理员信息或null
 */
export async function getAdminSessionFromRequest(request?: NextRequest) {
  try {
    // 获取admin session token
    const token = await getAdminSessionFromCookie();

    if (!token) {
      console.log('[Middleware] No admin session token found');
      return null;
    }

    // 验证session
    const sessionData = await validateSession(token);

    if (!sessionData || !sessionData.session.isAdmin) {
      console.log('[Middleware] Invalid admin session');
      return null;
    }

    console.log('[Middleware] Admin session validated');
    return sessionData;
  } catch (error) {
    console.error('[Middleware] Error getting admin session:', error);
    return null;
  }
}

/**
 * 要求用户登录的中间件
 * 用于保护需要认证的路由
 */
export async function requireAuth(request?: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    console.log('[Middleware] Authentication required');
    return NextResponse.json(
      { error: 'Authentication required', message: '请先登录' },
      { status: 401 }
    );
  }

  return session;
}

/**
 * 要求管理员登录的中间件
 * 用于保护管理后台路由
 */
export async function requireAdmin() {
  const session = await getAdminSessionFromRequest();

  if (!session) {
    console.log('[Middleware] Admin authentication required');
    return NextResponse.json(
      { error: 'Admin authentication required', message: '请先登录管理后台' },
      { status: 401 }
    );
  }

  return session;
}

/**
 * 获取当前用户信息
 * @returns 用户信息或null
 */
export async function getCurrentUser() {
  const session = await getSessionFromRequest();
  return session ? session.user : null;
}

/**
 * 获取当前管理员信息
 * @returns 管理员信息或null
 */
export async function getCurrentAdmin() {
  const session = await getAdminSessionFromRequest();
  return session ? session.user : null;
}

/**
 * 检查用户是否已登录
 * @returns 是否已登录
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSessionFromRequest();
  return session !== null;
}

/**
 * 检查是否为管理员
 * @returns 是否为管理员
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getAdminSessionFromRequest();
  return session !== null;
}