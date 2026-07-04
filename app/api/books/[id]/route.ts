/**
 * GET /api/books/[id]
 * 获取书籍详情（前台用户访问）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBookById,
  getBookCharacters,
  getRecommendedBooks
} from '@/lib/services/book-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/books/:id
 * 获取单本书籍的完整信息，包含角色列表和推荐书籍
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 获取书籍信息
    const book = await getBookById(id);

    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 检查书籍是否已上架
    if (book.status !== 'published') {
      return NextResponse.json(
        { error: '该书籍暂未上架' },
        { status: 403 }
      );
    }

    // 获取角色列表
    const characters = await getBookCharacters(id);

    // 获取推荐书籍（基于分类）
    const recommendations = await getRecommendedBooks(id, 5);

    // 格式化角色数据（只返回必要信息）
    const formattedCharacters = characters.map(char => ({
      id: char.id,
      name: char.name,
      description: char.description,
      // 不返回 prompt_template 等敏感信息
    }));

    // 格式化推荐书籍
    const formattedRecommendations = recommendations.map(rec => ({
      id: rec.id,
      title: rec.title,
      author: rec.author,
      cover_url: rec.cover_url,
      category: rec.category,
    }));

    // 返回书籍详情
    return NextResponse.json({
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      cover_url: book.cover_url,
      category: book.category,
      tags: book.tags,
      publisher: undefined, // 如果有的话
      publish_date: undefined, // 如果有的话
      conversation_strategy: book.conversation_strategy,
      has_document: book.requires_document,
      character_count: formattedCharacters.length,
      characters: formattedCharacters,
      recommendations: formattedRecommendations,
      language_mode: book.language_mode || 'zh_native',
    });
  } catch (error) {
    console.error('[Public] Get book detail error:', error);
    return NextResponse.json(
      { error: '获取书籍详情失败' },
      { status: 500 }
    );
  }
}