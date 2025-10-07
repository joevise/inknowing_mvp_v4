/**
 * GET /api/books/[id]/characters
 * 获取书籍角色列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBookById, getBookCharacters } from '@/lib/services/book-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/books/:id/characters
 * 获取书中可对话的角色
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 检查书籍是否存在且已上架
    const book = await getBookById(id);

    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    if (book.status !== 'published') {
      return NextResponse.json(
        { error: '该书籍暂未上架' },
        { status: 403 }
      );
    }

    // 获取角色列表
    const characters = await getBookCharacters(id);

    // 格式化角色数据
    const formattedCharacters = characters.map(char => ({
      id: char.id,
      book_id: char.book_id,
      name: char.name,
      description: char.description,
      personality: char.speaking_style, // 简化的性格描述
      background: char.background_story,
      // 不返回 prompt_template 等技术细节
    }));

    return NextResponse.json({
      characters: formattedCharacters,
      total: formattedCharacters.length,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
      }
    });
  } catch (error) {
    console.error('[Public] Get book characters error:', error);
    return NextResponse.json(
      { error: '获取角色列表失败' },
      { status: 500 }
    );
  }
}