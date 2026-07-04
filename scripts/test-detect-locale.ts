import { detectLocale } from '../lib/i18n/detect-locale';

type Case = {
  name: string;
  headers: Record<string, string>;
  expected: 'zh' | 'en';
};

function makeHeaders(entries: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(entries)) {
    h.set(k, v);
  }
  return h;
}

const cases: Case[] = [
  {
    name: 'cf-ipcountry=CN → zh',
    headers: { 'cf-ipcountry': 'CN' },
    expected: 'zh',
  },
  {
    name: 'cf-ipcountry=HK → zh (中文地区)',
    headers: { 'cf-ipcountry': 'HK' },
    expected: 'zh',
  },
  {
    name: 'x-vercel-ip-country=TW → zh',
    headers: { 'x-vercel-ip-country': 'TW' },
    expected: 'zh',
  },
  {
    name: 'cf-ipcountry=US + Accept-Language: en-US,en → en',
    headers: {
      'cf-ipcountry': 'US',
      'accept-language': 'en-US,en;q=0.9',
    },
    expected: 'en',
  },
  {
    name: 'cf-ipcountry=US + Accept-Language: zh-CN → zh (海外华人)',
    headers: {
      'cf-ipcountry': 'US',
      'accept-language': 'zh-CN,zh;q=0.9',
    },
    expected: 'zh',
  },
  {
    name: 'cf-ipcountry=US 且无 accept-language → en (海外兜底)',
    headers: {
      'cf-ipcountry': 'US',
    },
    expected: 'en',
  },
  {
    name: 'no geo + Accept-Language: en-US,en → en',
    headers: { 'accept-language': 'en-US,en;q=0.9' },
    expected: 'en',
  },
  {
    name: 'no geo + Accept-Language: zh-CN,zh → zh',
    headers: { 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' },
    expected: 'zh',
  },
  {
    name: 'no geo + Accept-Language: fr-FR → en (其它语言兜底)',
    headers: { 'accept-language': 'fr-FR,fr;q=0.9' },
    expected: 'en',
  },
  {
    name: 'no geo + Accept-Language: zh-TW → zh',
    headers: { 'accept-language': 'zh-TW' },
    expected: 'zh',
  },
  {
    name: 'no headers at all → zh (保守兜底)',
    headers: {},
    expected: 'zh',
  },
  {
    name: 'empty geo header value → fall through to Accept-Language',
    headers: {
      'cf-ipcountry': '',
      'accept-language': 'en-US',
    },
    expected: 'en',
  },
  {
    name: 'geo precedence: x-vercel-ip-country wins (first non-empty)',
    headers: {
      'x-vercel-ip-country': 'CN',
      'cf-ipcountry': 'US',
    },
    expected: 'zh',
  },
];

let failed = 0;
for (const c of cases) {
  const got = detectLocale(makeHeaders(c.headers));
  const ok = got === c.expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${c.name}  (got=${got}, expected=${c.expected})`);
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1);