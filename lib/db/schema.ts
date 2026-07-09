/**
 * 数据库Schema定义
 * 严格按照 inknowing-api-spec.yaml 定义的数据模型
 */

// TypeScript类型定义
export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  category: string;
  tags: string[]; // 存储为JSON
  ai_knowledge_level: number; // 1-10
  requires_document: boolean;
  conversation_strategy: 'ai_native' | 'rag_only' | 'hybrid';
  status: 'published' | 'draft';
  // 语言原生度:zh_native 仅中文/multilingual 中英双语/en_native 仅英文
  // DB 层 NOT NULL DEFAULT 'zh_native' 保证总有值,此处可选仅为兼容旧代码字面量构造。
  language_mode?: 'zh_native' | 'multilingual' | 'en_native';
  title_en?: string;
  description_en?: string;
  author_en?: string;
  tags_en?: string[]; // 存储为JSON
  created_at: Date;
  updated_at: Date;
}

export interface Character {
  id: string;
  book_id: string;
  name: string;
  description: string;
  personality_traits: Record<string, any>; // 存储为JSON
  speaking_style: string;
  background_story: string;
  prompt_template: string;
  name_en?: string;
  description_en?: string;
  speaking_style_en?: string;
  background_story_en?: string;
  prompt_template_en?: string;
  // 角色沉浸质量提升(2026-07):从 prompt 中拆出来的结构化锚点
  // 4 个新列均为 JSON 字符串或明文,允许为空(未回填前正常对话)
  key_quotes?: string | null; // JSON 数组,5~8 条原著经典台词
  relationships?: string | null; // JSON 数组,与其他角色的关系描述
  key_events?: string | null; // JSON 数组,3~5 个关键情节锚点
  knowledge_boundary?: string | null; // 角色知识边界(活到哪章、知道什么不知道什么)
  created_at: Date;
  updated_at: Date;
}

export interface Document {
  id: string;
  book_id: string;
  type: 'main' | 'supplement';
  title: string;
  file_path: string;
  file_size: number;
  vectorized: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  user_id: string;
  book_id: string;
  character_id: string | null;
  type: 'book' | 'character';
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, any>; // 存储为JSON，包含RAG来源等
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  session_token: string;
  expires_at: Date;
  created_at: Date;
}

export interface Config {
  key: string;
  value: string;
  updated_at: Date;
}

export interface Favorite {
  id: string;
  user_id: string;
  book_id: string;
  created_at: Date;
}

