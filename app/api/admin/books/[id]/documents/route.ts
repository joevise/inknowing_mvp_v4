/**
 * 书籍文档管理API
 * POST /api/admin/books/[id]/documents - 上传文档
 * GET /api/admin/books/[id]/documents - 获取文档列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getBookById } from '@/lib/db/books';
import { createDocument, getDocumentsByBookId } from '@/lib/db/documents';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    // 验证书籍存在
    const book = getBookById(params.id);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 解析文件上传
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const title = formData.get('title') as string;

    // 验证必需字段
    if (!file) {
      return NextResponse.json(
        { error: '请选择要上传的文件' },
        { status: 400 }
      );
    }

    if (!type || !['main', 'supplement'].includes(type)) {
      return NextResponse.json(
        { error: 'type 必须是 main 或 supplement' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: '文档标题不能为空' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const fileName = file.name;
    const fileExt = fileName.split('.').pop()?.toLowerCase();

    if (!fileExt || !['txt', 'md', 'markdown'].includes(fileExt)) {
      return NextResponse.json(
        { error: '只支持 TXT 或 Markdown 文件' },
        { status: 400 }
      );
    }

    // 验证文件大小（限制为 10MB）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '文件大小不能超过 10MB' },
        { status: 400 }
      );
    }

    // 准备存储路径
    const uploadDir = join(process.cwd(), 'uploads', 'documents', params.id);

    // 创建目录（如果不存在）
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 生成唯一文件名（时间戳 + 原文件名）
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFileName = `${timestamp}_${safeFileName}`;
    const filePath = join(uploadDir, storedFileName);

    // 保存文件
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    console.log('[API] 文件上传成功:', {
      bookId: params.id,
      fileName: storedFileName,
      filePath,
      fileSize: file.size,
      type,
    });

    // 创建数据库记录
    const document = createDocument({
      book_id: params.id,
      type: type as 'main' | 'supplement',
      title,
      file_path: filePath,
      file_size: file.size,
      vectorized: false,
    });

    return NextResponse.json(
      {
        success: true,
        document_id: document.id,
        document,
        message: '文档上传成功',
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[API] 文档上传失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '文档上传失败',
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    // 获取文档列表
    const documents = getDocumentsByBookId(params.id);

    return NextResponse.json({
      success: true,
      documents
    });
  } catch (error) {
    console.error('[API] 获取文档列表失败:', error);
    return NextResponse.json(
      { error: '获取文档列表失败' },
      { status: 500 }
    );
  }
}