import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { locale } = await request.json();
  if (locale !== 'zh' && locale !== 'en') {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: 'lax',
  });
  return res;
}