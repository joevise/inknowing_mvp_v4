/**
 * 支付模块统一导出
 */

export type {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  WebhookResult,
  OrderStatus,
  RefundResult,
} from './types';
export {
  registerProvider,
  getProvider,
  createOrder,
  handleWebhook,
  confirmOrder,
} from './service';
export { MockPaymentProvider } from './providers/mock';
