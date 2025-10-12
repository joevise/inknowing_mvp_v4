/**
 * AI配置管理API
 * GET /api/admin/config/ai - 获取AI配置
 * PUT /api/admin/config/ai - 更新AI配置
 * 支持3个独立模型配置: 对话、向量、解析
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getConfig, setManyConfig } from '@/lib/services/runtime-config';
import {
  BOOK_CHAT_PROMPT,
  CHARACTER_CHAT_PROMPT,
  BOOK_RECOGNITION_PROMPT,
  CHARACTER_EXTRACTION_PROMPT,
} from '@/lib/ai/prompts';

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    // 从运行时配置读取当前配置
    const config = {
      conversation: {
        provider: getConfig('CONVERSATION_PROVIDER') || 'aliyun',
        qwen_api_key: maskApiKey(getConfig('CONVERSATION_QWEN_API_KEY') || ''),
        qwen_model: getConfig('CONVERSATION_QWEN_MODEL') || 'qwen-turbo',
        qwen_base_url: getConfig('CONVERSATION_QWEN_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        openai_api_key: maskApiKey(getConfig('CONVERSATION_OPENAI_API_KEY') || ''),
        openai_base_url: getConfig('CONVERSATION_OPENAI_BASE_URL') || '',
        openai_model: getConfig('CONVERSATION_OPENAI_MODEL') || 'gpt-3.5-turbo',
        temperature: parseFloat(getConfig('CONVERSATION_TEMPERATURE') || '0.7'),
        max_tokens: parseInt(getConfig('CONVERSATION_MAX_TOKENS') || '2000'),
        book_prompt: getConfig('CONVERSATION_BOOK_PROMPT') || BOOK_CHAT_PROMPT,
        character_prompt: getConfig('CONVERSATION_CHARACTER_PROMPT') || CHARACTER_CHAT_PROMPT,
      },
      embedding: {
        provider: getConfig('EMBEDDING_PROVIDER') || 'aliyun',
        qwen_api_key: maskApiKey(getConfig('EMBEDDING_QWEN_API_KEY') || ''),
        qwen_model: getConfig('EMBEDDING_QWEN_MODEL') || 'text-embedding-v3',
        qwen_base_url: getConfig('EMBEDDING_QWEN_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        openai_api_key: maskApiKey(getConfig('EMBEDDING_OPENAI_API_KEY') || ''),
        openai_base_url: getConfig('EMBEDDING_OPENAI_BASE_URL') || '',
        openai_model: getConfig('EMBEDDING_OPENAI_MODEL') || 'text-embedding-3-small',
        chromadb_url: getConfig('CHROMADB_URL') || 'http://localhost:8000',
      },
      parsing: {
        provider: getConfig('PARSING_PROVIDER') || 'aliyun',
        qwen_api_key: maskApiKey(getConfig('PARSING_QWEN_API_KEY') || ''),
        qwen_model: getConfig('PARSING_QWEN_MODEL') || 'qwen-max',
        qwen_base_url: getConfig('PARSING_QWEN_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        openai_api_key: maskApiKey(getConfig('PARSING_OPENAI_API_KEY') || ''),
        openai_base_url: getConfig('PARSING_OPENAI_BASE_URL') || '',
        openai_model: getConfig('PARSING_OPENAI_MODEL') || 'gpt-4o',
        temperature: parseFloat(getConfig('PARSING_TEMPERATURE') || '0.3'),
        max_tokens: parseInt(getConfig('PARSING_MAX_TOKENS') || '4000'),
        book_recognition_prompt: getConfig('PARSING_BOOK_RECOGNITION_PROMPT') || BOOK_RECOGNITION_PROMPT,
        character_extraction_prompt: getConfig('PARSING_CHARACTER_EXTRACTION_PROMPT') || CHARACTER_EXTRACTION_PROMPT,
      }
    };

    console.log('[AI Config API] Retrieved config from runtime cache');

    return NextResponse.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('[AI Config API] Get config error:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { tab, config } = body;

    console.log(`[AI Config API] Update ${tab} config request received`);

    // 验证必填字段
    if (!tab || !config) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 检查是否有现有配置
    const prefix = tab.toUpperCase();
    const hasExistingAliyunKey = getConfig(`${prefix}_QWEN_API_KEY`);
    const hasExistingOpenAIKey = getConfig(`${prefix}_OPENAI_API_KEY`);

    // 根据provider验证必填字段
    // 如果key是masked的，说明用户没改，只要有历史配置就可以
    if (config.provider === 'aliyun') {
      const keyIsValid = config.qwen_api_key && !isApiKeyMasked(config.qwen_api_key);
      const hasHistoryKey = hasExistingAliyunKey;
      if (!keyIsValid && !hasHistoryKey) {
        return NextResponse.json(
          { error: '阿里云API Key为必填项' },
          { status: 400 }
        );
      }
    }

    if (config.provider === 'openai') {
      const keyIsValid = config.openai_api_key && !isApiKeyMasked(config.openai_api_key);
      const hasHistoryKey = hasExistingOpenAIKey;
      if ((!keyIsValid && !hasHistoryKey) || !config.openai_base_url) {
        return NextResponse.json(
          { error: 'OpenAI API Key和Base URL为必填项' },
          { status: 400 }
        );
      }
    }

    // 准备要更新的配置
    const configUpdates: Record<string, string> = {};

    // 通用配置更新
    configUpdates[`${prefix}_PROVIDER`] = config.provider || 'aliyun';

    // 阿里云配置
    if (config.qwen_api_key && !isApiKeyMasked(config.qwen_api_key)) {
      configUpdates[`${prefix}_QWEN_API_KEY`] = config.qwen_api_key;
    }
    if (config.qwen_model) configUpdates[`${prefix}_QWEN_MODEL`] = config.qwen_model;
    if (config.qwen_base_url) configUpdates[`${prefix}_QWEN_BASE_URL`] = config.qwen_base_url;

    // OpenAI配置
    if (config.openai_api_key && !isApiKeyMasked(config.openai_api_key)) {
      configUpdates[`${prefix}_OPENAI_API_KEY`] = config.openai_api_key;
    }
    if (config.openai_base_url) configUpdates[`${prefix}_OPENAI_BASE_URL`] = config.openai_base_url;
    if (config.openai_model) configUpdates[`${prefix}_OPENAI_MODEL`] = config.openai_model;

    // LLM模型特有参数 (conversation和parsing)
    if (tab === 'conversation' || tab === 'parsing') {
      if (config.temperature !== undefined) configUpdates[`${prefix}_TEMPERATURE`] = String(config.temperature);
      if (config.max_tokens !== undefined) configUpdates[`${prefix}_MAX_TOKENS`] = String(config.max_tokens);
    }

    // 对话模型提示词
    if (tab === 'conversation') {
      if (config.book_prompt) configUpdates.CONVERSATION_BOOK_PROMPT = config.book_prompt;
      if (config.character_prompt) configUpdates.CONVERSATION_CHARACTER_PROMPT = config.character_prompt;
    }

    // 解析模型提示词
    if (tab === 'parsing') {
      if (config.book_recognition_prompt) configUpdates.PARSING_BOOK_RECOGNITION_PROMPT = config.book_recognition_prompt;
      if (config.character_extraction_prompt) configUpdates.PARSING_CHARACTER_EXTRACTION_PROMPT = config.character_extraction_prompt;
    }

    // Embedding模型特有参数
    if (tab === 'embedding' && config.chromadb_url) {
      configUpdates.CHROMADB_URL = config.chromadb_url;
    }

    // 更新运行时配置（立即生效）
    const success = setManyConfig(configUpdates);

    if (!success) {
      return NextResponse.json(
        { error: '保存配置失败' },
        { status: 500 }
      );
    }

    console.log('[AI Config API] Config updated in runtime cache - effective immediately');

    return NextResponse.json({
      success: true,
      message: '配置已成功保存并立即生效',
      needRestart: false
    });
  } catch (error) {
    console.error('[AI Config API] Update config error:', error);
    return NextResponse.json(
      { error: '更新配置失败' },
      { status: 500 }
    );
  }
}

// 辅助函数：遮罩API Key
function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '';
  return '**********' + key.slice(-4);
}

// 辅助函数：检查是否是被遮罩的API Key
function isApiKeyMasked(key: string): boolean {
  return key.startsWith('**********');
}
