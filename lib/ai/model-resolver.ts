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

async function resolveProviderConfig(prefix: string, provider: string | undefined): Promise<{
  apiKey: string;
  baseUrl: string;
  model: string;
}> {
  if (provider === 'openrouter') {
    const apiKey = (await getConfig(`${prefix}_OPENROUTER_API_KEY`)) || process.env.CHAT_API_KEY || '';
    const baseUrl = (await getConfig(`${prefix}_OPENROUTER_BASE_URL`)) || 'https://openrouter.ai/api/v1';
    const model = (await getConfig(`${prefix}_OPENROUTER_MODEL`)) || 'deepseek/deepseek-v4-flash';
    return { apiKey, baseUrl, model };
  }
  if (provider === 'openai') {
    const apiKey = (await getConfig(`${prefix}_OPENAI_API_KEY`)) || process.env.OPENAI_API_KEY || '';
    const baseUrl = (await getConfig(`${prefix}_OPENAI_BASE_URL`)) || process.env.OPENAI_BASE_URL || '';
    const model = (await getConfig(`${prefix}_OPENAI_MODEL`)) || process.env.OPENAI_MODEL || 'gpt-4';
    return { apiKey, baseUrl, model };
  }
  const apiKey = (await getConfig(`${prefix}_QWEN_API_KEY`)) || process.env.QWEN_API_KEY || '';
  const baseUrl = (await getConfig(`${prefix}_QWEN_BASE_URL`)) || process.env.QWEN_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = (await getConfig(`${prefix}_QWEN_MODEL`)) || process.env.QWEN_MODEL || 'qwen-max';
  return { apiKey, baseUrl, model };
}

export async function resolveConversationModel(): Promise<ResolvedChatModel> {
  const provider = (await getConfig('CONVERSATION_PROVIDER')) || process.env.AI_PROVIDER || 'aliyun';
  const { apiKey, baseUrl, model } = await resolveProviderConfig('CONVERSATION', provider);
  const temperature = parseFloat((await getConfig('CONVERSATION_TEMPERATURE')) || '0.7');
  const maxTokens = parseInt((await getConfig('CONVERSATION_MAX_TOKENS')) || '2000');

  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  return { client, model, temperature, maxTokens };
}

export async function resolveParsingModel(): Promise<ResolvedChatModel> {
  const provider = (await getConfig('PARSING_PROVIDER')) || process.env.AI_PROVIDER || 'aliyun';
  const { apiKey, baseUrl, model } = await resolveProviderConfig('PARSING', provider);
  const temperature = parseFloat((await getConfig('PARSING_TEMPERATURE')) || '0.3');
  const maxTokens = parseInt((await getConfig('PARSING_MAX_TOKENS')) || '4000');

  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  return { client, model, temperature, maxTokens };
}

export async function resolveEmbeddingConfig(): Promise<ResolvedEmbeddingConfig> {
  const provider = (await getConfig('EMBEDDING_PROVIDER')) || 'aliyun';
  const { apiKey, baseUrl, model } = await resolveProviderConfig('EMBEDDING', provider);
  return { apiKey, baseUrl, model };
}
