/**
 * 更新用户名 API
 * PUT /api/user/update-username
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db/client';

/**
 * PUT /api/user/update-username
 * 更新当前用户的用户名
 */
export async function PUT(request: NextRequest) {
  console.log('[Update Username API] Updating username');

  try {
    // 1. 验证用户是否登录
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 2. 获取请求数据
    const body = await request.json();
    const { username } = body;

    // 3. 验证用户名
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid input',
          message: '用户名不能为空'
        },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          message: '用户名长度必须在2-20个字符之间'
        },
        { status: 400 }
      );
    }

    // 4. 更新数据库
    const stmt = db().prepare(`
      UPDATE users
      SET username = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(trimmedUsername, user.id);

    if (result.changes === 0) {
      return NextResponse.json(
        {
          error: 'Update failed',
          message: '更新失败，用户不存在'
        },
        { status: 404 }
      );
    }

    console.log('[Update Username API] Username updated successfully for user:', user.id);

    return NextResponse.json(
      {
        success: true,
        message: '用户名更新成功',
        username: trimmedUsername
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Update Username API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: '更新用户名失败'
      },
      { status: 500 }
    );
  }
}
