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
import {
  indexBookSemantic,
  removeBookSemantic,
} from './semantic-search';

/**
 * AI识别书籍信息
 */
export async function recognizeBook(bookTitle: string): Promise<{
  bookInfo: {
    title: string;
    author: string;
    description: string;
    title_en: string;
    description_en: string;
    author_en: string;
    tags_en: string[];
    publisher?: string;
    publishDate?: string;
    category: string;
    tags: string[];
    language_mode: 'zh_native' | 'multilingual' | 'en_native';
  };
  aiScore: number;
  coverOptions: string[];
  requiresDocument: boolean;
}> {
  try {
    const { client, model, temperature } = await resolveParsingModel();

    const prompt = `
请根据书名"${bookTitle}"，提供以下信息（以JSON格式返回）：
1. 完整的书籍信息：
   - title（准确的中文书名）
   - title_en（官方/最常见的英文书名；若该书原本为英文，请保留其原始英文书名）
   - description（200字内中文简介）
   - description_en（200词内英文简介）
   - author（作者中文名或通用译名）
   - author_en（作者英文名：外国作者用其原名如 George R. R. Martin；中国作者用拼音如 Wu Cheng'en）
   - publisher（出版社）
   - publishDate（出版年份）
2. category（从以下选择一个：文学、商业、科学、心理、哲学、历史、艺术、技术、教育、生活）
3. tags（5-8个相关中文标签，格式如：#必读 #经典）和 tags_en（与 tags 一一对应的英文标签，格式如：#MustRead #Classic）
4. aiScore（1-10分，你对这本书的了解程度）
5. coverOptions（3个封面图片描述，用于生成或搜索）
6. languageMode（原作语言归属，从以下三个值中选一个）：
   - "zh_native"：原作是中文创作（如中国古典名著、中国当代作家作品）
   - "en_native"：原作是英文创作且以英文名收录（如 Jane Eyre 英文版）
   - "multilingual"：原作是外语（英语/西语/日语/德语等）、当前以中文译本流通，或本书本身适合多语言阅读
   判断依据是「原作创作语言」，不是当前书名语言。例如：《权力的游戏》《格林童话》《百年孤独》《挪威的森林》原作都是外语 → multilingual；《西游记》《三国演义》《活着》→ zh_native。

注意：
- 不论原书是中文还是英文，title/title_en、description/description_en、author/author_en、tags/tags_en 都必须同时给出。
- 优先使用该书广为人知的官方译名（如 三国演义 -> Romance of the Three Kingdoms；Jane Eyre -> 简·爱；The Lord of the Rings -> 魔戒）。

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

    const title = bookData.title || bookTitle;
    const description = bookData.description || '暂无简介';
    // *_en 安全回填：缺失时回退到对应本地字段，避免空值
    const titleEn = (bookData.title_en && String(bookData.title_en).trim()) || title;
    const descriptionEn = (bookData.description_en && String(bookData.description_en).trim()) || description;
    const authorEn = (bookData.author_en && String(bookData.author_en).trim()) || (bookData.author || '未知');
    const tagsEn = Array.isArray(bookData.tags_en) && bookData.tags_en.length > 0
      ? bookData.tags_en
      : (Array.isArray(bookData.tags) ? bookData.tags : []);
    // 原作语言归属：AI 判断优先，非法值兜底 zh_native
    const validModes = ['zh_native', 'multilingual', 'en_native'] as const;
    const languageMode = validModes.includes(bookData.languageMode)
      ? (bookData.languageMode as 'zh_native' | 'multilingual' | 'en_native')
      : 'zh_native';

    return {
      bookInfo: {
        title,
        author: bookData.author || '未知',
        description,
        title_en: titleEn,
        description_en: descriptionEn,
        author_en: authorEn,
        tags_en: tagsEn,
        publisher: bookData.publisher,
        publishDate: bookData.publishDate,
        category: bookData.category || '文学',
        tags: Array.isArray(bookData.tags) ? bookData.tags : ['#待完善'],
        language_mode: languageMode,
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
  titleEn?: string;
  descriptionEn?: string;
  authorEn?: string;
  tagsEn?: string[];
  languageMode?: 'zh_native' | 'multilingual' | 'en_native';
}): Promise<Book> {
  const bookId = generateId();
  const aiScore = data.aiScore || 5;
  const knowledgeLevel = getAIKnowledgeLevel(aiScore);

  // *_en 标准化为 null（缺失或仅空白时入 NULL，不写空串）
  const titleEn = data.titleEn?.trim() ? data.titleEn.trim() : null;
  const descriptionEn = data.descriptionEn?.trim() ? data.descriptionEn.trim() : null;
  const authorEn = data.authorEn?.trim() ? data.authorEn.trim() : null;
  const tagsEn = Array.isArray(data.tagsEn) && data.tagsEn.length > 0 ? data.tagsEn : null;
  const languageMode = data.languageMode || 'zh_native';

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
    language_mode: languageMode,
    title_en: titleEn ?? undefined,
    description_en: descriptionEn ?? undefined,
    author_en: authorEn ?? undefined,
    tags_en: tagsEn ?? undefined,
    status: 'draft',
    created_at: new Date(),
    updated_at: new Date(),
  };

  // 插入数据库
  const database = db();
  await database.prepare(`
    INSERT INTO books (
      id, title, author, description, cover_url, category, tags,
      ai_knowledge_level, requires_document, conversation_strategy, status,
      language_mode, title_en, description_en, author_en, tags_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    book.status,
    languageMode,
    titleEn,
    descriptionEn,
    authorEn,
    tagsEn ? JSON.stringify(tagsEn) : null
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
    titleEn: recognitionResult.bookInfo.title_en,
    descriptionEn: recognitionResult.bookInfo.description_en,
    authorEn: recognitionResult.bookInfo.author_en,
    tagsEn: recognitionResult.bookInfo.tags_en,
    languageMode: recognitionResult.bookInfo.language_mode,
    coverUrl: additionalData?.coverUrl,
    aiScore: recognitionResult.aiScore,
    conversationStrategy: additionalData?.conversationStrategy || 'hybrid',
  });

  // 异步 fire-and-forget 写语义索引,失败只 console.warn,不阻塞主流程
  void indexBookSemantic(book).catch((err) =>
    console.warn('[BookService] recognizeAndCreateBook → 语义索引失败:', err),
  );

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

  const updated = await getBookById(bookId);

  // 影响语义索引文本的字段(title/description/tags 及其 _en 变体)发生变更 → 重建索引
  // fire-and-forget,失败仅 console.warn
  const affectsSemanticText =
    updates.title !== undefined ||
    updates.title_en !== undefined ||
    updates.author !== undefined ||
    updates.author_en !== undefined ||
    updates.description !== undefined ||
    updates.description_en !== undefined ||
    updates.tags !== undefined ||
    updates.tags_en !== undefined ||
    updates.category !== undefined;
  if (updated && affectsSemanticText) {
    void indexBookSemantic(updated).catch((err) =>
      console.warn(`[BookService] updateBook → 语义重建失败 (book=${bookId}):`, err),
    );
  }

  return updated;
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

    // 同步清理语义索引(放在 COMMIT 之后,失败也不影响 DB 删除已成功的事实)
    void removeBookSemantic(bookId).catch((err) =>
      console.warn(`[BookService] deleteBook → 语义索引清理失败 (book=${bookId}):`, err),
    );

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
    tags_en: result.tags_en ? JSON.parse(result.tags_en) : undefined,
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

  // 获取分页数据（子查询避免 JOIN 笛卡尔积导致收藏数错误）
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  const books = await database.prepare(
    `SELECT b.*,
      (SELECT COUNT(*) FROM favorites f WHERE f.book_id = b.id) as favorite_count,
      (SELECT COUNT(*) FROM characters c WHERE c.book_id = b.id) as character_count
     FROM books b
     ${whereClause ? whereClause.replace(/\bbooks\b/g, 'b') : ''}
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  // 格式化数据
  const formattedBooks = books.map((book: any) => ({
    ...book,
    tags: book.tags ? JSON.parse(book.tags) : [],
    tags_en: book.tags_en ? JSON.parse(book.tags_en) : undefined,
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
 *
 * 精确路召回:LIKE 匹配 title / author / description / tags
 * + 扩展到英文三件套 title_en / author_en / tags_en,
 *   tags_* 在 DB 里是 JSON 字符串,LIKE `%"foo"%` 同样能命中内部元素。
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
      tags LIKE ? OR
      title_en LIKE ? OR
      author_en LIKE ? OR
      tags_en LIKE ?
    ) AND status = 'published'
    ORDER BY
      CASE
        WHEN title LIKE ? THEN 1
        WHEN title_en LIKE ? THEN 2
        WHEN author LIKE ? THEN 3
        WHEN author_en LIKE ? THEN 4
        ELSE 5
      END,
      created_at DESC
    LIMIT 20
  `).all(
    searchPattern, searchPattern, searchPattern, searchPattern,
    searchPattern, searchPattern, searchPattern,
    searchPattern, searchPattern, searchPattern, searchPattern
  );

  return books.map(book => ({
    ...book,
    tags: book.tags ? JSON.parse(book.tags) : [],
    tags_en: book.tags_en ? JSON.parse(book.tags_en) : undefined,
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
    tags_en: book.tags_en ? JSON.parse(book.tags_en) : undefined,
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
