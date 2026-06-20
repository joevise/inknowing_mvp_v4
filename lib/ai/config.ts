/**
 * AI配置管理模块
 * 负责读取运行时配置，管理AI服务配置
 */

import { getConfig } from '@/lib/services/runtime-config';

export interface AIConfig {
  provider: 'qwen' | 'openai';
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  timeout: number;
  maxRetries: number;
}

/**
 * 获取AI配置（从运行时配置或环境变量）
 */
export async function getAIConfig(): Promise<AIConfig> {
  console.log('[AI Config] 初始化AI配置...');

  // 从运行时配置读取，如果未设置则使用环境变量
  const qwenApiKey = (await getConfig('QWEN_API_KEY')) || process.env.QWEN_API_KEY;
  const openaiApiKey = (await getConfig('OPENAI_API_KEY')) || process.env.OPENAI_API_KEY;

  if (qwenApiKey && qwenApiKey !== 'sk-your_actual_key_here') {
    console.log('[AI Config] 使用通义千问API (runtime config)');
    return {
      provider: 'qwen',
      apiKey: qwenApiKey,
      baseUrl: (await getConfig('QWEN_BASE_URL')) || process.env.QWEN_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      chatModel: (await getConfig('QWEN_MODEL')) || process.env.QWEN_CHAT_MODEL || 'qwen-max',
      embeddingModel: (await getConfig('QWEN_EMBEDDING_MODEL')) || process.env.QWEN_EMBEDDING_MODEL || 'text-embedding-v3',
      timeout: 30000, // 30秒超时
      maxRetries: 3
    };
  } else if (openaiApiKey) {
    console.log('[AI Config] 使用OpenAI API (runtime config)');
    return {
      provider: 'openai',
      apiKey: openaiApiKey,
      baseUrl: (await getConfig('OPENAI_BASE_URL')) || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      chatModel: (await getConfig('OPENAI_MODEL')) || process.env.AI_CHAT_MODEL || 'gpt-3.5-turbo',
      embeddingModel: (await getConfig('OPENAI_EMBEDDING_MODEL')) || process.env.AI_EMBEDDING_MODEL || 'text-embedding-ada-002',
      timeout: 30000,
      maxRetries: 3
    };
  }

  // 如果都没有配置，返回通义千问的默认配置（用于测试）
  console.warn('[AI Config] 未找到有效的API密钥，使用默认配置（需要设置API密钥）');
  return {
    provider: 'qwen',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    chatModel: 'qwen-max',
    embeddingModel: 'text-embedding-v3',
    timeout: 30000,
    maxRetries: 3
  };
}

/**
 * 验证API配置是否有效
 */
export function validateConfig(config: AIConfig): { valid: boolean; error?: string } {
  console.log('[AI Config] 验证配置...');

  if (!config.apiKey) {
    return { valid: false, error: '未配置API密钥' };
  }

  if (config.apiKey === 'sk-your_actual_key_here') {
    return { valid: false, error: '请设置有效的API密钥' };
  }

  if (!config.baseUrl) {
    return { valid: false, error: '未配置API基础URL' };
  }

  console.log('[AI Config] 配置验证通过');
  return { valid: true };
}

/**
 * 获取模型列表
 */
export function getAvailableModels(provider: 'qwen' | 'openai') {
  if (provider === 'qwen') {
    return {
      chat: [
        'qwen-max',
        'qwen-plus',
        'qwen-turbo',
        'qwen-7b-chat',
        'qwen-14b-chat'
      ],
      embedding: [
        'text-embedding-v3',
        'text-embedding-v2',
        'text-embedding-v1'
      ]
    };
  } else {
    return {
      chat: [
        'gpt-4-turbo-preview',
        'gpt-4',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k'
      ],
      embedding: [
        'text-embedding-3-small',
        'text-embedding-3-large',
        'text-embedding-ada-002'
      ]
    };
  }
}
