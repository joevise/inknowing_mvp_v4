/**
 * 我申请上架的书籍 - 独立页面（MUJI 风格）
 * /my-requests
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface BookRequest {
  id: string;
  title: string;
  author?: string;
  status: 'pending' | 'processing' | 'created' | 'wishlist' | 'rejected' | 'failed';
  book_id?: string;
  ai_confidence?: number;
  error_message?: string;
  created_at: string;
}

type StatusClass = {
  text: string;
  cls: string;
};

export default function MyRequestsPage() {
  const router = useRouter();
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [error, setError] = useState('');

  const STATUS_LABEL: Record<string, StatusClass> = {
    created: { text: t('myRequests.statusCreated'), cls: 'bg-green-100 text-green-700' },
    wishlist: { text: t('myRequests.statusWishlist'), cls: 'bg-yellow-100 text-yellow-700' },
    pending: { text: t('myRequests.statusPending'), cls: 'bg-blue-100 text-blue-700' },
    processing: { text: t('myRequests.statusProcessing'), cls: 'bg-blue-100 text-blue-700' },
    rejected: { text: t('myRequests.statusRejected'), cls: 'bg-red-100 text-red-700' },
    failed: { text: t('myRequests.statusFailed'), cls: 'bg-red-100 text-red-700' },
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/user/my-requests');
        if (res.status === 401) {
          router.push('/auth/login?redirect=/my-requests');
          return;
        }
        if (!res.ok) throw new Error(t('myRequests.errorLoadFailed'));
        const d = await res.json();
        if (alive) setRequests(d.requests || []);
      } catch (e: any) {
        if (alive) setError(e.message || t('myRequests.errorLoadFailed'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light text-gray-800">{t('myRequests.title')}</h1>
            <p className="mt-2 text-sm font-light text-gray-500">
              {t('myRequests.subtitle')}
            </p>
          </div>
          <Link
            href="/request-book"
            className="px-5 py-2.5 bg-[#2C5530] text-white text-sm font-light rounded-md
                       hover:bg-[#234426] transition-colors whitespace-nowrap"
          >
            {t('myRequests.addBook')}
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          {loading ? (
            <div className="text-center py-16 font-light text-gray-400">{t('myRequests.loading')}</div>
          ) : error ? (
            <div className="text-center py-16 font-light text-red-500">{error}</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-light text-gray-400 mb-4">{t('myRequests.noRequests')}</p>
              <Link
                href="/request-book"
                className="text-[#2C5530] hover:underline font-light text-sm"
              >
                {t('myRequests.goAddBook')}
              </Link>
            </div>
          ) : (
            <div>
              {requests.map((req) => {
                const label = STATUS_LABEL[req.status] || {
                  text: req.status,
                  cls: 'bg-gray-100 text-gray-700',
                };
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between px-8 py-5
                               border-b border-gray-100 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="font-light text-base text-gray-800 truncate">
                          {req.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-light ${label.cls}`}
                        >
                          {label.text}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-light text-gray-400">
                        {req.author && <span>{t('myRequests.fieldAuthor', { author: req.author })}</span>}
                        <span>
                          {t('myRequests.fieldSubmittedAt', {
                            date: new Date(req.created_at).toLocaleDateString('zh-CN')
                          })}
                        </span>
                        {req.ai_confidence != null && (
                          <span>
                            {t('myRequests.fieldConfidence', {
                              percent: Math.round(req.ai_confidence * 100)
                            })}
                          </span>
                        )}
                      </div>
                      {req.error_message && (
                        <p className="text-xs font-light text-red-500 mt-1.5">
                          {req.error_message}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 shrink-0">
                      {req.status === 'created' && req.book_id && (
                        <Link
                          href={`/books/${req.book_id}`}
                          className="px-4 py-2 bg-[#2C5530] text-white text-xs
                                     font-light rounded-md hover:bg-[#234426] transition-colors"
                        >
                          {t('myRequests.actionView')}
                        </Link>
                      )}
                      {req.status === 'wishlist' && (
                        <span className="text-xs font-light text-gray-400">
                          {t('myRequests.statusWishlistHint')}
                        </span>
                      )}
                      {(req.status === 'pending' ||
                        req.status === 'processing') && (
                        <span className="text-xs font-light text-blue-500">
                          {t('myRequests.statusPendingHint')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
