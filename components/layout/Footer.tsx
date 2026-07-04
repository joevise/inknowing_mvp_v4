'use client';

import { useTranslations } from 'next-intl';

/**
 * 统一的页面底部组件
 * MUJI风格：简洁、细字体
 * 注：本组件被 client 页面(如首页)引用，故用 useTranslations(client)而非 getTranslations(server)
 */
export default function Footer() {
  const t = useTranslations();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#FAF9F7] border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* 关于 */}
          <div>
            <h3 className="font-light text-sm text-gray-800 mb-4">{t('footer.aboutTitle')}</h3>
            <p className="font-light text-xs text-gray-600 leading-relaxed">
              {t('footer.aboutDescription')}
            </p>
          </div>

          {/* 快速链接 */}
          <div>
            <h3 className="font-light text-sm text-gray-800 mb-4">{t('footer.quickLinksTitle')}</h3>
            <ul className="space-y-2">
              <li>
                <a href="/about" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.aboutLink')}
                </a>
              </li>
              <li>
                <a href="/books" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.browseBooksLink')}
                </a>
              </li>
              <li>
                <a href="/characters" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.popularCharactersLink')}
                </a>
              </li>
              <li>
                <a href="/auth/login" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.signInLink')}
                </a>
              </li>
            </ul>
          </div>

          {/* 帮助与支持 */}
          <div>
            <h3 className="font-light text-sm text-gray-800 mb-4">{t('footer.helpTitle')}</h3>
            <ul className="space-y-2">
              <li>
                <a href="/help" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.userGuide')}
                </a>
              </li>
              <li>
                <a href="/faq" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.faq')}
                </a>
              </li>
              <li>
                <a href="/contact" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.contactUs')}
                </a>
              </li>
            </ul>
          </div>

          {/* 法律信息 */}
          <div>
            <h3 className="font-light text-sm text-gray-800 mb-4">{t('footer.legalTitle')}</h3>
            <ul className="space-y-2">
              <li>
                <a href="/terms" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.terms')}
                </a>
              </li>
              <li>
                <a href="/privacy" className="font-light text-xs text-gray-600 hover:text-[#2C5530] transition-colors">
                  {t('footer.privacy')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="pt-8 border-t border-gray-200 text-center">
          <p className="font-light text-xs text-gray-500">
            {t('footer.copyright', { year: currentYear })}
          </p>
          <p className="font-light text-xs text-gray-400 mt-2">
            {t('footer.tagline')}
          </p>
        </div>
      </div>
    </footer>
  );
}
