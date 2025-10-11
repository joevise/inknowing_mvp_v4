/**
 * 批量创建书籍API
 * POST /api/admin/books/batch-create
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { recognizeAndCreateBook, recognizeCharacters } from '@/lib/services/book-service';
import { fetchDoubanCover } from '@/lib/services/douban-service';
import { createCharacter } from '@/lib/db/characters';

interface BatchBookInput {
  title: string;
  author: string;
  brief_reason: string;
}

interface BatchResult {
  title: string;
  success: boolean;
  bookId?: string;
  coverUrl?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { books, createCharacters = false } = body as {
      books: BatchBookInput[];
      createCharacters?: boolean;
    };

    if (!books || !Array.isArray(books) || books.length === 0) {
      return NextResponse.json(
        { error: '请提供至少一本书籍' },
        { status: 400 }
      );
    }

    console.log(`[Batch Create] Starting batch creation for ${books.length} books`);

    const results: BatchResult[] = [];

    for (const book of books) {
      try {
        console.log(`[Batch Create] Processing: ${book.title}`);

        // 1. 尝试从豆瓣获取封面并下载到本地
        let coverUrl: string | undefined;
        try {
          const coverResult = await fetchDoubanCover(book.title);
          if (coverResult.success) {
            // 优先使用本地路径，如果下载失败则使用原始URL
            coverUrl = coverResult.localPath || coverResult.coverUrl;
            console.log(`[Batch Create] Found Douban cover for ${book.title}:`, coverUrl);
          }
        } catch (coverError) {
          console.warn(`[Batch Create] Douban cover fetch failed for ${book.title}:`, coverError);
          // 继续处理，即使封面获取失败
        }

        // 2. 使用AI识别并创建书籍
        const result = await recognizeAndCreateBook(book.title, {
          coverUrl,
          conversationStrategy: 'hybrid', // 默认使用混合策略（AI原生+RAG）
        });

        console.log(`[Batch Create] Successfully created: ${book.title} (ID: ${result.book.id})`);

        results.push({
          title: book.title,
          success: true,
          bookId: result.book.id,
          coverUrl: result.book.cover_url,
        });

        // 3. 可选：自动识别并创建角色
        if (createCharacters) {
          try {
            console.log(`[Batch Create] Recognizing characters for ${book.title}...`);
            const characters = await recognizeCharacters(book.title, book.author);

            if (characters && characters.length > 0) {
              for (const char of characters) {
                try {
                  createCharacter({
                    book_id: result.book.id,
                    name: char.name,
                    description: char.description,
                    personality_traits: char.personality_traits,
                    speaking_style: char.speaking_style,
                    background_story: char.background_story,
                  });
                  console.log(`[Batch Create] Created character: ${char.name} for ${book.title}`);
                } catch (charError) {
                  console.error(`[Batch Create] Failed to create character ${char.name}:`, charError);
                }
              }
              console.log(`[Batch Create] Created ${characters.length} characters for ${book.title}`);
            } else {
              console.log(`[Batch Create] No characters recognized for ${book.title}`);
            }
          } catch (charError) {
            console.error(`[Batch Create] Character recognition failed for ${book.title}:`, charError);
            // 不影响书籍创建，继续处理
          }
        }

        // 添加短暂延迟，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[Batch Create] Failed to create ${book.title}:`, error);
        results.push({
          title: book.title,
          success: false,
          error: error instanceof Error ? error.message : '创建失败',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[Batch Create] Completed: ${successCount} success, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      total: books.length,
      successCount,
      failureCount,
      results,
    });

  } catch (error) {
    console.error('[Batch Create] Error:', error);
    return NextResponse.json(
      { error: '批量创建书籍失败' },
      { status: 500 }
    );
  }
}
