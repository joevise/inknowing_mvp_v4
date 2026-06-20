/**
 * AI客户端管理模块
 * 负责初始化和管理OpenAI SDK客户端
 */

import OpenAI from 'openai';
import { getAIConfig, validateConfig } from './config';

let client: OpenAI | null = null;
let currentConfig: Awaited<ReturnType<typeof getAIConfig>> | null = null;

/**
 * 获取或创建AI客户端
 */
export async function getAIClient(): Promise<OpenAI> {
  const config = await getAIConfig();

  // 如果配置改变了，重新创建客户端
  if (!client || !currentConfig ||
      currentConfig.apiKey !== config.apiKey ||
      currentConfig.baseUrl !== config.baseUrl) {

    console.log('[AI Client] 创建新的AI客户端实例');

    // 验证配置
    const validation = validateConfig(config);
    if (!validation.valid) {
      console.error('[AI Client] 配置验证失败:', validation.error);
      throw new Error(`AI配置无效: ${validation.error}`);
    }

    // 创建OpenAI客户端（兼容通义千问）
    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });

    currentConfig = config;
    console.log('[AI Client] 客户端创建成功', {
      provider: config.provider,
      baseUrl: config.baseUrl,
      chatModel: config.chatModel
    });
  }

  return client;
}

/**
 * 重置客户端（用于配置更新时）
 */
export function resetClient(): void {
  console.log('[AI Client] 重置客户端');
  client = null;
  currentConfig = null;
}

/**
 * 获取当前配置
 */
export async function getCurrentConfig() {
  return currentConfig || await getAIConfig();
}

/**
 * 带重试的执行函数
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI Client] 执行请求 (尝试 ${attempt}/${maxRetries})`);
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`[AI Client] 请求失败 (尝试 ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        const delay = retryDelay * attempt; // 逐步增加延迟
        console.log(`[AI Client] 等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('[AI Client] 所有重试都失败了');
  throw lastError || new Error('执行失败');
}

/**
 * 测试AI客户端连接
 */
export async function testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  console.log('[AI Client] 测试连接...');

  try {
    const client = await getAIClient();
    const config = await getCurrentConfig();

    // 发送一个简单的测试请求
    const response = await executeWithRetry(async () => {
      return await client.chat.completions.create({
        model: config.chatModel,
        messages: [
          { role: 'system', content: '你是一个友好的助手' },
          { role: 'user', content: '请回复"连接成功"' }
        ],
        max_tokens: 10,
        temperature: 0
      });
    }, 1); // 测试时只重试一次

    console.log('[AI Client] 连接测试成功');
    return {
      success: true,
      message: '连接成功',
      details: {
        provider: config.provider,
        model: config.chatModel,
        response: response.choices[0]?.message?.content
      }
    };
  } catch (error) {
    console.error('[AI Client] 连接测试失败:', error);
    return {
      success: false,
      message: '连接失败',
      details: error instanceof Error ? error.message : '未知错误'
    };
  }
}
