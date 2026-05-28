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

// 删除所有表的SQL（用于重置数据库）
export const dropTablesSQL = `
  DROP TABLE IF EXISTS messages;
  DROP TABLE IF EXISTS sessions;
  DROP TABLE IF EXISTS conversations;
  DROP TABLE IF EXISTS favorites;
  DROP TABLE IF EXISTS documents;
  DROP TABLE IF EXISTS characters;
  DROP TABLE IF EXISTS books;
  DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS config;
  DROP TABLE IF EXISTS user_book_requests;
`;