/**
 * 批量提取更多角色API
 * POST /api/admin/characters/extract - 批量为书籍提取更多角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getBookById } from '@/lib/db/books';
import { extractCharacters } from '@/lib/ai/character-extraction';
import { createCharacter, getCharactersByBookId } from '@/lib/db/characters';

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { bookIds } = body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return NextResponse.json(
        { error: '缺少书籍ID列表' },
        { status: 400 }
      );
    }

    console.log('[Batch Extract] Extracting characters for', bookIds.length, 'books');

    const results: Array<{
      bookId: string;
      bookTitle: string;
      success: boolean;
      newCharactersCount?: number;
      error?: string;
    }> = [];

    for (const bookId of bookIds) {
      try {
        // 获取书籍信息
        const book = await getBookById(bookId);
        if (!book) {
          results.push({
            bookId,
            bookTitle: '未知',
            success: false,
            error: '书籍不存在',
          });
          continue;
        }

        // 获取已有角色列表
        const existingCharacters = await getCharactersByBookId(bookId);
        const excludeNames = existingCharacters.map((char) => char.name);

        console.log(
          `[Batch Extract] Extracting for "${book.title}", existing: ${excludeNames.length}`
        );

        // 提取新角色
        const extractionResult = await extractCharacters(
          book.title,
          book.author,
          book.description,
          undefined,
          excludeNames.length > 0 ? excludeNames : undefined
        );

        // 创建角色
        let createdCount = 0;
        for (const char of extractionResult.characters) {
          try {
            await createCharacter({
              book_id: bookId,
              name: char.name,
              description: char.description,
              personality_traits: char.personality,
              speaking_style: char.speakingStyle || null,
              background_story: char.backgroundStory || null,
              prompt_template: null,
            });
            createdCount++;
          } catch (error) {
            console.error(
              `[Batch Extract] Failed to create character ${char.name}:`,
              error
            );
          }
        }

        results.push({
          bookId,
          bookTitle: book.title,
          success: true,
          newCharactersCount: createdCount,
        });

        console.log(`[Batch Extract] Created ${createdCount} new characters for "${book.title}"`);

        // 添加延迟避免API调用过快
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Batch Extract] Error processing book ${bookId}:`, error);
        results.push({
          bookId,
          bookTitle: '未知',
          success: false,
          error: error instanceof Error ? error.message : '提取失败',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const totalNewCharacters = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.newCharactersCount || 0), 0);

    return NextResponse.json({
      success: true,
      successCount,
      failCount: results.length - successCount,
      totalNewCharacters,
      results,
      message: `成功为 ${successCount} 本书提取了 ${totalNewCharacters} 个新角色`,
    });
  } catch (error) {
    console.error('[API] 批量提取角色失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量提取失败' },
      { status: 500 }
    );
  }
}
