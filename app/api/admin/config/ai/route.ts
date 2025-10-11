/**
 * AI配置管理API
 * GET /api/admin/config/ai - 获取AI配置
 * PUT /api/admin/config/ai - 更新AI配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getConfig, setManyConfig } from '@/lib/services/runtime-config';

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    // 从运行时配置读取当前配置
    const qwenApiKey = getConfig('QWEN_API_KEY') || '';
    const openaiApiKey = getConfig('OPENAI_API_KEY') || '';
    const config = {
      provider: getConfig('AI_PROVIDER') || 'aliyun',
      qwen_api_key: qwenApiKey ? '**********' + qwenApiKey.slice(-4) : '',
      qwen_model: getConfig('QWEN_MODEL') || 'qwen-max',
      qwen_base_url: getConfig('QWEN_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      qwen_embedding_model: getConfig('QWEN_EMBEDDING_MODEL') || 'text-embedding-v3',
      chromadb_url: getConfig('CHROMADB_URL') || 'http://localhost:8000',
      openai_compatible: {
        enabled: !!openaiApiKey,
        base_url: getConfig('OPENAI_BASE_URL') || '',
        api_key: openaiApiKey ? '**********' + openaiApiKey.slice(-4) : '',
        model: getConfig('OPENAI_MODEL') || 'gpt-4',
        embedding_model: getConfig('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small',
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
    const {
      provider,
      qwen_api_key,
      qwen_model,
      qwen_base_url,
      qwen_embedding_model,
      chromadb_url,
      openai_compatible
    } = body;

    console.log('[AI Config API] Update config request received, provider:', provider);

    // 根据provider验证必填字段
    if (provider === 'aliyun') {
      if (!qwen_api_key || !qwen_model) {
        return NextResponse.json(
          { error: '通义千问API Key和模型为必填项' },
          { status: 400 }
        );
      }
    } else if (provider === 'openai') {
      if (!openai_compatible?.api_key || !openai_compatible?.base_url) {
        return NextResponse.json(
          { error: 'OpenAI兼容模式需要API Key和Base URL' },
          { status: 400 }
        );
      }
    }

    // 准备要更新的配置
    const configUpdates: Record<string, string> = {
      AI_PROVIDER: provider || 'aliyun',
    };

    // 阿里云配置
    if (qwen_api_key) {
      configUpdates.QWEN_API_KEY = qwen_api_key;
    }
    if (qwen_model) {
      configUpdates.QWEN_MODEL = qwen_model;
    }
    if (qwen_base_url) {
      configUpdates.QWEN_BASE_URL = qwen_base_url;
    }
    if (qwen_embedding_model) {
      configUpdates.QWEN_EMBEDDING_MODEL = qwen_embedding_model;
    }

    // ChromaDB配置
    if (chromadb_url) {
      configUpdates.CHROMADB_URL = chromadb_url;
    }

    // OpenAI兼容配置
    if (openai_compatible?.api_key) {
      configUpdates.OPENAI_API_KEY = openai_compatible.api_key;
    }
    if (openai_compatible?.base_url) {
      configUpdates.OPENAI_BASE_URL = openai_compatible.base_url;
    }
    if (openai_compatible?.model) {
      configUpdates.OPENAI_MODEL = openai_compatible.model;
    }
    if (openai_compatible?.embedding_model) {
      configUpdates.OPENAI_EMBEDDING_MODEL = openai_compatible.embedding_model;
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
