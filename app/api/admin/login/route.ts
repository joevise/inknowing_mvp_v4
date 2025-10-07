/**
 * 管理员登录 API
 * POST /api/admin/login
 *
 * 使用环境变量配置的密码登录管理后台
 * 状态转换: ADMIN_GUEST → ADMIN_AUTHENTICATING → ADMIN_LOGGED_IN
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, createAdminSession } from '@/lib/auth/admin';

/**
 * POST /api/admin/login
 * 管理员登录接口
 */
export async function POST(request: NextRequest) {
  console.log('[Admin Login API] Processing admin login request');

  try {
    // 1. 解析请求体
    const body = await request.json();
    const { password } = body;

    // 2. 验证必填字段
    if (!password) {
      console.log('[Admin Login API] Missing password');
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: '请提供管理员密码'
        },
        { status: 400 }
      );
    }

    // 3. 验证管理员密码
    const isPasswordValid = verifyAdminPassword(password);

    if (!isPasswordValid) {
      console.log('[Admin Login API] Invalid admin password');
      return NextResponse.json(
        {
          error: 'Authentication failed',
          message: '管理员密码错误'
        },
        { status: 401 }
      );
    }

    // 4. 创建管理员session
    const sessionInfo = await createAdminSession();

    // 5. 返回成功响应，并手动设置cookie
    const responseData = {
      success: true,
      admin_session: sessionInfo.session,
      expiresAt: sessionInfo.expiresAt.toISOString(),
    };

    console.log('[Admin Login API] Admin login successful');

    const response = NextResponse.json(responseData, { status: 200 });

    // 手动设置cookie到response header
    response.cookies.set('admin_session', sessionInfo.session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24小时
      path: '/',
      expires: sessionInfo.expiresAt,
    });

    return response;

  } catch (error) {
    console.error('[Admin Login API] Error during admin login:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: '管理员登录失败，请稍后重试'
      },
      { status: 500 }
    );
  }
}