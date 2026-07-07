/**
 * 豆瓣服务
 * 提供书籍封面抓取功能：豆瓣（带重试）→ 百度图片兜底
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { generateId } from '@/lib/db/client';

interface DoubanCoverResult {
  success: boolean;
  coverUrl?: string;
  localPath?: string;
  error?: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 下载图片并保存到 public/covers，校验必须是真图（image/* 且 >1KB）
 */
async function downloadAndSave(
  imageUrl: string,
  referer: string
): Promise<{ localPath: string } | null> {
  try {
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Referer: referer,
      },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = imageResponse.headers.get('content-type') || '';
    if (!imageResponse.ok) return null;
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const isImage =
      contentType.toLowerCase().startsWith('image/') && buffer.length > 1024;
    if (!isImage) {
      console.warn('[Cover Service] Invalid image response:', {
        url: imageUrl,
        status: imageResponse.status,
        contentType,
        size: buffer.length,
      });
      return null;
    }

    const fileId = generateId();
    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)?.[1] || 'jpg';
    const fileName = `${fileId}.${ext}`;
    const coversDir = join(process.cwd(), 'public', 'covers');
    mkdirSync(coversDir, { recursive: true });
    writeFileSync(join(coversDir, fileName), buffer);
    const localPath = `/covers/${fileName}`;
    console.log('[Cover Service] Saved to local:', localPath);
    return { localPath };
  } catch (e) {
    console.error('[Cover Service] Download error:', e);
    return null;
  }
}

/**
 * 搜豆瓣一次，返回封面大图 URL（可能因反爬验证页返回 null）
 */
async function searchDoubanOnce(bookTitle: string): Promise<string | null> {
  const searchUrl = `https://www.douban.com/search?cat=1001&q=${encodeURIComponent(bookTitle)}`;
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': UA,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Referer: 'https://www.douban.com/',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();

  const imgRegex = /(https?:\/\/[^"']*doubanio\.com[^"']*\/view\/[^"']*)/g;
  const matches = html.match(imgRegex);
  if (matches && matches.length > 0) {
    return matches[0].replace('/s/', '/l/');
  }
  // 无结果：可能是反爬验证页
  if (/sec\.douban|验证|captcha/i.test(html)) {
    console.warn('[Douban Service] Anti-bot page detected');
  }
  return null;
}

/**
 * 百度图片兜底：搜「书名 书籍封面」取第一张可下载的图
 */
async function searchBaiduCover(bookTitle: string): Promise<string | null> {
  try {
    const url = `https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&word=${encodeURIComponent(
      `${bookTitle} 书籍封面`
    )}&pn=0&rn=8`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://image.baidu.com/',
        Accept: 'application/json, text/plain, */*',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    // 宽松解析（百度返回的 JSON 常有非法转义），直接正则抽 thumbURL/middleURL
    const urls = [
      ...(text.match(/"middleURL":"(https?:\/\/[^"]+)"/g) || []),
      ...(text.match(/"thumbURL":"(https?:\/\/[^"]+)"/g) || []),
    ]
      .map((m) => m.replace(/^"(?:middleURL|thumbURL)":"/, '').replace(/"$/, ''))
      .filter((u) => /^https?:\/\//.test(u));
    return urls[0] || null;
  } catch (e) {
    console.error('[Baidu Cover] Search error:', e);
    return null;
  }
}

/**
 * 从豆瓣（重试1次）→ 百度图片 获取书籍封面并保存到本地
 */
export async function fetchDoubanCover(bookTitle: string): Promise<DoubanCoverResult> {
  console.log('[Cover Service] Searching cover for:', bookTitle);

  // ① 豆瓣：最多试 2 次（反爬验证页时好时坏）
  let doubanUrl: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      doubanUrl = await searchDoubanOnce(bookTitle);
      if (doubanUrl) break;
    } catch (e) {
      console.warn(`[Douban Service] Attempt ${attempt} failed:`, e);
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 2000));
  }

  if (doubanUrl) {
    console.log('[Douban Service] Found:', doubanUrl);
    const saved = await downloadAndSave(doubanUrl, 'https://book.douban.com/');
    if (saved) {
      return { success: true, coverUrl: doubanUrl, localPath: saved.localPath };
    }
    console.warn('[Douban Service] Download failed, falling back to Baidu');
  } else {
    console.warn('[Douban Service] No cover found, falling back to Baidu');
  }

  // ② 百度图片兜底
  const baiduUrl = await searchBaiduCover(bookTitle);
  if (baiduUrl) {
    console.log('[Baidu Cover] Found:', baiduUrl);
    const saved = await downloadAndSave(baiduUrl, 'https://image.baidu.com/');
    if (saved) {
      return { success: true, coverUrl: baiduUrl, localPath: saved.localPath };
    }
  }

  return { success: false, error: '豆瓣与百度均未获取到有效封面' };
}
