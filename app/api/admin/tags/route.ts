/**
 * /api/admin/tags
 * GET - 获取所有标签
 * POST - 创建自定义标签
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { PRESET_TAGS } from '@/lib/constants/categories';
import { db } from '@/lib/db';

// 存储自定义标签（生产环境应该使用数据库）
const customTags = new Set<string>();

/**
 * GET /api/admin/tags
 * 获取所有标签（预设 + 自定义）
 */
export async function GET(request: NextRequest) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    // 从数据库获取所有使用过的标签
    const usedTags = await db.all(`
      SELECT DISTINCT tags
      FROM books
      WHERE tags IS NOT NULL AND tags != '[]'
    `);

    // 解析所有标签
    const allTagsSet = new Set<string>(PRESET_TAGS);

    // 添加数据库中的标签
    for (const row of usedTags) {
      try {
        const tags = JSON.parse(row.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => allTagsSet.add(tag));
        }
      } catch (e) {
        // 忽略解析错误
      }
    }

    // 添加自定义标签
    customTags.forEach(tag => allTagsSet.add(tag));

    // 统计每个标签的使用次数
    const tagCounts = new Map<string, number>();

    for (const tag of allTagsSet) {
      const count = await db.get(`
        SELECT COUNT(*) as count
        FROM books
        WHERE tags LIKE ?
      `, [`%"${tag}"%`]);
      tagCounts.set(tag, count?.count || 0);
    }

    // 格式化标签数据
    const tags = Array.from(allTagsSet).map(tag => ({
      name: tag,
      value: tag,
      count: tagCounts.get(tag) || 0,
      type: PRESET_TAGS.includes(tag as any) ? 'preset' : 'custom',
    }));

    // 按使用次数排序
    tags.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      tags,
      total: tags.length,
      preset_count: PRESET_TAGS.length,
      custom_count: tags.length - PRESET_TAGS.length,
    });
  } catch (error) {
    console.error('[Admin] Get tags error:', error);
    return NextResponse.json(
      { error: '获取标签失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tags
 * 创建自定义标签
 */
export async function POST(request: NextRequest) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name } = body;

    // 验证输入
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '请提供有效的标签名称' },
        { status: 400 }
      );
    }

    const tagName = name.trim();

    // 确保标签以#开头
    const formattedTag = tagName.startsWith('#') ? tagName : `#${tagName}`;

    // 检查是否已存在
    if (PRESET_TAGS.includes(formattedTag as any) || customTags.has(formattedTag)) {
      return NextResponse.json(
        { error: '该标签已存在' },
        { status: 409 }
      );
    }

    // 添加到自定义标签集合
    customTags.add(formattedTag);

    console.log(`[Admin] Created custom tag: ${formattedTag}`);

    return NextResponse.json(
      {
        tag: {
          name: formattedTag,
          value: formattedTag,
          count: 0,
          type: 'custom',
        },
        message: '标签创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Admin] Create tag error:', error);
    return NextResponse.json(
      { error: '创建标签失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tags
 * 删除自定义标签
 */
export async function DELETE(request: NextRequest) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const tagName = searchParams.get('name');

    if (!tagName) {
      return NextResponse.json(
        { error: '请提供要删除的标签名称' },
        { status: 400 }
      );
    }

    // 不能删除预设标签
    if (PRESET_TAGS.includes(tagName as any)) {
      return NextResponse.json(
        { error: '不能删除预设标签' },
        { status: 403 }
      );
    }

    // 从自定义标签中删除
    const deleted = customTags.delete(tagName);

    if (!deleted) {
      return NextResponse.json(
        { error: '标签不存在' },
        { status: 404 }
      );
    }

    console.log(`[Admin] Deleted custom tag: ${tagName}`);

    return NextResponse.json({
      message: '标签删除成功',
      deleted_tag: tagName,
    });
  } catch (error) {
    console.error('[Admin] Delete tag error:', error);
    return NextResponse.json(
      { error: '删除标签失败' },
      { status: 500 }
    );
  }
}