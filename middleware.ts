import { NextRequest, NextResponse } from 'next/server';
import { detectLocale } from '@/lib/i18n/detect-locale';
import { locales, type Locale } from '@/i18n/request';

const COOKIE_NAME = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const VALID_LOCALES = locales as readonly string[];

function isValidLocale(value: string | undefined): value is Locale {
  return typeof value === 'string' && VALID_LOCALES.includes(value);
}

export function middleware(request: NextRequest) {
  try {
    const existing = request.cookies.get(COOKIE_NAME)?.value;
    if (isValidLocale(existing)) {
      return NextResponse.next();
    }

    const locale = detectLocale(request.headers);
    const res = NextResponse.next();
    res.cookies.set(COOKIE_NAME, locale, {
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      httpOnly: false,
      sameSite: 'lax',
    });
    return res;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};