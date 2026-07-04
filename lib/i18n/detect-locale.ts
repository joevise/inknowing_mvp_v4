import type { Locale } from '@/i18n/request';

const GEO_HEADERS = [
  'x-vercel-ip-country',
  'cf-ipcountry',
  'x-geo-country',
  'x-country-code',
] as const;

const ZH_COUNTRIES = new Set(['CN', 'HK', 'TW', 'MO']);

function parseAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const firstSegment = header.split(',')[0];
  if (!firstSegment) return null;
  const primary = firstSegment.split(';')[0]?.trim().toLowerCase();
  if (!primary) return null;
  if (primary.startsWith('zh')) return 'zh';
  if (primary.startsWith('en')) return 'en';
  return null;
}

export function detectLocale(headers: Headers): Locale {
  let geoFallback: Locale = 'zh';
  for (const name of GEO_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    const country = raw.trim().toUpperCase();
    if (!country) continue;
    if (ZH_COUNTRIES.has(country)) return 'zh';
    geoFallback = 'en';
    break;
  }

  const acceptHeader = headers.get('accept-language');
  if (acceptHeader) {
    const fromAccept = parseAcceptLanguage(acceptHeader);
    if (fromAccept) return fromAccept;
    return 'en';
  }

  return geoFallback;
}