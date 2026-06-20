/**
 * 角色表CRUD操作
 */

import { db, generateId, now, toJson, parseJson, transaction } from './client';
import type { Character } from './schema';
export type { Character };

export interface CreateCharacterInput {
  book_id: string;
  name: string;
  description?: string;
  personality_traits?: Record<string, any>;
  speaking_style?: string;
  background_story?: string;
  prompt_template?: string;
}

export interface UpdateCharacterInput {
  name?: string;
  description?: string;
  personality_traits?: Record<string, any>;
  speaking_style?: string;
  background_story?: string;
  prompt_template?: string;
}

/**
 * 创建新角色
 */
export async function createCharacter(input: CreateCharacterInput): Promise<Character> {
  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO characters (
      id, book_id, name, description, personality_traits,
      speaking_style, background_story, prompt_template,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await stmt.run(
    id,
    input.book_id,
    input.name,
    input.description || null,
    toJson(input.personality_traits || {}),
    input.speaking_style || null,
    input.background_story || null,
    input.prompt_template || null,
    timestamp,
    timestamp
  );

  return (await getCharacterById(id))!;
}

/**
 * 通过ID获取角色
 */
export async function getCharacterById(id: string): Promise<Character | null> {
  const stmt = db().prepare(`
    SELECT * FROM characters WHERE id = ?
  `);

  const row = await stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    book_id: row.book_id,
    name: row.name,
    description: row.description,
    personality_traits: parseJson(row.personality_traits) || {},
    speaking_style: row.speaking_style,
    background_story: row.background_story,
    prompt_template: row.prompt_template,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 获取书籍的所有角色
 */
export async function getCharactersByBookId(bookId: string): Promise<Character[]> {
  const stmt = db().prepare(`
    SELECT * FROM characters
    WHERE book_id = ?
    ORDER BY created_at ASC
  `);

  const rows = await stmt.all(bookId) as any[];

  return rows.map(row => ({
    id: row.id,
    book_id: row.book_id,
    name: row.name,
    description: row.description,
    personality_traits: parseJson(row.personality_traits) || {},
    speaking_style: row.speaking_style,
    background_story: row.background_story,
    prompt_template: row.prompt_template,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 更新角色
 */
export async function updateCharacter(
  id: string,
  input: UpdateCharacterInput
): Promise<Character | null> {
  const character = await getCharacterById(id);
  if (!character) {
    throw new Error('Character not found');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }

  if (input.personality_traits !== undefined) {
    updates.push('personality_traits = ?');
    values.push(toJson(input.personality_traits));
  }

  if (input.speaking_style !== undefined) {
    updates.push('speaking_style = ?');
    values.push(input.speaking_style);
  }

  if (input.background_story !== undefined) {
    updates.push('background_story = ?');
    values.push(input.background_story);
  }

  if (input.prompt_template !== undefined) {
    updates.push('prompt_template = ?');
    values.push(input.prompt_template);
  }

  if (updates.length === 0) {
    return character;
  }

  updates.push('updated_at = ?');
  values.push(now().toISOString());
  values.push(id);

  const stmt = db().prepare(`
    UPDATE characters
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  await stmt.run(...values);

  return await getCharacterById(id);
}

/**
 * 删除角色
 */
export async function deleteCharacter(id: string): Promise<boolean> {
  const stmt = db().prepare(`
    DELETE FROM characters WHERE id = ?
  `);

  const result = await stmt.run(id);
  return result.changes > 0;
}

/**
 * 删除书籍的所有角色
 */
export async function deleteCharactersByBookId(bookId: string): Promise<number> {
  const stmt = db().prepare(`
    DELETE FROM characters WHERE book_id = ?
  `);

  const result = await stmt.run(bookId);
  return result.changes;
}

/**
 * 搜索角色
 */
export async function searchCharacters(query: string): Promise<Array<Character & { book_title: string }>> {
  const stmt = db().prepare(`
    SELECT c.*, b.title as book_title
    FROM characters c
    JOIN books b ON c.book_id = b.id
    WHERE c.name LIKE ? OR c.description LIKE ?
    ORDER BY c.created_at DESC
    LIMIT 50
  `);

  const searchPattern = `%${query}%`;
  const rows = await stmt.all(searchPattern, searchPattern) as any[];

  return rows.map(row => ({
    id: row.id,
    book_id: row.book_id,
    name: row.name,
    description: row.description,
    personality_traits: parseJson(row.personality_traits) || {},
    speaking_style: row.speaking_style,
    background_story: row.background_story,
    prompt_template: row.prompt_template,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    book_title: row.book_title,
  }));
}

/**
 * 获取热门角色（基于对话数量）- 支持分页
 */
export async function getPopularCharacters(
  limit: number = 10,
  offset: number = 0
): Promise<{
  characters: Array<Character & { conversation_count: number; book_title: string }>;
  total: number;
}> {
  // 获取总数
  const countStmt = db().prepare(`
    SELECT COUNT(DISTINCT c.id) as total
    FROM characters c
    JOIN books b ON c.book_id = b.id
    WHERE b.status = 'published'
  `);
  const { total } = await countStmt.get() as { total: number };

  // 获取分页数据
  const stmt = db().prepare(`
    SELECT c.*, b.title as book_title, COUNT(conv.id) as conversation_count
    FROM characters c
    JOIN books b ON c.book_id = b.id
    LEFT JOIN conversations conv ON c.id = conv.character_id
    WHERE b.status = 'published'
    GROUP BY c.id
    ORDER BY conversation_count DESC
    LIMIT ? OFFSET ?
  `);

  const rows = await stmt.all(limit, offset) as any[];

  const characters = rows.map(row => ({
    id: row.id,
    book_id: row.book_id,
    name: row.name,
    description: row.description,
    personality_traits: parseJson(row.personality_traits) || {},
    speaking_style: row.speaking_style,
    background_story: row.background_story,
    prompt_template: row.prompt_template,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    book_title: row.book_title,
    conversation_count: row.conversation_count,
  }));

  return { characters, total };
}

/**
 * 批量创建角色（用于测试）
 */
export async function bulkCreateCharacters(characters: CreateCharacterInput[]): Promise<Character[]> {
  return transaction(async () => {
    const created: Character[] = [];

    for (const characterInput of characters) {
      const character = await createCharacter(characterInput);
      created.push(character);
    }

    return created;
  });
}

/**
 * 复制角色到另一本书
 */
export async function copyCharacterToBook(
  characterId: string,
  targetBookId: string
): Promise<Character | null> {
  const original = await getCharacterById(characterId);
  if (!original) {
    throw new Error('Character not found');
  }

  return await createCharacter({
    book_id: targetBookId,
    name: original.name,
    description: original.description,
    personality_traits: original.personality_traits,
    speaking_style: original.speaking_style,
    background_story: original.background_story,
    prompt_template: original.prompt_template,
  });
}

/**
 * 获取角色统计信息
 */
export async function getCharacterStats(): Promise<{
  totalCharacters: number;
  averagePerBook: number;
  mostPopular: Array<{ name: string; book_title: string; conversations: number }>;
}> {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM characters');
  const totalRow = await totalStmt.get() as any;

  const avgStmt = db().prepare(`
    SELECT AVG(char_count) as average
    FROM (
      SELECT COUNT(*) as char_count
      FROM characters
      GROUP BY book_id
    )
  `);
  const avgRow = await avgStmt.get() as any;

  const popularStmt = db().prepare(`
    SELECT c.name, b.title as book_title, COUNT(conv.id) as conversations
    FROM characters c
    JOIN books b ON c.book_id = b.id
    LEFT JOIN conversations conv ON c.id = conv.character_id
    GROUP BY c.id
    ORDER BY conversations DESC
    LIMIT 5
  `);
  const popularRows = await popularStmt.all() as any[];

  return {
    totalCharacters: totalRow.count,
    averagePerBook: Math.round(avgRow.average || 0),
    mostPopular: popularRows.map(row => ({
      name: row.name,
      book_title: row.book_title,
      conversations: row.conversations,
    })),
  };
}
