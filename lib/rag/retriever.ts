/**
 * RAG检索器
 * 负责从ChromaDB中检索相关文档块
 */

import { RAG_CONFIG } from './config';
import { generateEmbedding } from '../ai/embedding';
import {
  queryDocuments,
  queryByText,
  getDocuments,
  collectionExists
} from './chroma-client';

// 检索结果定义
export interface RetrievalResult {
  id: string;
  content: string;
  similarity: number;
  metadata: {
    bookId: string;
    docId: string;
    docType: 'main' | 'supplement';
    chapter?: string;
    chapterLevel?: number;
    chunkIndex: number;
    totalChunks?: number;
  };
}

// 检索选项
export interface RetrievalOptions {
  topK?: number;
  minSimilarity?: number;
  docType?: 'main' | 'supplement' | 'all';
  includeMetadata?: boolean;
  rerank?: boolean;
}

// 上下文格式化选项
export interface ContextFormattingOptions {
  includeChapterInfo?: boolean;
  includeSimilarityScore?: boolean;
  includeDocType?: boolean;
  separator?: string;
  maxLength?: number;
}

/**
 * 检索相关文本块
 * @param bookId 书籍ID
 * @param query 查询文本
 * @param options 检索选项
 */
export async function searchRelevantChunks(
  bookId: string,
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResult[]> {
  const {
    topK = RAG_CONFIG.retrieval.topK,
    minSimilarity = RAG_CONFIG.retrieval.minSimilarity,
    docType = 'all',
    includeMetadata = RAG_CONFIG.retrieval.includeMetadata
  } = options;

  console.log('[Retriever] 开始检索相关文档', {
    bookId,
    queryLength: query.length,
    topK,
    minSimilarity,
    docType
  });

  try {
    // 检查Collection是否存在
    const exists = await collectionExists(bookId);
    if (!exists) {
      console.log('[Retriever] Collection不存在，返回空结果');
      return [];
    }

    // 生成查询向量
    const queryEmbedding = await generateEmbedding(query);

    // 构建过滤条件
    const where: any = {};
    if (docType !== 'all') {
      where.docType = docType;
    }

    // 执行向量搜索
    const results = await queryDocuments(
      bookId,
      [queryEmbedding.embedding],
      topK,
      Object.keys(where).length > 0 ? where : undefined
    );

    // 处理结果
    const retrievalResults: RetrievalResult[] = [];

    if (results.ids.length > 0 && results.ids[0].length > 0) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const similarity = 1 - (results.distances[0][i] || 0); // 转换距离为相似度

        // 过滤低相似度结果
        if (similarity < minSimilarity) {
          continue;
        }

        retrievalResults.push({
          id: results.ids[0][i],
          content: results.documents[0][i],
          similarity,
          metadata: includeMetadata ? results.metadatas[0][i] : {}
        });
      }
    }

    // 如果需要重排序
    if (options.rerank && retrievalResults.length > 0) {
      return await rerankResults(query, retrievalResults);
    }

    console.log('[Retriever] 检索完成', {
      resultsCount: retrievalResults.length,
      topSimilarity: retrievalResults[0]?.similarity
    });

    return retrievalResults;
  } catch (error) {
    console.error('[Retriever] 检索失败:', error);
    throw new Error(
      `检索失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
  }
}

/**
 * 通过文本直接检索（使用ChromaDB的embedding功能）
 * @param bookId 书籍ID
 * @param query 查询文本
 * @param options 检索选项
 */
export async function searchByText(
  bookId: string,
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResult[]> {
  const {
    topK = RAG_CONFIG.retrieval.topK,
    minSimilarity = RAG_CONFIG.retrieval.minSimilarity,
    docType = 'all'
  } = options;

  try {
    // 构建过滤条件
    const where: any = {};
    if (docType !== 'all') {
      where.docType = docType;
    }

    // 执行文本搜索
    const results = await queryByText(
      bookId,
      [query],
      topK,
      Object.keys(where).length > 0 ? where : undefined
    );

    // 处理结果
    const retrievalResults: RetrievalResult[] = [];

    if (results.ids.length > 0 && results.ids[0].length > 0) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const similarity = 1 - (results.distances[0][i] || 0);

        if (similarity < minSimilarity) {
          continue;
        }

        retrievalResults.push({
          id: results.ids[0][i],
          content: results.documents[0][i],
          similarity,
          metadata: results.metadatas[0][i]
        });
      }
    }

    return retrievalResults;
  } catch (error) {
    console.error('[Retriever] 文本搜索失败:', error);
    return [];
  }
}

/**
 * 重排序结果（可选功能，MVP阶段简单实现）
 * @param query 原始查询
 * @param results 初步检索结果
 */
async function rerankResults(
  query: string,
  results: RetrievalResult[]
): Promise<RetrievalResult[]> {
  // MVP阶段简单实现：基于关键词匹配度调整分数
  const queryKeywords = extractKeywords(query);

  const rerankedResults = results.map(result => {
    const contentKeywords = extractKeywords(result.content);
    const keywordOverlap = calculateKeywordOverlap(queryKeywords, contentKeywords);

    // 结合原始相似度和关键词匹配度
    const adjustedSimilarity = result.similarity * 0.7 + keywordOverlap * 0.3;

    return {
      ...result,
      similarity: adjustedSimilarity
    };
  });

  // 重新排序
  rerankedResults.sort((a, b) => b.similarity - a.similarity);

  return rerankedResults;
}

/**
 * 格式化检索上下文
 * @param results 检索结果
 * @param options 格式化选项
 */
export function formatContext(
  results: RetrievalResult[],
  options: ContextFormattingOptions = {}
): string {
  const {
    includeChapterInfo = true,
    includeSimilarityScore = false,
    includeDocType = false,
    separator = '\n\n---\n\n',
    maxLength
  } = options;

  if (results.length === 0) {
    return '';
  }

  const formattedChunks = results.map((result, index) => {
    const parts: string[] = [];

    // 添加元信息头
    if (includeChapterInfo || includeSimilarityScore || includeDocType) {
      const metaParts: string[] = [];

      if (includeChapterInfo && result.metadata.chapter) {
        metaParts.push(`章节：${result.metadata.chapter}`);
      }

      if (includeDocType) {
        const typeLabel = result.metadata.docType === 'main' ? '主文档' : '补充材料';
        metaParts.push(`来源：${typeLabel}`);
      }

      if (includeSimilarityScore) {
        metaParts.push(`相似度：${(result.similarity * 100).toFixed(1)}%`);
      }

      if (metaParts.length > 0) {
        parts.push(`[${metaParts.join(' | ')}]`);
      }
    }

    // 添加内容
    parts.push(result.content.trim());

    return parts.join('\n');
  });

  let context = formattedChunks.join(separator);

  // 限制长度
  if (maxLength && context.length > maxLength) {
    context = truncateContext(context, maxLength);
  }

  return context;
}

/**
 * 获取文档的特定块
 * @param bookId 书籍ID
 * @param docId 文档ID
 * @param chunkIndices 块索引数组
 */
export async function getSpecificChunks(
  bookId: string,
  docId: string,
  chunkIndices: number[]
): Promise<RetrievalResult[]> {
  try {
    const ids = chunkIndices.map(index => `${docId}_chunk_${index}`);
    const results = await getDocuments(bookId, ids);

    const retrievalResults: RetrievalResult[] = [];

    for (let i = 0; i < results.ids.length; i++) {
      retrievalResults.push({
        id: results.ids[i],
        content: results.documents[i],
        similarity: 1.0, // 精确匹配
        metadata: results.metadatas[i]
      });
    }

    return retrievalResults;
  } catch (error) {
    console.error('[Retriever] 获取特定块失败:', error);
    return [];
  }
}

/**
 * 获取章节的所有块
 * @param bookId 书籍ID
 * @param chapter 章节名称
 */
export async function getChapterChunks(
  bookId: string,
  chapter: string
): Promise<RetrievalResult[]> {
  try {
    const results = await getDocuments(
      bookId,
      undefined,
      { chapter },
      100 // 获取最多100个块
    );

    const retrievalResults: RetrievalResult[] = [];

    for (let i = 0; i < results.ids.length; i++) {
      retrievalResults.push({
        id: results.ids[i],
        content: results.documents[i],
        similarity: 1.0,
        metadata: results.metadatas[i]
      });
    }

    // 按块索引排序
    retrievalResults.sort((a, b) =>
      (a.metadata.chunkIndex || 0) - (b.metadata.chunkIndex || 0)
    );

    return retrievalResults;
  } catch (error) {
    console.error('[Retriever] 获取章节块失败:', error);
    return [];
  }
}

// 辅助函数：提取关键词
function extractKeywords(text: string): Set<string> {
  // 简单的中文分词（MVP阶段）
  const keywords = new Set<string>();

  // 移除标点符号
  const cleanText = text.replace(/[，。！？；：""''（）【】《》、]/g, ' ');

  // 按空格分词
  const words = cleanText.split(/\s+/).filter(word => word.length > 1);

  words.forEach(word => keywords.add(word.toLowerCase()));

  return keywords;
}

// 辅助函数：计算关键词重叠度
function calculateKeywordOverlap(
  keywords1: Set<string>,
  keywords2: Set<string>
): number {
  if (keywords1.size === 0 || keywords2.size === 0) {
    return 0;
  }

  let overlap = 0;
  keywords1.forEach(keyword => {
    if (keywords2.has(keyword)) {
      overlap++;
    }
  });

  return overlap / Math.max(keywords1.size, keywords2.size);
}

// 辅助函数：截断上下文
function truncateContext(context: string, maxLength: number): string {
  if (context.length <= maxLength) {
    return context;
  }

  // 尝试在句子边界截断
  const truncated = context.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );

  if (lastSentenceEnd > maxLength * 0.8) {
    return truncated.substring(0, lastSentenceEnd + 1) + '...';
  }

  return truncated + '...';
}

/**
 * 混合检索：结合多种来源
 * @param bookId 书籍ID
 * @param query 查询文本
 * @param options 检索选项
 */
export async function hybridSearch(
  bookId: string,
  query: string,
  options: RetrievalOptions & {
    mainWeight?: number;
    supplementWeight?: number;
  } = {}
): Promise<RetrievalResult[]> {
  const {
    mainWeight = 0.7,
    supplementWeight = 0.3,
    topK = RAG_CONFIG.retrieval.topK
  } = options;

  // 分别检索主文档和补充材料
  const [mainResults, supplementResults] = await Promise.all([
    searchRelevantChunks(bookId, query, {
      ...options,
      docType: 'main',
      topK: Math.ceil(topK * 1.5) // 获取更多结果用于混合
    }),
    searchRelevantChunks(bookId, query, {
      ...options,
      docType: 'supplement',
      topK: Math.ceil(topK * 0.5)
    })
  ]);

  // 调整权重
  mainResults.forEach(result => {
    result.similarity *= mainWeight;
  });

  supplementResults.forEach(result => {
    result.similarity *= supplementWeight;
  });

  // 合并并排序
  const combined = [...mainResults, ...supplementResults];
  combined.sort((a, b) => b.similarity - a.similarity);

  // 返回top-k结果
  return combined.slice(0, topK);
}