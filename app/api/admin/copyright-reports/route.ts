import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { listCopyrightReports } from '@/lib/db/copyright-reports';

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const reports = await listCopyrightReports();
    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error('[Admin] list copyright reports failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取版权投诉列表失败' },
      { status: 500 }
    );
  }
}
