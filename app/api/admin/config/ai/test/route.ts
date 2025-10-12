/**
 * AI配置测试API
 * POST /api/admin/config/ai/test - 测试AI服务连接
 * 支持3种模型类型: conversation, embedding, parsing
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { tab, config } = body;

    console.log(`[AI Config Test API] Testing ${tab} model configuration`);

    if (!tab || !config) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 });
    }

    // 根据provider选择API配置
    const provider = config.provider || 'aliyun';
    let apiKey: string;
    let baseURL: string;
    let model: string;

    if (provider === 'aliyun') {
      apiKey = config.qwen_api_key;
      baseURL = config.qwen_base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      model = config.qwen_model;
    } else {
      apiKey = config.openai_api_key;
      baseURL = config.openai_base_url;
      model = config.openai_model;
    }

    // 验证必填字段
    if (!apiKey || apiKey.startsWith('**********')) {
      return NextResponse.json({
        success: false,
        error: 'API Key为必填项'
      });
    }

    if (provider === 'openai' && !baseURL) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI Base URL为必填项'
      });
    }

    try {
      const client = new OpenAI({
        apiKey,
        baseURL,
      });

      // 根据模型类型进行不同的测试
      if (tab === 'embedding') {
        // 向量模型测试
        console.log('[AI Config Test API] Testing embedding model');

        const response = await client.embeddings.create({
          model,
          input: '测试文本',
        });

        return NextResponse.json({
          success: true,
          message: '向量模型连接成功',
          model_used: model,
          dimension: response.data[0]?.embedding?.length || 0
        });
      } else {
        // 对话模型和解析模型测试 (conversation, parsing)
        console.log('[AI Config Test API] Testing LLM model');

        const testParams: any = {
          model,
          messages: [
            {
              role: 'user',
              content: '你好，这是一个测试连接。请简单回复"连接成功"。'
            }
          ],
        };

        // 添加可选参数
        if (config.temperature !== undefined) {
          testParams.temperature = config.temperature;
        }
        if (config.max_tokens !== undefined) {
          testParams.max_tokens = Math.min(config.max_tokens, 100); // 测试时限制在100以内
        } else {
          testParams.max_tokens = 50;
        }

        const response = await client.chat.completions.create(testParams);
        const reply = response.choices[0]?.message?.content || '';

        console.log('[AI Config Test API] Test successful, response:', reply.substring(0, 50));

        return NextResponse.json({
          success: true,
          message: 'AI服务连接成功',
          test_response: reply,
          model_used: model
        });
      }
    } catch (aiError: any) {
      console.error('[AI Config Test API] AI service error:', aiError);

      let errorMessage = '连接失败';

      if (aiError.status === 401) {
        errorMessage = 'API Key无效或已过期';
      } else if (aiError.status === 429) {
        errorMessage = 'API调用频率超限';
      } else if (aiError.code === 'ECONNREFUSED') {
        errorMessage = '无法连接到API服务器';
      } else if (aiError.message) {
        errorMessage = aiError.message;
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: aiError.message || aiError.toString()
      });
    }
  } catch (error) {
    console.error('[AI Config Test API] Test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '测试配置时发生错误',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
