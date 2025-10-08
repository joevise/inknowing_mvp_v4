/**
 * 用户注册 API
 * POST /api/auth/register
 *
 * 接收邮箱和密码，创建新用户并自动登录
 * 状态转换: GUEST → REGISTERED → LOGGED_IN
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/db';
import { validatePasswordStrength } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { setSessionCookie } from '@/lib/auth/cookie';

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

  try {
    // 1. 解析请求体
    const body = await request.json();
    const { username, email, password } = body;

    // 2. 验证必填字段
    if (!username || !email || !password) {
      console.log('[Register API] Missing required fields');
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: '请提供用户名、邮箱和密码'
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

    // 5. 检查邮箱是否已注册
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

    // 6. 创建用户（createUser会自动加密密码）
    const newUser = await createUser({
      username: username,
      email: email.toLowerCase(),
      password: password,
    });
    console.log('[Register API] User created:', newUser.id);

    // 8. 自动创建session并登录
    const sessionInfo = await createSession(newUser.id, false);

    // 9. 设置session cookie
    await setSessionCookie(sessionInfo.token, sessionInfo.expiresAt);

    // 10. 返回成功响应
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
        message: '注册过程中发生错误，请稍后重试'
      },
      { status: 500 }
    );
  }
}