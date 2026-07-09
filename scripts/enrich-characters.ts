#!/usr/bin/env tsx
/**
 * 批量回填 characters 表的 4 个新锚点字段:
 *   - key_quotes        (JSON 数组,5~8 条原著经典台词)
 *   - relationships     (JSON 数组,与其他角色的关系)
 *   - key_events        (JSON 数组,3~5 个关键情节锚点)
 *   - knowledge_boundary (TEXT,知识边界)
 *
 * 行为:
 *   - 按 book_id 分组,同一本书的角色一起送入一次 LLM 调用,便于生成关系网
 *   - 只回填"4 个字段全为 NULL"的角色(已有人工填写的跳过)
 *   - 串行(默认)+ 遇 429 指数退避,异常角色写入失败日志(临时文件)
 *   - 支持 --dry-run:不写库,只打印
 *   - 支持 --only-empty=false:也覆盖已有数据(谨慎)
 *
 * 用法:
 *   npx tsx scripts/enrich-characters.ts
 *   npx tsx scripts/enrich-characters.ts --dry-run
 *   npx tsx scripts/enrich-characters.ts --limit 10   # 只处理前 10 本书(测试)
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
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

// ===================== CLI 参数 =====================
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const ONLY_EMPTY = !argv.includes('--only-empty=false');
const LIMIT = (() => {
  const i = argv.indexOf('--limit');
  if (i >= 0 && argv[i + 1]) return parseInt(argv[i + 1], 10) || 0;
  return 0;
})();

// ===================== 配置 =====================
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_API_BASE =
  process.env.QWEN_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const QWEN_CHAT_MODEL = process.env.QWEN_ENRICH_MODEL || process.env.QWEN_CHAT_MODEL || 'qwen-max';
const CONCURRENCY = Math.max(1, parseInt(process.env.BATCH_CONCURRENCY || '1', 10));
const DELAY_MS = Math.max(0, parseInt(process.env.BATCH_DELAY_MS || '300', 10));

if (!QWEN_API_KEY) {
  console.error('❌ 缺少 QWEN_API_KEY(请确认项目根 .env 已配置)');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL 未加载,db client 将使用内置默认值');
}

const openai = new OpenAI({ apiKey: QWEN_API_KEY, baseURL: QWEN_API_BASE });

// ===================== 类型 =====================
type CharacterRow = {
  id: string;
  book_id: string;
  name: string;
  description: string | null;
  speaking_style: string | null;
  background_story: string | null;
  personality_traits: string | null; // JSON 字符串
  key_quotes: string | null;
  relationships: string | null;
  key_events: string | null;
  knowledge_boundary: string | null;
};

type BookRow = {
  id: string;
  title: string;
  author: string;
};

type EnrichPayload = {
  keyQuotes: string[];
  relationships: string[];
  keyEvents: string[];
  knowledgeBoundary: string;
};

const LOG_DIR = resolve(process.cwd(), 'tmp');
const FAIL_LOG = resolve(LOG_DIR, 'enrich-characters-fail.log');

// ===================== 工具 =====================
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isMissing(v: string | null | undefined): boolean {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

function parsePersonality(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(x => String(x));
    if (v && typeof v === 'object') return Object.values(v).map(x => String(x));
  } catch {
    /* fallthrough */
  }
  return [];
}

function logFailure(bookId: string, characterId: string, name: string, err: unknown) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
  const ts = new Date().toISOString();
  const msg = `[${ts}] book=${bookId} character=${characterId} name="${name}" :: ${(err as Error)?.message ?? err}\n`;
  try {
    appendFileSync(FAIL_LOG, msg);
  } catch {
    /* ignore */
  }
  console.error(`    ❌ ${name}: ${(err as Error)?.message ?? err}`);
}

// ===================== Prompt 构建 =====================
function buildSystemPrompt(): string {
  return [
    '你是一个严谨的图书角色研究专家。',
    '你的任务:根据一本书的信息和该书已有角色的简短档案,',
    '为每个角色补全 4 个结构化字段,用于后续 AI 角色扮演的"身份锁死"与"反幻觉"。',
    '',
    '严格要求:',
    '- 严格按用户给出的 JSON 结构输出,不要 markdown 包裹,不要多余字段。',
    '- keyQuotes 必须是该角色在书中的原话或高度还原的台词,3~8 条,优先选高辨识度的。',
    '- relationships 必须用"该角色 与 其他角色名 是/是...的关系"格式,2~5 条;',
    '  若一本书只有 1 个角色,relationships 返回空数组。',
    '- keyEvents 3~5 条关键情节,只写该角色亲历或直接相关的。',
    '- knowledgeBoundary 明确"知道什么 / 不知道什么",比如活到第几章 / 是否知道后续关键转折。',
    '- 所有内容用中文;若原书是中文则用中文,若是外文经典可保留关键术语。',
  ].join('');
}

