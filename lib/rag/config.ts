/**
 * RAG系统配置
 * 包含ChromaDB连接配置、向量化参数、分块策略等
 */

export const RAG_CONFIG = {
  // ChromaDB配置
  chromadb: {
    // 服务器地址，默认使用本地Docker实例
    host: process.env.CHROMA_DB_URL || 'http://localhost:8000',

    // 租户和数据库配置
    tenant: process.env.CHROMA_DB_TENANT || 'default_tenant',
    database: process.env.CHROMA_DB_DATABASE || 'default_database',

    // Collection命名规则
    collectionPrefix: 'inknowing_book_',

    // 向量维度（通义千问embedding维度）
    embeddingDimension: 1536,

    // 距离度量方式
    distanceFunction: 'cosine' as const,

    // 连接超时设置（毫秒）
    timeout: 30000,

    // 重试配置
    retry: {
      maxRetries: 3,
      retryDelay: 1000, // 毫秒
      backoffMultiplier: 2
    }
  },

  // 文档处理配置
  document: {
    // 支持的文件类型
    supportedTypes: ['.txt', '.md', '.markdown'],

    // 最大文件大小（字节）
    maxSize: parseInt(process.env.MAX_DOCUMENT_SIZE || '10485760'), // 10MB

    // 文档存储路径
    storagePath: 'data/documents',

    // 文档编码
    encoding: 'utf-8' as BufferEncoding
  },

  // 文本分块策略
  chunking: {
    // 默认分块大小（字符数）
    chunkSize: parseInt(process.env.CHUNK_SIZE || '500'),

    // 分块重叠大小（字符数）
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '50'),

    // 最小分块大小
    minChunkSize: 100,

    // 是否保持段落完整性
    preserveParagraphs: true,

    // 是否保持句子完整性
    preserveSentences: true,

    // 段落分隔符
    paragraphSeparators: ['\n\n', '\r\n\r\n'],

    // 句子分隔符
    sentenceSeparators: ['。', '！', '？', '.', '!', '?']
  },

  // 向量化配置
  vectorization: {
    // 批处理大小
    batchSize: 10,

    // 并发请求数
    concurrency: 3,

    // 进度报告间隔（毫秒）
    progressInterval: 1000,

    // embedding模型名称（通义千问）— 可通过 EMBEDDING_MODEL 环境变量覆盖
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-v4',

    // API延迟（避免限流）
    apiDelay: 200 // 毫秒
  },

  // 检索配置
  retrieval: {
    // 默认返回结果数
    topK: 5,

    // 最小相似度阈值
    minSimilarity: 0.7,

    // 是否包含元数据
    includeMetadata: true,

    // 是否包含距离分数
    includeDistances: true,

    // 重排序配置
    rerank: {
      enabled: false, // MVP阶段暂不启用
      model: 'rerank-v1'
    }
  },

  // 缓存配置
  cache: {
    // 是否启用缓存
    enabled: true,

    // 缓存过期时间（秒）
    ttl: 3600, // 1小时

    // 最大缓存条目数
    maxEntries: 100
  }
};

// 类型定义
export type ChromaDBConfig = typeof RAG_CONFIG.chromadb;
export type DocumentConfig = typeof RAG_CONFIG.document;
export type ChunkingConfig = typeof RAG_CONFIG.chunking;
export type VectorizationConfig = typeof RAG_CONFIG.vectorization;
export type RetrievalConfig = typeof RAG_CONFIG.retrieval;

// 辅助函数：获取Collection名称
export function getCollectionName(bookId: string): string {
  return `${RAG_CONFIG.chromadb.collectionPrefix}${bookId}`;
}

// 辅助函数：验证文件类型
export function isSupportedFileType(filename: string): boolean {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? RAG_CONFIG.document.supportedTypes.includes(ext) : false;
}

// 辅助函数：获取文档存储路径
export function getDocumentPath(bookId: string, docId: string, docType: 'main' | 'supplement'): string {
  return `${RAG_CONFIG.document.storagePath}/${bookId}/${docId}_${docType}`;
}