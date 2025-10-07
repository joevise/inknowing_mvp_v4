/**
 * 书籍识别模块
 * 使用AI自动识别和提取书籍信息
 */

import { chat } from './chat';
import { BOOK_RECOGNITION_PROMPT } from './prompts';

export interface BookInfo {
  title: string;
  author: string;
  description: string;
  publishYear?: string;
  publisher?: string;
  isbn?: string;
  category: string;
  tags: string[];
  aiKnowledgeScore: number; // AI对这本书的了解程度 1-10
  requiresDocument: boolean; // 是否需要上传文档
  coverOptions: CoverOption[]; // 推荐的封面图片选项
}

export interface CoverOption {
  url: string;
  description: string;
  source: string;
}

/**
 * AI识别书籍信息
 */
export async function recognizeBook(bookTitle: string): Promise<BookInfo> {
  console.log('[Book Recognition] 开始识别书籍:', bookTitle);

  if (!bookTitle || bookTitle.trim().length === 0) {
    throw new Error('书名不能为空');
  }

  try {
    // 构建提示词
    const messages = [
      {
        role: 'system' as const,
        content: BOOK_RECOGNITION_PROMPT
      },
      {
        role: 'user' as const,
        content: `请识别这本书：${bookTitle}`
      }
    ];

    // 调用AI
    const response = await chat(messages, {
      temperature: 0.3, // 使用较低温度以获得更准确的信息
      maxTokens: 1500
    });

    // 解析JSON响应
    let bookInfo: BookInfo;
    try {
      // 尝试提取JSON部分
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        bookInfo = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('响应中未找到JSON数据');
      }
    } catch (parseError) {
      console.error('[Book Recognition] JSON解析失败:', parseError);
      console.log('[Book Recognition] AI响应内容:', response.content);

      // 如果解析失败，使用备用方法
      bookInfo = parseBookInfoFromText(bookTitle, response.content);
    }

    // 验证和补充信息
    bookInfo = validateAndEnrichBookInfo(bookInfo, bookTitle);

    console.log('[Book Recognition] 识别完成:', bookInfo);
    return bookInfo;
  } catch (error) {
    console.error('[Book Recognition] 识别失败:', error);
    // 返回基础信息
    return createFallbackBookInfo(bookTitle);
  }
}

/**
 * 从纯文本响应中解析书籍信息（备用方法）
 */
