/**
 * 关于知应页面 - 介绍InKnowing的理念和愿景
 */

import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default async function AboutPage() {
  const t = await getTranslations();

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero区域 */}
        <section className="py-20 px-6 bg-gradient-to-br from-[#2C5530] to-[#234426] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-light mb-6">
              {t('about.heroTitle')}
            </h1>
            <p className="text-lg md:text-xl font-light opacity-90 leading-relaxed">
              {t('about.heroSubtitle')}
            </p>
          </div>
        </section>

        {/* 我们的理念 */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-light text-gray-800 mb-8 text-center">{t('about.philosophyTitle')}</h2>

            <div className="space-y-8">
              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
                <h3 className="text-xl font-light text-[#2C5530] mb-4">{t('about.philosophyItem1Title')}</h3>
                <p className="font-light text-gray-600 leading-relaxed">
                  {t('about.philosophyItem1Body')}
                </p>
              </div>

              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
                <h3 className="text-xl font-light text-[#2C5530] mb-4">{t('about.philosophyItem2Title')}</h3>
                <p className="font-light text-gray-600 leading-relaxed">
                  {t('about.philosophyItem2Body')}
                </p>
              </div>

              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
                <h3 className="text-xl font-light text-[#2C5530] mb-4">{t('about.philosophyItem3Title')}</h3>
                <p className="font-light text-gray-600 leading-relaxed">
                  {t('about.philosophyItem3Body')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 我们的使命 */}
        <section className="py-16 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-light text-gray-800 mb-8 text-center">{t('about.missionTitle')}</h2>

            <div className="prose prose-lg max-w-none">
              <p className="font-light text-gray-600 leading-relaxed text-center mb-8">
                {t('about.missionIntro')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-[#2C5530] rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">📚</span>
                  </div>
                  <h3 className="font-light text-lg text-gray-800 mb-3">{t('about.missionItem1Title')}</h3>
                  <p className="font-light text-sm text-gray-600">
                    {t('about.missionItem1Body')}
                  </p>
                </div>

                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-[#2C5530] rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">🤝</span>
                  </div>
                  <h3 className="font-light text-lg text-gray-800 mb-3">{t('about.missionItem2Title')}</h3>
                  <p className="font-light text-sm text-gray-600">
                    {t('about.missionItem2Body')}
                  </p>
                </div>

                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-[#2C5530] rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">✨</span>
                  </div>
                  <h3 className="font-light text-lg text-gray-800 mb-3">{t('about.missionItem3Title')}</h3>
                  <p className="font-light text-sm text-gray-600">
                    {t('about.missionItem3Body')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 技术特色 */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-light text-gray-800 mb-8 text-center">{t('about.techTitle')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAF9F7] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <div>
                    <h3 className="font-light text-base text-gray-800 mb-2">{t('about.techItem1Title')}</h3>
                    <p className="font-light text-sm text-gray-600">
                      {t('about.techItem1Body')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAF9F7] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div>
                    <h3 className="font-light text-base text-gray-800 mb-2">{t('about.techItem2Title')}</h3>
                    <p className="font-light text-sm text-gray-600">
                      {t('about.techItem2Body')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAF9F7] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <div>
                    <h3 className="font-light text-base text-gray-800 mb-2">{t('about.techItem3Title')}</h3>
                    <p className="font-light text-sm text-gray-600">
                      {t('about.techItem3Body')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAF9F7] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">💾</span>
                  </div>
                  <div>
                    <h3 className="font-light text-base text-gray-800 mb-2">{t('about.techItem4Title')}</h3>
                    <p className="font-light text-sm text-gray-600">
                      {t('about.techItem4Body')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA区域 */}
        <section className="py-20 px-6 bg-gradient-to-br from-[#2C5530] to-[#234426] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-light mb-6">
              {t('about.ctaTitle')}
            </h2>
            <p className="text-lg font-light opacity-90 mb-8">
              {t('about.ctaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/books"
                className="px-8 py-3 bg-white text-[#2C5530] rounded-lg font-light hover:bg-gray-100 transition-colors"
              >
                {t('about.ctaBrowseBooks')}
              </a>
              <a
                href="/auth/register"
                className="px-8 py-3 bg-white/10 text-white border border-white rounded-lg font-light hover:bg-white/20 transition-colors"
              >
                {t('about.ctaRegister')}
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
