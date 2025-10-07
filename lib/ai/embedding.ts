/**
 * 文本向量化模块
 * 使用AI模型生成文本的向量表示
 */

import { getAIClient, getCurrentConfig, executeWithRetry } from './client';

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  text: string;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalTokens?: number;
}

/**
 * 生成单个文本的向量
 */
export async function generateEmbedding(
  text: string,
  model?: string
): Promise<EmbeddingResult> {
  console.log('[Embedding] 生成文本向量', {
    textLength: text.length,
    model
  });

  if (!text || text.trim().length === 0) {
    throw new Error('文本不能为空');
  }

  const client = getAIClient();
  const config = getCurrentConfig();
  const embeddingModel = model || config.embeddingModel;

  try {
    const response = await executeWithRetry(async () => {
      return await client.embeddings.create({
        model: embeddingModel,
        input: text,
        encoding_format: 'float'
      });
    });

    const embedding = response.data[0].embedding;

    console.log('[Embedding] 向量生成成功', {
      dimensions: embedding.length,
      usage: response.usage
    });

    return {
      embedding,
      dimensions: embedding.length,
      text
    };
  } catch (error) {
    console.error('[Embedding] 向量生成失败:', error);
    throw new Error(`向量生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 批量生成文本向量
 */
export async function generateBatchEmbeddings(
  texts: string[],
  model?: string,
  batchSize: number = 20
): Promise<BatchEmbeddingResult> {
  console.log('[Embedding] 批量生成文本向量', {
    count: texts.length,
    batchSize,
    model
  });

  if (texts.length === 0) {
    return { embeddings: [], totalTokens: 0 };
  }

  // 过滤空文本
  const validTexts = texts.filter(text => text && text.trim().length > 0);
  if (validTexts.length === 0) {
    throw new Error('没有有效的文本');
  }

  const client = getAIClient();
  const config = getCurrentConfig();
  const embeddingModel = model || config.embeddingModel;

  const results: EmbeddingResult[] = [];
  let totalTokens = 0;

  // 分批处理
  for (let i = 0; i < validTexts.length; i += batchSize) {
    const batch = validTexts.slice(i, i + batchSize);

    console.log(`[Embedding] 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(validTexts.length / batchSize)}`, {
      batchSize: batch.length
    });

    try {
      const response = await executeWithRetry(async () => {
        return await client.embeddings.create({
          model: embeddingModel,
          input: batch,
          encoding_format: 'float'
        });
      });

      // 处理响应
      for (let j = 0; j < response.data.length; j++) {
        const embedding = response.data[j].embedding;
        results.push({
          embedding,
          dimensions: embedding.length,
          text: batch[j]
        });
      }

      if (response.usage) {
        totalTokens += response.usage.total_tokens;
      }

      // 避免请求过快
      if (i + batchSize < validTexts.length) {
        console.log('[Embedding] 等待100ms避免请求过快');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`[Embedding] 批次处理失败 (${i / batchSize + 1}):`, error);
      // 对失败的批次，逐个处理
      for (const text of batch) {
        try {
          const result = await generateEmbedding(text, model);
          results.push(result);
        } catch (singleError) {
          console.error('[Embedding] 单个文本处理失败，跳过:', text.substring(0, 50));
          // 跳过失败的文本
        }
      }
    }
  }

  console.log('[Embedding] 批量向量生成完成', {
    success: results.length,
    total: validTexts.length,
    totalTokens
  });

  return {
    embeddings: results,
    totalTokens
  };
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('向量维度不匹配');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * 在向量列表中找到最相似的向量
 */
export function findMostSimilar(
  queryVector: number[],
  vectors: { embedding: number[]; metadata?: any }[],
  topK: number = 5
): Array<{ similarity: number; index: number; metadata?: any }> {
  console.log('[Embedding] 查找最相似向量', {
    queryDimensions: queryVector.length,
    vectorCount: vectors.length,
    topK
  });

  const similarities = vectors.map((vec, index) => ({
    similarity: cosineSimilarity(queryVector, vec.embedding),
    index,
    metadata: vec.metadata
  }));

  // 按相似度降序排序
  similarities.sort((a, b) => b.similarity - a.similarity);

  const results = similarities.slice(0, topK);

  console.log('[Embedding] 相似度搜索完成', {
    topSimilarity: results[0]?.similarity,
    lowestSimilarity: results[results.length - 1]?.similarity
  });

  return results;
}

/**
 * 文本分块（用于长文本）
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 1000,
  overlap: number = 100
): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;

    // 尝试在句号、问号、感叹号处断开
    if (end < text.length) {
      const punctuations = ['。', '！', '？', '.', '!', '?', '\n'];
      let bestBreak = -1;

      for (const punct of punctuations) {
        const lastPunct = text.lastIndexOf(punct, end);
        if (lastPunct > start + maxChunkSize * 0.5) {
          bestBreak = Math.max(bestBreak, lastPunct + 1);
        }
      }

      if (bestBreak > 0) {
        end = bestBreak;
      }
    }

    chunks.push(text.slice(start, end));

    // 计算下一个开始位置（考虑重叠）
    start = end - overlap;
    if (start <= chunks[chunks.length - 1].length) {
      start = end; // 避免过度重叠
    }
  }

  console.log('[Embedding] 文本分块完成', {
    originalLength: text.length,
    chunkCount: chunks.length,
    avgChunkSize: Math.round(text.length / chunks.length)
  });

  return chunks;
}

/**
 * 预处理文本（清理和规范化）
 */
export function preprocessText(text: string): string {
  // 移除多余的空白字符
  let processed = text.replace(/\s+/g, ' ').trim();

  // 移除特殊的不可见字符
  processed = processed.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  // 规范化引号
  processed = processed.replace(/[""]/g, '"').replace(/['']/g, "'");

  return processed;
}