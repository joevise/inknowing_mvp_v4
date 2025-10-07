/**
 * 书籍角色管理 API
 * GET /api/admin/books/:id/characters - 获取书籍的所有角色
 * POST /api/admin/books/:id/characters - 为书籍创建角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractCharacters } from '@/lib/ai/character-extraction';
import { getBookById } from '@/lib/db/books';
import {
  createCharacter,
  getCharactersByBookId,
  type Character
} from '@/lib/db/characters';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

/**
 * GET /api/admin/books/:id/characters
 * 获取书籍的所有角色
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    // 获取书籍信息
    const book = await getBookById(params.id);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 获取角色列表
    const characters = await getCharactersByBookId(params.id);

    return NextResponse.json({
      success: true,
      characters,
      total: characters.length,
    });

  } catch (error) {
    console.error('[API] 获取角色列表失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '获取角色列表失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/books/:id/characters
 * 为书籍创建角色（手动或AI提取）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    // 获取书籍信息
    const book = await getBookById(params.id);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { mode, character } = body;

    if (mode === 'ai_extract') {
      // AI自动提取角色
      console.log('[API] 开始AI提取角色:', {
        bookId: params.id,
        bookTitle: book.title,
      });

      const extractionResult = await extractCharacters(
        book.title,
        book.author,
        book.description
      );

      console.log('[API] AI提取完成，找到', extractionResult.characters.length, '个角色');

      // 批量创建角色
      const createdCharacters: Character[] = [];
      for (const char of extractionResult.characters) {
        const created = createCharacter({
          book_id: params.id,
          name: char.name,
          description: char.description,
          personality_traits: char.personality,
          speaking_style: char.speakingStyle || null,
          background_story: char.backgroundStory || null,
          prompt_template: null,
        });
        createdCharacters.push(created);
      }

      return NextResponse.json({
        success: true,
        characters: createdCharacters,
        message: `成功提取${createdCharacters.length}个角色`,
      }, { status: 201 });

    } else if (mode === 'manual') {
      // 手动创建角色
      if (!character || !character.name) {
        return NextResponse.json(
          { error: '角色名称不能为空' },
          { status: 400 }
        );
      }

      const created = createCharacter({
        book_id: params.id,
        name: character.name,
        description: character.description || '',
        personality_traits: character.personalityTraits || null,
        speaking_style: character.speakingStyle || null,
        background_story: character.backgroundStory || null,
        prompt_template: character.promptTemplate || null,
      });

      return NextResponse.json({
        success: true,
        character: created,
        message: '角色创建成功',
      }, { status: 201 });

    } else {
      return NextResponse.json(
        { error: 'mode 必须是 ai_extract 或 manual' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[API] 创建角色失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '创建角色失败',
      },
      { status: 500 }
    );
  }
}
