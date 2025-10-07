/**
 * AI配置测试API
 * POST /api/admin/config/ai/test - 测试AI服务连接
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { getConfig } from '@/lib/services/runtime-config';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdminAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const {
      qwen_api_key,
      qwen_model,
      qwen_base_url,
      openai_compatible
    } = body;

    console.log('[AI Config Test API] Testing AI configuration');

    // 验证必填字段
    if (!qwen_api_key) {
      return NextResponse.json({
        success: false,
        error: '请提供通义千问API Key'
      });
    }

    try {
      // 创建临时客户端进行测试
      const client = new OpenAI({
        apiKey: qwen_api_key,
        baseURL: qwen_base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      });

      // 发送测试请求
      console.log('[AI Config Test API] Sending test request to Qwen API');

      const response = await client.chat.completions.create({
        model: qwen_model || 'qwen-max',
        messages: [
          {
            role: 'user',
            content: '你好，这是一个测试连接。请回复"连接成功"。'
          }
        ],
        max_tokens: 50
      });

      const reply = response.choices[0]?.message?.content || '';

      console.log('[AI Config Test API] Test successful, response:', reply.substring(0, 50));

      return NextResponse.json({
        success: true,
        message: 'AI服务连接成功',
        test_response: reply,
        model_used: qwen_model || 'qwen-max'
      });
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
