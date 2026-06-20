/**
 * ChromaDB客户端
 * 负责与ChromaDB向量数据库的所有交互
 */

import { ChromaClient, Collection } from 'chromadb';
declare const OpenAIEmbeddingFunction: new (config: any) => any;
import { RAG_CONFIG, getCollectionName } from './config';
import { resolveEmbeddingConfig } from '@/lib/ai/model-resolver';

// ChromaDB客户端单例
let chromaClient: ChromaClient | null = null;

// Collection缓存
const collectionCache: Map<string, Collection> = new Map();

/**
 * 获取ChromaDB客户端实例
 */
export function getChromaClient(): ChromaClient {
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: RAG_CONFIG.chromadb.host,
      tenant: RAG_CONFIG.chromadb.tenant,
      database: RAG_CONFIG.chromadb.database
    });
  }
  return chromaClient;
}

/**
 * 创建或获取Collection
 * @param bookId 书籍ID
 * @returns Collection实例
 */
export async function getOrCreateCollection(bookId: string): Promise<Collection> {
  const collectionName = getCollectionName(bookId);

  // 检查缓存
  if (collectionCache.has(collectionName)) {
    return collectionCache.get(collectionName)!;
  }

  const client = getChromaClient();

  try {
    const { apiKey, baseUrl, model } = await resolveEmbeddingConfig();

    let collection = await client.getCollection({
      name: collectionName,
      embeddingFunction: new OpenAIEmbeddingFunction({
        openai_api_key: apiKey,
        openai_api_base: baseUrl,
        openai_model: model
      })
    });

    collectionCache.set(collectionName, collection);
    return collection;
  } catch (error) {
    const { apiKey, baseUrl, model } = await resolveEmbeddingConfig();

    const collection = await client.createCollection({
      name: collectionName,
      embeddingFunction: new OpenAIEmbeddingFunction({
        openai_api_key: apiKey,
        openai_api_base: baseUrl,
        openai_model: model
      }),
      metadata: {
        bookId,
        createdAt: new Date().toISOString(),
        dimension: RAG_CONFIG.chromadb.embeddingDimension,
        distance: RAG_CONFIG.chromadb.distanceFunction
      }
    });

    collectionCache.set(collectionName, collection);
    return collection;
  }
}

/**
 * 删除Collection
 * @param bookId 书籍ID
 */
export async function deleteCollection(bookId: string): Promise<void> {
  const collectionName = getCollectionName(bookId);
  const client = getChromaClient();

  try {
    await client.deleteCollection({
      name: collectionName
    });

    // 清除缓存
    collectionCache.delete(collectionName);
  } catch (error) {
    console.error(`删除Collection失败: ${collectionName}`, error);
    // 即使删除失败也清除缓存
    collectionCache.delete(collectionName);
  }
}

/**
 * 检查Collection是否存在
 * @param bookId 书籍ID
 */
export async function collectionExists(bookId: string): Promise<boolean> {
  const collectionName = getCollectionName(bookId);
  const client = getChromaClient();

  try {
    const collections = await client.listCollections();
    return collections.some(col => col.name === collectionName);
  } catch (error) {
    console.error(`检查Collection存在性失败: ${collectionName}`, error);
    return false;
  }
}

/**
 * 获取Collection统计信息
 * @param bookId 书籍ID
 */
export async function getCollectionStats(bookId: string): Promise<{
  exists: boolean;
  count: number;
  metadata?: any;
}> {
  try {
    const collection = await getOrCreateCollection(bookId);
    const count = await collection.count();
    const peek = await collection.peek({ limit: 1 });

    return {
      exists: true,
      count,
      metadata: peek.metadatas?.[0] || {}
    };
  } catch (error) {
    return {
      exists: false,
      count: 0
    };
  }
}

/**
 * 添加文档向量到Collection
 * @param bookId 书籍ID
 * @param documents 文档内容数组
 * @param embeddings 向量数组
 * @param metadatas 元数据数组
 * @param ids ID数组
 */
export async function addDocuments(
  bookId: string,
  documents: string[],
  embeddings: number[][],
  metadatas: any[],
  ids: string[]
): Promise<void> {
  const collection = await getOrCreateCollection(bookId);

  await collection.add({
    ids,
    embeddings,
    metadatas,
    documents
  });
}