export interface UserBookRequest {
  id: string;
  user_id: string;
  title: string;
  author?: string;
  status: 'pending' | 'processing' | 'created' | 'wishlist' | 'rejected' | 'failed';
  book_id?: string;
  ai_confidence?: number;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 角色召唤日志
 * 记录用户每次"召唤书中角色"的请求,用于每日配额统计与审计。
 * quota 计数按 user_id + created_at 当天 UTC 范围。
 */
export interface CharacterSummonLog {
  id: string;
  user_id: string;
  book_id: string;
  /** main_cast:批量召唤主要角色; named:指定单个角色名 */
  mode: 'main_cast' | 'named';
  /** named 模式下用户输入/AI 返回的角色名;main_cast 模式下可空 */
  character_name: string | null;
  /** 整体结果状态:success 真正生成/返回了角色;failed AI 失败等;existed 仅命中去重返回已有角色 */
  status: 'success' | 'failed' | 'existed';
  created_at: Date;
}

/**
 * 用户跨会话全局记忆
 * 跨书籍/角色共享:仅以 user_id 隔离,不绑定 conversation。
 * memory_type 区分事实/偏好/画像等,便于分层注入与管理。
 */
export interface UserMemory {
  id: string;
  user_id: string;
  memory_type: 'fact' | 'preference' | 'profile' | 'interest' | 'event';
  content: string;
  // 来源:哪次对话/哪本书沉淀出来的(可空,用于审计与回溯)
  source_conversation_id: string | null;
  source_book_id: string | null;
  // 重要度 0-1,用于检索排序与容量淘汰
  importance: number;
  // 命中/复用次数,辅助淘汰策略
  access_count: number;
  last_accessed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// 创建表的SQL语句
export const createTablesSQL = `
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 创建email索引
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  -- 书籍表
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    category TEXT,
    tags TEXT, -- JSON字符串
    ai_knowledge_level INTEGER CHECK (ai_knowledge_level >= 1 AND ai_knowledge_level <= 10),
    requires_document BOOLEAN DEFAULT 0,
    conversation_strategy TEXT CHECK (conversation_strategy IN ('ai_native', 'rag_only', 'hybrid')),
    status TEXT CHECK (status IN ('published', 'draft')) DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 创建status索引
  CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
  CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);

  -- 角色表
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    personality_traits TEXT, -- JSON字符串
    speaking_style TEXT,
    background_story TEXT,
    prompt_template TEXT,
    key_quotes TEXT,           -- JSON 数组,原著经典台词
    relationships TEXT,        -- JSON 数组,与其他角色的关系
    key_events TEXT,           -- JSON 数组,关键情节锚点
    knowledge_boundary TEXT,   -- 角色知识边界
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );

  -- 创建book_id索引
  CREATE INDEX IF NOT EXISTS idx_characters_book_id ON characters(book_id);

  -- 文档表
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    type TEXT CHECK (type IN ('main', 'supplement')) NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    vectorized BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );

  -- 创建book_id和type索引
  CREATE INDEX IF NOT EXISTS idx_documents_book_id ON documents(book_id);
  CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

  -- 对话表
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    character_id TEXT,
    type TEXT CHECK (type IN ('book', 'character')) NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
  );

  -- 创建用户和书籍索引
  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_book_id ON conversations(book_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_character_id ON conversations(character_id);

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT, -- JSON字符串
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  -- 创建conversation_id索引
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

  -- Session表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 创建session_token索引
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

  -- 配置表 (runtime configuration)
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 收藏表
  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE(user_id, book_id)
  );

  -- 创建索引
  CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_book_id ON favorites(book_id);

  -- 用户书籍申请表
  CREATE TABLE IF NOT EXISTS user_book_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    status TEXT CHECK (status IN ('pending', 'processing', 'created', 'wishlist', 'rejected', 'failed')) DEFAULT 'pending',
    book_id TEXT,
    ai_confidence REAL,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
  );

  -- 创建索引
  CREATE INDEX IF NOT EXISTS idx_user_book_requests_user_id ON user_book_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_book_requests_status ON user_book_requests(status);
  CREATE INDEX IF NOT EXISTS idx_user_book_requests_book_id ON user_book_requests(book_id);
`;

// 添加触发器更新updated_at字段
export const createTriggersSQL = `
  -- 用户表更新触发器
  CREATE TRIGGER IF NOT EXISTS update_users_timestamp
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  -- 书籍表更新触发器
  CREATE TRIGGER IF NOT EXISTS update_books_timestamp
  AFTER UPDATE ON books
  FOR EACH ROW
  BEGIN
    UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  -- 角色表更新触发器
  CREATE TRIGGER IF NOT EXISTS update_characters_timestamp
  AFTER UPDATE ON characters
  FOR EACH ROW
  BEGIN
    UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  -- 文档表更新触发器
  CREATE TRIGGER IF NOT EXISTS update_documents_timestamp
  AFTER UPDATE ON documents
  FOR EACH ROW
  BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  -- 对话表更新触发器
  CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp
  AFTER UPDATE ON conversations
  FOR EACH ROW
  BEGIN
    UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  -- 配置表更新触发器
  CREATE TRIGGER IF NOT EXISTS update_config_timestamp
  AFTER UPDATE ON config
  FOR EACH ROW
  BEGIN
    UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
  END;

  -- 用户书籍申请表更新触发器
  CREATE TRIGGER IF NOT EXISTS update_user_book_requests_timestamp
  AFTER UPDATE ON user_book_requests
  FOR EACH ROW
  BEGIN
    UPDATE user_book_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`;

/**
 * ============================================================
 * PostgreSQL 方言 Schema(迁移目标)
 * ------------------------------------------------------------
 * - TEXT 主键(应用层 UUID)保持不变
 * - SQLite BOOLEAN 0/1 -> PG BOOLEAN false/true
 * - DATETIME -> TIMESTAMPTZ DEFAULT NOW()
 * - CHECK 约束保留
 * - updated_at 自动更新:统一 trigger function + 每表 trigger
 * - 面向 10万级:关键外键/查询列建索引
 * - 幂等:全部 IF NOT EXISTS
 * ============================================================
 */
export const PG_SCHEMA_SQL = `
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  -- 书籍表
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    category TEXT,
    tags TEXT,
    ai_knowledge_level INTEGER CHECK (ai_knowledge_level >= 1 AND ai_knowledge_level <= 10),
    requires_document BOOLEAN DEFAULT FALSE,
    conversation_strategy TEXT CHECK (conversation_strategy IN ('ai_native', 'rag_only', 'hybrid')),
    status TEXT CHECK (status IN ('published', 'draft')) DEFAULT 'draft',
    language_mode TEXT NOT NULL DEFAULT 'zh_native' CHECK (language_mode IN ('zh_native','multilingual','en_native')),
    title_en TEXT,
    description_en TEXT,
    author_en TEXT,
    tags_en TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
  CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);

  -- 角色表
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    personality_traits TEXT,
    speaking_style TEXT,
    background_story TEXT,
    prompt_template TEXT,
    name_en TEXT,
    description_en TEXT,
    speaking_style_en TEXT,
    background_story_en TEXT,
    prompt_template_en TEXT,
    key_quotes TEXT,           -- JSON 数组,原著经典台词
    relationships TEXT,        -- JSON 数组,与其他角色的关系
    key_events TEXT,           -- JSON 数组,关键情节锚点
    knowledge_boundary TEXT,   -- 角色知识边界
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_characters_book_id ON characters(book_id);

  -- 文档表
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('main', 'supplement')) NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    vectorized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_documents_book_id ON documents(book_id);
  CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

  -- 对话表
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('book', 'character')) NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_book_id ON conversations(book_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_character_id ON conversations(character_id);

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

  -- Session 表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

  -- 配置表
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 收藏表
  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id)
  );
  CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_book_id ON favorites(book_id);

  -- 用户书籍申请表
  CREATE TABLE IF NOT EXISTS user_book_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT,
    status TEXT CHECK (status IN ('pending', 'processing', 'created', 'wishlist', 'rejected', 'failed')) DEFAULT 'pending',
    book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
    ai_confidence REAL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_user_book_requests_user_id ON user_book_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_book_requests_status ON user_book_requests(status);
  CREATE INDEX IF NOT EXISTS idx_user_book_requests_book_id ON user_book_requests(book_id);

  -- 角色召唤日志表(每日配额统计 + 审计)
  CREATE TABLE IF NOT EXISTS character_summon_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    mode TEXT CHECK (mode IN ('main_cast', 'named')) NOT NULL,
    character_name TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'existed')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  -- 配额主索引:按用户 + 当天范围聚合计数
  CREATE INDEX IF NOT EXISTS idx_character_summon_logs_user_created
    ON character_summon_logs(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_character_summon_logs_book_id
    ON character_summon_logs(book_id);

  -- 用户跨会话全局记忆表(新增核心特性)
  CREATE TABLE IF NOT EXISTS user_memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'profile', 'interest', 'event')),
    content TEXT NOT NULL,
    source_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
    source_book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
    importance REAL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  -- 检索主路径:按用户取记忆,按重要度/时间排序
  CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_memories_user_importance ON user_memories(user_id, importance DESC, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(user_id, memory_type);

  -- 多语言字段(幂等补列,兼容已存在的库)
  ALTER TABLE books ADD COLUMN IF NOT EXISTS language_mode TEXT NOT NULL DEFAULT 'zh_native';
  ALTER TABLE books ADD COLUMN IF NOT EXISTS title_en TEXT;
  ALTER TABLE books ADD COLUMN IF NOT EXISTS description_en TEXT;
  ALTER TABLE books ADD COLUMN IF NOT EXISTS author_en TEXT;
  ALTER TABLE books ADD COLUMN IF NOT EXISTS tags_en TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS name_en TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS description_en TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS speaking_style_en TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS background_story_en TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS prompt_template_en TEXT;
  -- 角色沉浸质量提升(2026-07):4 个新列(允许为空,已存在则跳过)
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS key_quotes TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS relationships TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS key_events TEXT;
  ALTER TABLE characters ADD COLUMN IF NOT EXISTS knowledge_boundary TEXT;

  -- 统一的 updated_at 自动更新触发器函数
  CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

// 为各表挂 updated_at 触发器(单独执行,避免 CREATE TRIGGER IF NOT EXISTS 兼容性问题)
export const PG_TRIGGERS_SQL = `
  DO $$
  DECLARE t TEXT;
  BEGIN
    FOREACH t IN ARRAY ARRAY['users','books','characters','documents','conversations','config','user_book_requests','user_memories']
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I', t);
      EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
    END LOOP;
  END $$;
`;

// 删除所有表的SQL（用于重置数据库）
export const dropTablesSQL = `
  DROP TABLE IF EXISTS messages;
  DROP TABLE IF EXISTS sessions;
  DROP TABLE IF EXISTS conversations;
  DROP TABLE IF EXISTS favorites;
  DROP TABLE IF EXISTS documents;
  DROP TABLE IF EXISTS characters;
  DROP TABLE IF EXISTS character_summon_logs;
  DROP TABLE IF EXISTS books;
  DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS config;
  DROP TABLE IF EXISTS user_book_requests;
`;