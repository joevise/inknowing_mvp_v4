#!/usr/bin/env tsx
/**
 * 批量补全 books / characters 表的英文字段(*_en)。
 * - 幂等:只翻译并写入"当前为 NULL 或空字符串"的英文字段,不会覆盖已有英文。
 * - 一条记录一次 API 调用,模型严格返回 JSON。
 * - 中文原文为空 → 对应英文字段也留空,不调 API。
 * - 串行小并发(≤3),间隔 200~500ms,遇 429 指数退避(最多 3 次)。
 *
 * 用法:
 *   npx tsx scripts/translate-books-en.ts             # 翻译并写库
 *   npx tsx scripts/translate-books-en.ts --dry-run   # 只打印译文,不写库
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import OpenAI from 'openai';
import { prepare, closeDb } from '../lib/db/client';

// ===================== .env 解析(无 dotenv 依赖) =====================
function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  let raw: string;
  try {
    raw = readFileSync(envPath, 'utf-8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}
loadDotEnv();

// ===================== 命令行参数 / 客户端 =====================
const DRY_RUN = process.argv.slice(2).includes('--dry-run');

const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_API_BASE =
  process.env.QWEN_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const QWEN_CHAT_MODEL = process.env.QWEN_CHAT_MODEL || 'qwen-max';

if (!QWEN_API_KEY) {
  console.error('❌ 缺少 QWEN_API_KEY(请确认项目根 .env 已配置且可加载)');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL 未加载,db client 将使用内置默认值');
}

const openai = new OpenAI({
  apiKey: QWEN_API_KEY,
  baseURL: QWEN_API_BASE,
});

// ===================== 类型 / 字段定义 =====================
type BookRow = {
  id: string;
  title: string;
  description: string | null;
  title_en: string | null;
  description_en: string | null;
};

type CharacterRow = {
  id: string;
  name: string;
  description: string | null;
  speaking_style: string | null;
  background_story: string | null;
  prompt_template: string | null;
  name_en: string | null;
  description_en: string | null;
  speaking_style_en: string | null;
  background_story_en: string | null;
  prompt_template_en: string | null;
};

const BOOK_FIELDS: { en: keyof BookRow; cn: keyof BookRow }[] = [
  { en: 'title_en', cn: 'title' },
  { en: 'description_en', cn: 'description' },
];

const CHARACTER_FIELDS: { en: keyof CharacterRow; cn: keyof CharacterRow }[] = [
  { en: 'name_en', cn: 'name' },
  { en: 'description_en', cn: 'description' },
  { en: 'speaking_style_en', cn: 'speaking_style' },
  { en: 'background_story_en', cn: 'background_story' },
  { en: 'prompt_template_en', cn: 'prompt_template' },
];

// ===================== 工具 =====================
const isMissing = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const FIELD_HINT: Record<string, string> = {
  title_en:
    'English book title. World-famous works must use their standard established English title (e.g. 《简爱》→ "Jane Eyre"; 《哈姆雷特》→ "Hamlet"; 《挪威的森林》→ "Norwegian Wood"; 《思考,快与慢》→ "Thinking, Fast and Slow"; 《原则》→ "Principles"; 《富爸爸穷爸爸》→ "Rich Dad Poor Dad"; 《红楼梦》→ "Dream of the Red Chamber"; 《三国演义》→ "Romance of the Three Kingdoms"; 《西游记》→ "Journey to the West"; 《水浒传》→ "Outlaws of the Marsh"; 《论语》→ "The Analects"; 《道德经》→ "Tao Te Ching").',
  description_en:
    'Natural, fluent English book description (literary register, not literal machine-translation).',
  name_en:
    'English personal name. Chinese names use Hanyu Pinyin without tone marks (e.g. 丁元英 → "Ding Yuanying"; 芮小丹 → "Rui Xiaodan"; 武松 → "Wu Song"). Western / world-literature characters use their original English name (e.g. 简·爱 → "Jane Eyre"; 哈姆雷特 → "Hamlet"; 罗切斯特 → "Rochester"; 麦克白 → "Macbeth").',
  speaking_style_en:
    "Faithful, fluent English description of the character's speaking style.",
  background_story_en: 'Faithful, fluent English background story.',
  prompt_template_en:
    'English roleplay system prompt for an LLM to play this character. Keep the imperative / roleplay tone so an English LLM can follow it directly.',
};

function buildUserPrompt(
  missingFields: string[],
  sources: Record<string, string>,
  context: Record<string, string | null>,
): string {
  const lines: string[] = [];
  lines.push('Translate the following Chinese fields into English.');
  lines.push('Return ONLY a valid JSON object. No markdown fences, no commentary, no extra text.');
  lines.push('');
  lines.push('Fields to translate (with per-field guidance):');
  for (const f of missingFields) {
    lines.push(`- ${f}: ${FIELD_HINT[f]}`);
  }
  const ctxEntries = Object.entries(context).filter(([, v]) => !isMissing(v));
  if (ctxEntries.length) {
    lines.push('');
    lines.push('Context (already-translated English — for reference only, do NOT include in output):');
    for (const [k, v] of ctxEntries) lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push('Input (Chinese source per field):');
  for (const f of missingFields) {
    lines.push(`- ${f}: ${JSON.stringify(sources[f] ?? '')}`);
  }
  lines.push('');
  lines.push('Output: a JSON object whose keys are EXACTLY: ' + missingFields.join(', ') + '.');
  return lines.join('\n');
}

function extractJson(text: string): Record<string, unknown> {
  const trimmed = String(text ?? '').trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model response');
  return JSON.parse(body.slice(start, end + 1));
}

async function callModel(
  missingFields: string[],
  sources: Record<string, string>,
  context: Record<string, string | null>,
): Promise<Record<string, string>> {
  const system =
    'You are a professional literary translator localizing Chinese book metadata and literary character profiles into natural, idiomatic English for a bilingual reading app.\n\n' +
    'Translation rules:\n' +
    '- Output STRICTLY a valid JSON object. No markdown fences, no commentary, no trailing prose.\n' +
    '- Only fill in the keys listed in the user prompt. Never invent extra keys.\n' +
    '- For each requested key, translate the Chinese input into fluent, literary English.\n' +
    '- Titles of world-famous works use their standard established English title. Names follow the per-field instructions in the user prompt.\n' +
    '- Do not add explanations.';
  const user = buildUserPrompt(missingFields, sources, context);
  const resp = await openai.chat.completions.create({
    model: QWEN_CHAT_MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const content = resp.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson(content);
  const result: Record<string, string> = {};
  for (const f of missingFields) {
    const v = parsed[f];
    if (typeof v === 'string' && v.trim() !== '') result[f] = v;
  }
  return result;
}

async function callWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status;
      const is429 = status === 429 || /429|rate|too many/i.test(String(err?.message ?? ''));
      if (is429 && attempt < 2) {
        const wait = 1500 * (attempt + 1);
        console.warn(`  ⚠️  ${label} 429,退避 ${wait}ms 后重试 (${attempt + 1}/3)`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// 并发 worker pool(每条记录处理完之后 sleep 200~500ms)
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const total = items.length;
  const lanes = Array.from({ length: Math.min(limit, Math.max(total, 1)) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
      if (idx < items.length - 1) {
        await sleep(200 + Math.floor(Math.random() * 300));
      }
    }
  });
  if (total === 0) return;
  await Promise.all(lanes);
}

// ===================== 处理单条记录 =====================

async function processBook(
  row: BookRow,
): Promise<{ translated: Record<string, string>; skip: boolean }> {
  const missing = BOOK_FIELDS.filter((f) => isMissing(row[f.en]));
  const withSource = missing.filter((f) => !isMissing(row[f.cn]));
  if (withSource.length === 0) return { translated: {}, skip: true };

  const sources: Record<string, string> = {};
  const context: Record<string, string | null> = {};
  for (const f of withSource) sources[f.en] = String(row[f.cn] ?? '');
  for (const f of BOOK_FIELDS) {
    if (!withSource.includes(f) && !isMissing(row[f.en])) context[f.en] = row[f.en];
  }
  const translated = await callWithRetry(
    () => callModel(withSource.map((f) => f.en), sources, context),
    `[book 《${row.title}》]`,
  );
  return { translated, skip: Object.keys(translated).length === 0 };
}

async function processCharacter(
  row: CharacterRow,
): Promise<{ translated: Record<string, string>; skip: boolean }> {
  const missing = CHARACTER_FIELDS.filter((f) => isMissing(row[f.en]));
  const withSource = missing.filter((f) => !isMissing(row[f.cn]));
  if (withSource.length === 0) return { translated: {}, skip: true };

  const sources: Record<string, string> = {};
  const context: Record<string, string | null> = {};
  for (const f of withSource) sources[f.en] = String(row[f.cn] ?? '');
  for (const f of CHARACTER_FIELDS) {
    if (!withSource.includes(f) && !isMissing(row[f.en])) context[f.en] = row[f.en];
  }
  const translated = await callWithRetry(
    () => callModel(withSource.map((f) => f.en), sources, context),
    `[character ${row.name}]`,
  );
  return { translated, skip: Object.keys(translated).length === 0 };
}

// ===================== 写库 =====================

async function writeBook(row: BookRow, fields: Record<string, string>): Promise<void> {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setParts: string[] = [];
  const params: any[] = [];
  for (const k of keys) {
    setParts.push(`${k} = ?`);
    params.push(fields[k]);
  }
  setParts.push(`updated_at = NOW()`);
  params.push(row.id);
  await prepare(
    `UPDATE books SET ${setParts.join(', ')} WHERE id = ?`,
  ).run(...params);
}

async function writeCharacter(
  row: CharacterRow,
  fields: Record<string, string>,
): Promise<void> {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setParts: string[] = [];
  const params: any[] = [];
  for (const k of keys) {
    setParts.push(`${k} = ?`);
    params.push(fields[k]);
  }
  setParts.push(`updated_at = NOW()`);
  params.push(row.id);
  await prepare(
    `UPDATE characters SET ${setParts.join(', ')} WHERE id = ?`,
  ).run(...params);
}

// ===================== 主流程 =====================

async function main() {
  console.log('🚀 Translate books/characters → EN  (' + (DRY_RUN ? 'DRY-RUN' : 'WRITE') + ')');
  console.log('='.repeat(60));

  const books = await prepare(
    `SELECT id, title, description, title_en, description_en FROM books`,
  ).all<BookRow>();
  const characters = await prepare(
    `SELECT id, name, description, speaking_style, background_story, prompt_template,
            name_en, description_en, speaking_style_en, background_story_en, prompt_template_en
       FROM characters`,
  ).all<CharacterRow>();

  const missingBooks = books.filter((b) =>
    BOOK_FIELDS.some((f) => isMissing(b[f.en]) && !isMissing(b[f.cn])),
  ).length;
  const missingChars = characters.filter((c) =>
    CHARACTER_FIELDS.some((f) => isMissing(c[f.en]) && !isMissing(c[f.cn])),
  ).length;

  console.log(`📚 books: 总 ${books.length},待翻译 ${missingBooks}`);
  console.log(`🎭 characters: 总 ${characters.length},待翻译 ${missingChars}`);
  console.log('');

  let okBooks = 0,
    skipBooks = 0,
    failBooks = 0;
  let okChars = 0,
    skipChars = 0,
    failChars = 0;

  // ---- books ----
  await runPool(books, 3, async (row, idx) => {
    const tag = `[book ${idx + 1}/${books.length}] 《${row.title}》`;
    try {
      const { translated, skip } = await processBook(row);
      const keys = Object.keys(translated);
      if (skip || keys.length === 0) {
        skipBooks++;
        console.log(`  ${tag} 跳过(无缺失字段或中文原文全空)`);
        return;
      }
      if (DRY_RUN) {
        okBooks++;
        const preview = keys
          .map((k) => `${k}=${JSON.stringify(translated[k]).slice(0, 80)}`)
          .join(' | ');
        console.log(`  ${tag} DRY: ${preview}`);
        return;
      }
      await writeBook(row, translated);
      okBooks++;
      console.log(`  ${tag} 已写入 ${keys.join(', ')}`);
    } catch (err: any) {
      failBooks++;
      console.error(`  ❌ ${tag} ${err?.message ?? err}`);
    }
  });

  // ---- characters ----
  await runPool(characters, 3, async (row, idx) => {
    const tag = `[character ${idx + 1}/${characters.length}] ${row.name}`;
    try {
      const { translated, skip } = await processCharacter(row);
      const keys = Object.keys(translated);
      if (skip || keys.length === 0) {
        skipChars++;
        console.log(`  ${tag} 跳过(无缺失字段或中文原文全空)`);
        return;
      }
      if (DRY_RUN) {
        okChars++;
        const preview = keys
          .map((k) => `${k}=${JSON.stringify(translated[k]).slice(0, 80)}`)
          .join(' | ');
        console.log(`  ${tag} DRY: ${preview}`);
        return;
      }
      await writeCharacter(row, translated);
      okChars++;
      console.log(`  ${tag} 已写入 ${keys.join(', ')}`);
    } catch (err: any) {
      failChars++;
      console.error(`  ❌ ${tag} ${err?.message ?? err}`);
    }
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('📊 汇总');
  console.log(`  Books:      成功 ${okBooks} | 跳过 ${skipBooks} | 失败 ${failBooks} (共 ${books.length})`);
  console.log(`  Characters: 成功 ${okChars} | 跳过 ${skipChars} | 失败 ${failChars} (共 ${characters.length})`);
  if (DRY_RUN) console.log('  (DRY-RUN 模式,本次未写库)');
}

(async () => {
  try {
    await main();
  } catch (err: any) {
    console.error('❌ 脚本执行失败:', err?.message ?? err);
    process.exit(1);
  } finally {
    try {
      await closeDb();
    } catch {
      /* ignore */
    }
  }
})();
