/**
 * GET /api/search
 * 智能搜索API - 支持自然语言搜索，AI理解用户意图
 *
 * 两路召回:
 *   1) 精确路:searchBooks(LIKE 命中 title/author/description/tags + *_en)
 *   2) 语义路:semanticSearchBooks(Chroma 余弦距离命中),按 distance 升序追加,
 *      排除精确路已返回的 book_id
 *
 * 参数名同时兼容 `q`(页面路由 search page 使用)与 `query`(老接口默认名)
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchBooks, getBookById } from '@/lib/services/book-service';
import { db } from '@/lib/db';
import { localizeBook, localizeCharacter } from '@/lib/db/i18n-helpers';
import { semanticSearchBooks } from '@/lib/services/semantic-search';
import OpenAI from 'openai';

// 通义千问客户端
const qwenClient = new OpenAI({
  apiKey: process.env.QWEN_API_KEY || '',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

/**
 * 使用AI分析搜索意图
 */
async function analyzeSearchIntent(query: string): Promise<{
  type: 'book' | 'character' | 'topic' | 'general';
  keywords: string[];
  suggestions: string[];
}> {
  try {
    const prompt = `
分析用户搜索意图：
"${query}"

返回JSON格式：
{
  "type": "book/character/topic/general",
  "keywords": ["关键词1", "关键词2"],
  "suggestions": ["相关搜索建议1", "建议2", "建议3"]
}

type说明：
- book: 搜索具体书籍
- character: 搜索角色
- topic: 搜索主题/话题
- general: 一般搜索
`;

    const completion = await qwenClient.chat.completions.create({
      model: process.env.QWEN_MODEL || 'qwen-max',
      messages: [
        { role: 'system', content: '你是一个智能搜索分析助手。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('AI intent analysis failed:', error);
    // 返回默认值
    return {
      type: 'general',
      keywords: [query],
      suggestions: []
    };
  }
}

/**
 * 搜索角色
 */
async function searchCharacters(query: string): Promise<any[]> {
  const searchPattern = `%${query}%`;

  const characters = await db().prepare(`
    SELECT c.*, b.title as book_title, b.author as book_author
    FROM characters c
    INNER JOIN books b ON c.book_id = b.id
    WHERE b.status = 'published' AND (
      c.name LIKE ? OR
      c.description LIKE ?
    )
    LIMIT 10
  `).all(searchPattern, searchPattern) as any[];

  return characters.map(char => ({
    id: char.id,
    name: char.name,
    book_title: char.book_title,
    book_author: char.book_author,
    description: char.description,
  }));
}

/**
 * GET /api/search
 * 智能搜索接口
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // 同时接受 `q`(新页面规范)与 `query`(兼容老调用方)
    const rawQuery = searchParams.get('q') ?? searchParams.get('query');

    if (!rawQuery || rawQuery.trim().length === 0) {
      return NextResponse.json(
        { error: '请提供搜索关键词' },
        { status: 400 }
      );
    }

    const trimmedQuery = rawQuery.trim();

    // 读取界面语言（i18n middleware 设置的 cookie）
    const lang = request.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh';

    // 使用AI分析搜索意图（可选，根据需要启用）
    let intent = { type: 'general', keywords: [trimmedQuery], suggestions: [] as string[] };

    // 如果启用AI意图分析（可根据环境变量控制）
    if (process.env.ENABLE_AI_SEARCH_INTENT === 'true') {
      intent = await analyzeSearchIntent(trimmedQuery);
    }

    // 搜索角色（保持原行为）
    const characters = await searchCharacters(trimmedQuery);

    // ---- 精确路:DB LIKE 命中(已扩展到 *_en) ----
    const exactBooks = await searchBooks(trimmedQuery);
    const exactIds = new Set(exactBooks.map(b => b.id));

    // ---- 语义路:Chroma 向量召回 ----
    const semanticHits = await semanticSearchBooks(trimmedQuery, 10);
    const extraIds = semanticHits
      .map(h => h.bookId)
      .filter(id => !exactIds.has(id));

    let semanticBooks: typeof exactBooks = [];
    for (const id of extraIds) {
      const book = await getBookById(id);
      if (book && book.status === 'published') semanticBooks.push(book);
    }

    // 合并:精确路优先在前,语义路按 distance 升序追加
    const books = [...exactBooks, ...semanticBooks];
    const matches: Array<'exact' | 'semantic'> = [
      ...exactBooks.map(() => 'exact' as const),
      ...semanticBooks.map(() => 'semantic' as const),
    ];

    // 格式化书籍结果，按 lang 切换 title/description
    const formattedBooks = books.map(book => {
      const localized = localizeBook(book, lang);
      return {
        id: localized.id,
        title: localized.title,
        author: localized.author,
        description: localized.description?.substring(0, 100) + '...',
        cover_url: localized.cover_url,
        category: localized.category,
        tags: localized.tags,
        type: 'book',
      };
    });

    // 格式化角色结果，按 lang 切换 name/description；book_title 保持原值
    // （JOIN 出来的行未包含 b.title_en，为安全不强行本地化）
    const formattedCharacters = characters.map(char => {
      const localizedChar = localizeCharacter(char as any, lang);
      return {
        id: char.id,
        name: localizedChar.name,
        book_title: char.book_title,
        description: localizedChar.description?.substring(0, 100) + '...',
        type: 'character',
      };
    });

    // 生成搜索建议（基于精确路命中的书,语义路没有强解释性,不参与建议）
    const suggestions = intent.suggestions.length > 0
      ? intent.suggestions
      : generateDefaultSuggestions(trimmedQuery, exactBooks);

    return NextResponse.json({
      query: trimmedQuery,
      intent: intent.type,
      books: formattedBooks,
      characters: formattedCharacters,
      suggestions: suggestions,
      total: {
        books: formattedBooks.length,
        characters: formattedCharacters.length,
      },
      // 兼容老调用方:默认 'exact' 不会破坏既有消费者;新前端可读取 match 区分
      match: matches.length > 0 ? matches[0] : 'exact',
    });
  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json(
      { error: '搜索失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * 生成默认搜索建议
 */
function generateDefaultSuggestions(query: string, books: any[]): string[] {
  const suggestions: string[] = [];

  // 基于找到的书籍生成建议
  if (books.length > 0) {
    const authors = [...new Set(books.map(b => b.author))];
    const categories = [...new Set(books.map(b => b.category))];

    if (authors.length > 0) {
      suggestions.push(`${authors[0]}的其他作品`);
    }
    if (categories.length > 0) {
      suggestions.push(`更多${categories[0]}类书籍`);
    }
  }

  // 默认建议
  if (suggestions.length === 0) {
    suggestions.push(
      `与"${query}"相关的书籍`,
      `搜索作者"${query}"`,
      `浏览全部书籍`
    );
  }

  return suggestions.slice(0, 3);
}
