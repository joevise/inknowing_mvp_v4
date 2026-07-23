/**
 * 用户注册 API
 * POST /api/auth/register
 *
 * 接收邮箱、密码与邀请码,创建新用户并自动登录。
 * 邀请码校验在创建用户之前,标记已用在创建用户之后,
 * 防止邀请码被消耗但用户创建失败(白名单"邀请码但没注册成功"也会卡住)。
 * 状态转换: GUEST → REGISTERED → LOGGED_IN
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/db';
import { validatePasswordStrength } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { setSessionCookie } from '@/lib/auth/cookie';
import { validateInviteCode, markInviteCodeUsed } from '@/lib/db/invite-codes';
import { rateLimit, getClientIP } from '@/lib/middleware/rate-limit';

/**
 * 验证邮箱格式
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/auth/register
 * 用户注册接口
 */
export async function POST(request: NextRequest) {
  console.log('[Register API] Processing registration request');

  // 0. Rate limiting: 5 次/小时（按 IP）
  const clientIP = getClientIP(request);
  const rl = rateLimit(`register:${clientIP}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', message: '注册请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  try {
    // 1. 解析请求体
    const body = await request.json();
    const { username, email, password, inviteCode } = body;

    // 2. 验证必填字段
    if (!username || !email || !password || !inviteCode) {
      console.log('[Register API] Missing required fields');
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: '请提供用户名、邮箱、密码和邀请码'
        },
        { status: 400 }
      );
    }

    // 3. 验证邮箱格式
    if (!validateEmail(email)) {
      console.log('[Register API] Invalid email format:', email);
      return NextResponse.json(
        {
          error: 'Invalid email format',
          message: '请输入有效的邮箱地址'
        },
        { status: 400 }
      );
    }

    // 4. 验证密码强度
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      console.log('[Register API] Weak password:', passwordValidation.message);
      return NextResponse.json(
        {
          error: 'Invalid password',
          message: passwordValidation.message
        },
        { status: 400 }
      );
    }

    // 5. 验证邀请码(创建用户之前,失败不消耗邀请码)
    const normalizedInviteCode = String(inviteCode).trim().toUpperCase();
    const inviteRecord = await validateInviteCode(normalizedInviteCode);
    if (!inviteRecord) {
      console.log('[Register API] Invalid invite code');
      return NextResponse.json(
        {
          error: 'Invalid invite code',
          message: '邀请码无效或已被使用'
        },
        { status: 400 }
      );
    }

    // 6. 检查邮箱是否已注册
    const existingUser = await getUserByEmail(email.toLowerCase());

    if (existingUser) {
      console.log('[Register API] Email already exists:', email);
      return NextResponse.json(
        {
          error: 'Email already exists',
          message: '该邮箱已被注册'
        },
        { status: 400 }
      );
    }

    // 7. 创建用户(createUser会自动加密密码)
    const newUser = await createUser({
      username: username,
      email: email.toLowerCase(),
      password: password,
    });
    console.log('[Register API] User created:', newUser.id);

    // 8. 标记邀请码为已使用(创建用户成功后)
    //    即使此步失败,用户也已经成功注册;只记录日志,不阻断流程。
    try {
      await markInviteCodeUsed(normalizedInviteCode, newUser.id);
    } catch (err) {
      console.error('[Register API] Failed to mark invite code as used:', err);
    }

    // 9. 自动创建session并登录
    const sessionInfo = await createSession(newUser.id, false);

    // 10. 设置session cookie
    await setSessionCookie(sessionInfo.token, sessionInfo.expiresAt);

    // 11. 返回成功响应
    const responseData = {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        created_at: newUser.created_at.toISOString(),
      },
      session: sessionInfo.token,
    };

    console.log('[Register API] Registration successful for:', email);
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    console.error('[Register API] Error during registration:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: '注册过程中发生错误,请稍后重试'
      },
      { status: 500 }
    );
  }
}