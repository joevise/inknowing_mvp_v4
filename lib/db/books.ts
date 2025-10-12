/**
 * 书籍表CRUD操作
 */

import { db, generateId, now, toJson, parseJson, transaction } from './client';
import type { Book } from './schema';

export interface CreateBookInput {
  title: string;
  author: string;
  description?: string;
  cover_url?: string;
  category?: string;
  tags?: string[];
  ai_knowledge_level?: number;
  requires_document?: boolean;
  conversation_strategy?: 'ai_native' | 'rag_only' | 'hybrid';
  status?: 'published' | 'draft';
}

export interface UpdateBookInput {
  title?: string;
  author?: string;
  description?: string;
  cover_url?: string;
  category?: string;
  tags?: string[];
  ai_knowledge_level?: number;
  requires_document?: boolean;
  conversation_strategy?: 'ai_native' | 'rag_only' | 'hybrid';
  status?: 'published' | 'draft';
}

/**
 * 创建新书籍
 */
export function createBook(input: CreateBookInput): Book {
  const id = generateId();
  const timestamp = now().toISOString();

  const stmt = db().prepare(`
    INSERT INTO books (
      id, title, author, description, cover_url, category, tags,
      ai_knowledge_level, requires_document, conversation_strategy,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.title,
    input.author,
    input.description || null,
    input.cover_url || null,
    input.category || null,
    toJson(input.tags || []),
    input.ai_knowledge_level || 5,
    input.requires_document ? 1 : 0,
    input.conversation_strategy || 'ai_native',
    input.status || 'draft',
    timestamp,
    timestamp
  );

  return getBookById(id)!;
}

/**
 * 通过ID获取书籍
 */
export function getBookById(id: string): Book | null {
  const stmt = db().prepare(`
    SELECT * FROM books WHERE id = ?
  `);

  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    cover_url: row.cover_url,
    category: row.category,
    tags: parseJson(row.tags) || [],
    ai_knowledge_level: row.ai_knowledge_level,
    requires_document: !!row.requires_document,
    conversation_strategy: row.conversation_strategy,
    status: row.status,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 更新书籍
 */
export function updateBook(id: string, input: UpdateBookInput): Book | null {
  const book = getBookById(id);
  if (!book) {
    throw new Error('Book not found');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }

  if (input.author !== undefined) {
    updates.push('author = ?');
    values.push(input.author);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }

  if (input.cover_url !== undefined) {
    updates.push('cover_url = ?');
    values.push(input.cover_url);
  }

  if (input.category !== undefined) {
    updates.push('category = ?');
    values.push(input.category);
  }

  if (input.tags !== undefined) {
    updates.push('tags = ?');
    values.push(toJson(input.tags));
  }

  if (input.ai_knowledge_level !== undefined) {
    updates.push('ai_knowledge_level = ?');
    values.push(input.ai_knowledge_level);
  }

  if (input.requires_document !== undefined) {
    updates.push('requires_document = ?');
    values.push(input.requires_document ? 1 : 0);
  }

  if (input.conversation_strategy !== undefined) {
    updates.push('conversation_strategy = ?');
    values.push(input.conversation_strategy);
  }

  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }

  if (updates.length === 0) {
    return book;
  }

  updates.push('updated_at = ?');
  values.push(now().toISOString());
  values.push(id);

  const stmt = db().prepare(`
    UPDATE books
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  return getBookById(id);
}

/**
 * 删除书籍
 */
export function deleteBook(id: string): boolean {
  const stmt = db().prepare(`
    DELETE FROM books WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 获取书籍列表（包含收藏数）
 */
export function listBooks(options?: {
  category?: string;
  tags?: string[];
  status?: 'published' | 'draft';
  limit?: number;
  offset?: number;
}): { books: (Book & { favorite_count?: number })[]; total: number } {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // 构建查询条件
  const conditions: string[] = [];
  const values: any[] = [];

  if (options?.category) {
    conditions.push('category = ?');
    values.push(options.category);
  }

  if (options?.status) {
    conditions.push('status = ?');
    values.push(options.status);
  }

  // 标签筛选（使用LIKE查询JSON字符串）
  if (options?.tags && options.tags.length > 0) {
    const tagConditions = options.tags.map(tag => {
      values.push(`%"${tag}"%`);
      return 'tags LIKE ?';
    });
    conditions.push(`(${tagConditions.join(' OR ')})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 获取总数
  const countStmt = db().prepare(`
    SELECT COUNT(*) as total FROM books b ${whereClause ? whereClause.replace('books', 'b') : ''}
  `);
  const countRow = countStmt.get(...values) as any;
  const total = countRow.total;

  // 获取书籍列表（JOIN favorites 表统计收藏数）
  values.push(limit, offset);
  const stmt = db().prepare(`
    SELECT
      b.*,
      COUNT(f.id) as favorite_count
    FROM books b
    LEFT JOIN favorites f ON b.id = f.book_id
    ${whereClause ? whereClause.replace('books', 'b') : ''}
    GROUP BY b.id
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...values) as any[];

  const books = rows.map(row => ({
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    cover_url: row.cover_url,
    category: row.category,
    tags: parseJson(row.tags) || [],
    ai_knowledge_level: row.ai_knowledge_level,
    requires_document: !!row.requires_document,
    conversation_strategy: row.conversation_strategy,
    status: row.status,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    favorite_count: row.favorite_count || 0,
  }));

  return { books, total };
}

/**
 * 搜索书籍
 */
export function searchBooks(query: string): Book[] {
  const stmt = db().prepare(`
    SELECT * FROM books
    WHERE (title LIKE ? OR author LIKE ? OR description LIKE ?)
      AND status = 'published'
    ORDER BY ai_knowledge_level DESC, created_at DESC
    LIMIT 50
  `);

  const searchPattern = `%${query}%`;
  const rows = stmt.all(searchPattern, searchPattern, searchPattern) as any[];

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    cover_url: row.cover_url,
    category: row.category,
    tags: parseJson(row.tags) || [],
    ai_knowledge_level: row.ai_knowledge_level,
    requires_document: !!row.requires_document,
    conversation_strategy: row.conversation_strategy,
    status: row.status,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 获取热门书籍
 */
export function getPopularBooks(limit: number = 10): Book[] {
  // 基于对话数量获取热门书籍
  const stmt = db().prepare(`
    SELECT b.*, COUNT(c.id) as conversation_count
    FROM books b
    LEFT JOIN conversations c ON b.id = c.book_id
    WHERE b.status = 'published'
    GROUP BY b.id
    ORDER BY conversation_count DESC, b.ai_knowledge_level DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    cover_url: row.cover_url,
    category: row.category,
    tags: parseJson(row.tags) || [],
    ai_knowledge_level: row.ai_knowledge_level,
    requires_document: !!row.requires_document,
    conversation_strategy: row.conversation_strategy,
    status: row.status,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 获取推荐书籍
 */
export function getRecommendedBooks(userId: string, limit: number = 10): Book[] {
  // 基于用户历史对话推荐书籍
  const stmt = db().prepare(`
    SELECT DISTINCT b.*
    FROM books b
    WHERE b.status = 'published'
      AND b.id NOT IN (
        SELECT DISTINCT book_id FROM conversations WHERE user_id = ?
      )
    ORDER BY b.ai_knowledge_level DESC, b.created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(userId, limit) as any[];

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    cover_url: row.cover_url,
    category: row.category,
    tags: parseJson(row.tags) || [],
    ai_knowledge_level: row.ai_knowledge_level,
    requires_document: !!row.requires_document,
    conversation_strategy: row.conversation_strategy,
    status: row.status,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 获取书籍统计信息
 */
export function getBookStats(): {
  totalBooks: number;
  publishedBooks: number;
  draftBooks: number;
  categoryCounts: Record<string, number>;
} {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM books');
  const totalRow = totalStmt.get() as any;

  const publishedStmt = db().prepare(
    "SELECT COUNT(*) as count FROM books WHERE status = 'published'"
  );
  const publishedRow = publishedStmt.get() as any;

  const draftStmt = db().prepare(
    "SELECT COUNT(*) as count FROM books WHERE status = 'draft'"
  );
  const draftRow = draftStmt.get() as any;

  const categoryStmt = db().prepare(`
    SELECT category, COUNT(*) as count
    FROM books
    WHERE category IS NOT NULL
    GROUP BY category
  `);
  const categoryRows = categoryStmt.all() as any[];

  const categoryCounts: Record<string, number> = {};
  for (const row of categoryRows) {
    categoryCounts[row.category] = row.count;
  }

  return {
    totalBooks: totalRow.count,
    publishedBooks: publishedRow.count,
    draftBooks: draftRow.count,
    categoryCounts,
  };
}

/**
 * 根据书名和作者查找书籍
 */
export function findBookByTitleAndAuthor(title: string, author: string): Book | null {
  const stmt = db().prepare(`
    SELECT * FROM books
    WHERE title = ? AND author = ?
    LIMIT 1
  `);

  const row = stmt.get(title, author) as any;

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    cover_url: row.cover_url,
    category: row.category,
    tags: parseJson(row.tags) || [],
    ai_knowledge_level: row.ai_knowledge_level,
    requires_document: !!row.requires_document,
    conversation_strategy: row.conversation_strategy,
    status: row.status,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 批量创建书籍（用于测试）
 */
export function bulkCreateBooks(books: CreateBookInput[]): Book[] {
  return transaction(() => {
    const created: Book[] = [];

    for (const bookInput of books) {
      const book = createBook(bookInput);
      created.push(book);
    }

    return created;
  });
}