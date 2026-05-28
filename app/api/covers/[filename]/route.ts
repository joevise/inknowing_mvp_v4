/**
 * GET /api/covers/[filename]
 * 动态提供 public/covers 下的文件（Next.js standalone 不会服务运行时新增的 public 文件）
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

const COVERS_DIR = join(process.cwd(), 'public', 'covers');

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

interface RouteParams {
  params: Promise<{ filename: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { filename } = await params;
    // 防穿越
    const safe = basename(filename);
    if (safe !== filename) {
      return NextResponse.json({ error: 'invalid filename' }, { status: 400 });
    }
    const ext = extname(safe).toLowerCase();
    if (!MIME[ext]) {
      return NextResponse.json({ error: 'unsupported type' }, { status: 400 });
    }
    const filePath = join(COVERS_DIR, safe);
    const s = await stat(filePath).catch(() => null);
    if (!s || !s.isFile()) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const buf = await readFile(filePath);
    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        'Content-Type': MIME[ext],
        'Content-Length': String(s.size),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
