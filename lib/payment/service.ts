/**
 * 支付服务 — 工厂 + 订单管理 + Webhook 处理
 */

import { db, generateId, now } from '@/lib/db/client';
import type { Order } from '@/lib/db/schema';
import { subscribe } from '@/lib/subscription/service';
import type { PaymentProvider } from './types';
import { MockPaymentProvider } from './providers/mock';

// ---- Provider 注册 ----
const providers: Map<string, PaymentProvider> = new Map();

// 注册内置 provider
providers.set('mock', new MockPaymentProvider());
// 未来：providers.set('wechat', new WechatPayProvider());
// 未来：providers.set('alipay', new AlipayProvider());
// 未来：providers.set('stripe', new StripeProvider());

/**
 * 注册自定义 provider（插件式扩展）
 */
export function registerProvider(name: string, provider: PaymentProvider): void {
  providers.set(name, provider);
}

/**
 * 工厂方法：获取 provider
 */
export function getProvider(name: string): PaymentProvider {
  const provider = providers.get(name);
  if (!provider) {
    throw new Error(`不支持的支付方式: ${name}`);
  }
  return provider;
}

// ---- 行解析 ----
function parseOrder(row: any): Order {
  return {
    id: row.id,
    user_id: row.user_id,
    plan_id: row.plan_id,
    amount_cents: Number(row.amount_cents ?? 0),
    currency: row.currency ?? 'CNY',
    status: row.status,
    provider: row.provider,
    provider_order_id: row.provider_order_id ?? null,
    provider_transaction_id: row.provider_transaction_id ?? null,
    paid_at: row.paid_at ? new Date(row.paid_at) : null,
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
    metadata: row.metadata ?? null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

// ---- 公开 API ----

/**
 * 创建支付订单
 */
export async function createOrder(
  userId: string,
  planId: string,
  providerName: string
): Promise<{ order: Order; payResult: ReturnType<PaymentProvider['createOrder']> extends Promise<infer T> ? T : never }> {
  // 获取套餐信息
  const plan = await db()
    .prepare('SELECT * FROM plans WHERE id = ? AND is_active = true')
    .get(planId) as any;

  if (!plan) {
    throw new Error('套餐不存在或已下架');
  }

  if (plan.price_cents === 0) {
    throw new Error('免费套餐无需支付');
  }

  // 创建内部订单
  const orderId = generateId();
  const ts = now().toISOString();
  const expiresAt = new Date(now().getTime() + 30 * 60 * 1000); // 30分钟过期

  await db()
    .prepare(
      `INSERT INTO orders (id, user_id, plan_id, amount_cents, currency, status, provider, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
    )
    .run(
      orderId,
      userId,
      planId,
      plan.price_cents,
      plan.currency,
      providerName,
      expiresAt.toISOString(),
      ts,
      ts
    );

  // 调用 provider 创建支付
  const provider = getProvider(providerName);
  const payResult = await provider.createOrder({
    orderId,
    amountCents: plan.price_cents,
    description: `InKnowing - ${plan.name}`,
    userId,
    planId,
  });

  // 更新 provider_order_id
  if (payResult.providerOrderId) {
    await db()
      .prepare('UPDATE orders SET provider_order_id = ?, updated_at = ? WHERE id = ?')
      .run(payResult.providerOrderId, now().toISOString(), orderId);
  }

  const orderRow = await db().prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  const order = parseOrder(orderRow);

  return { order, payResult };
}

/**
 * 处理 Webhook 回调
 * 验签 → 更新订单状态 → 激活订阅
 */
export async function handleWebhook(
  providerName: string,
  headers: Record<string, string>,
  body: string
): Promise<void> {
  const provider = getProvider(providerName);
  const result = await provider.verifyWebhook(headers, body);

  // 查询内部订单
  const orderRow = await db()
    .prepare('SELECT * FROM orders WHERE id = ?')
    .get(result.orderId) as any;

  if (!orderRow) {
    console.error(`[Payment] Webhook: order not found: ${result.orderId}`);
    return;
  }

  if (orderRow.status === 'paid') {
    // 已处理过的回调，幂等跳过
    return;
  }

  // 更新订单状态
  const ts = now().toISOString();
  if (result.status === 'paid') {
    await db()
      .prepare(
        `UPDATE orders
            SET status = 'paid', provider_order_id = ?, provider_transaction_id = ?,
                paid_at = ?, updated_at = ?
          WHERE id = ?`
      )
      .run(
        result.providerOrderId,
        result.providerTransactionId,
        ts,
        ts,
        result.orderId
      );

    // 激活订阅
    const order = parseOrder(orderRow);
    await activateSubscription(order);
  } else {
    await db()
      .prepare(
        `UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ?`
      )
      .run(ts, result.orderId);
  }
}

/**
 * 订单成功后创建/续期订阅
 */
async function activateSubscription(order: Order): Promise<void> {
  await subscribe(order.user_id, order.plan_id);
  console.log(`[Payment] Subscription activated for user ${order.user_id}, plan ${order.plan_id}`);
}

/**
 * 手动确认订单支付（给 admin 或 mock 测试用）
 */
export async function confirmOrder(orderId: string): Promise<void> {
  const orderRow = await db()
    .prepare('SELECT * FROM orders WHERE id = ?')
    .get(orderId) as any;

  if (!orderRow) throw new Error('订单不存在');
  if (orderRow.status === 'paid') return; // 幂等

  const ts = now().toISOString();
  await db()
    .prepare(
      `UPDATE orders SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?`
    )
    .run(ts, ts, orderId);

  const order = parseOrder(orderRow);
  await activateSubscription(order);
}
