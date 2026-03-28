// @ts-nocheck
/**
 * 文档服务层
 * 处理文档的上传、向量化、管理等业务逻辑
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db, generateId, now } from '../db/client';
import { Document } from '../db/schema';
import { RAG_CONFIG, getDocumentPath, isSupportedFileType } from '../rag/config';
import { validateDocument } from '../rag/document-parser';
import {
  vectorizeDocument,
  VectorizationResult,
  VectorizationProgress,
  deleteDocumentVectors,
  getVectorizationStatus
} from '../rag/vectorizer';
import { deleteCollection } from '../rag/chroma-client';

// 文档上传选项
export interface DocumentUploadOptions {
  bookId: string;
  docType: 'main' | 'supplement';
  title: string;
  fileBuffer: Buffer;
  fileName: string;
}

// 文档服务响应
export interface DocumentServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 向量化任务缓存（用于进度查询）
const vectorizationTasks = new Map<string, VectorizationProgress>();

/**
 * 上传文档
 * @param options 上传选项
 */
export async function uploadDocument(
  options: DocumentUploadOptions
): Promise<DocumentServiceResponse<Document>> {
  const { bookId, docType, title, fileBuffer, fileName } = options;

  try {
    // 1. 验证文件类型
    if (!isSupportedFileType(fileName)) {
      return {
        success: false,
        error: `不支持的文件类型。支持的类型：${RAG_CONFIG.document.supportedTypes.join(', ')}`
      };
    }

    // 2. 验证文件大小
    if (fileBuffer.length > RAG_CONFIG.document.maxSize) {
      return {
        success: false,
        error: `文件过大。最大支持：${RAG_CONFIG.document.maxSize / 1024 / 1024}MB`
      };
    }

    // 3. 生成文档ID和路径
    const docId = uuidv4();
    const ext = path.extname(fileName);
    const docPath = getDocumentPath(bookId, docId, docType) + ext;
    const fullPath = path.join(process.cwd(), docPath);

    // 4. 确保目录存在
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // 5. 保存文件
    await fs.writeFile(fullPath, fileBuffer);

    // 6. 验证保存的文件
    const validation = await validateDocument(fullPath);
    if (!validation.valid) {
      // 删除无效文件
      await fs.unlink(fullPath).catch(() => {});
      return {
        success: false,
        error: `文档验证失败：${validation.errors.join('; ')}`
      };
    }

    // 7. 创建数据库记录
    const document: Document = {
      id: docId,
      book_id: bookId,
      type: docType,
      title,
      file_path: docPath,
      file_size: fileBuffer.length,
      vectorized: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    // 8. 插入数据库
    db().prepare(
      `INSERT INTO documents (
        id, book_id, type, title, file_path, file_size, vectorized, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      document.id,
      document.book_id,
      document.type,
      document.title,
      document.file_path,
      document.file_size,
      0, // false
      document.created_at.toISOString(),
      document.updated_at.toISOString()
    );

    console.log('[DocumentService] 文档上传成功', {
      docId,
      bookId,
      docType,
      fileName,
      fileSize: fileBuffer.length
    });

    return {
      success: true,
      data: document
    };
  } catch (error) {
    console.error('[DocumentService] 文档上传失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '文档上传失败'
    };
  }
}

/**
 * 执行文档向量化
 * @param docId 文档ID
 * @param onProgress 进度回调
 */
export async function vectorizeDocumentById(
  docId: string,
  onProgress?: (progress: VectorizationProgress) => void
): Promise<DocumentServiceResponse<VectorizationResult>> {
  try {
    // 1. 获取文档信息
    const document = await db().get<Document>(
      'SELECT * FROM documents WHERE id = ?',
      [docId]
    );

    if (!document) {
      return {
        success: false,
        error: '文档不存在'
      };
    }

    // 2. 构建完整文件路径
    const fullPath = path.join(process.cwd(), document.file_path);

    // 3. 检查文件是否存在
    try {
      await fs.access(fullPath);
    } catch {
      return {
        success: false,
        error: '文档文件不存在'
      };
    }

    // 4. 创建进度追踪
    const taskId = `${document.book_id}_${docId}`;
    const progressCallback = (progress: VectorizationProgress) => {
      vectorizationTasks.set(taskId, progress);
      if (onProgress) {
        onProgress(progress);
      }
    };

    // 5. 执行向量化
    console.log('[DocumentService] 开始向量化文档', {
      docId,
      bookId: document.book_id,
      docType: document.type
    });

    const result = await vectorizeDocument({
      bookId: document.book_id,
      docId: document.id,
      docType: document.type,
      filePath: fullPath,
      onProgress: progressCallback,
      forceRegenerate: document.vectorized // 如果已向量化，强制重新生成
    });

    // 6. 更新数据库状态
    if (result.success) {
      await db().run(
        'UPDATE documents SET vectorized = ?, updated_at = ? WHERE id = ?',
        [1, new Date().toISOString(), docId]
      );
    }

    // 7. 清理任务缓存
    setTimeout(() => {
      vectorizationTasks.delete(taskId);
    }, 60000); // 1分钟后清理

    console.log('[DocumentService] 文档向量化完成', {
      docId,
      success: result.success,
      chunksCount: result.chunksCount,
      duration: result.duration
    });

    return {
      success: result.success,
      data: result,
      error: result.error
    };
  } catch (error) {
    console.error('[DocumentService] 文档向量化失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '向量化失败'
    };
  }
}

/**
 * 获取书籍的所有文档
 * @param bookId 书籍ID
 */
export async function getDocumentsByBookId(
  bookId: string
): Promise<DocumentServiceResponse<Document[]>> {
  try {
    const documents = await db().all<Document>(
      'SELECT * FROM documents WHERE book_id = ? ORDER BY type, created_at DESC',
      [bookId]
    );

    return {
      success: true,
      data: documents
    };
  } catch (error) {
    console.error('[DocumentService] 获取文档列表失败:', error);
    return {
      success: false,
      error: '获取文档列表失败',
      data: []
    };
  }
}

/**
 * 获取文档详情
 * @param docId 文档ID
 */
export async function getDocumentById(
  docId: string
): Promise<DocumentServiceResponse<Document>> {
  try {
    const document = await db().get<Document>(
      'SELECT * FROM documents WHERE id = ?',
      [docId]
    );

    if (!document) {
      return {
        success: false,
        error: '文档不存在'
      };
    }

    return {
      success: true,
      data: document
    };
  } catch (error) {
    console.error('[DocumentService] 获取文档详情失败:', error);
    return {
      success: false,
      error: '获取文档详情失败'
    };
  }
}

/**
 * 删除文档
 * @param docId 文档ID
 */
export async function deleteDocument(
  docId: string
): Promise<DocumentServiceResponse<void>> {
  try {
    // 1. 获取文档信息
    const document = await db().get<Document>(
      'SELECT * FROM documents WHERE id = ?',
      [docId]
    );

    if (!document) {
      return {
        success: false,
        error: '文档不存在'
      };
    }

    // 2. 删除向量数据
    if (document.vectorized) {
      try {
        await deleteDocumentVectors(document.book_id, document.id);
      } catch (error) {
        console.error('[DocumentService] 删除向量数据失败:', error);
        // 继续删除文档
      }
    }

    // 3. 删除文件
    const fullPath = path.join(process.cwd(), document.file_path);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      console.error('[DocumentService] 删除文件失败:', error);
      // 继续删除数据库记录
    }

    // 4. 删除数据库记录
    await db().run('DELETE FROM documents WHERE id = ?', [docId]);

    // 5. 如果没有其他文档使用同一个book的向量库，清理整个collection
    const remainingDocs = await db().get<{ count: number }>(
      'SELECT COUNT(*) as count FROM documents WHERE book_id = ? AND vectorized = 1',
      [document.book_id]
    );

    if (remainingDocs && remainingDocs.count === 0) {
      try {
        await deleteCollection(document.book_id);
      } catch (error) {
        console.error('[DocumentService] 清理Collection失败:', error);
      }
    }

    console.log('[DocumentService] 文档删除成功', { docId });

    return {
      success: true
    };
  } catch (error) {
    console.error('[DocumentService] 删除文档失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除文档失败'
    };
  }
}

/**
 * 获取向量化进度
 * @param bookId 书籍ID
 * @param docId 文档ID
 */
export async function getVectorizationProgress(
  bookId: string,
  docId: string
): Promise<DocumentServiceResponse<VectorizationProgress | null>> {
  try {
    // 1. 检查内存缓存
    const taskId = `${bookId}_${docId}`;
    const cachedProgress = vectorizationTasks.get(taskId);

    if (cachedProgress) {
      return {
        success: true,
        data: cachedProgress
      };
    }

    // 2. 检查数据库状态
    const document = await db().get<Document>(
      'SELECT * FROM documents WHERE id = ? AND book_id = ?',
      [docId, bookId]
    );

    if (!document) {
      return {
        success: false,
        error: '文档不存在'
      };
    }

    // 3. 如果已完成，返回完成状态
    if (document.vectorized) {
      const status = await getVectorizationStatus(bookId, docId);
      return {
        success: true,
        data: {
          current: status.chunkCount,
          total: status.chunkCount,
          percentage: 100,
          status: 'completed',
          startTime: new Date(document.updated_at).getTime()
        }
      };
    }

    // 4. 未开始或未找到进度
    return {
      success: true,
      data: null
    };
  } catch (error) {
    console.error('[DocumentService] 获取向量化进度失败:', error);
    return {
      success: false,
      error: '获取进度失败'
    };
  }
}

/**
 * 批量删除书籍的所有文档
 * @param bookId 书籍ID
 */
export async function deleteBookDocuments(
  bookId: string
): Promise<DocumentServiceResponse<number>> {
  try {
    // 1. 获取所有文档
    const documents = await db().all<Document>(
      'SELECT * FROM documents WHERE book_id = ?',
      [bookId]
    );

    let deletedCount = 0;

    // 2. 逐个删除文档
    for (const doc of documents) {
      const result = await deleteDocument(doc.id);
      if (result.success) {
        deletedCount++;
      }
    }

    // 3. 清理整个Collection
    try {
      await deleteCollection(bookId);
    } catch (error) {
      console.error('[DocumentService] 清理Collection失败:', error);
    }

    console.log('[DocumentService] 批量删除文档成功', {
      bookId,
      deletedCount
    });

    return {
      success: true,
      data: deletedCount
    };
  } catch (error) {
    console.error('[DocumentService] 批量删除文档失败:', error);
    return {
      success: false,
      error: '批量删除失败',
      data: 0
    };
  }
}

/**
 * 检查书籍是否有向量化的文档
 * @param bookId 书籍ID
 */
export async function hasVectorizedDocuments(
  bookId: string
): Promise<boolean> {
  try {
    const result = await db().get<{ count: number }>(
      'SELECT COUNT(*) as count FROM documents WHERE book_id = ? AND vectorized = 1',
      [bookId]
    );

    return result ? result.count > 0 : false;
  } catch (error) {
    console.error('[DocumentService] 检查向量化文档失败:', error);
    return false;
  }
}

/**
 * 更新文档标题
 * @param docId 文档ID
 * @param title 新标题
 */
export async function updateDocumentTitle(
  docId: string,
  title: string
): Promise<DocumentServiceResponse<void>> {
  try {
    const result = await db().run(
      'UPDATE documents SET title = ?, updated_at = ? WHERE id = ?',
      [title, new Date().toISOString(), docId]
    );

    if (result.changes === 0) {
      return {
        success: false,
        error: '文档不存在'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('[DocumentService] 更新文档标题失败:', error);
    return {
      success: false,
      error: '更新失败'
    };
  }
}