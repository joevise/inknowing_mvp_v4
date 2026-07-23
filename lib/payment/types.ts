/**
 * 支付模块类型定义
 */

export interface PaymentProvider {
  name: string;
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifyWebhook(headers: Record<string, string>, body: string): Promise<WebhookResult>;
  queryOrder(orderId: string): Promise<OrderStatus>;
  refund(orderId: string, amount?: number): Promise<RefundResult>;
}

export interface CreateOrderParams {
  orderId: string;        // 内部订单号
  amountCents: number;
  description: string;
  userId: string;
  planId: string;
  returnUrl?: string;
  notifyUrl?: string;
}

export interface CreateOrderResult {
  payUrl?: string;         // 支付跳转链接（H5）
  qrCode?: string;         // 二维码内容（扫码付）
  providerOrderId?: string;
}

export interface WebhookResult {
  orderId: string;
  providerOrderId: string;
  providerTransactionId: string;
  status: 'paid' | 'failed';
  amountCents: number;
}

export interface OrderStatus {
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  providerOrderId?: string;
  providerTransactionId?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  message?: string;
}
