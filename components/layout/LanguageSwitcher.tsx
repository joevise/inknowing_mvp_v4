'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useBookLanguage } from '@/components/i18n/BookLanguageContext';

const LOCALE_OPTIONS = [
  { value: 'zh', labelKey: 'language.zh' },
  { value: 'en', labelKey: 'language.en' },
] as const;

type LocaleValue = 'zh' | 'en';

export default function LanguageSwitcher() {
  const currentLocale = useLocale();
  const t = useTranslations();
  const { languageMode } = useBookLanguage();
  const [open, setOpen] = useState(false);
  const [pendingLocale, setPendingLocale] = useState<LocaleValue | null>(null);
  const isPending = false;

  useEffect(() => {
    if (pendingLocale && currentLocale === pendingLocale) {
      setPendingLocale(null);
    }
  }, [currentLocale, pendingLocale]);

  const performSwitch = async (locale: LocaleValue) => {
    const res = await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    });
    if (res.ok) {
      // Full reload so both server- and client-side data re-fetch in the new locale
      window.location.reload();
    }
  };

  const handleSelect = async (locale: LocaleValue) => {
    if (locale === currentLocale) {
      setOpen(false);
      return;
    }

    const requiresConfirm =
      locale === 'en' &&
      currentLocale === 'zh' &&
      languageMode === 'zh_native';

    setOpen(false);

    if (requiresConfirm) {
      setPendingLocale(locale);
      return;
    }

    await performSwitch(locale);
  };

  const handleConfirm = async () => {
    if (!pendingLocale) return;
    const target = pendingLocale;
    setPendingLocale(null);
    await performSwitch(target);
  };

  const handleCancel = () => {
    setPendingLocale(null);
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="px-3 py-1.5 text-sm font-light rounded-lg border border-text-tertiary/30 bg-background text-text-primary hover:bg-background-secondary transition-colors disabled:opacity-50"
        aria-label={t('language.switchTo')}
      >
        {currentLocale === 'zh' ? t('language.zh') : t('language.en')}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-32 bg-background border border-text-tertiary/20 rounded-lg shadow-medium py-1 z-50">
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-4 py-2 text-sm font-light transition-colors ${
                currentLocale === opt.value
                  ? 'text-primary-700 bg-background-secondary'
                  : 'text-text-primary hover:bg-background-secondary'
              }`}
            >
              {t(opt.labelKey as 'language.zh' | 'language.en')}
            </button>
          ))}
        </div>
      )}

      {pendingLocale && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lang-confirm-title"
          onClick={handleCancel}
        >
          <div
            className="w-full max-w-sm bg-background rounded-lg shadow-large border border-text-tertiary/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2">
              <h2
                id="lang-confirm-title"
                className="text-lg font-normal text-text-primary"
              >
                {t('bookLangNotice.confirmTitle')}
              </h2>
            </div>
            <div className="px-6 py-3 text-sm font-light text-text-secondary leading-relaxed">
              {t('bookLangNotice.confirmBody')}
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 bg-background-secondary">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-light rounded-lg border border-text-tertiary/30 text-text-primary hover:bg-background transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-light rounded-lg bg-[#2C5530] text-white hover:bg-[#234426] transition-colors"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}