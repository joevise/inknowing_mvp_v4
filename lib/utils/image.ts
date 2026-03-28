/**
 * 图片处理工具
 * 处理封面图片的上传、删除和验证
 */

import fs from 'fs/promises';
import path from 'path';
import { generateId } from '@/lib/db/client';

// 支持的图片格式
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// 最大文件大小（5MB）
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 封面存储路径
const COVERS_DIR = path.join(process.cwd(), 'public', 'covers');

/**
 * 确保封面目录存在
 */
async function ensureCoversDirectory(): Promise<void> {
  try {
    await fs.access(COVERS_DIR);
  } catch {
    await fs.mkdir(COVERS_DIR, { recursive: true });
  }
}

/**
 * 验证图片文件
 */
export function validateImageFile(file: {
  type?: string;
  size?: number;
  name?: string;
}): { valid: boolean; error?: string } {
  // 检查文件类型
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `不支持的文件类型。支持的格式：${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  // 检查文件扩展名
  if (file.name) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `不支持的文件扩展名。支持的格式：${ALLOWED_EXTENSIONS.join(', ')}`
      };
    }
  }

  // 检查文件大小
  if (file.size && file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件大小超过限制。最大支持 ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return { valid: true };
}

/**
 * 上传封面图片
 */
export async function uploadCover(
  fileBuffer: Buffer,
  originalName: string
): Promise<{ url: string; filename: string }> {
  await ensureCoversDirectory();

  // 生成唯一文件名
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${generateId()}${ext}`;
  const filepath = path.join(COVERS_DIR, filename);

  // 保存文件
  await fs.writeFile(filepath, fileBuffer);

  // 返回可访问的URL
  const url = `/covers/${filename}`;

  return { url, filename };
}

/**
 * 上传封面图片（从Base64）
 */
export async function uploadCoverFromBase64(
  base64Data: string,
  originalName?: string
): Promise<{ url: string; filename: string }> {
  // 移除Base64前缀（如果有）
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');

  // 确定扩展名
  const ext = originalName ? path.extname(originalName) : '.jpg';

  return uploadCover(buffer, `cover${ext}`);
}

/**
 * 删除封面图片
 */
export async function deleteCover(filename: string): Promise<boolean> {
  try {
    // 安全检查：确保文件名不包含路径遍历
    const basename = path.basename(filename);
    const filepath = path.join(COVERS_DIR, basename);

    // 确保文件在封面目录内
    if (!filepath.startsWith(COVERS_DIR)) {
      console.error('Security: Attempt to delete file outside covers directory');
      return false;
    }

    await fs.unlink(filepath);
    return true;
  } catch (error) {
    console.error('Error deleting cover:', error);
    return false;
  }
}

/**
 * 删除旧封面并上传新封面
 */
export async function replaceCover(
  oldUrl: string | null,
  newFileBuffer: Buffer,
  originalName: string
): Promise<{ url: string; filename: string }> {
  // 删除旧封面（如果存在且不是默认封面）
  if (oldUrl && !oldUrl.includes('default')) {
    const oldFilename = path.basename(oldUrl);
    await deleteCover(oldFilename);
  }

  // 上传新封面
  return uploadCover(newFileBuffer, originalName);
}

/**
 * 复制默认封面
 */
export async function copyDefaultCover(): Promise<{ url: string; filename: string }> {
  await ensureCoversDirectory();

  const defaultCoverPath = path.join(process.cwd(), 'public', 'images', 'default-book-cover.jpg');
  const filename = `${generateId()}.jpg`;
  const targetPath = path.join(COVERS_DIR, filename);

  try {
    await fs.copyFile(defaultCoverPath, targetPath);
  } catch (error) {
    // 如果默认封面不存在，创建一个占位文件
    const placeholderContent = Buffer.from('');
    await fs.writeFile(targetPath, placeholderContent);
  }

  return {
    url: `/covers/${filename}`,
    filename
  };
}

/**
 * 获取封面的完整URL
 */
export function getCoverUrl(filename: string | null, baseUrl?: string): string {
  if (!filename) {
    return '/images/default-book-cover.jpg';
  }

  // 如果已经是完整URL，直接返回
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }

  // 如果是相对路径
  if (filename.startsWith('/')) {
    return baseUrl ? `${baseUrl}${filename}` : filename;
  }

  // 构建封面URL
  const url = `/covers/${filename}`;
  return baseUrl ? `${baseUrl}${url}` : url;
}

/**
 * 清理未使用的封面（维护任务）
 */
export async function cleanupUnusedCovers(usedFilenames: string[]): Promise<number> {
  await ensureCoversDirectory();

  const files = await fs.readdir(COVERS_DIR);
  const usedSet = new Set(usedFilenames.map(f => path.basename(f)));
  let deletedCount = 0;

  for (const file of files) {
    if (!usedSet.has(file) && file !== '.gitkeep') {
      const filepath = path.join(COVERS_DIR, file);
      try {
        await fs.unlink(filepath);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete unused cover ${file}:`, error);
      }
    }
  }

  return deletedCount;
}