/**
 * 验证管理员登录状态 API
 * GET /api/admin/me
 *
 * 验证admin_session cookie并返回管理员信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromCookie } from '@/lib/auth/cookie';
import { validateSession } from '@/lib/auth/session';

/**
 * GET /api/admin/me
 * 验证管理员登录状态
 */
export async function GET(request: NextRequest) {
  console.log('[Admin Me API] Checking admin session');

  try {
    // 1. 获取admin session cookie
    const token = await getAdminSessionFromCookie();

    if (!token) {
      console.log('[Admin Me API] No admin session cookie');
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: '未登录或会话已过期'
        },
        { status: 401 }
      );
    }

    // 2. 验证session
    const sessionData = await validateSession(token);

    if (!sessionData) {
      console.log('[Admin Me API] Invalid or expired session');
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: '会话无效或已过期'
        },
        { status: 401 }
      );
    }

    // 3. 检查是否为admin用户
    console.log('[Admin Me API] Session data:', JSON.stringify(sessionData));

    const userId = sessionData.user?.id;
    console.log('[Admin Me API] User ID:', userId);

    if (userId !== 'admin') {
      console.log('[Admin Me API] Not admin user:', userId);
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: '无管理员权限'
        },
        { status: 403 }
      );
    }

    // 4. 返回管理员信息
    console.log('[Admin Me API] Admin session valid');
    return NextResponse.json(
      {
        admin: true,
        user_id: 'admin'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Admin Me API] Error checking admin session:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: '验证失败，请稍后重试'
      },
      { status: 500 }
    );
  }
}
