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
 * 管理员登录内存级限流
 * 同一 IP 5 次失败后锁 15 分钟
 */
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const record = loginAttempts.get(ip);
  if (record && record.lockedUntil > Date.now()) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - (record?.count ?? 0) };
}

function recordFailedAttempt(ip: string): void {
  const record = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION;
  }
  loginAttempts.set(ip, record);
}

function resetAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * POST /api/admin/login
 * 管理员登录接口
 */
export async function POST(request: NextRequest) {
  console.log('[Admin Login API] Processing admin login request');

  const clientIP = getClientIP(request);

  // 0. 登录限流检查
  const rateCheck = checkRateLimit(clientIP);
  if (!rateCheck.allowed) {
    console.log('[Admin Login API] Rate limited:', clientIP);
    return NextResponse.json(
      {
        error: 'Too many attempts',
        message: '登录失败次数过多，请 15 分钟后再试'
      },
      { status: 429 }
    );
  }

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
      recordFailedAttempt(clientIP);
      const remaining = MAX_ATTEMPTS - (loginAttempts.get(clientIP)?.count ?? 0);
      return NextResponse.json(
        {
          error: 'Authentication failed',
          message: remaining > 0 ? `管理员密码错误，剩余尝试次数: ${remaining}` : '管理员密码错误'
        },
        { status: 401 }
      );
    }

    // 登录成功，重置限流
    resetAttempts(clientIP);

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

    // Use raw Set-Cookie header to bypass Next.js Secure flag
    const expires = sessionInfo.expiresAt.toUTCString();
    response.headers.set(
      "Set-Cookie",
      `admin_session=${sessionInfo.session}; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`
    );

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