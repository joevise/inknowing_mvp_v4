/**
 * 支付回调 Webhook
 * POST /api/payment/webhook/[provider]
 * 第三方支付平台异步通知，无需用户认证
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/payment/service';

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const providerName = params.provider;

  try {
    const body = await request.text();

    // 收集 headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    await handleWebhook(providerName, headers, body);

    // 大多数支付平台期望返回 200 + 特定格式
    return NextResponse.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    console.error(`[Payment] webhook ${providerName} failed:`, error);
    return NextResponse.json(
      { code: 'FAIL', message: '处理失败' },
      { status: 500 }
    );
  }
}
