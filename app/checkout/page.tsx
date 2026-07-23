/**
 * 支付页面 /checkout?plan=plan_xxx
 * 微信扫码支付流程
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface Plan {
  id: string;
  name: string;
  nameEn: string | null;
  priceCents: number;
  currency: string;
  billingCycle: string;
}

interface OrderResult {
  success: boolean;
  orderId: string;
  qrCode?: string;
  payUrl?: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations();

  const planId = searchParams.get('plan') || '';
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'success' | 'failed'>('idle');
  const [error, setError] = useState('');

  // 加载套餐信息 + 检查登录
  useEffect(() => {
    if (!planId) {
      router.push('/pricing');
      return;
    }

    Promise.all([
      fetch('/api/plans').then((r) => r.json()),
      fetch('/api/auth/me', { credentials: 'include' }),
    ])
      .then(async ([plansData, authRes]) => {
        if (!authRes.ok) {
          router.push('/auth/login');
          return;
        }
        const found = (plansData.plans || []).find((p: Plan) => p.id === planId);
        if (!found) {
          setError(t('checkout.planNotFound'));
          return;
        }
        if (found.priceCents === 0) {
          router.push('/pricing');
          return;
        }
        setPlan(found);
      })
      .finally(() => setLoading(false));
  }, [planId, router, t]);

  // 创建订单
  const handleCreateOrder = async () => {
    if (!plan) return;
    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, provider: 'wechat' }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // 如果微信支付未配置，尝试 mock
        if (data.error?.includes('not configured') || data.error?.includes('不支持')) {
          const mockRes = await fetch('/api/payment/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: plan.id, provider: 'mock' }),
          });
          const mockData = await mockRes.json();
          if (mockRes.ok && mockData.success) {
            setOrder(mockData);
            setStatus('waiting');
            startPolling(mockData.orderId);
            return;
          }
        }
        throw new Error(data.error || 'Failed to create order');
      }

      setOrder(data);
      setStatus('waiting');
      startPolling(data.orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('checkout.createOrderFailed'));
    } finally {
      setCreating(false);
    }
  };

  // 轮询订单状态
  const startPolling = (orderId: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 200; // 约 10 分钟

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setPolling(false);
        setStatus('failed');
        return;
      }

      try {
        // 用 mock provider 查询（内部订单状态）
        const res = await fetch(`/api/payment/create-order?orderId=${orderId}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        // create-order 只支持 POST，这里用 webhook 模拟或直接检查订单
        // 实际场景中需要订单查询 API，这里简单用 subscription 检查
        const subRes = await fetch('/api/subscription/current', {
          credentials: 'include',
        });
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.subscription?.status === 'active' && subData.plan?.id === planId) {
            clearInterval(interval);
            setPolling(false);
            setStatus('success');
            setTimeout(() => router.push('/'), 2000);
          }
        }
      } catch {
        // 忽略轮询错误
      }
    }, 3000);

    // 存储 interval ID 以便清理
    (window as any).__checkoutPoll = interval;
  };

  // 清理轮询
  useEffect(() => {
    return () => {
      const interval = (window as any).__checkoutPoll;
      if (interval) clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 font-light">{t('common.loading')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-16">
          {/* 返回链接 */}
          <Link
            href="/pricing"
            className="text-sm font-light text-gray-400 hover:text-[#2C5530] mb-8 inline-block"
          >
            ← {t('common.back')}
          </Link>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-600 font-light">{error}</p>
            </div>
          )}

          {/* 套餐信息 */}
          {plan && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
              <h1 className="text-xl font-light text-gray-800 mb-2">
                {t('checkout.title')}
              </h1>
              <p className="text-sm font-light text-gray-500 mb-6">
                {t('checkout.subtitle')}
              </p>

              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="font-light text-sm text-gray-500">
                  {t('checkout.plan')}
                </span>
                <span className="font-light text-sm text-gray-800">
                  {plan.name}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="font-light text-sm text-gray-500">
                  {t('checkout.billingCycle')}
                </span>
                <span className="font-light text-sm text-gray-800">
                  {t(`pricing.cycle.${plan.billingCycle}`)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="font-light text-sm text-gray-500">
                  {t('checkout.amount')}
                </span>
                <span className="text-2xl font-light text-[#2C5530]">
                  ¥{(plan.priceCents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* 支付状态区域 */}
          {status === 'idle' && plan && (
            <button
              onClick={handleCreateOrder}
              disabled={creating}
              className="w-full py-3 bg-[#2C5530] text-white rounded-lg font-light text-base
                       hover:bg-[#234426] transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? t('checkout.creating') : t('checkout.confirmPay')}
            </button>
          )}

          {/* 二维码展示 */}
          {status === 'waiting' && order?.qrCode && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <h2 className="text-lg font-light text-gray-800 mb-2">
                {t('checkout.scanToPay')}
              </h2>
              <p className="text-sm font-light text-gray-400 mb-6">
                {t('checkout.scanHint')}
              </p>

              <div className="flex justify-center mb-6">
                {/* 使用在线二维码生成 API，无需额外依赖 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(order.qrCode)}`}
                  alt="WeChat Pay QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-sm font-light text-gray-500">
                <svg className="animate-spin w-4 h-4 text-[#2C5530]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('checkout.waitingForPayment')}
              </div>
            </div>
          )}

          {/* 支付成功 */}
          {status === 'success' && (
            <div className="bg-white rounded-xl border border-[#2C5530] p-8 text-center">
              <div className="w-16 h-16 bg-[#2C5530] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-light text-gray-800 mb-2">
                {t('checkout.paymentSuccess')}
              </h2>
              <p className="text-sm font-light text-gray-400">
                {t('checkout.redirecting')}
              </p>
            </div>
          )}

          {/* 支付失败 */}
          {status === 'failed' && (
            <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
              <h2 className="text-xl font-light text-gray-800 mb-2">
                {t('checkout.paymentFailed')}
              </h2>
              <p className="text-sm font-light text-gray-400 mb-4">
                {t('checkout.paymentFailedHint')}
              </p>
              <button
                onClick={() => {
                  setStatus('idle');
                  setOrder(null);
                }}
                className="px-6 py-2 bg-[#2C5530] text-white rounded-lg font-light text-sm hover:bg-[#234426] transition-colors"
              >
                {t('checkout.retry')}
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center">
          <p className="text-gray-400 font-light">Loading...</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
