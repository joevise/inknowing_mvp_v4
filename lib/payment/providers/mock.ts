/**
 * Mock 支付 Provider
 * 用于开发和测试，直接返回成功结果
 */

import type {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  WebhookResult,
  OrderStatus,
  RefundResult,
} from '../types';

export class MockPaymentProvider implements PaymentProvider {
  name = 'mock';

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    // 模拟生成订单
    const providerOrderId = `MOCK_${params.orderId}`;
    const mockQr = `mock://pay?order=${params.orderId}&amount=${params.amountCents}`;

    return {
      payUrl: `mock://pay?order=${params.orderId}`,
      qrCode: mockQr,
      providerOrderId,
    };
  }

  async verifyWebhook(
    _headers: Record<string, string>,
    body: string
  ): Promise<WebhookResult> {
    // Mock: 直接解析 body
    const data = JSON.parse(body);
    return {
      orderId: data.orderId,
      providerOrderId: data.providerOrderId || `MOCK_${data.orderId}`,
      providerTransactionId: `MOCK_TX_${Date.now()}`,
      status: 'paid',
      amountCents: data.amountCents || 0,
    };
  }

  async queryOrder(orderId: string): Promise<OrderStatus> {
    // Mock: 始终返回 pending（测试用）
    return {
      status: 'pending',
      providerOrderId: `MOCK_${orderId}`,
    };
  }

  async refund(orderId: string, _amount?: number): Promise<RefundResult> {
    return {
      success: true,
      refundId: `MOCK_REFUND_${orderId}_${Date.now()}`,
      message: 'Mock refund always succeeds',
    };
  }
}
