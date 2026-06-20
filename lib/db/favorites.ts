/**
 * 收藏表CRUD操作
 */

import { db, generateId, now } from './client';
import type { Favorite } from './schema';

/**
 * 添加收藏
 */
export async function addFavorite(userId: string, bookId: string): Promise<Favorite> {
  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO favorites (id, user_id, book_id, created_at)
    VALUES (?, ?, ?, ?)
  `);

  try {
    await stmt.run(id, userId, bookId, timestamp);
  } catch (error: any) {
    // 如果已存在，返回现有记录
    if (error.message.includes('UNIQUE constraint failed')) {
      return (await getFavorite(userId, bookId))!;
    }
    throw error;
  }

  return (await getFavorite(userId, bookId))!;
}

/**
 * 移除收藏
 */
export async function removeFavorite(userId: string, bookId: string): Promise<boolean> {
  const stmt = db().prepare(`
    DELETE FROM favorites
    WHERE user_id = ? AND book_id = ?
  `);

  const result = await stmt.run(userId, bookId);
  return result.changes > 0;
}

/**
 * 检查是否已收藏
 */
export async function isFavorited(userId: string, bookId: string): Promise<boolean> {
  const stmt = db().prepare(`
    SELECT COUNT(*) as count
    FROM favorites
    WHERE user_id = ? AND book_id = ?
  `);

  const row = await stmt.get(userId, bookId) as any;
  return row.count > 0;
}

/**
 * 获取单个收藏记录
 */
export async function getFavorite(userId: string, bookId: string): Promise<Favorite | null> {
  const stmt = db().prepare(`
    SELECT * FROM favorites
    WHERE user_id = ? AND book_id = ?
  `);

  const row = await stmt.get(userId, bookId) as any;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    book_id: row.book_id,
    created_at: new Date(row.created_at),
  };
}

/**
 * 获取用户的所有收藏（包含书籍信息）
 */
export async function getUserFavorites(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<Array<{
  favorite: Favorite;
  book: {
    id: string;
    title: string;
    author: string;
    description: string;
    cover_url: string;
    category: string;
  };
}>> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const stmt = db().prepare(`
    SELECT
      f.*,
      b.id as book_id,
      b.title as book_title,
      b.author as book_author,
      b.description as book_description,
      b.cover_url as book_cover_url,
      b.category as book_category
    FROM favorites f
    JOIN books b ON f.book_id = b.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = await stmt.all(userId, limit, offset) as any[];

  return rows.map(row => ({
    favorite: {
      id: row.id,
      user_id: row.user_id,
      book_id: row.book_id,
      created_at: new Date(row.created_at),
    },
    book: {
      id: row.book_id,
      title: row.book_title,
      author: row.book_author,
      description: row.book_description,
      cover_url: row.book_cover_url,
      category: row.book_category,
    },
  }));
}

/**
 * 获取书籍的收藏数
 */
export async function getBookFavoriteCount(bookId: string): Promise<number> {
  const stmt = db().prepare(`
    SELECT COUNT(*) as count
    FROM favorites
    WHERE book_id = ?
  `);

  const row = await stmt.get(bookId) as any;
  return row.count;
}

/**
 * 批量获取多本书的收藏数
 */
export async function getBatchBookFavoriteCounts(bookIds: string[]): Promise<Record<string, number>> {
  if (bookIds.length === 0) return {};

  const placeholders = bookIds.map(() => '?').join(',');
  const stmt = db().prepare(`
    SELECT book_id, COUNT(*) as count
    FROM favorites
    WHERE book_id IN (${placeholders})
    GROUP BY book_id
  `);

  const rows = await stmt.all(...bookIds) as any[];

  const result: Record<string, number> = {};
  bookIds.forEach(id => {
    result[id] = 0;
  });

  rows.forEach(row => {
    result[row.book_id] = row.count;
  });

  return result;
}

/**
 * 获取用户收藏的书籍ID列表
 */
export async function getUserFavoriteBookIds(userId: string): Promise<string[]> {
  const stmt = db().prepare(`
    SELECT book_id
    FROM favorites
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);

  const rows = await stmt.all(userId) as any[];
  return rows.map(row => row.book_id);
}

/**
 * 获取收藏统计
 */
export async function getFavoriteStats(): Promise<{
  totalFavorites: number;
  uniqueUsers: number;
  uniqueBooks: number;
  averageFavoritesPerUser: number;
}> {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM favorites');
  const totalRow = await totalStmt.get() as any;

  const usersStmt = db().prepare('SELECT COUNT(DISTINCT user_id) as count FROM favorites');
  const usersRow = await usersStmt.get() as any;

  const booksStmt = db().prepare('SELECT COUNT(DISTINCT book_id) as count FROM favorites');
  const booksRow = await booksStmt.get() as any;

  const avgStmt = db().prepare(`
    SELECT AVG(fav_count) as average
    FROM (
      SELECT COUNT(*) as fav_count
      FROM favorites
      GROUP BY user_id
    )
  `);
  const avgRow = await avgStmt.get() as any;

  return {
    totalFavorites: totalRow.count,
    uniqueUsers: usersRow.count,
    uniqueBooks: booksRow.count,
    averageFavoritesPerUser: Math.round(avgRow.average || 0),
  };
}
