/**
 * 申请上架书籍页面 (MUJI风格)
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface SubmitResult {
  status: 'success' | 'created' | 'wishlist' | 'already_exists' | 'request_exists' | 'pending' | 'processing';
  request_id?: string;
  book_id?: string;
  message: string;
}

export default function RequestBookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#faf9f7]" />}>
      <RequestBookPageInner />
    </Suspense>
  );
}

function RequestBookPageInner() {
  const router = useRouter();
  const t = useTranslations();
  const params = useSearchParams();
  const presetTitle = params.get('title') || '';
  const [title, setTitle] = useState(presetTitle);
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        setIsLoggedIn(false);
      }
    } catch {
      setIsLoggedIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError(t('requestBook.errorTitleRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/books/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        setIsLoggedIn(false);
        return;
      }

      if (!response.ok) {
        setError(data.message || t('requestBook.errorSubmitFailed'));
        return;
      }

      setResult({
        status: data.status,
        request_id: data.request_id,
        book_id: data.book_id,
        message: data.message,
      });

      if (data.status === 'created' && data.book_id) {
        setTimeout(() => {
          router.push(`/books/${data.book_id}`);
        }, 2000);
      }
    } catch (err) {
      console.error('[RequestBook] 提交失败:', err);
      setError(t('requestBook.errorNetwork'));
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-light text-gray-800 mb-4">{t('requestBook.pleaseLoginTitle')}</h2>
            <p className="text-gray-600 font-light mb-6">{t('requestBook.pleaseLoginSubtitle')}</p>
            <Link
              href="/auth/login"
              className="inline-block px-6 py-3 bg-[#2C5530] text-white rounded-lg hover:bg-[#234426] transition-colors font-light"
            >
              {t('requestBook.goLogin')}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* 页面标题区域 */}
        <section className="py-12 px-6 bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-light text-gray-800 mb-2">{t('requestBook.title')}</h1>
            <p className="text-base font-light text-gray-600">
              {t('requestBook.subtitle')}
            </p>
          </div>
        </section>

        {/* 表单区域 */}
        <section className="py-12 px-6">
          <div className="max-w-xl mx-auto">
            {/* 错误提示 */}
            {error && (
              <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg font-light text-sm">
                {error}
              </div>
            )}

            {/* 成功提示 */}
            {result && (
              <div className="mb-6 bg-[#2C5530]/10 text-[#2C5530] px-4 py-3 rounded-lg font-light text-sm">
                <div className="flex items-start gap-2">
                  <span>
                    {result.status === 'created' && '✓ '}
                    {result.status === 'wishlist' && '📝 '}
                    {result.status === 'already_exists' && '📚 '}
                    {result.status === 'request_exists' && '⏳ '}
                  </span>
                  <div>
                    <p className="font-medium">{result.message}</p>
                    {result.status === 'created' && result.book_id && (
                      <p className="text-xs mt-1 opacity-70">{t('requestBook.resultCreatedHint')}</p>
                    )}
                    {result.status === 'wishlist' && (
                      <p className="text-xs mt-1 opacity-70">{t('requestBook.resultWishlistHint')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 申请表单 */}
            {!result && (
              <div className="bg-white rounded-lg p-8">
                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="title" className="block text-sm font-light text-gray-600 mb-2">
                        {t('requestBook.titleLabel')} <span className="text-red-500">{t('requestBook.titleRequired')}</span>
                      </label>
                      <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('requestBook.titlePlaceholder')}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors font-light"
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label htmlFor="author" className="block text-sm font-light text-gray-600 mb-2">
                        {t('requestBook.authorLabel')} <span className="text-gray-400">{t('requestBook.authorOptional')}</span>
                      </label>
                      <input
                        type="text"
                        id="author"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder={t('requestBook.authorPlaceholder')}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors font-light"
                        disabled={loading}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={loading || !title.trim()}
                        className="w-full py-3 bg-[#2C5530] text-white rounded-lg
                                 font-light text-sm hover:bg-[#234426] transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? t('requestBook.submitting') : t('requestBook.submitButton')}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-light text-gray-600 mb-3">{t('requestBook.tipsTitle')}</h3>
                  <ul className="text-xs font-light text-gray-400 space-y-2">
                    <li>• {t('requestBook.tip1')}</li>
                    <li>• {t('requestBook.tip2')}</li>
                    <li>• {t('requestBook.tip3')}</li>
                    <li>• {t('requestBook.tip4')}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 返回链接 */}
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-sm font-light text-gray-500 hover:text-[#2C5530] transition-colors"
              >
                {t('requestBook.backHome')}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
