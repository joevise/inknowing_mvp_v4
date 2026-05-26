/**
 * Model Resolver
 * Unified accessor for conversation/parsing/embedding model configuration
 * Reads from runtime-config with prefix-based keys (CONVERSATION_*, PARSING_*, EMBEDDING_*)
 * Falls back to process.env for backward compatibility
 */

import OpenAI from 'openai';
import { getConfig } from '@/lib/services/runtime-config';

export interface ResolvedChatModel {
  client: OpenAI;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ResolvedEmbeddingConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function resolveProviderConfig(prefix: string, provider: string | undefined): {
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  if (provider === 'openrouter') {
    const apiKey = getConfig(`${prefix}_OPENROUTER_API_KEY`) || process.env.CHAT_API_KEY || '';
    const baseUrl = getConfig(`${prefix}_OPENROUTER_BASE_URL`) || 'https://openrouter.ai/api/v1';
    const model = getConfig(`${prefix}_OPENROUTER_MODEL`) || 'deepseek/deepseek-v4-flash';
    return { apiKey, baseUrl, model };
  }
  if (provider === 'openai') {
    const apiKey = getConfig(`${prefix}_OPENAI_API_KEY`) || process.env.OPENAI_API_KEY || '';
    const baseUrl = getConfig(`${prefix}_OPENAI_BASE_URL`) || process.env.OPENAI_BASE_URL || '';
    const model = getConfig(`${prefix}_OPENAI_MODEL`) || process.env.OPENAI_MODEL || 'gpt-4';
    return { apiKey, baseUrl, model };
  }
  const apiKey = getConfig(`${prefix}_QWEN_API_KEY`) || process.env.QWEN_API_KEY || '';
  const baseUrl = getConfig(`${prefix}_QWEN_BASE_URL`) || process.env.QWEN_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = getConfig(`${prefix}_QWEN_MODEL`) || process.env.QWEN_MODEL || 'qwen-max';
  return { apiKey, baseUrl, model };
}

export function resolveConversationModel(): ResolvedChatModel {
  const provider = getConfig('CONVERSATION_PROVIDER') || process.env.AI_PROVIDER || 'aliyun';
  const { apiKey, baseUrl, model } = resolveProviderConfig('CONVERSATION', provider);
  const temperature = parseFloat(getConfig('CONVERSATION_TEMPERATURE') || '0.7');
  const maxTokens = parseInt(getConfig('CONVERSATION_MAX_TOKENS') || '2000');

  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  return { client, model, temperature, maxTokens };
}

export function resolveParsingModel(): ResolvedChatModel {
  const provider = getConfig('PARSING_PROVIDER') || process.env.AI_PROVIDER || 'aliyun';
  const { apiKey, baseUrl, model } = resolveProviderConfig('PARSING', provider);
  const temperature = parseFloat(getConfig('PARSING_TEMPERATURE') || '0.3');
  const maxTokens = parseInt(getConfig('PARSING_MAX_TOKENS') || '4000');

  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  return { client, model, temperature, maxTokens };
}

export function resolveEmbeddingConfig(): ResolvedEmbeddingConfig {
  const provider = getConfig('EMBEDDING_PROVIDER') || 'aliyun';
  const { apiKey, baseUrl, model } = resolveProviderConfig('EMBEDDING', provider);
  return { apiKey, baseUrl, model };
}