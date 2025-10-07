/**
 * POST /api/admin/books/[id]/cover
 * 上传或更换封面图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getBookById, updateBook } from '@/lib/services/book-service';
import {
  validateImageFile,
  uploadCover,
  deleteCover,
  uploadCoverFromBase64
} from '@/lib/utils/image';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/books/:id/cover
 * 上传或更换书籍封面
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    // 检查书籍是否存在
    const book = await getBookById(id);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 获取请求内容类型
    const contentType = request.headers.get('content-type') || '';

    let coverUrl: string;
    let filename: string;

    if (contentType.includes('multipart/form-data')) {
      // 处理FormData上传
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json(
          { error: '请选择要上传的图片文件' },
          { status: 400 }
        );
      }

      // 验证文件
      const validation = validateImageFile({
        type: file.type,
        size: file.size,
        name: file.name
      });

      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      // 读取文件内容
      const buffer = Buffer.from(await file.arrayBuffer());

      // 删除旧封面（如果不是默认封面）
      if (book.cover_url && !book.cover_url.includes('default')) {
        const oldFilename = book.cover_url.split('/').pop();
        if (oldFilename) {
          await deleteCover(oldFilename);
        }
      }

      // 上传新封面
      const uploadResult = await uploadCover(buffer, file.name);
      coverUrl = uploadResult.url;
      filename = uploadResult.filename;
    } else if (contentType.includes('application/json')) {
      // 处理Base64上传
      const body = await request.json();

      if (!body.image) {
        return NextResponse.json(
          { error: '请提供图片数据' },
          { status: 400 }
        );
      }

      // 验证Base64数据
      if (!body.image.startsWith('data:image/')) {
        return NextResponse.json(
          { error: '无效的图片数据格式' },
          { status: 400 }
        );
      }

      // 删除旧封面
      if (book.cover_url && !book.cover_url.includes('default')) {
        const oldFilename = book.cover_url.split('/').pop();
        if (oldFilename) {
          await deleteCover(oldFilename);
        }
      }

      // 从Base64上传
      const uploadResult = await uploadCoverFromBase64(
        body.image,
        body.filename || 'cover.jpg'
      );
      coverUrl = uploadResult.url;
      filename = uploadResult.filename;
    } else {
      return NextResponse.json(
        { error: '不支持的请求格式' },
        { status: 400 }
      );
    }

    // 更新书籍封面URL
    console.log(`[Admin] Updating book ${id} cover: ${coverUrl}`);
    const updatedBook = await updateBook(id, { cover_url: coverUrl });

    if (!updatedBook) {
      // 如果更新失败，删除刚上传的图片
      await deleteCover(filename);
      return NextResponse.json(
        { error: '更新书籍封面失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cover_url: coverUrl,
      filename: filename,
      book: {
        id: updatedBook.id,
        title: updatedBook.title,
        cover_url: updatedBook.cover_url
      }
    });
  } catch (error) {
    console.error('[Admin] Upload cover error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '上传封面失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/books/:id/cover
 * 删除书籍封面（恢复默认封面）
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // 验证管理员权限
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    // 检查书籍是否存在
    const book = await getBookById(id);
    if (!book) {
      return NextResponse.json(
        { error: '书籍不存在' },
        { status: 404 }
      );
    }

    // 删除当前封面
    if (book.cover_url && !book.cover_url.includes('default')) {
      const filename = book.cover_url.split('/').pop();
      if (filename) {
        await deleteCover(filename);
      }
    }

    // 更新为默认封面
    const defaultCover = '/images/default-book-cover.jpg';
    console.log(`[Admin] Resetting book ${id} cover to default`);
    const updatedBook = await updateBook(id, { cover_url: defaultCover });

    return NextResponse.json({
      success: true,
      cover_url: defaultCover,
      book: {
        id: updatedBook?.id,
        title: updatedBook?.title,
        cover_url: defaultCover
      }
    });
  } catch (error) {
    console.error('[Admin] Delete cover error:', error);
    return NextResponse.json(
      { error: '删除封面失败' },
      { status: 500 }
    );
  }
}