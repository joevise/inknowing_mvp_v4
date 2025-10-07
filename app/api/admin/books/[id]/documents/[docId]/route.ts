/**
 * 单个文档管理API
 * GET /api/admin/books/[id]/documents/[docId] - 获取文档详情
 * DELETE /api/admin/books/[id]/documents/[docId] - 删除文档
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/check-auth';
import {
  getDocumentById,
  deleteDocument,
  updateDocumentTitle
} from '@/lib/services/document-service';

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

    const { docId } = params;

    // 2. 获取文档详情
    const result = await getDocumentById(docId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '文档不存在' },
        { status: 404 }
      );
    }

    // 3. 验证文档属于指定书籍
    if (result.data?.book_id !== params.id) {
      return NextResponse.json(
        { error: '文档不属于该书籍' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      document: result.data
    });
  } catch (error) {
    console.error('[API] 获取文档详情失败:', error);
    return NextResponse.json(
      { error: '获取文档详情失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { docId } = params;

    // 2. 获取文档详情（验证权限）
    const docResult = await getDocumentById(docId);
    if (!docResult.success || !docResult.data) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      );
    }

    // 3. 验证文档属于指定书籍
    if (docResult.data.book_id !== params.id) {
      return NextResponse.json(
        { error: '文档不属于该书籍' },
        { status: 403 }
      );
    }

    // 4. 删除文档
    const result = await deleteDocument(docId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '删除文档失败' },
        { status: 400 }
      );
    }

    console.log('[API] 文档删除成功', { docId });

    return NextResponse.json({
      success: true,
      message: '文档删除成功'
    });
  } catch (error) {
    console.error('[API] 删除文档失败:', error);
    return NextResponse.json(
      { error: '删除文档失败' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const { docId } = params;

    // 2. 解析请求体
    const body = await request.json();
    const { title } = body;

    if (!title) {
      return NextResponse.json(
        { error: '标题不能为空' },
        { status: 400 }
      );
    }

    // 3. 获取文档详情（验证权限）
    const docResult = await getDocumentById(docId);
    if (!docResult.success || !docResult.data) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      );
    }

    // 4. 验证文档属于指定书籍
    if (docResult.data.book_id !== params.id) {
      return NextResponse.json(
        { error: '文档不属于该书籍' },
        { status: 403 }
      );
    }

    // 5. 更新文档标题
    const result = await updateDocumentTitle(docId, title);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '更新失败' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '文档标题更新成功'
    });
  } catch (error) {
    console.error('[API] 更新文档失败:', error);
    return NextResponse.json(
      { error: '更新文档失败' },
      { status: 500 }
    );
  }
}