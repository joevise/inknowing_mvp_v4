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
    const config = {
      qwen_api_key: qwenApiKey ? '**********' + qwenApiKey.slice(-4) : '',
      qwen_model: getConfig('QWEN_MODEL') || 'qwen-max',
      qwen_base_url: getConfig('QWEN_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      embedding_model: getConfig('QWEN_EMBEDDING_MODEL') || 'text-embedding-v3',
      chromadb_url: getConfig('CHROMADB_URL') || 'http://localhost:8000',
      openai_compatible: {
        enabled: !!(getConfig('OPENAI_API_KEY')),
        base_url: getConfig('OPENAI_BASE_URL') || '',
        api_key: getConfig('OPENAI_API_KEY') ? '**********' + getConfig('OPENAI_API_KEY')!.slice(-4) : '',
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
      qwen_api_key,
      qwen_model,
      qwen_base_url,
      embedding_model,
      chromadb_url,
      openai_compatible
    } = body;

    console.log('[AI Config API] Update config request received');

    // 验证必填字段
    if (!qwen_api_key || !qwen_model) {
      return NextResponse.json(
        { error: '通义千问API Key和模型为必填项' },
        { status: 400 }
      );
    }

    // 准备要更新的配置
    const configUpdates: Record<string, string> = {
      QWEN_API_KEY: qwen_api_key,
      QWEN_MODEL: qwen_model,
    };

    if (qwen_base_url) {
      configUpdates.QWEN_BASE_URL = qwen_base_url;
    }

    if (embedding_model) {
      configUpdates.QWEN_EMBEDDING_MODEL = embedding_model;
    }

    if (chromadb_url) {
      configUpdates.CHROMADB_URL = chromadb_url;
    }

    if (openai_compatible?.api_key) {
      configUpdates.OPENAI_API_KEY = openai_compatible.api_key;
    }

    if (openai_compatible?.base_url) {
      configUpdates.OPENAI_BASE_URL = openai_compatible.base_url;
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
