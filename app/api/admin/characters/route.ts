/**
 * 角色列表API
 * GET /api/admin/characters - 获取所有角色列表（支持搜索、筛选、排序、分页）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { db } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const bookId = searchParams.get('bookId') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(c.name LIKE ? OR b.title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (bookId) {
      conditions.push('c.book_id = ?');
      params.push(bookId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM characters c
      LEFT JOIN books b ON c.book_id = b.id
      ${whereClause}
    `;
    const countResult = db().prepare(countQuery).get(...params) as any;
    const total = countResult?.total || 0;

    // 验证sortBy字段
    const validSortFields = ['name', 'created_at', 'book_title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // 构建排序字段映射
    const sortFieldMap: Record<string, string> = {
      name: 'c.name',
      created_at: 'c.created_at',
      book_title: 'b.title',
    };

    // 获取角色列表
    const query = `
      SELECT
        c.*,
        b.id as book_id,
        b.title as book_title,
        b.author as book_author
      FROM characters c
      LEFT JOIN books b ON c.book_id = b.id
      ${whereClause}
      ORDER BY ${sortFieldMap[sortField]} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const characters = db().prepare(query).all(...params, pageSize, offset) as any[];

    // 格式化数据
    const formattedCharacters = characters.map((char) => ({
      id: char.id,
      book_id: char.book_id,
      name: char.name,
      description: char.description,
      personality_traits: char.personality_traits ? JSON.parse(char.personality_traits) : {},
      speaking_style: char.speaking_style,
      background_story: char.background_story,
      prompt_template: char.prompt_template,
      created_at: char.created_at,
      updated_at: char.updated_at,
      book_title: char.book_title,
      book_author: char.book_author,
    }));

    return NextResponse.json({
      success: true,
      characters: formattedCharacters,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[API] 获取角色列表失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取角色列表失败' },
      { status: 500 }
    );
  }
}
