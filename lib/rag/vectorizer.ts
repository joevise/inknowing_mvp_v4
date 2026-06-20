/**
 * 向量化处理器
 * 负责文档的向量化处理和存储到ChromaDB
 */

import { v4 as uuidv4 } from 'uuid';
import { RAG_CONFIG } from './config';
import { parseDocument, ParsedDocument } from './document-parser';
import { chunkDocument, TextChunk } from './text-chunker';
import { generateBatchEmbeddings } from '../ai/embedding';
import {
  addDocuments,
  deleteDocuments,
  batchAddDocuments,
  getOrCreateCollection
} from './chroma-client';

// 向量化进度回调
export interface VectorizationProgress {
  current: number;
  total: number;
  percentage: number;
  currentChunk?: string;
  status: 'parsing' | 'chunking' | 'embedding' | 'storing' | 'completed' | 'error';
  error?: string;
  startTime: number;
  estimatedTimeRemaining?: number;
}

export type ProgressCallback = (progress: VectorizationProgress) => void;

// 向量化选项
export interface VectorizationOptions {
  bookId: string;
  docId: string;
  docType: 'main' | 'supplement';
  filePath: string;
  onProgress?: ProgressCallback;
  forceRegenerate?: boolean; // 是否强制重新生成
  chunkSize?: number;
  chunkOverlap?: number;
}

// 向量化结果
export interface VectorizationResult {
  success: boolean;
  bookId: string;
  docId: string;
  docType: 'main' | 'supplement';
  chunksCount: number;
  vectorsGenerated: number;
  totalTokens?: number;
  duration: number; // 毫秒
  error?: string;
}

/**
 * 文档向量化主流程
 * @param options 向量化选项
 */
export async function vectorizeDocument(
  options: VectorizationOptions
): Promise<VectorizationResult> {
  const startTime = Date.now();
  const progress: VectorizationProgress = {
    current: 0,
    total: 100,
    percentage: 0,
    status: 'parsing',
    startTime
  };

  const { bookId, docId, docType, filePath, onProgress, forceRegenerate } = options;

  try {
    // 1. 解析文档
    updateProgress(progress, 'parsing', 10, '正在解析文档...', onProgress);
    const parsedDoc = await parseDocument(filePath);

    // 2. 文本分块
    updateProgress(progress, 'chunking', 20, '正在分块处理...', onProgress);
    const chunks = chunkDocument(
      parsedDoc,
      bookId,
      docId,
      docType,
      {
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap
      }
    );

    progress.total = chunks.length;

    // 3. 如果强制重新生成，先删除旧数据
    if (forceRegenerate) {
      await deleteDocuments(bookId, undefined, { doc_id: docId });
    }

    // 4. 批量向量化和存储
    updateProgress(progress, 'embedding', 30, '正在生成向量...', onProgress);
    const result = await batchVectorizeAndStore(
      chunks,
      bookId,
      RAG_CONFIG.vectorization.batchSize,
      (current, total) => {
        const percentage = 30 + (current / total) * 60; // 30% - 90%
        updateProgress(
          progress,
          current < total ? 'embedding' : 'storing',
          percentage,
          `处理第 ${current}/${total} 批`,
          onProgress
        );
      }
    );

    // 5. 完成
    updateProgress(progress, 'completed', 100, '向量化完成', onProgress);

    return {
      success: true,
      bookId,
      docId,
      docType,
      chunksCount: chunks.length,
      vectorsGenerated: result.vectorsStored,
      totalTokens: result.totalTokens,
      duration: Date.now() - startTime
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    updateProgress(
      progress,
      'error',
      progress.percentage,
      errorMessage,
      onProgress
    );

    return {
      success: false,
      bookId,
      docId,
      docType,
      chunksCount: 0,
      vectorsGenerated: 0,
      duration: Date.now() - startTime,
      error: errorMessage
    };
  }
}

/**
 * 批量向量化并存储到ChromaDB
 * @param chunks 文本块数组
 * @param bookId 书籍ID
 * @param batchSize 批处理大小
 * @param onBatchProgress 批处理进度回调
 */
async function batchVectorizeAndStore(
  chunks: TextChunk[],
  bookId: string,
  batchSize: number = RAG_CONFIG.vectorization.batchSize,
  onBatchProgress?: (current: number, total: number) => void
): Promise<{
  vectorsStored: number;
  totalTokens?: number;
  errors: string[];
}> {
  const batches: Array<{
    documents: string[];
    embeddings: number[][];
    metadatas: any[];
    ids: string[];
  }> = [];

  let totalTokens = 0;
  const errors: string[] = [];
  const totalBatches = Math.ceil(chunks.length / batchSize);

  // 分批处理
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;

    console.log(`[Vectorizer] 处理批次 ${batchIndex}/${totalBatches}`);

    try {
      // 生成向量
      const texts = batchChunks.map(chunk => chunk.content);
      const embeddingResult = await generateBatchEmbeddings(texts);

      // 准备批次数据
      const batchData = {
        documents: [],
        embeddings: [],
        metadatas: [],
        ids: []
      } as {
        documents: string[];
        embeddings: number[][];
        metadatas: any[];
        ids: string[];
      };

      for (let j = 0; j < batchChunks.length; j++) {
        const chunk = batchChunks[j];
        const embedding = embeddingResult.embeddings[j];

        if (embedding) {
          batchData.documents.push(chunk.content);
          batchData.embeddings.push(embedding.embedding);
          batchData.metadatas.push(chunk.metadata);
          batchData.ids.push(chunk.id);
        } else {
          errors.push(`块 ${chunk.id} 向量化失败`);
        }
      }

      if (batchData.documents.length > 0) {
        batches.push(batchData);
      }

      if (embeddingResult.totalTokens) {
        totalTokens += embeddingResult.totalTokens;
      }

      if (onBatchProgress) {
        onBatchProgress(batchIndex, totalBatches);
      }

      // 添加延迟避免API限流
      if (i + batchSize < chunks.length) {
        await new Promise(resolve =>
          setTimeout(resolve, RAG_CONFIG.vectorization.apiDelay)
        );
      }
    } catch (error) {
      console.error(`[Vectorizer] 批次 ${batchIndex} 处理失败:`, error);
      errors.push(
        `批次 ${batchIndex} 处理失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`
      );
    }
  }

  // 批量存储到ChromaDB
  console.log(`[Vectorizer] 开始存储 ${batches.length} 个批次到ChromaDB`);

  let vectorsStored = 0;
  for (const batch of batches) {
    try {
      await addDocuments(
        bookId,
        batch.documents,
        batch.embeddings,
        batch.metadatas,
        batch.ids
      );
      vectorsStored += batch.documents.length;
    } catch (error) {
      console.error('[Vectorizer] ChromaDB存储失败:', error);
      errors.push(
        `ChromaDB存储失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`
      );
    }
  }

  console.log(`[Vectorizer] 向量化完成，存储了 ${vectorsStored} 个向量`);

  return {
    vectorsStored,
    totalTokens,
    errors
  };
}

