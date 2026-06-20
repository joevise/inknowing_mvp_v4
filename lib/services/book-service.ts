/**
 * 书籍服务层
 * 处理所有书籍相关的业务逻辑
 */

import { db, generateId } from '@/lib/db/client';
import { Book, Character } from '@/lib/db/schema';
import {
  BookCategory,
  BookStatus,
  ConversationStrategy,
  getAIKnowledgeLevel
} from '@/lib/constants/categories';
import OpenAI from 'openai';
import { resolveParsingModel } from '@/lib/ai/model-resolver';

/**
 * AI识别书籍信息
 */
export async function recognizeBook(bookTitle: string): Promise<{
  bookInfo: {
    title: string;
    author: string;
    description: string;
    publisher?: string;
    publishDate?: string;
    category: string;
    tags: string[];
  };
  aiScore: number;
  coverOptions: string[];
  requiresDocument: boolean;
}> {
  try {
    const { client, model, temperature } = await resolveParsingModel();

    const prompt = `
请根据书名"${bookTitle}"，提供以下信息（以JSON格式返回）：
1. 完整的书籍信息：title（准确书名）、author（作者）、description（200字内简介）、publisher（出版社）、publishDate（出版年份）
2. category（从以下选择一个：文学、商业、科学、心理、哲学、历史、艺术、技术、教育、生活）
3. tags（5-8个相关标签，格式如：#必读 #经典）
4. aiScore（1-10分，你对这本书的了解程度）
5. coverOptions（3个封面图片描述，用于生成或搜索）

只返回JSON，不要其他内容。
`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是一个专业的图书管理专家，熟悉各类书籍。' },
        { role: 'user', content: prompt }
      ],
      temperature,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // 解析JSON响应
    let bookData;
    try {
      // 提取JSON部分（去除可能的markdown标记）
      const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      bookData = JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // 提供默认值
      bookData = {
        title: bookTitle,
        author: '未知',
        description: '暂无简介',
        category: '文学',
        tags: ['#待完善'],
        aiScore: 5,
        coverOptions: ['书籍封面', '简约设计封面', '经典风格封面']
      };
    }

    // 确定是否需要文档
    const knowledgeLevel = getAIKnowledgeLevel(bookData.aiScore || 5);

    return {
      bookInfo: {
        title: bookData.title || bookTitle,
        author: bookData.author || '未知',
        description: bookData.description || '暂无简介',
        publisher: bookData.publisher,
        publishDate: bookData.publishDate,
        category: bookData.category || '文学',
        tags: Array.isArray(bookData.tags) ? bookData.tags : ['#待完善'],
      },
      aiScore: bookData.aiScore || 5,
      coverOptions: bookData.coverOptions || [],
      requiresDocument: knowledgeLevel.requireDoc,
    };
  } catch (error) {
    console.error('Error recognizing book:', error);
    throw new Error('书籍识别失败');
  }
}

/**
 * 创建书籍
 */
