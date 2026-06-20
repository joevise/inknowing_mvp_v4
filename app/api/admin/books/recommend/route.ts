/**
 * AI推荐书籍列表API
 * POST /api/admin/books/recommend
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { resolveConversationModel } from '@/lib/ai/model-resolver';
import { findBookByTitleAndAuthor } from '@/lib/db/books';

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { query, count = 20 } = body;

    if (!query) {
      return NextResponse.json(
        { error: '查询条件为必填项' },
        { status: 400 }
      );
    }

    const { client, model, temperature } = await resolveConversationModel();

    const prompt = `
根据用户的查询条件："${query}"，请推荐${count}本相关书籍。

要求：
1. 返回JSON数组格式
2. 每本书包含：title（书名）、author（作者）、brief_reason（推荐理由，1句话）
3. 推荐经典和优质书籍
4. 只返回JSON，不要其他内容

示例格式：
[
  {
    "title": "活着",
    "author": "余华",
    "brief_reason": "中国当代文学经典，深刻描绘生命的坚韧"
  }
]
`;

    console.log('[Book Recommend] Query:', query);

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是一个专业的图书推荐专家，熟悉各类经典书籍。' },
        { role: 'user', content: prompt }
      ],
      temperature,
    });

    const responseText = completion.choices[0]?.message?.content || '[]';

    let books;
    try {
      const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      books = JSON.parse(jsonStr);
    } catch (error) {
      console.error('[Book Recommend] JSON parse error:', error);
      return NextResponse.json(
        { error: 'AI返回格式错误' },
        { status: 500 }
      );
    }

    const booksWithStatus = await Promise.all(books.map(async (book: any) => {
      const existingBook = await findBookByTitleAndAuthor(book.title, book.author);
      return {
        ...book,
        existingBookId: existingBook?.id,
        status: existingBook?.status,
        alreadyExists: !!existingBook,
      };
    }));

    console.log('[Book Recommend] Success, count:', booksWithStatus.length);

    return NextResponse.json({
      success: true,
      books: booksWithStatus,
      query
    });

  } catch (error) {
    console.error('[Book Recommend] Error:', error);
    return NextResponse.json(
      { error: '推荐书籍失败' },
      { status: 500 }
    );
  }
}
