/**
 * Migration Script: Seed DB config from current .env values
 * Run with: node scripts/migrate-config-to-db.js
 * 
 * Seeds prefix-based config keys (CONVERSATION_*, PARSING_*, EMBEDDING_*) from
 * existing environment variables only if the key doesn't already exist in DB.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'inknowing.db');

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.error('[Migration] Failed to open DB at', dbPath, err.message);
  process.exit(1);
}

function getIfExists(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setIfNotExists(key, value) {
  if (!value) return false;
  const existing = getIfExists(key);
  if (existing !== null) {
    console.log(`[Migration] SKIP ${key} (already set)`);
    return false;
  }
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
  console.log(`[Migration] SET ${key}`);
  return true;
}

const updates = [];

// Conversation config
if (process.env.CHAT_API_KEY) {
  updates.push(['CONVERSATION_OPENROUTER_API_KEY', process.env.CHAT_API_KEY]);
}
if (process.env.CHAT_API_BASE) {
  updates.push(['CONVERSATION_OPENROUTER_BASE_URL', process.env.CHAT_API_BASE]);
} else {
  updates.push(['CONVERSATION_OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1']);
}
if (process.env.CHAT_MODEL) {
  updates.push(['CONVERSATION_OPENROUTER_MODEL', process.env.CHAT_MODEL]);
} else {
  updates.push(['CONVERSATION_OPENROUTER_MODEL', 'deepseek/deepseek-v4-flash']);
}
updates.push(['CONVERSATION_PROVIDER', 'openrouter']);
updates.push(['CONVERSATION_TEMPERATURE', '0.7']);
updates.push(['CONVERSATION_MAX_TOKENS', '2000']);

// Parsing config
if (process.env.CHAT_API_KEY) {
  updates.push(['PARSING_OPENROUTER_API_KEY', process.env.CHAT_API_KEY]);
}
if (process.env.CHAT_API_BASE) {
  updates.push(['PARSING_OPENROUTER_BASE_URL', process.env.CHAT_API_BASE]);
} else {
  updates.push(['PARSING_OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1']);
}
if (process.env.CHAT_MODEL) {
  updates.push(['PARSING_OPENROUTER_MODEL', process.env.CHAT_MODEL]);
} else {
  updates.push(['PARSING_OPENROUTER_MODEL', 'deepseek/deepseek-v4-flash']);
}
updates.push(['PARSING_PROVIDER', 'openrouter']);
updates.push(['PARSING_TEMPERATURE', '0.3']);
updates.push(['PARSING_MAX_TOKENS', '4000']);

// Embedding config
if (process.env.QWEN_API_KEY) {
  updates.push(['EMBEDDING_QWEN_API_KEY', process.env.QWEN_API_KEY]);
}
if (process.env.QWEN_API_BASE) {
  updates.push(['EMBEDDING_QWEN_BASE_URL', process.env.QWEN_API_BASE]);
} else {
  updates.push(['EMBEDDING_QWEN_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1']);
}
if (process.env.QWEN_EMBEDDING_MODEL) {
  updates.push(['EMBEDDING_QWEN_MODEL', process.env.QWEN_EMBEDDING_MODEL]);
} else {
  updates.push(['EMBEDDING_QWEN_MODEL', 'text-embedding-v4']);
}
updates.push(['EMBEDDING_PROVIDER', 'aliyun']);

console.log('[Migration] Starting config migration...');
let applied = 0;
for (const [key, value] of updates) {
  if (setIfNotExists(key, value)) applied++;
}
console.log(`[Migration] Done. Applied ${applied} new keys.`);

db.close();