/**
 * 更新文档向量
 * @param bookId 书籍ID
 * @param documents 文档内容数组
 * @param embeddings 向量数组
 * @param metadatas 元数据数组
 * @param ids ID数组
 */
export async function updateDocuments(
  bookId: string,
  documents: string[],
  embeddings: number[][],
  metadatas: any[],
  ids: string[]
): Promise<void> {
  const collection = await getOrCreateCollection(bookId);

  await collection.update({
    ids,
    embeddings,
    metadatas,
    documents
  });
}

/**
 * 删除文档向量
 * @param bookId 书籍ID
 * @param ids ID数组或过滤条件
 */
export async function deleteDocuments(
  bookId: string,
  ids?: string[],
  where?: any
): Promise<void> {
  const collection = await getOrCreateCollection(bookId);

  await collection.delete({
    ids,
    where
  });
}

/**
 * 查询相似文档
 * @param bookId 书籍ID
 * @param queryEmbeddings 查询向量
 * @param nResults 返回结果数
 * @param where 过滤条件
 */
export async function queryDocuments(
  bookId: string,
  queryEmbeddings: number[][],
  nResults: number = RAG_CONFIG.retrieval.topK,
  where?: any
): Promise<{
  ids: string[][];
  distances: number[][];
  metadatas: any[][];
  documents: string[][];
}> {
  const collection = await getOrCreateCollection(bookId);

  return await collection.query({
    queryEmbeddings,
    nResults,
    where,
    include: ['metadatas', 'documents', 'distances']
  }) as any;
}

/**
 * 通过文本查询相似文档
 * @param bookId 书籍ID
 * @param queryTexts 查询文本数组
 * @param nResults 返回结果数
 * @param where 过滤条件
 */
export async function queryByText(
  bookId: string,
  queryTexts: string[],
  nResults: number = RAG_CONFIG.retrieval.topK,
  where?: any
): Promise<{
  ids: string[][];
  distances: number[][];
  metadatas: any[][];
  documents: string[][];
}> {
  const collection = await getOrCreateCollection(bookId);

  return await collection.query({
    queryTexts,
    nResults,
    where,
    include: ['metadatas', 'documents', 'distances']
  }) as any;
}

/**
 * 获取特定文档
 * @param bookId 书籍ID
 * @param ids 文档ID数组
 */
export async function getDocuments(
  bookId: string,
  ids?: string[],
  where?: any,
  limit?: number
): Promise<{
  ids: string[];
  metadatas: any[];
  documents: string[];
}> {
  const collection = await getOrCreateCollection(bookId);

  return await collection.get({
    ids,
    where,
    limit,
    include: ['metadatas', 'documents']
  }) as any;
}

/**
 * 清理所有Collection缓存
 */
export function clearCollectionCache(): void {
  collectionCache.clear();
}

/**
 * 测试ChromaDB连接
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = getChromaClient();
    await client.heartbeat();
    return true;
  } catch (error) {
    console.error('ChromaDB连接测试失败:', error);
    return false;
  }
}

/**
 * 批量添加文档（带进度回调）
 * @param bookId 书籍ID
 * @param batches 批次数据
 * @param onProgress 进度回调
 */
export async function batchAddDocuments(
  bookId: string,
  batches: Array<{
    documents: string[];
    embeddings: number[][];
    metadatas: any[];
    ids: string[];
  }>,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const collection = await getOrCreateCollection(bookId);
  const total = batches.length;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    await collection.add({
      ids: batch.ids,
      embeddings: batch.embeddings,
      metadatas: batch.metadatas,
      documents: batch.documents
    });

    if (onProgress) {
      onProgress(i + 1, total);
    }

    // 添加延迟避免过载
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RAG_CONFIG.vectorization.apiDelay));
    }
  }
}

// 导出错误处理辅助函数
export function isChromaDBError(error: any): boolean {
  return error?.message?.includes('ChromaDB') ||
         error?.message?.includes('Collection') ||
         error?.code === 'ECONNREFUSED';
}

export function getErrorMessage(error: any): string {
  if (error?.code === 'ECONNREFUSED') {
    return 'ChromaDB服务器连接失败，请确保服务已启动';
  }
  return error?.message || '未知错误';
}