export async function createBook(data: {
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  category?: string;
  tags?: string[];
  aiScore?: number;
  conversationStrategy?: ConversationStrategy;
}): Promise<Book> {
  const bookId = generateId();
  const aiScore = data.aiScore || 5;
  const knowledgeLevel = getAIKnowledgeLevel(aiScore);

  const book: Book = {
    id: bookId,
    title: data.title,
    author: data.author,
    description: data.description || '',
    cover_url: data.coverUrl || '/covers/default.jpg',
    category: data.category || '文学',
    tags: data.tags || [],
    ai_knowledge_level: aiScore,
    requires_document: knowledgeLevel.requireDoc,
    conversation_strategy: data.conversationStrategy || 'hybrid',
    status: 'draft',
    created_at: new Date(),
    updated_at: new Date(),
  };

  // 插入数据库
  const database = db();
  await database.prepare(`
    INSERT INTO books (
      id, title, author, description, cover_url, category, tags,
      ai_knowledge_level, requires_document, conversation_strategy, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    book.id,
    book.title,
    book.author,
    book.description,
    book.cover_url,
    book.category,
    JSON.stringify(book.tags),
    book.ai_knowledge_level,
    book.requires_document ? 1 : 0,
    book.conversation_strategy,
    book.status
  );

  return book;
}

/**
 * AI识别并创建书籍（组合操作）
 */
export async function recognizeAndCreateBook(
  bookTitle: string,
  additionalData?: {
    coverUrl?: string;
    conversationStrategy?: ConversationStrategy;
  }
): Promise<{ book: Book; recognitionResult: any }> {
  // 先识别
  const recognitionResult = await recognizeBook(bookTitle);

  // 再创建
  const book = await createBook({
    ...recognitionResult.bookInfo,
    coverUrl: additionalData?.coverUrl,
    aiScore: recognitionResult.aiScore,
    conversationStrategy: additionalData?.conversationStrategy || 'hybrid',
  });

  return { book, recognitionResult };
}

/**
 * 更新书籍信息
 */
export async function updateBook(
  bookId: string,
  updates: Partial<Omit<Book, 'id' | 'created_at' | 'updated_at'>>
): Promise<Book | null> {
  // 构建更新语句
  const updateFields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    updateFields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.author !== undefined) {
    updateFields.push('author = ?');
    values.push(updates.author);
  }
  if (updates.description !== undefined) {
    updateFields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.cover_url !== undefined) {
    updateFields.push('cover_url = ?');
    values.push(updates.cover_url);
  }
  if (updates.category !== undefined) {
    updateFields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.tags !== undefined) {
    updateFields.push('tags = ?');
    values.push(JSON.stringify(updates.tags));
  }
  if (updates.ai_knowledge_level !== undefined) {
    updateFields.push('ai_knowledge_level = ?');
    values.push(updates.ai_knowledge_level);

    // 同时更新requires_document
    const knowledgeLevel = getAIKnowledgeLevel(updates.ai_knowledge_level);
    updateFields.push('requires_document = ?');
    values.push(knowledgeLevel.requireDoc ? 1 : 0);
  }
  if (updates.conversation_strategy !== undefined) {
    updateFields.push('conversation_strategy = ?');
    values.push(updates.conversation_strategy);
  }
  if (updates.status !== undefined) {
    updateFields.push('status = ?');
    values.push(updates.status);
  }

  if (updateFields.length === 0) {
    return await getBookById(bookId);
  }

  values.push(bookId);

  const database = db();
  await database.prepare(
    `UPDATE books SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(...values);

  return await getBookById(bookId);
}

/**
 * 删除书籍（同时清理相关数据）
 */
export async function deleteBook(bookId: string): Promise<boolean> {
  const database = db();
  try {
    // 开启事务
    await database.prepare('BEGIN TRANSACTION').run();

    // 删除相关的向量数据（如果有ChromaDB集成，在这里调用）
    // await deleteBookVectors(bookId);

    // 删除书籍（级联删除会自动删除相关的characters、documents、conversations）
    const result = await database.prepare('DELETE FROM books WHERE id = ?').run(bookId);

    await database.prepare('COMMIT').run();

    return (result?.changes || 0) > 0;
  } catch (error) {
    await database.prepare('ROLLBACK').run();
    console.error('Error deleting book:', error);
    throw error;
  }
}

/**
 * 切换书籍状态（上架/下架）
 */
export async function toggleBookStatus(bookId: string): Promise<Book | null> {
  const book = await getBookById(bookId);
  if (!book) return null;

  const newStatus = book.status === 'published' ? 'draft' : 'published';
  return await updateBook(bookId, { status: newStatus });
}

/**
 * 获取书籍详情
 */
export async function getBookById(bookId: string): Promise<Book | null> {
  const database = db();
  const result = await database.prepare('SELECT * FROM books WHERE id = ?').get(bookId);

  if (!result) return null;

  return {
    ...result,
    tags: result.tags ? JSON.parse(result.tags) : [],
    requires_document: result.requires_document === 1,
    created_at: new Date(result.created_at),
    updated_at: new Date(result.updated_at),
  } as Book;
}

/**
 * 获取所有书籍（支持筛选）
 */
export async function getAllBooks(options?: {
  status?: BookStatus;
  category?: BookCategory;
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<{ books: Book[]; total: number }> {
  let whereConditions: string[] = [];
  let params: any[] = [];

  if (options?.status) {
    whereConditions.push('status = ?');
    params.push(options.status);
  }

  if (options?.category) {
    whereConditions.push('category = ?');
    params.push(options.category);
  }

  // 标签筛选（包含任一标签）
  if (options?.tags && options.tags.length > 0) {
    const tagConditions = options.tags.map(() => "tags LIKE ?").join(' OR ');
    whereConditions.push(`(${tagConditions})`);
    options.tags.forEach(tag => {
      params.push(`%"${tag}"%`);
    });
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const database = db();

  // 获取总数
  const countResult = await database.prepare(
    `SELECT COUNT(DISTINCT b.id) as total
     FROM books b ${whereClause ? whereClause.replace(/\bbooks\b/g, 'b') : ''}`
  ).get(...params);
  const total = countResult?.total || 0;

  // 获取分页数据
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  const books = await database.prepare(
    `SELECT b.*, COUNT(f.id) as favorite_count, COUNT(DISTINCT c.id) as character_count
     FROM books b
     LEFT JOIN favorites f ON b.id = f.book_id
     LEFT JOIN characters c ON b.id = c.book_id
     ${whereClause ? whereClause.replace(/\bbooks\b/g, 'b') : ''}
     GROUP BY b.id
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  // 格式化数据
  const formattedBooks = books.map((book: any) => ({
    ...book,
    tags: book.tags ? JSON.parse(book.tags) : [],
    requires_document: book.requires_document === 1,
    created_at: new Date(book.created_at),
    updated_at: new Date(book.updated_at),
    favorite_count: book.favorite_count || 0,
    character_count: book.character_count || 0,
  })) as Book[];

  return { books: formattedBooks, total };
}

/**
 * 搜索书籍
 */
export async function searchBooks(query: string): Promise<Book[]> {
  const searchPattern = `%${query}%`;
  const database = db();

  const books = await database.prepare(`
    SELECT * FROM books
    WHERE (
      title LIKE ? OR
      author LIKE ? OR
      description LIKE ? OR
      tags LIKE ?
    ) AND status = 'published'
    ORDER BY
      CASE
        WHEN title LIKE ? THEN 1
        WHEN author LIKE ? THEN 2
        ELSE 3
      END,
      created_at DESC
    LIMIT 20
  `).all(
    searchPattern, searchPattern, searchPattern, searchPattern,
    searchPattern, searchPattern
  );

  return books.map(book => ({
    ...book,
    tags: book.tags ? JSON.parse(book.tags) : [],
    requires_document: book.requires_document === 1,
    created_at: new Date(book.created_at),
    updated_at: new Date(book.updated_at),
  })) as Book[];
}

/**
 * 获取书籍的角色列表
 */
export async function getBookCharacters(bookId: string): Promise<Character[]> {
  const database = db();
  const characters = await database.prepare(
    'SELECT * FROM characters WHERE book_id = ? ORDER BY created_at'
  ).all(bookId);

  return characters.map(char => ({
    ...char,
    personality_traits: char.personality_traits ? JSON.parse(char.personality_traits) : {},
    created_at: new Date(char.created_at),
    updated_at: new Date(char.updated_at),
  })) as Character[];
}

/**
 * 获取推荐书籍
 */
export async function getRecommendedBooks(bookId?: string, limit: number = 5): Promise<Book[]> {
  const database = db();
  let query = `
    SELECT * FROM books
    WHERE status = 'published'
  `;
  let params: any[] = [];

  if (bookId) {
    // 排除当前书籍
    query += ' AND id != ?';
    params.push(bookId);

    // 可以基于分类推荐（简单实现）
    const currentBook = await getBookById(bookId);
    if (currentBook?.category) {
      query = `
        SELECT * FROM books
        WHERE status = 'published' AND id != ?
        ORDER BY
          CASE WHEN category = ? THEN 0 ELSE 1 END,
          ai_knowledge_level DESC,
          created_at DESC
        LIMIT ?
      `;
      params = [bookId, currentBook.category, limit];
    }
  } else {
    query += ' ORDER BY ai_knowledge_level DESC, created_at DESC LIMIT ?';
    params.push(limit);
  }

  const books = await database.prepare(query).all(...params);

  return books.map(book => ({
    ...book,
    tags: book.tags ? JSON.parse(book.tags) : [],
    requires_document: book.requires_document === 1,
    created_at: new Date(book.created_at),
    updated_at: new Date(book.updated_at),
  })) as Book[];
}
/**
 * 识别书籍中的主要角色
 */
export async function recognizeCharacters(bookTitle: string, bookAuthor: string): Promise<Array<{
  name: string;
  description: string;
  personality_traits: Record<string, any>;
  speaking_style: string;
  background_story: string;
}>> {
  try {
    const prompt = `
请识别《${bookTitle}》（作者：${bookAuthor}）中的3-5个主要角色，并提供以下信息（以JSON数组格式返回）：

1. name（角色名字）
2. description（角色简介，50字内）
3. personality_traits（性格特征，JSON对象，包含3-5个关键特质）
4. speaking_style（说话风格，30字内）
5. background_story（背景故事，100字内）

只返回JSON数组，不要其他内容。

示例格式：
[
  {
    "name": "孙悟空",
    "description": "齐天大圣，护送唐僧西天取经的大徒弟",
    "personality_traits": {
      "勇敢": "不畏强权，敢于斗争",
      "机智": "善于变化，智慧过人",
      "忠诚": "对师父忠心耿耿"
    },
    "speaking_style": "直率豪爽，常带有猴性的顽皮和傲气",
    "background_story": "花果山水帘洞美猴王，大闹天宫后被压五行山下五百年，后被唐僧救出，保护唐僧西天取经"
  }
]
`;

    const { client, model, temperature } = await resolveParsingModel();

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是一个专业的文学评论家，熟悉各类书籍中的角色。' },
        { role: 'user', content: prompt }
      ],
      temperature,
    });

    const responseText = completion.choices[0]?.message?.content || '[]';

    // 解析JSON响应
    try {
      const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const characters = JSON.parse(jsonStr);

      if (!Array.isArray(characters)) {
        throw new Error('Response is not an array');
      }

      return characters.slice(0, 5); // 最多返回5个角色
    } catch (error) {
      console.error('[Recognize Characters] JSON parse error:', error);
      return [];
    }

  } catch (error) {
    console.error('[Recognize Characters] Error:', error);
    return [];
  }
}
