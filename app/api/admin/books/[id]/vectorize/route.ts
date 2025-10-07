/**
 * 书籍批量向量化API
 * POST /api/admin/books/[id]/vectorize - 对书籍的所有未向量化文档进行向量化
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getBookById } from '@/lib/db/books';
import { getDocumentsByBookId, markDocumentAsVectorized } from '@/lib/db/documents';
import { generateId } from '@/lib/db/client';
import { vectorizeDocument } from '@/lib/rag/vectorizer';
import { join } from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const bookId = params.id;

    // 验证书籍存在
    const book = getBookById(bookId);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    console.log('[API] 开始批量向量化', { bookId, bookTitle: book.title });

    // 获取该书籍的所有文档
    const documents = getDocumentsByBookId(bookId);

    if (documents.length === 0) {
      return NextResponse.json(
        { error: '该书籍没有可向量化的文档，请先上传文档' },
        { status: 400 }
      );
    }

    // 过滤出未向量化的文档
    const unvectorizedDocs = documents.filter(doc => !doc.vectorized);

    if (unvectorizedDocs.length === 0) {
      return NextResponse.json({
        task_id: generateId(),
        status: 'completed',
        message: '所有文档已向量化',
        totalDocs: documents.length,
        processedDocs: 0
      });
    }

    console.log('[API] 发现未向量化文档', {
      bookId,
      total: documents.length,
      unvectorized: unvectorizedDocs.length
    });

    // 生成任务ID
    const taskId = generateId();

    // 批量向量化处理
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const doc of unvectorizedDocs) {
      console.log('[API] 正在向量化文档', {
        docId: doc.id,
        title: doc.title,
        filePath: doc.file_path
      });

      try {
        // 调用向量化服务
        const result = await vectorizeDocument({
          bookId,
          docId: doc.id,
          docType: doc.type,
          filePath: doc.file_path,
          onProgress: (progress) => {
            console.log('[API] 向量化进度', {
              docId: doc.id,
              status: progress.status,
              percentage: progress.percentage
            });
          }
        });

        if (result.success) {
          // 标记文档为已向量化
          markDocumentAsVectorized(doc.id);
          successCount++;

          results.push({
            docId: doc.id,
            title: doc.title,
            success: true,
            chunksCount: result.chunksCount,
            vectorsGenerated: result.vectorsGenerated,
            duration: result.duration
          });

          console.log('[API] 文档向量化成功', {
            docId: doc.id,
            chunksCount: result.chunksCount,
            vectorsGenerated: result.vectorsGenerated
          });
        } else {
          failureCount++;
          results.push({
            docId: doc.id,
            title: doc.title,
            success: false,
            error: result.error
          });

          console.error('[API] 文档向量化失败', {
            docId: doc.id,
            error: result.error
          });
        }
      } catch (error) {
        failureCount++;
        results.push({
          docId: doc.id,
          title: doc.title,
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        });

        console.error('[API] 文档向量化异常', {
          docId: doc.id,
          error
        });
      }
    }

    console.log('[API] 批量向量化完成', {
      bookId,
      total: unvectorizedDocs.length,
      success: successCount,
      failure: failureCount
    });

    return NextResponse.json({
      task_id: taskId,
      status: failureCount === 0 ? 'completed' : 'failed',
      message: `批量向量化完成：成功 ${successCount} 个，失败 ${failureCount} 个`,
      totalDocs: documents.length,
      processedDocs: unvectorizedDocs.length,
      successCount,
      failureCount,
      results
    });

  } catch (error) {
    console.error('[API] 批量向量化失败:', error);
    return NextResponse.json(
      {
        error: '批量向量化失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
