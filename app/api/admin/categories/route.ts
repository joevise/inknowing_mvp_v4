/**
 * GET /api/admin/categories
 * 获取所有书籍分类
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { BOOK_CATEGORIES } from '@/lib/constants/categories';
import { db } from '@/lib/db';

/**
 * GET /api/admin/categories
 * 获取所有分类及其书籍统计
 */
export async function GET(request: NextRequest) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    // 统计每个分类的书籍数量
    const categoryCounts = await db.all(`
      SELECT category, COUNT(*) as count
      FROM books
      WHERE category IS NOT NULL
      GROUP BY category
    `);

    // 创建分类映射
    const countMap = new Map(
      categoryCounts.map(row => [row.category, row.count])
    );

    // 格式化分类数据
    const categories = BOOK_CATEGORIES.map(category => ({
      name: category,
      value: category,
      count: countMap.get(category) || 0,
    }));

    // 添加"其他"分类（如果有未分类的书籍）
    const otherCount = await db.get(`
      SELECT COUNT(*) as count
      FROM books
      WHERE category IS NULL OR category = ''
    `);

    if (otherCount?.count > 0) {
      categories.push({
        name: '其他',
        value: 'other',
        count: otherCount.count,
      });
    }

    return NextResponse.json({
      categories,
      total: categories.length,
    });
  } catch (error) {
    console.error('[Admin] Get categories error:', error);
    return NextResponse.json(
      { error: '获取分类失败' },
      { status: 500 }
    );
  }
}