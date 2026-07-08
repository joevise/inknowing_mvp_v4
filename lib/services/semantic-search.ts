/**
 * 书籍语义召回(两路召回的第二路)
 *
 * 设计目标:在精确(LIKE)召回之后,用全局 Chroma collection 补充语义命中。
 * - 使用一个全局 collection,id = book.id,metadata.book_id 冗余一份便于过滤
 * - 全部 try/catch 包裹,Chroma 挂了不能拖垮搜索接口 → 返回空数组
 * - 距离阈值写成常量,便于调
 */

import type { Collection } from 'chromadb';
import { getChromaClient } from '@/lib/rag/chroma-client';
import { generateEmbedding } from '@/lib/ai/embedding';
import type { Book } from '@/lib/db/schema';

const SEMANTIC_COLLECTION_NAME = 'books_semantic';

/**
 * 余弦距离上限(0~2,越小越相似)。放宽一些以提高召回,具体业务再调。
 */
const SEMANTIC_DISTANCE_THRESHOLD = 0.85;

/**
 * 缓存 collection 句柄(全局只有一个)
 */
let cachedCollection: Collection | null = null;

/**
 * 把书的多语言字段拼成一段可被 embedding 的纯文本。
 * 缺失/空字符串自动跳过,避免污染向量。
 */
function buildBookEmbeddingText(book: Partial<Book>): string {
  const parts: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const s = String(value).trim();
    if (!s) return;
    parts.push(`${label}: ${s}`);
  };

  push('Title', book.title);
  push('Title(EN)', book.title_en);
  push('Author', book.author);
  push('Author(EN)', book.author_en);
  push('Description', book.description);
  push('Description(EN)', book.description_en);

  const tags = Array.isArray(book.tags) ? book.tags.filter(Boolean) : [];
  if (tags.length > 0) push('Tags', tags.join(', '));
  const tagsEn = Array.isArray(book.tags_en) ? book.tags_en.filter(Boolean) : [];
  if (tagsEn.length > 0) push('Tags(EN)', tagsEn.join(', '));

  if (book.category) push('Category', book.category);

  return parts.join('\n');
}

/**
 * 获取(必要时创建)全局语义 collection
 */
/**
 * 获取(必要时创建)全局语义 collection
 * 注：我们始终显式传 embeddings，不需要 chroma 自带的 embeddingFunction，
 * 但 JS 客户端不传会强制要求安装 @chroma-core/default-embed，故提供 no-op。
 */
const NOOP_EMBEDDING_FUNCTION = {
  generate: async (texts: string[]): Promise<number[][]> => texts.map(() => []),
} as any;

async function getSemanticCollection(): Promise<Collection> {
  if (cachedCollection) return cachedCollection;
  const client = getChromaClient();
  try {
    cachedCollection = await client.getCollection({
      name: SEMANTIC_COLLECTION_NAME,
      embeddingFunction: NOOP_EMBEDDING_FUNCTION,
    } as any);
  } catch {
    cachedCollection = await client.createCollection({
      name: SEMANTIC_COLLECTION_NAME,
      embeddingFunction: NOOP_EMBEDDING_FUNCTION,
    } as any);
  }
  return cachedCollection;
}

/**
 * 把一本书的语义信息写入(覆盖式 upsert)collection
 */
export async function indexBookSemantic(book: Pick<Book, 'id'> & Partial<Book>): Promise<void> {
  if (!book?.id) {
    console.warn('[SemanticSearch] indexBookSemantic: missing book.id, skip');
    return;
  }
  try {
    const text = buildBookEmbeddingText(book);
    if (!text) {
      console.warn(`[SemanticSearch] book ${book.id} 拼出来的文本为空,跳过索引`);
      return;
    }
    const { embedding } = await generateEmbedding(text);

    const collection = await getSemanticCollection();
    await collection.upsert({
      ids: [book.id],
      embeddings: [embedding],
      documents: [text],
      metadatas: [{ book_id: book.id }],
    });
  } catch (err) {
    console.warn(
      `[SemanticSearch] indexBookSemantic 失败 (book=${book.id}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * 从 collection 中删除一本书
 */
export async function removeBookSemantic(bookId: string): Promise<void> {
  if (!bookId) return;
  try {
    const collection = await getSemanticCollection();
    await collection.delete({ ids: [bookId] });
  } catch (err) {
    console.warn(
      `[SemanticSearch] removeBookSemantic 失败 (book=${bookId}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

export interface SemanticHit {
  bookId: string;
  distance: number;
}

/**
 * 语义召回:把 query 转向量,查 collection,过滤过远距离,返回 book_id 列表
 */
export async function semanticSearchBooks(
  query: string,
  limit: number = 10,
): Promise<SemanticHit[]> {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];
  try {
    const { embedding } = await generateEmbedding(trimmed);
    const collection = await getSemanticCollection();
    const res = await collection.query({
      queryEmbeddings: [embedding],
      nResults: limit,
      include: ['distances', 'metadatas'],
    });

    const ids = res.ids?.[0] || [];
    const distances = res.distances?.[0] || [];
    const hits: SemanticHit[] = [];
    for (let i = 0; i < ids.length; i++) {
      const dist = distances[i];
      if (dist === null || dist === undefined) continue;
      if (dist > SEMANTIC_DISTANCE_THRESHOLD) continue;
      hits.push({ bookId: ids[i], distance: dist });
    }
    return hits;
  } catch (err) {
    console.warn(
      '[SemanticSearch] semanticSearchBooks 失败,返回空:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export const SEMANTIC_SEARCH_CONFIG = {
  collectionName: SEMANTIC_COLLECTION_NAME,
  distanceThreshold: SEMANTIC_DISTANCE_THRESHOLD,
};
