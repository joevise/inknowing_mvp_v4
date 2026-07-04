'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const LOCALE_OPTIONS = [
  { value: 'zh', labelKey: 'language.zh' },
  { value: 'en', labelKey: 'language.en' },
] as const;

export default function LanguageSwitcher() {
  const currentLocale = useLocale();
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSelect = async (locale: 'zh' | 'en') => {
    if (locale === currentLocale) {
      setOpen(false);
      return;
    }
    setOpen(false);
    const res = await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    });
    if (res.ok) {
      startTransition(() => {
        router.refresh();
      });
    }
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
    </div>
  );
}