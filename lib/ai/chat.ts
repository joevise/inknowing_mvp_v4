/**
 * AI对话功能模块
 * 提供流式对话和普通对话能力
 */

import { getAIClient, getCurrentConfig, executeWithRetry } from './client';
import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
}

export interface ChatResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 普通对话（非流式）
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResult> {
  console.log('[Chat] 开始对话请求', {
    messageCount: messages.length,
    options
  });

  const client = await getAIClient();
  const config = await getCurrentConfig();

  try {
    const response = await executeWithRetry(async () => {
      return await client.chat.completions.create({
        model: config.chatModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP ?? 0.9,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stop: options.stop,
        stream: false
      });
    });

    const result: ChatResult = {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined
    };

    console.log('[Chat] 对话完成', {
      contentLength: result.content.length,
      usage: result.usage
    });

    return result;
  } catch (error) {
    console.error('[Chat] 对话失败:', error);
    throw new Error(`对话请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 流式对话（支持打字机效果）
 */
export async function* streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): AsyncGenerator<string, void, unknown> {
  console.log('[Chat] 开始流式对话', {
    messageCount: messages.length,
    options
  });

  const client = await getAIClient();
  const config = await getCurrentConfig();

  try {
    const stream = await executeWithRetry(async () => {
      return await client.chat.completions.create({
        model: config.chatModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP ?? 0.9,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stop: options.stop,
        stream: true
      });
    });

    let totalContent = '';
    let chunkCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        totalContent += content;
        chunkCount++;
        yield content;
      }
    }

    console.log('[Chat] 流式对话完成', {
      totalLength: totalContent.length,
      chunkCount
    });
  } catch (error) {
    console.error('[Chat] 流式对话失败:', error);
    throw new Error(`流式对话失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 创建对话流（用于API路由）
 */
export async function createChatStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ReadableStream> {
  console.log('[Chat] 创建对话流');

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const generator = streamChat(messages, options);

        for await (const chunk of generator) {
          // 发送SSE格式的数据
          const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
          controller.enqueue(encoder.encode(data));
        }

        // 发送结束标记
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('[Chat] 流处理错误:', error);
        const errorData = `data: ${JSON.stringify({
          error: error instanceof Error ? error.message : '未知错误'
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    }
  });
}

/**
 * 构建系统提示词
 */
export function buildSystemPrompt(context: {
  role?: string;
  knowledge?: string;
  constraints?: string[];
}): string {
  const parts = [];

  if (context.role) {
    parts.push(context.role);
  }

  if (context.knowledge) {
    parts.push(`背景知识：\n${context.knowledge}`);
  }

  if (context.constraints && context.constraints.length > 0) {
    parts.push(`约束条件：\n${context.constraints.map(c => `- ${c}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

/**
 * 格式化消息历史（限制长度）
 */
export function formatMessageHistory(
  messages: ChatMessage[],
  maxMessages: number = 20
): ChatMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  // 保留system消息和最新的消息
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  const recentMessages = otherMessages.slice(-maxMessages + systemMessages.length);

  console.log('[Chat] 消息历史被截断', {
    original: messages.length,
    kept: systemMessages.length + recentMessages.length
  });

  return [...systemMessages, ...recentMessages];
}

/**
 * 估算tokens数量（简单估算）
 */
export function estimateTokens(text: string): number {
  // 简单估算：中文约1.5个字符一个token，英文约4个字符一个token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishChars = text.length - chineseChars;

  return Math.ceil(chineseChars / 1.5 + englishChars / 4);
}

/**
 * 检查是否超过token限制
 */
export function checkTokenLimit(
  messages: ChatMessage[],
  maxTokens: number = 4000
): { withinLimit: boolean; estimatedTokens: number } {
  const totalText = messages.map(m => m.content).join(' ');
  const estimatedTokens = estimateTokens(totalText);

  console.log('[Chat] Token估算', {
    estimatedTokens,
    maxTokens,
    withinLimit: estimatedTokens <= maxTokens
  });

  return {
    withinLimit: estimatedTokens <= maxTokens,
    estimatedTokens
  };
}