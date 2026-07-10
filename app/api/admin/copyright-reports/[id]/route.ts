import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import {
  getCopyrightReportById,
  updateCopyrightReportStatus,
  type CopyrightReportStatus,
} from '@/lib/db/copyright-reports';

const VALID_STATUSES: CopyrightReportStatus[] = ['pending', 'reviewing', 'resolved', 'rejected'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const existing = await getCopyrightReportById(params.id);
    if (!existing) {
      return NextResponse.json({ error: '版权投诉不存在' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body?.status;
    const adminNote = typeof body?.admin_note === 'string'
      ? body.admin_note.trim().slice(0, 2000)
      : undefined;

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: '无效的处理状态' }, { status: 400 });
    }

    const report = await updateCopyrightReportStatus(params.id, status, adminNote);
    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('[Admin] update copyright report failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新版权投诉失败' },
      { status: 500 }
    );
  }
}
