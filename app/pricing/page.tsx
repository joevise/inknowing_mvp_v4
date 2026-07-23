/**
 * 套餐详情页 /pricing
 * MUJI 风格：简洁对比表格
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface Plan {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  priceCents: number;
  currency: string;
  billingCycle: string;
  features: Record<string, string>;
}

interface UserSession {
  user: { id: string; username: string; email: string };
}

export default function PricingPage() {
  const t = useTranslations();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/plans').then((r) => r.json()),
      fetch('/api/auth/me', { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([plansData, authData]) => {
        setPlans(plansData.plans || []);
        if (authData?.user) {
          setUser(authData);
          // 获取当前订阅
          fetch('/api/subscription/current', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((subData) => {
              if (subData?.plan) {
                setCurrentPlanId(subData.plan.id);
              }
            })
            .catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // 功能对比行定义
  const featureRows: { key: string; label: string }[] = [
    { key: 'daily_messages', label: t('pricing.features.daily_messages') },
    { key: 'max_characters', label: t('pricing.features.max_characters') },
    { key: 'premium_books', label: t('pricing.features.premium_books') },
    { key: 'custom_characters', label: t('pricing.features.custom_characters') },
    { key: 'multilingual', label: t('pricing.features.multilingual') },
    { key: 'advanced_model', label: t('pricing.features.advanced_model') },
  ];

  function getFeatureDisplay(plan: Plan, featureKey: string): string {
    const val = plan.features[featureKey];
    if (val === undefined || val === null) {
      // 默认值
      if (plan.priceCents === 0) {
        if (featureKey === 'daily_messages') return '10';
        if (featureKey === 'max_characters') return '1';
        return '—';
      }
      return featureKey === 'daily_messages' || featureKey === 'max_characters'
        ? t('pricing.unlimited')
        : '✓';
    }
    if (val === '0' || val === 'false') return '—';
    if (val === '-1') return t('pricing.unlimited');
    return val;
  }

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

  // 计算年度节省
  const monthlyPlan = plans.find((p) => p.billingCycle === 'monthly');
  const yearlyPlan = plans.find((p) => p.billingCycle === 'yearly');
  const yearlySave =
    monthlyPlan && yearlyPlan
      ? monthlyPlan.priceCents * 12 - yearlyPlan.priceCents
      : 0;

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* 页面标题 */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl md:text-3xl font-light text-[#2C5530] mb-3">
              {t('pricing.pageTitle')}
            </h1>
            <p className="text-sm font-light text-gray-500 max-w-2xl mx-auto">
              {t('pricing.pageSubtitle')}
            </p>
          </div>
        </section>

        {/* 套餐卡片 */}
        <section className="px-6 pb-12">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const isFree = plan.priceCents === 0;
                const isYearly = plan.billingCycle === 'yearly';
                const isCurrent = plan.id === currentPlanId;

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-xl p-6 ${
                      !isFree
                        ? 'border-2 border-[#2C5530] bg-white'
                        : 'border border-gray-200 bg-white'
                    }`}
                  >
                    {isYearly && yearlySave > 0 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-[#2C5530] text-white text-xs font-light px-3 py-1 rounded-full">
                          {t('pricing.save', { amount: `¥${(yearlySave / 100).toFixed(0)}` })}
                        </span>
                      </div>
                    )}

                    {isCurrent && (
                      <div className="absolute -top-3 right-3">
                        <span className="bg-gray-600 text-white text-xs font-light px-3 py-1 rounded-full">
                          {t('pricing.currentPlan')}
                        </span>
                      </div>
                    )}

                    <h3 className="text-lg font-light text-gray-800 text-center mb-1">
                      {plan.name}
                    </h3>
                    {plan.description && (
                      <p className="text-xs font-light text-gray-400 text-center mb-4">
                        {plan.description}
                      </p>
                    )}

                    <div className="text-center mb-6">
                      {isFree ? (
                        <span className="text-3xl font-light text-[#2C5530]">
                          {t('pricing.free')}
                        </span>
                      ) : (
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-3xl font-light text-[#2C5530]">
                            ¥{(plan.priceCents / 100).toFixed(0)}
                          </span>
                          <span className="text-sm font-light text-gray-400">
                            / {t(`pricing.cycle.${plan.billingCycle}`)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CTA 按钮 */}
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-lg font-light text-sm bg-gray-100 text-gray-400 cursor-default"
                      >
                        {t('pricing.currentPlan')}
                      </button>
                    ) : isFree ? (
                      <Link
                        href={user ? '/dashboard' : '/auth/register'}
                        className="block w-full py-2.5 text-center rounded-lg font-light text-sm border border-gray-300 text-gray-600 hover:border-[#2C5530] hover:text-[#2C5530] transition-all"
                      >
                        {user ? t('pricing.useFree') : t('pricing.startFree')}
                      </Link>
                    ) : (
                      <Link
                        href={user ? `/checkout?plan=${plan.id}` : '/auth/register'}
                        className="block w-full py-2.5 text-center rounded-lg font-light text-sm bg-[#2C5530] text-white hover:bg-[#234426] transition-all"
                      >
                        {user ? t('pricing.upgrade') : t('pricing.startUsing')}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 功能对比表格 */}
        <section className="px-6 pb-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-light text-gray-800 mb-6 text-center">
              {t('pricing.comparisonTitle')}
            </h2>

            {/* 桌面端表格 */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAF9F7]">
                    <th className="text-left px-6 py-4 font-light text-sm text-gray-600">
                      {t('pricing.feature')}
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className="text-center px-6 py-4 font-light text-sm text-gray-800"
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row, idx) => (
                    <tr
                      key={row.key}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                    >
                      <td className="px-6 py-3 font-light text-sm text-gray-600">
                        {row.label}
                      </td>
                      {plans.map((plan) => (
                        <td
                          key={plan.id}
                          className="text-center px-6 py-3 font-light text-sm text-gray-700"
                        >
                          {getFeatureDisplay(plan, row.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端列表 */}
            <div className="md:hidden space-y-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-gray-200 p-5 bg-white"
                >
                  <h3 className="font-light text-base text-gray-800 mb-3">
                    {plan.name}
                  </h3>
                  <dl className="space-y-2">
                    {featureRows.map((row) => (
                      <div
                        key={row.key}
                        className="flex justify-between items-center"
                      >
                        <dt className="font-light text-xs text-gray-500">
                          {row.label}
                        </dt>
                        <dd className="font-light text-sm text-gray-700">
                          {getFeatureDisplay(plan, row.key)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ 简易 */}
        <section className="px-6 pb-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-light text-gray-400">
              {t('pricing.faqHint')}
            </p>
            <Link
              href="/about"
              className="text-sm font-light text-[#2C5530] hover:underline mt-2 inline-block"
            >
              {t('pricing.learnMore')}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
