/**
 * 套餐简览组件 — MUJI 风格三列卡片
 * 用于首页展示
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

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

export default function PricingSection() {
  const t = useTranslations();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    fetch('/api/plans')
      .then((res) => res.json())
      .then((data) => {
        setPlans(data.plans || []);
      })
      .catch(() => {
        // 静默失败，套餐区域不显示即可
      });
  }, []);

  if (plans.length === 0) return null;

  // 计算年度节省金额（年价 vs 月价×12）
  const monthlyPlan = plans.find((p) => p.billingCycle === 'monthly');
  const yearlyPlan = plans.find((p) => p.billingCycle === 'yearly');
  const yearlySave =
    monthlyPlan && yearlyPlan
      ? monthlyPlan.priceCents * 12 - yearlyPlan.priceCents
      : 0;

  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-xl md:text-2xl font-light text-gray-800 mb-2">
            {t('pricing.sectionTitle')}
          </h2>
          <p className="text-sm font-light text-gray-500">
            {t('pricing.sectionSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isYearly = plan.billingCycle === 'yearly';
            const isFree = plan.priceCents === 0;
            const isPopular = plan.billingCycle === 'monthly' || plan.billingCycle === 'yearly';

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl p-6 transition-shadow hover:shadow-md ${
                  isPopular
                    ? 'border-2 border-[#2C5530] bg-[#FAF9F7]'
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

                {/* 套餐名称 */}
                <h3 className="text-lg font-light text-gray-800 text-center mb-1">
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className="text-xs font-light text-gray-400 text-center mb-4">
                    {plan.description}
                  </p>
                )}

                {/* 价格 */}
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

                {/* 核心功能列表 */}
                <ul className="space-y-2 mb-6 min-h-[120px]">
                  {getFeatureList(plan, t).map((feat, i) => (
                    <li
                      key={i}
                      className="flex items-center text-sm font-light text-gray-600"
                    >
                      <span className="mr-2 flex-shrink-0">
                        {feat.included ? (
                          <svg className="w-4 h-4 text-[#2C5530]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </span>
                      {feat.label}
                    </li>
                  ))}
                </ul>

                {/* 按钮 */}
                <Link
                  href="/pricing"
                  className={`block w-full py-2.5 text-center rounded-lg font-light text-sm transition-all ${
                    isFree
                      ? 'border border-gray-300 text-gray-600 hover:border-[#2C5530] hover:text-[#2C5530]'
                      : 'bg-[#2C5530] text-white hover:bg-[#234426]'
                  }`}
                >
                  {t('pricing.choose')}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * 从 plan features 提取展示列表
 */
function getFeatureList(plan: Plan, t: any) {
  const featureKeys = [
    'daily_messages',
    'max_characters',
    'premium_books',
    'custom_characters',
    'multilingual',
    'advanced_model',
  ];

  return featureKeys.map((key) => {
    const val = plan.features[key];
    if (val === undefined || val === null) {
      // 默认值：免费版有基础功能，付费版都有
      if (key === 'daily_messages') {
        return { label: `${t(`pricing.features.${key}`)}`, included: true };
      }
      return { label: t(`pricing.features.${key}`), included: plan.priceCents > 0 };
    }

    // 值为 "0" 或 "false" 表示不含此功能
    if (val === '0' || val === 'false' || val === '-1') {
      return { label: t(`pricing.features.${key}`), included: false };
    }

    // 值为 "-1" 表示无限
    if (val === '-1') {
      return { label: `${t(`pricing.features.${key}`)} (${t('pricing.unlimited')})`, included: true };
    }

    // 有具体值
    return { label: `${t(`pricing.features.${key}`)}: ${val}`, included: true };
  });
}
