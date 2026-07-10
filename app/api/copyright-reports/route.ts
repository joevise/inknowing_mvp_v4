import { NextRequest, NextResponse } from 'next/server';
import { createCopyrightReport } from '@/lib/db/copyright-reports';

const FIELD_LIMITS = {
  work_title: 200,
  rights_holder: 100,
  contact_info: 200,
  proof_description: 2000,
  infringing_content: 2000,
};

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const work_title = readText(body?.work_title);
    const rights_holder = readText(body?.rights_holder);
    const contact_info = readText(body?.contact_info);
    const proof_description = readText(body?.proof_description);
    const infringing_content = readText(body?.infringing_content);

    if (!work_title || !contact_info || !proof_description || !infringing_content) {
      return NextResponse.json({ error: '请填写所有必填项' }, { status: 400 });
    }

    if (
      work_title.length > FIELD_LIMITS.work_title ||
      rights_holder.length > FIELD_LIMITS.rights_holder ||
      contact_info.length > FIELD_LIMITS.contact_info ||
      proof_description.length > FIELD_LIMITS.proof_description ||
      infringing_content.length > FIELD_LIMITS.infringing_content
    ) {
      return NextResponse.json({ error: '提交内容超出长度限制' }, { status: 400 });
    }

    const report = await createCopyrightReport({
      work_title,
      rights_holder: rights_holder || null,
      contact_info,
      proof_description,
      infringing_content,
    });

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error) {
    console.error('[Copyright] create report failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交版权投诉失败' },
      { status: 500 }
    );
  }
}
