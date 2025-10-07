/**
 * 文档向量化API
 * POST /api/admin/books/[id]/documents/[docId]/vectorize - 触发文档向量化
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import {
  getDocumentById,
  vectorizeDocumentById
} from '@/lib/services/document-service';

// 使用服务器发送事件（SSE）实时传输进度
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    // 1. 验证管理员权限
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const { id: bookId, docId } = params;

    // 2. 验证文档存在并属于该书籍
    const docResult = await getDocumentById(docId);
    if (!docResult.success || !docResult.data) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      );
    }

    if (docResult.data.book_id !== bookId) {
      return NextResponse.json(
        { error: '文档不属于该书籍' },
        { status: 403 }
      );
    }

    // 3. 创建SSE响应流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送初始消息
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'start',
                message: '开始向量化处理...'
              })}\n\n`
            )
          );

          // 执行向量化，传入进度回调
          const result = await vectorizeDocumentById(docId, (progress) => {
            // 发送进度更新
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'progress',
                  progress: {
                    current: progress.current,
                    total: progress.total,
                    percentage: progress.percentage,
                    status: progress.status,
                    currentChunk: progress.currentChunk,
                    estimatedTimeRemaining: progress.estimatedTimeRemaining
                  }
                })}\n\n`
              )
            );
          });

          // 发送完成消息
          if (result.success && result.data) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'complete',
                  result: {
                    success: true,
                    chunksCount: result.data.chunksCount,
                    vectorsGenerated: result.data.vectorsGenerated,
                    totalTokens: result.data.totalTokens,
                    duration: result.data.duration
                  }
                })}\n\n`
              )
            );
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  error: result.error || '向量化失败'
                })}\n\n`
              )
            );
          }
        } catch (error) {
          // 发送错误消息
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : '未知错误'
              })}\n\n`
            )
          );
        } finally {
          // 关闭流
          controller.close();
        }
      }
    });

    // 返回SSE响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('[API] 向量化失败:', error);
    return NextResponse.json(
      { error: '向量化处理失败' },
      { status: 500 }
    );
  }
}

// 简化版本：不使用SSE，直接返回结果
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    // 1. 验证管理员权限
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const { id: bookId, docId } = params;

    // 2. 验证文档存在并属于该书籍
    const docResult = await getDocumentById(docId);
    if (!docResult.success || !docResult.data) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      );
    }

    if (docResult.data.book_id !== bookId) {
      return NextResponse.json(
        { error: '文档不属于该书籍' },
        { status: 403 }
      );
    }

    console.log('[API] 开始向量化文档', { bookId, docId });

    // 3. 执行向量化（不传入进度回调）
    const result = await vectorizeDocumentById(docId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || '向量化失败'
        },
        { status: 400 }
      );
    }

    console.log('[API] 向量化完成', {
      bookId,
      docId,
      chunksCount: result.data?.chunksCount,
      duration: result.data?.duration
    });

    return NextResponse.json({
      success: true,
      result: result.data
    });
  } catch (error) {
    console.error('[API] 向量化失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '向量化处理失败'
      },
      { status: 500 }
    );
  }
}