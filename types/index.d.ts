// 用户相关类型
export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

// 书籍相关类型
export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_image?: string;
  category: string;
  tags: string[];
  ai_understanding_level: number; // 1-10
  document_required: boolean;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

// 角色相关类型
export interface Character {
  id: string;
  book_id: string;
  name: string;
  description: string;
  personality_traits: string[];
  speaking_style: string;
  background_story?: string;
  prompt_template?: string;
  created_at: string;
  updated_at: string;
}

// 对话相关类型
export interface Conversation {
  id: string;
  user_id: string;
  book_id: string;
  character_id?: string;
  title?: string;
  mode: 'book' | 'character';
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

// 消息相关类型
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  routing_strategy?: 'ai_native' | 'rag' | 'hybrid';
  sources?: string[];
  created_at: string;
}

// 文档相关类型
export interface Document {
  id: string;
  book_id: string;
  type: 'main' | 'supplementary';
  filename: string;
  file_path: string;
  content?: string;
  chunk_count?: number;
  vector_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

// Session相关类型
export interface SessionData {
  userId?: string;
  email?: string;
  isAdmin?: boolean;
  createdAt?: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 搜索相关类型
export interface SearchResult {
  type: 'book' | 'character' | 'topic';
  id: string;
  title: string;
  description: string;
  relevance_score: number;
}

// RAG检索类型
export interface RAGResult {
  chunk_id: string;
  content: string;
  relevance_score: number;
  metadata?: Record<string, any>;
}