function buildUserPrompt(book: BookRow, characters: CharacterRow[]): string {
  const lines: string[] = [];
  lines.push(`【书名】${book.title}`);
  lines.push(`【作者】${book.author}`);
  lines.push('');
  lines.push('【现有角色档案】');
  characters.forEach((c, i) => {
    const pers = parsePersonality(c.personality_traits).join('、');
    lines.push(`${i + 1}. ${c.name}`);
    if (c.description) lines.push(`   简介:${c.description}`);
    if (pers) lines.push(`   性格:${pers}`);
    if (c.speaking_style) lines.push(`   说话风格:${c.speaking_style}`);
    if (c.background_story) lines.push(`   背景:${c.background_story}`);
  });
  lines.push('');
  lines.push('【请输出 JSON】');
  lines.push('{');
  lines.push('  "characters": [');
  lines.push('    {');
  lines.push('      "name": "与输入角色名完全一致",');
  lines.push('      "keyQuotes": ["台词1", "台词2", "台词3"],');
  lines.push('      "relationships": ["X 与 Y 是...关系"],');
  lines.push('      "keyEvents": ["事件1", "事件2"],');
  lines.push('      "knowledgeBoundary": "该角色知道...不知道..."');
  lines.push('    }');
  lines.push('  ]');
  lines.push('}');
  lines.push('');
  lines.push('注意:name 必须与上面角色档案里的名字**完全一致**(不要改字、不要加括号)。');
  lines.push('输出数组顺序与输入顺序保持一致。');
  return lines.join('\n');
}

// ===================== LLM 调用 =====================
function extractJson(text: string): Record<string, unknown> {
  const trimmed = String(text ?? '').trim();
  // 1) 去 markdown 代码块
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  let body = fence ? fence[1].trim() : trimmed;
  // 2) 有些模型在 JSON 后面跟了额外文字(如 MiniMax),只取第一个完整 JSON object
  const start = body.indexOf('{');
  if (start < 0) throw new Error('No JSON object in model response');
  // 用栈计数找匹配的最后一个 '}'
  let depth = 0;
  let end = -1;
  for (let i = start; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) throw new Error('No complete JSON object in model response');
  return JSON.parse(body.slice(start, end + 1));
}

async function callModel(systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
  const resp = await openai.chat.completions.create({
    model: QWEN_CHAT_MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  const content = resp.choices?.[0]?.message?.content ?? '';
  return extractJson(content);
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

// ===================== 数据归一化 =====================
function normalizeArr(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .map(x => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
      .filter(s => s.length > 0);
  }
  if (typeof v === 'string' && v.trim()) {
    return v.split(/[\n\r;；。]+/).map(s => s.trim()).filter(s => s.length > 0);
  }
  return [];
}

function normalizeBoundary(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  return '';
}

/**
 * 按 name 把 LLM 返回的结果对位到输入角色。
 * 容忍 LLM 改了字 / 加了别名的情况(用包含关系兜底),找不到则标 null 让上层按失败处理。
 */
function mapByName(
  inputs: CharacterRow[],
  rawList: unknown
): Map<string, EnrichPayload> {
  const map = new Map<string, EnrichPayload>();
  if (!Array.isArray(rawList)) return map;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!name) continue;

    // 严格匹配 → 模糊包含匹配
    let target = inputs.find(c => c.name.trim() === name);
    if (!target) {
      target = inputs.find(c => c.name.trim().includes(name) || name.includes(c.name.trim()));
    }
    if (!target) continue;

    map.set(target.id, {
      keyQuotes: normalizeArr(obj.keyQuotes).slice(0, 8),
      relationships: normalizeArr(obj.relationships).slice(0, 8),
      keyEvents: normalizeArr(obj.keyEvents).slice(0, 5),
      knowledgeBoundary: normalizeBoundary(obj.knowledgeBoundary).slice(0, 600),
    });
  }
  return map;
}

// ===================== 写库 =====================
async function writeCharacter(id: string, payload: EnrichPayload): Promise<void> {
  const stmt = prepare(`
    UPDATE characters
       SET key_quotes = ?,
           relationships = ?,
           key_events = ?,
           knowledge_boundary = ?,
           updated_at = NOW()
     WHERE id = ?
  `);
  await stmt.run(
    JSON.stringify(payload.keyQuotes),
    JSON.stringify(payload.relationships),
    JSON.stringify(payload.keyEvents),
    payload.knowledgeBoundary || null,
    id
  );
}

// ===================== 单本书处理 =====================
async function processBook(book: BookRow, characters: CharacterRow[]): Promise<{ ok: number; fail: number }> {
  const targetChars = ONLY_EMPTY
    ? characters.filter(c =>
        isMissing(c.key_quotes) &&
        isMissing(c.relationships) &&
        isMissing(c.key_events) &&
        isMissing(c.knowledge_boundary)
      )
    : characters;

  if (targetChars.length === 0) {
    return { ok: 0, fail: 0 };
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(book, targetChars);

  const parsed = await callWithRetry(
    () => callModel(systemPrompt, userPrompt),
    `[book《${book.title}》/${targetChars.length} chars]`
  );

  const list = (parsed && (parsed as any).characters) ?? parsed;
  const map = mapByName(targetChars, list);

  let ok = 0;
  let fail = 0;
  for (const c of targetChars) {
    const payload = map.get(c.id);
    if (!payload) {
      logFailure(book.id, c.id, c.name, 'LLM 未返回该角色的字段');
      fail++;
      continue;
    }
    if (
      payload.keyQuotes.length === 0 &&
      payload.relationships.length === 0 &&
      payload.keyEvents.length === 0 &&
      !payload.knowledgeBoundary
    ) {
      logFailure(book.id, c.id, c.name, 'LLM 返回的 4 个字段全为空');
      fail++;
      continue;
    }
    try {
      if (!DRY_RUN) {
        await writeCharacter(c.id, payload);
      }
      ok++;
      const preview = [
        `quotes=${payload.keyQuotes.length}`,
        `rel=${payload.relationships.length}`,
        `events=${payload.keyEvents.length}`,
        `boundary=${payload.knowledgeBoundary ? 'yes' : 'no'}`,
      ].join(' ');
      console.log(`    ✅ ${c.name}: ${preview}`);
    } catch (err) {
      logFailure(book.id, c.id, c.name, err);
      fail++;
    }
  }
  return { ok, fail };
}

// ===================== 简易并发池 =====================
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const total = items.length;
  const lanes = Array.from({ length: Math.min(limit, Math.max(total, 1)) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
      if (idx < items.length - 1) await sleep(DELAY_MS);
    }
  });
  if (total === 0) return;
  await Promise.all(lanes);
}

