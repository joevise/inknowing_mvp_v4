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
import { localizeBook, localizeCharacter } from '@/lib/db/i18n-helpers';

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

    // 读取界面语言（i18n middleware 设置的 cookie）
    const lang = request.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh';

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

    // 顶层书籍按 lang 切换 title/description
    const localizedBook = localizeBook(book, lang);

    // 格式化角色数据（只返回必要信息），按 lang 切换 name/description
    const formattedCharacters = characters.map(char => {
      const localizedChar = localizeCharacter(char, lang);
      return {
        id: localizedChar.id,
        name: localizedChar.name,
        description: localizedChar.description,
        // 不返回 prompt_template 等敏感信息
      };
    });

    // 格式化推荐书籍，按 lang 切换 title
    const formattedRecommendations = recommendations.map(rec => {
      const localizedRec = localizeBook(rec, lang);
      return {
        id: rec.id,
        title: localizedRec.title,
        author: rec.author,
        cover_url: rec.cover_url,
        category: rec.category,
      };
    });

    // 返回书籍详情
    return NextResponse.json({
      id: localizedBook.id,
      title: localizedBook.title,
      author: localizedBook.author,
      description: localizedBook.description,
      cover_url: localizedBook.cover_url,
      category: localizedBook.category,
      tags: localizedBook.tags,
      publisher: undefined, // 如果有的话
      publish_date: undefined, // 如果有的话
      conversation_strategy: localizedBook.conversation_strategy,
      has_document: localizedBook.requires_document,
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