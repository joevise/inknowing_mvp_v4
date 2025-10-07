/**
 * 获取当前用户 API
 * GET /api/auth/me
 *
 * 验证session并返回当前用户信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getConversationsByUserId } from '@/lib/db';

/**
 * GET /api/auth/me
 * 获取当前用户信息接口
 */
export async function GET(request: NextRequest) {
  console.log('[Me API] Getting current user info');

  try {
    // 1. 验证用户是否登录
    const authResult = await requireAuth(request);

    // 如果返回的是NextResponse，说明未认证
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 2. 获取用户的对话统计
    const userConversations = await getConversationsByUserId(user.id);

    // 3. 构建用户信息响应
    const userProfile = {
      id: user.id,
      email: user.email || '',
      created_at: user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString(),
      conversation_count: userConversations.length,
      last_active: user.updated_at ? new Date(user.updated_at).toISOString() : new Date().toISOString(),
    };

    console.log('[Me API] Returning user info for:', user.email);
    return NextResponse.json(userProfile, { status: 200 });

  } catch (error) {
    console.error('[Me API] Error getting user info:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: '获取用户信息失败'
      },
      { status: 500 }
    );
  }
}