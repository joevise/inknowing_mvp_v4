/**
 * 用户登录 API
 * POST /api/auth/login
 *
 * 使用邮箱密码登录，创建24小时session
 * 状态转换: GUEST → LOGGING_IN → LOGGED_IN
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, verifyUserPassword } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { setSessionCookie } from '@/lib/auth/cookie';
import { rateLimit, getClientIP } from '@/lib/middleware/rate-limit';

/**
 * POST /api/auth/login
 * 用户登录接口
 */
export async function POST(request: NextRequest) {
  console.log('[Login API] Processing login request');

  // 0. Rate limiting: 10 次/分钟（按 IP）
  const clientIP = getClientIP(request);
  const rl = rateLimit(`login:${clientIP}`, 10, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', message: '请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    // 1. 解析请求体
    const body = await request.json();
    const { email, password } = body;

    // 2. 验证必填字段
    if (!email || !password) {
      console.log('[Login API] Missing required fields');
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: '请提供邮箱和密码'
        },
        { status: 400 }
      );
    }

    // 3. 查找用户并验证密码
    const user = await getUserByEmail(email.toLowerCase());

    if (!user) {
      console.log('[Login API] User not found:', email);
      return NextResponse.json(
        {
          error: 'Authentication failed',
          message: '邮箱或密码错误'
        },
        { status: 401 }
      );
    }

    // 4. 验证密码
    const verifiedUser = await verifyUserPassword(email.toLowerCase(), password);

    if (!verifiedUser) {
      console.log('[Login API] Invalid password for user:', email);
      return NextResponse.json(
        {
          error: 'Authentication failed',
          message: '邮箱或密码错误'
        },
        { status: 401 }
      );
    }

    // 5. 创建新的session
    const sessionInfo = await createSession(verifiedUser.id, false);

    // 6. 准备响应数据
    const responseData = {
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        created_at: verifiedUser.created_at,
      },
      session: sessionInfo.token,
    };

    // 7. 创建响应并设置cookie
    const response = NextResponse.json(responseData, { status: 200 });

    // 8. 设置session cookie到响应头
    response.cookies.set('session', sessionInfo.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24小时
      path: '/',
      expires: sessionInfo.expiresAt,
    });

    console.log('[Login API] Login successful for:', email);
    return response;

  } catch (error) {
    console.error('[Login API] Error during login:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: '登录过程中发生错误，请稍后重试'
      },
      { status: 500 }
    );
  }
}