/**
 * 用户登出 API
 * POST /api/auth/logout
 *
 * 销毁session并登出
 * 状态转换: LOGGED_IN → LOGGED_OUT → GUEST
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, clearSessionCookie } from '@/lib/auth/cookie';
import { deleteSession } from '@/lib/auth/session';

/**
 * POST /api/auth/logout
 * 用户登出接口
 */
export async function POST(request: NextRequest) {
  console.log('[Logout API] Processing logout request');

  try {
    // 1. 从cookie获取session token
    const token = await getSessionFromCookie();

    if (token) {
      // 2. 删除数据库中的session记录
      await deleteSession(token);
      console.log('[Logout API] Session deleted from database');
    }

    // 3. 清除session cookie
    await clearSessionCookie();
    console.log('[Logout API] Session cookie cleared');

    // 4. 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: '登出成功'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Logout API] Error during logout:', error);
    // 即使发生错误，也尝试清除cookie
    try {
      await clearSessionCookie();
    } catch (clearError) {
      console.error('[Logout API] Error clearing cookie:', clearError);
    }

    // 登出操作通常不应该失败，所以仍然返回成功
    return NextResponse.json(
      {
        success: true,
        message: '登出成功'
      },
      { status: 200 }
    );
  }
}