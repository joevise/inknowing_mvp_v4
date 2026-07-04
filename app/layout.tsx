import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { BookLanguageProvider } from '@/components/i18n/BookLanguageContext';
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    keywords: t('meta.keywords'),
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className={`${inter.className} bg-background text-text-primary`}>
        <NextIntlClientProvider messages={messages}>
          <BookLanguageProvider>
            {children}
          </BookLanguageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
