/**
 * 书籍分类常量定义
 */

// 预设的书籍分类
export const BOOK_CATEGORIES = [
  '文学',
  '商业',
  '科学',
  '心理',
  '哲学',
  '历史',
  '艺术',
  '技术',
  '教育',
  '生活'
] as const;

export type BookCategory = typeof BOOK_CATEGORIES[number];

// 预设的标签
export const PRESET_TAGS = [
  '#必读',
  '#经典',
  '#思维提升',
  '#畅销书',
  '#新书推荐',
  '#深度阅读',
  '#轻松阅读',
  '#专业书籍',
  '#个人成长',
  '#实用指南',
  '#获奖作品',
  '#名著',
  '#原创',
  '#翻译作品',
  '#有声书'
] as const;

// 对话策略类型
export const CONVERSATION_STRATEGIES = {
  AI_NATIVE: 'ai_native',     // 纯AI原生知识
  RAG_ONLY: 'rag_only',       // 纯RAG检索
  HYBRID: 'hybrid'            // 混合模式
} as const;

export type ConversationStrategy = typeof CONVERSATION_STRATEGIES[keyof typeof CONVERSATION_STRATEGIES];

// 书籍状态
export const BOOK_STATUS = {
  ONLINE: 'online',   // 已上架
  OFFLINE: 'offline'  // 已下架
} as const;

export type BookStatus = typeof BOOK_STATUS[keyof typeof BOOK_STATUS];

// AI了解程度等级
export const AI_KNOWLEDGE_LEVELS = {
  HIGH: { min: 8, max: 10, label: 'AI原生', requireDoc: false },
  MEDIUM: { min: 5, max: 7, label: '建议补充', requireDoc: true },
  LOW: { min: 1, max: 4, label: '需要文档', requireDoc: true }
} as const;

// 获取AI了解程度等级
export function getAIKnowledgeLevel(score: number) {
  if (score >= AI_KNOWLEDGE_LEVELS.HIGH.min) {
    return AI_KNOWLEDGE_LEVELS.HIGH;
  } else if (score >= AI_KNOWLEDGE_LEVELS.MEDIUM.min) {
    return AI_KNOWLEDGE_LEVELS.MEDIUM;
  } else {
    return AI_KNOWLEDGE_LEVELS.LOW;
  }
}