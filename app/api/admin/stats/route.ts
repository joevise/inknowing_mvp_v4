/**
 * 管理后台统计数据 API
 * GET /api/admin/stats
 *
 * 返回系统各项统计数据
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export async function GET() {
  try {
    const database = db();

    // 统计书籍总数
    const bookCountResult = await database.prepare('SELECT COUNT(*) as count FROM books').get() as { count: number };
    const bookCount = bookCountResult?.count || 0;

    // 统计角色总数
    const characterCountResult = await database.prepare('SELECT COUNT(*) as count FROM characters').get() as { count: number };
    const characterCount = characterCountResult?.count || 0;

    // 统计对话总数
    const conversationCountResult = await database.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
    const conversationCount = conversationCountResult?.count || 0;

    // 统计用户总数
    const userCountResult = await database.prepare('SELECT COUNT(*) as count FROM users WHERE id != ?').get('admin') as { count: number };
    const userCount = userCountResult?.count || 0;

    // 统计已发布书籍数
    const publishedBooksResult = await database.prepare('SELECT COUNT(*) as count FROM books WHERE status = ?').get('published') as { count: number };
    const publishedBooks = publishedBooksResult?.count || 0;

    // 统计草稿书籍数
    const draftBooksResult = await database.prepare('SELECT COUNT(*) as count FROM books WHERE status = ?').get('draft') as { count: number };
    const draftBooks = draftBooksResult?.count || 0;

    return NextResponse.json({
      bookCount,
      characterCount,
      conversationCount,
      userCount,
      publishedBooks,
      draftBooks,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Admin Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
