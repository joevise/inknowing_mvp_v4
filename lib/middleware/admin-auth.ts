/**
 * 管理员认证中间件
 * 使用数据库session验证管理员权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';

/**
 * 管理员认证中间件
 * 验证 admin_session cookie 并确认用户为 admin
 */
export async function requireAdminAuth(request: NextRequest): Promise<NextResponse | null> {
  try {
    // 1. 获取 admin session cookie
    const token = await getAdminSessionFromCookie();

    if (!token) {
      return NextResponse.json(
        { error: '需要管理员权限', message: '未登录' },
        { status: 401 }
      );
    }

    // 2. 验证 session
    const sessionData = await validateSession(token);

    if (!sessionData) {
      return NextResponse.json(
        { error: '需要管理员权限', message: '会话无效或已过期' },
        { status: 401 }
      );
    }

    // 3. 检查是否为 admin 用户
    const userId = sessionData.user?.id;

    if (userId !== 'admin') {
      return NextResponse.json(
        { error: '需要管理员权限', message: '权限不足' },
        { status: 403 }
      );
    }

    // 认证通过
    return null;

  } catch (error) {
    console.error('[Admin Auth] Error:', error);
    return NextResponse.json(
      { error: '认证失败' },
      { status: 500 }
    );
  }
}