/**
 * 向量化单个文本块
 * @param chunk 文本块
 * @param bookId 书籍ID
 */
export async function vectorizeChunk(
  chunk: TextChunk,
  bookId: string
): Promise<{
  success: boolean;
  embedding?: number[];
  error?: string;
}> {
  try {
    const { generateEmbedding } = await import('../ai/embedding');
    const result = await generateEmbedding(chunk.content);

    // 存储到ChromaDB
    await addDocuments(
      bookId,
      [chunk.content],
      [result.embedding],
      [chunk.metadata],
      [chunk.id]
    );

    return {
      success: true,
      embedding: result.embedding
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 批量向量化（带进度控制）
 * @param chunks 文本块数组
 * @param batchSize 批处理大小
 * @param onProgress 进度回调
 */
export async function batchVectorize(
  chunks: TextChunk[],
  batchSize: number = 10,
  onProgress?: (current: number, total: number) => void
): Promise<Array<{
  chunkId: string;
  embedding?: number[];
  error?: string;
}>> {
  const results: Array<{
    chunkId: string;
    embedding?: number[];
    error?: string;
  }> = [];

  const totalBatches = Math.ceil(chunks.length / batchSize);

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;

    try {
      const texts = batch.map(chunk => chunk.content);
      const embeddingResult = await generateBatchEmbeddings(texts, undefined, batchSize);

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddingResult.embeddings[j];

        results.push({
          chunkId: chunk.id,
          embedding: embedding?.embedding
        });
      }
    } catch (error) {
      // 批次失败，记录错误
      for (const chunk of batch) {
        results.push({
          chunkId: chunk.id,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    if (onProgress) {
      onProgress(batchIndex, totalBatches);
    }

    // 添加延迟
    if (i + batchSize < chunks.length) {
      await new Promise(resolve =>
        setTimeout(resolve, RAG_CONFIG.vectorization.apiDelay)
      );
    }
  }

  return results;
}

/**
 * 删除文档的所有向量
 * @param bookId 书籍ID
 * @param docId 文档ID
 */
export async function deleteDocumentVectors(
  bookId: string,
  docId: string
): Promise<void> {
  try {
    await deleteDocuments(bookId, undefined, { doc_id: docId });
    console.log(`[Vectorizer] 删除文档向量成功: ${docId}`);
  } catch (error) {
    console.error(`[Vectorizer] 删除文档向量失败: ${docId}`, error);
    throw error;
  }
}

/**
 * 更新进度信息
 */
function updateProgress(
  progress: VectorizationProgress,
  status: VectorizationProgress['status'],
  percentage: number,
  currentChunk: string,
  callback?: ProgressCallback
): void {
  progress.status = status;
  progress.percentage = Math.min(100, Math.max(0, percentage));
  progress.currentChunk = currentChunk;

  // 估算剩余时间
  if (percentage > 0 && percentage < 100) {
    const elapsed = Date.now() - progress.startTime;
    const estimatedTotal = (elapsed / percentage) * 100;
    progress.estimatedTimeRemaining = Math.round(estimatedTotal - elapsed);
  }

  if (callback) {
    callback({ ...progress });
  }
}

/**
 * 获取文档向量化状态
 * @param bookId 书籍ID
 * @param docId 文档ID
 */
export async function getVectorizationStatus(
  bookId: string,
  docId: string
): Promise<{
  exists: boolean;
  chunkCount: number;
  lastUpdated?: string;
}> {
  try {
    const collection = await getOrCreateCollection(bookId);
    const results = await collection.get({
      where: { doc_id: docId },
      limit: 1
    });

    const chunkCount = await (collection.count as any)({ where: { doc_id: docId } });

    return {
      exists: chunkCount > 0,
      chunkCount,
      lastUpdated: results.metadatas?.[0]?.created_at as string | undefined
    };
  } catch (error) {
    console.error('[Vectorizer] 获取向量化状态失败:', error);
    return {
      exists: false,
      chunkCount: 0
    };
  }
}