/**
 * 邀请码 CSV 导出 API
 * GET /api/admin/invite-codes/export?status=all|active|used|disabled
 *
 * 返回 Content-Type: text/csv; charset=utf-8,带 BOM 以便 Excel 正确显示中文。
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { listInviteCodesByStatus } from '@/lib/db/invite-codes';
import type { InviteCode } from '@/lib/db/schema';

type StatusFilter = 'all' | InviteCode['status'];
const VALID_STATUSES: StatusFilter[] = ['all', 'active', 'used', 'disabled'];

const STATUS_LABELS_ZH: Record<InviteCode['status'], string> = {
  active: '可用',
  used: '已使用',
  disabled: '已停用',
};

function csvEscape(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const rawStatus = (request.nextUrl.searchParams.get('status') || 'all').toLowerCase();
    const status: StatusFilter = (VALID_STATUSES as string[]).includes(rawStatus)
      ? (rawStatus as StatusFilter)
      : 'all';

    const codes = await listInviteCodesByStatus(status);

    const header = ['邀请码', '状态', '创建时间', '使用者ID', '使用时间', '备注'];
    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(','));

    for (const c of codes) {
      lines.push(
        [
          c.code,
          STATUS_LABELS_ZH[c.status] || c.status,
          c.created_at ? new Date(c.created_at).toISOString() : '',
          c.used_by ?? '',
          c.used_at ? new Date(c.used_at).toISOString() : '',
          c.note ?? '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `invite_codes_${yyyy}${mm}${dd}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Admin] export invite codes failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出邀请码失败' },
      { status: 500 }
    );
  }
}