function parseBookInfoFromText(bookTitle: string, text: string): BookInfo {
  console.log('[Book Recognition] 使用文本解析方法');

  const bookInfo: BookInfo = {
    title: bookTitle,
    author: '未知',
    description: '暂无简介',
    category: '其他',
    tags: [],
    aiKnowledgeScore: 5,
    requiresDocument: true,
    coverOptions: []
  };

  // 尝试提取作者
  const authorMatch = text.match(/作者[：:]\s*([^\n,，]+)/);
  if (authorMatch) {
    bookInfo.author = authorMatch[1].trim();
  }

  // 尝试提取描述
  const descMatch = text.match(/简介[：:]\s*([^\n]+(?:\n[^\n]+)*)/);
  if (descMatch) {
    bookInfo.description = descMatch[1].trim();
  } else if (text.includes('这本书') || text.includes('该书')) {
    // 提取包含"这本书"或"该书"的句子作为描述
    const sentences = text.split(/[。！？]/);
    const bookSentences = sentences.filter(s =>
      s.includes('这本书') || s.includes('该书') || s.includes(bookTitle)
    );
    if (bookSentences.length > 0) {
      bookInfo.description = bookSentences.join('。').trim() + '。';
    }
  }

  // 尝试提取分类
  const categories = ['文学', '商业', '科学', '心理', '哲学', '历史', '技术', '艺术'];
  for (const cat of categories) {
    if (text.includes(cat)) {
      bookInfo.category = cat;
      break;
    }
  }

  // 提取标签
  const tagPatterns = ['#[^\\s#]+', '标签[：:]\\s*([^\\n]+)'];
  for (const pattern of tagPatterns) {
    const matches = text.match(new RegExp(pattern, 'g'));
    if (matches) {
      bookInfo.tags = matches.map(tag =>
        tag.replace(/[#标签：:]/g, '').trim()
      ).filter(tag => tag.length > 0);
      break;
    }
  }

  // 尝试提取AI了解程度
  const scoreMatch = text.match(/了解程度[：:]\s*(\d+)/);
  if (scoreMatch) {
    bookInfo.aiKnowledgeScore = parseInt(scoreMatch[1]);
  }

  return bookInfo;
}

/**
 * 验证和补充书籍信息
 */
function validateAndEnrichBookInfo(bookInfo: Partial<BookInfo>, bookTitle: string): BookInfo {
  // 确保必要字段存在
  const validated: BookInfo = {
    title: bookInfo.title || bookTitle,
    author: bookInfo.author || '未知',
    description: bookInfo.description || '暂无简介',
    publishYear: bookInfo.publishYear,
    publisher: bookInfo.publisher,
    isbn: bookInfo.isbn,
    category: bookInfo.category || '其他',
    tags: Array.isArray(bookInfo.tags) ? bookInfo.tags : [],
    aiKnowledgeScore: bookInfo.aiKnowledgeScore || 5,
    requiresDocument: true,
    coverOptions: Array.isArray(bookInfo.coverOptions) ? bookInfo.coverOptions : []
  };

  // 确保AI了解程度在1-10之间
  validated.aiKnowledgeScore = Math.min(10, Math.max(1, validated.aiKnowledgeScore));

  // 根据AI了解程度设置是否需要文档
  validated.requiresDocument = validated.aiKnowledgeScore < 8;

  // 如果没有标签，根据分类添加默认标签
  if (validated.tags.length === 0) {
    const defaultTags: Record<string, string[]> = {
      '文学': ['经典', '阅读'],
      '商业': ['管理', '创业'],
      '科学': ['知识', '探索'],
      '心理': ['成长', '自我'],
      '哲学': ['思考', '智慧'],
      '历史': ['文化', '传承'],
      '技术': ['编程', '创新'],
      '艺术': ['创意', '美学']
    };
    validated.tags = defaultTags[validated.category] || ['待分类'];
  }

  // 添加默认封面选项（如果没有）
  if (validated.coverOptions.length === 0) {
    validated.coverOptions = generateDefaultCoverOptions(validated);
  }

  return validated;
}

/**
 * 生成默认封面选项
 */
function generateDefaultCoverOptions(bookInfo: BookInfo): CoverOption[] {
  const options: CoverOption[] = [];

  // 生成基于分类的默认封面
  const categoryImages: Record<string, string[]> = {
    '文学': [
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop'
    ],
    '商业': [
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=600&fit=crop'
    ],
    '科学': [
      'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop'
    ],
    '心理': [
      'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1493836734858-16e69ce0e6bb?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=600&fit=crop'
    ],
    '哲学': [
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1448932223592-d1fc686e76ea?w=400&h=600&fit=crop'
    ],
    '其他': [
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=600&fit=crop'
    ]
  };

  const images = categoryImages[bookInfo.category] || categoryImages['其他'];

  images.forEach((url, index) => {
    options.push({
      url,
      description: `${bookInfo.category}类书籍封面 ${index + 1}`,
      source: 'Unsplash'
    });
  });

  return options;
}

/**
 * 创建后备书籍信息（当AI识别完全失败时）
 */
function createFallbackBookInfo(bookTitle: string): BookInfo {
  console.log('[Book Recognition] 使用后备信息');

  return {
    title: bookTitle,
    author: '待补充',
    description: '该书籍信息暂时无法自动识别，请手动编辑补充。',
    category: '其他',
    tags: ['待分类'],
    aiKnowledgeScore: 1,
    requiresDocument: true,
    coverOptions: generateDefaultCoverOptions({
      title: bookTitle,
      author: '',
      description: '',
      category: '其他',
      tags: [],
      aiKnowledgeScore: 1,
      requiresDocument: true,
      coverOptions: []
    })
  };
}

/**
 * 批量识别书籍
 */
export async function recognizeBooks(
  bookTitles: string[],
  onProgress?: (current: number, total: number) => void
): Promise<BookInfo[]> {
  console.log('[Book Recognition] 批量识别书籍', {
    count: bookTitles.length
  });

  const results: BookInfo[] = [];

  for (let i = 0; i < bookTitles.length; i++) {
    if (onProgress) {
      onProgress(i + 1, bookTitles.length);
    }

    try {
      const bookInfo = await recognizeBook(bookTitles[i]);
      results.push(bookInfo);

      // 避免请求过快
      if (i < bookTitles.length - 1) {
        console.log('[Book Recognition] 等待500ms避免请求过快');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[Book Recognition] 识别失败: ${bookTitles[i]}`, error);
      results.push(createFallbackBookInfo(bookTitles[i]));
    }
  }

  console.log('[Book Recognition] 批量识别完成', {
    success: results.filter(b => b.aiKnowledgeScore > 1).length,
    total: results.length
  });

  return results;
}