// ===================== 主流程 =====================
async function main() {
  console.log('🚀 Enrich characters (key_quotes / relationships / key_events / knowledge_boundary)');
  console.log(`   mode = ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}  onlyEmpty=${ONLY_EMPTY}  model=${QWEN_CHAT_MODEL}  concurrency=${CONCURRENCY}`);
  console.log('='.repeat(70));

  // 1) 拉所有书
  const books = (await prepare(`SELECT id, title, author FROM books`).all<BookRow>()) || [];
  // 2) 拉所有角色
  const characters = (await prepare(
    `SELECT id, book_id, name, description, speaking_style, background_story,
            personality_traits, key_quotes, relationships, key_events, knowledge_boundary
       FROM characters`
  ).all<CharacterRow>()) || [];

  const byBook = new Map<string, CharacterRow[]>();
  for (const c of characters) {
    const arr = byBook.get(c.book_id) || [];
    arr.push(c);
    byBook.set(c.book_id, arr);
  }

  // 3) 按书分组,过滤掉"完全没有角色"的书
  const targets = books.filter(b => (byBook.get(b.id)?.length ?? 0) > 0);
  const sliced = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;
  console.log(`📚 总书数 ${books.length},有角色的书 ${targets.length},本次处理 ${sliced.length}`);
  console.log(`🎭 总角色数 ${characters.length}`);

  let totalOk = 0;
  let totalFail = 0;
  let processedBooks = 0;

  await runPool(sliced, CONCURRENCY, async (book, idx) => {
    const tag = `[book ${idx + 1}/${sliced.length}] 《${book.title}》(作者:${book.author})`;
    try {
      const chars = byBook.get(book.id) || [];
      console.log(`${tag}  角色数 ${chars.length}`);
      const r = await processBook(book, chars);
      totalOk += r.ok;
      totalFail += r.fail;
      processedBooks++;
      console.log(`${tag}  ✅${r.ok}  ❌${r.fail}`);
    } catch (err: any) {
      totalFail += byBook.get(book.id)?.length ?? 0;
      console.error(`${tag}  ❌ 整本书失败: ${err?.message ?? err}`);
      logFailure(book.id, '', '<book-level>', err);
    }
  });

  console.log('');
  console.log('='.repeat(70));
  console.log('📊 汇总');
  console.log(`  处理书籍: ${processedBooks}/${sliced.length}`);
  console.log(`  角色成功: ${totalOk}`);
  console.log(`  角色失败: ${totalFail}`);
  if (DRY_RUN) console.log('  (DRY-RUN 模式,本次未写库)');
  if (totalFail > 0) console.log(`  失败明细见: ${FAIL_LOG}`);
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