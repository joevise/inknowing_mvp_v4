/**
 * 管理员登出 API
 * POST /api/admin/logout
 *
 * 清除管理员session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromCookie, clearAdminSessionCookie } from '@/lib/auth/cookie';
import { deleteSession } from '@/lib/auth/session';

/**
 * POST /api/admin/logout
 * 管理员登出接口
 */
export async function POST(request: NextRequest) {
  console.log('[Admin Logout API] Processing admin logout request');

  try {
    // 1. 从cookie获取admin session token
    const token = await getAdminSessionFromCookie();

    if (token) {
      // 2. 删除数据库中的session记录
      await deleteSession(token);
      console.log('[Admin Logout API] Admin session deleted from database');
    }

    // 3. 清除admin session cookie
    await clearAdminSessionCookie();
    console.log('[Admin Logout API] Admin session cookie cleared');

    // 4. 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: '管理员登出成功'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Admin Logout API] Error during admin logout:', error);
    // 即使发生错误，也尝试清除cookie
    try {
      await clearAdminSessionCookie();
    } catch (clearError) {
      console.error('[Admin Logout API] Error clearing admin cookie:', clearError);
    }

    // 登出操作通常不应该失败，所以仍然返回成功
    return NextResponse.json(
      {
        success: true,
        message: '管理员登出成功'
      },
      { status: 200 }
    );
  }
}