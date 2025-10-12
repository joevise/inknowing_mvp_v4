/**
 * 角色批量操作API
 * DELETE /api/admin/characters/batch - 批量删除角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { deleteCharacter } from '@/lib/db/characters';

export async function DELETE(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '缺少角色ID列表' },
        { status: 400 }
      );
    }

    console.log('[Batch Delete] Deleting', ids.length, 'characters');

    let successCount = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await deleteCharacter(id);
        successCount++;
      } catch (error) {
        console.error(`[Batch Delete] Failed to delete character ${id}:`, error);
        errors.push(id);
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      failCount: errors.length,
      message: `成功删除 ${successCount} 个角色${errors.length > 0 ? `，${errors.length} 个失败` : ''}`,
    });
  } catch (error) {
    console.error('[API] 批量删除角色失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量删除失败' },
      { status: 500 }
    );
  }
}
