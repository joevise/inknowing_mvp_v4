/**
 * 向量化进度查询API
 * GET /api/admin/books/[id]/documents/[docId]/progress - 获取向量化进度
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/check-auth';
import { getVectorizationProgress } from '@/lib/services/document-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    // 1. 验证管理员权限
    const authResult = await checkAdminAuth(request);
    if (!authResult.authenticated || authResult.user?.email !== 'admin@inknowing.com') {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 401 }
      );
    }

    const { id: bookId, docId } = params;

    // 2. 获取向量化进度
    const result = await getVectorizationProgress(bookId, docId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '获取进度失败' },
        { status: 400 }
      );
    }

    // 3. 返回进度信息
    if (result.data) {
      return NextResponse.json({
        success: true,
        progress: {
          current: result.data.current,
          total: result.data.total,
          percentage: result.data.percentage,
          status: result.data.status,
          currentChunk: result.data.currentChunk,
          estimatedTimeRemaining: result.data.estimatedTimeRemaining
        }
      });
    } else {
      // 没有进行中的向量化任务
      return NextResponse.json({
        success: true,
        progress: null,
        message: '没有进行中的向量化任务'
      });
    }
  } catch (error) {
    console.error('[API] 获取向量化进度失败:', error);
    return NextResponse.json(
      { error: '获取进度失败' },
      { status: 500 }
    );
  }
}