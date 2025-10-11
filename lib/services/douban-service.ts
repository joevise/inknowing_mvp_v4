/**
 * 豆瓣服务
 * 提供豆瓣图书封面抓取功能
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { generateId } from '@/lib/db/client';

interface DoubanCoverResult {
  success: boolean;
  coverUrl?: string;
  localPath?: string;
  error?: string;
}

/**
 * 从豆瓣搜索并获取书籍封面
 */
export async function fetchDoubanCover(bookTitle: string): Promise<DoubanCoverResult> {
  try {
    // 构建豆瓣搜索URL
    const encodedKeyword = encodeURIComponent(bookTitle);
    const searchUrl = `https://www.douban.com/search?cat=1001&q=${encodedKeyword}`;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.douban.com/'
    };

    console.log('[Douban Service] Searching:', bookTitle);

    const response = await fetch(searchUrl, {
      headers,
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 使用正则表达式提取图片URL
    // 豆瓣图书封面通常在 img.doubanio.com/view/ 路径下
    const imgRegex = /(https?:\/\/[^"']*doubanio\.com[^"']*\/view\/[^"']*)/g;
    const matches = html.match(imgRegex);

    if (matches && matches.length > 0) {
      // 取第一个匹配的图片，并替换为大图
      let coverUrl = matches[0].replace('/s/', '/l/'); // s=小图, l=大图

      console.log('[Douban Service] Found:', coverUrl);

      // 下载图片到本地
      try {
        const imageResponse = await fetch(coverUrl, { headers });

        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // 生成唯一文件名
          const fileId = generateId();
          const ext = coverUrl.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
          const fileName = `${fileId}.${ext}`;
          const filePath = join(process.cwd(), 'public', 'covers', fileName);

          // 保存到本地
          writeFileSync(filePath, buffer);

          const localPath = `/covers/${fileName}`;
          console.log('[Douban Service] Saved to local:', localPath);

          return {
            success: true,
            coverUrl,
            localPath,
          };
        } else {
          console.warn('[Douban Service] Failed to download image:', imageResponse.status);
          // 下载失败，仍返回原始URL
          return {
            success: true,
            coverUrl,
          };
        }
      } catch (downloadError) {
        console.error('[Douban Service] Download error:', downloadError);
        // 下载失败，仍返回原始URL
        return {
          success: true,
          coverUrl,
        };
      }
    } else {
      console.log('[Douban Service] Not found for:', bookTitle);
      return {
        success: false,
        error: '未找到封面图片',
      };
    }

  } catch (error) {
    console.error('[Douban Service] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取豆瓣封面失败',
    };
  }
}
