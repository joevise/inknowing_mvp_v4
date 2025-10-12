/**
 * AI配置管理API
 * GET /api/admin/config/ai - 获取AI配置
 * PUT /api/admin/config/ai - 更新AI配置
 * 支持3个独立模型配置: 对话、向量、解析
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getConfig, setManyConfig } from '@/lib/services/runtime-config';

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
    const { conversation, embedding, parsing } = body;

    console.log('[AI Config API] Update config request received');

    // 验证必填字段
    const errors: string[] = [];

    // 验证对话模型配置
    if (conversation?.provider === 'aliyun' && !conversation?.qwen_api_key) {
      errors.push('对话模型: 阿里云API Key为必填项');
    }
    if (conversation?.provider === 'openai' && (!conversation?.openai_api_key || !conversation?.openai_base_url)) {
      errors.push('对话模型: OpenAI API Key和Base URL为必填项');
    }

    // 验证向量模型配置
    if (embedding?.provider === 'aliyun' && !embedding?.qwen_api_key) {
      errors.push('向量模型: 阿里云API Key为必填项');
    }
    if (embedding?.provider === 'openai' && (!embedding?.openai_api_key || !embedding?.openai_base_url)) {
      errors.push('向量模型: OpenAI API Key和Base URL为必填项');
    }

    // 验证解析模型配置
    if (parsing?.provider === 'aliyun' && !parsing?.qwen_api_key) {
      errors.push('解析模型: 阿里云API Key为必填项');
    }
    if (parsing?.provider === 'openai' && (!parsing?.openai_api_key || !parsing?.openai_base_url)) {
      errors.push('解析模型: OpenAI API Key和Base URL为必填项');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join('; ') },
        { status: 400 }
      );
    }

    // 准备要更新的配置
    const configUpdates: Record<string, string> = {};

    // 对话模型配置
    if (conversation) {
      configUpdates.CONVERSATION_PROVIDER = conversation.provider || 'aliyun';
      if (conversation.qwen_api_key && !isApiKeyMasked(conversation.qwen_api_key)) {
        configUpdates.CONVERSATION_QWEN_API_KEY = conversation.qwen_api_key;
      }
      if (conversation.qwen_model) configUpdates.CONVERSATION_QWEN_MODEL = conversation.qwen_model;
      if (conversation.qwen_base_url) configUpdates.CONVERSATION_QWEN_BASE_URL = conversation.qwen_base_url;
      if (conversation.openai_api_key && !isApiKeyMasked(conversation.openai_api_key)) {
        configUpdates.CONVERSATION_OPENAI_API_KEY = conversation.openai_api_key;
      }
      if (conversation.openai_base_url) configUpdates.CONVERSATION_OPENAI_BASE_URL = conversation.openai_base_url;
      if (conversation.openai_model) configUpdates.CONVERSATION_OPENAI_MODEL = conversation.openai_model;
      if (conversation.temperature !== undefined) configUpdates.CONVERSATION_TEMPERATURE = String(conversation.temperature);
      if (conversation.max_tokens !== undefined) configUpdates.CONVERSATION_MAX_TOKENS = String(conversation.max_tokens);
    }

    // 向量模型配置
    if (embedding) {
      configUpdates.EMBEDDING_PROVIDER = embedding.provider || 'aliyun';
      if (embedding.qwen_api_key && !isApiKeyMasked(embedding.qwen_api_key)) {
        configUpdates.EMBEDDING_QWEN_API_KEY = embedding.qwen_api_key;
      }
      if (embedding.qwen_model) configUpdates.EMBEDDING_QWEN_MODEL = embedding.qwen_model;
      if (embedding.qwen_base_url) configUpdates.EMBEDDING_QWEN_BASE_URL = embedding.qwen_base_url;
      if (embedding.openai_api_key && !isApiKeyMasked(embedding.openai_api_key)) {
        configUpdates.EMBEDDING_OPENAI_API_KEY = embedding.openai_api_key;
      }
      if (embedding.openai_base_url) configUpdates.EMBEDDING_OPENAI_BASE_URL = embedding.openai_base_url;
      if (embedding.openai_model) configUpdates.EMBEDDING_OPENAI_MODEL = embedding.openai_model;
      if (embedding.chromadb_url) configUpdates.CHROMADB_URL = embedding.chromadb_url;
    }

    // 解析模型配置
    if (parsing) {
      configUpdates.PARSING_PROVIDER = parsing.provider || 'aliyun';
      if (parsing.qwen_api_key && !isApiKeyMasked(parsing.qwen_api_key)) {
        configUpdates.PARSING_QWEN_API_KEY = parsing.qwen_api_key;
      }
      if (parsing.qwen_model) configUpdates.PARSING_QWEN_MODEL = parsing.qwen_model;
      if (parsing.qwen_base_url) configUpdates.PARSING_QWEN_BASE_URL = parsing.qwen_base_url;
      if (parsing.openai_api_key && !isApiKeyMasked(parsing.openai_api_key)) {
        configUpdates.PARSING_OPENAI_API_KEY = parsing.openai_api_key;
      }
      if (parsing.openai_base_url) configUpdates.PARSING_OPENAI_BASE_URL = parsing.openai_base_url;
      if (parsing.openai_model) configUpdates.PARSING_OPENAI_MODEL = parsing.openai_model;
      if (parsing.temperature !== undefined) configUpdates.PARSING_TEMPERATURE = String(parsing.temperature);
      if (parsing.max_tokens !== undefined) configUpdates.PARSING_MAX_TOKENS = String(parsing.max_tokens);
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
