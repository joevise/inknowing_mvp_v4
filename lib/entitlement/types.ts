/**
 * 权限模块类型定义
 */

export type FeatureKey =
  | 'daily_message_limit'    // 每日消息上限（数字，-1=无限）
  | 'max_active_characters'  // 同时对话角色上限（数字，-1=无限）
  | 'premium_books'          // 精品书单（boolean）
  | 'custom_characters'      // 自定义角色（boolean）
  | 'multi_language'         // 多语言（boolean）
  | 'advanced_models';       // 高级模型（boolean）

export interface PlanFeatures {
  daily_message_limit: number;
  max_active_characters: number;
  premium_books: boolean;
  custom_characters: boolean;
  multi_language: boolean;
  advanced_models: boolean;
  [key: string]: number | boolean | string;
}

export interface CheckResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
}
