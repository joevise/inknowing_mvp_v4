/**
 * 我申请上架的书籍 - 独立页面（MUJI 风格）
 * /my-requests
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  created: { text: '已上架', cls: 'bg-green-100 text-green-700' },
  wishlist: { text: '许愿池', cls: 'bg-yellow-100 text-yellow-700' },
  pending: { text: '等待中', cls: 'bg-blue-100 text-blue-700' },
  processing: { text: '处理中', cls: 'bg-blue-100 text-blue-700' },
  rejected: { text: '已拒绝', cls: 'bg-red-100 text-red-700' },
  failed: { text: '失败', cls: 'bg-red-100 text-red-700' },
};

export default function MyRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/user/my-requests');
        if (res.status === 401) {
          router.push('/auth/login?redirect=/my-requests');
          return;
        }
        if (!res.ok) throw new Error(`加载失败 (${res.status})`);
        const d = await res.json();
        if (alive) setRequests(d.requests || []);
      } catch (e: any) {
        if (alive) setError(e.message || '加载失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light text-gray-800">我的申请</h1>
            <p className="mt-2 text-sm font-light text-gray-500">
              你申请添加的书籍 — AI 认识的会直接上架，不认识的进入许愿池
            </p>
          </div>
          <Link
            href="/request-book"
            className="px-5 py-2.5 bg-[#2C5530] text-white text-sm font-light rounded-md
                       hover:bg-[#234426] transition-colors whitespace-nowrap"
          >
            ➕ 添加一本书
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          {loading ? (
            <div className="text-center py-16 font-light text-gray-400">加载中…</div>
          ) : error ? (
            <div className="text-center py-16 font-light text-red-500">{error}</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-light text-gray-400 mb-4">你还没有申请过任何书籍</p>
              <Link
                href="/request-book"
                className="text-[#2C5530] hover:underline font-light text-sm"
              >
                去添加一本 →
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
                        {req.author && <span>作者：{req.author}</span>}
                        <span>
                          申请时间：
                          {new Date(req.created_at).toLocaleDateString('zh-CN')}
                        </span>
                        {req.ai_confidence != null && (
                          <span>
                            置信度：{Math.round(req.ai_confidence * 100)}%
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
                          查看
                        </Link>
                      )}
                      {req.status === 'wishlist' && (
                        <span className="text-xs font-light text-gray-400">
                          等待处理
                        </span>
                      )}
                      {(req.status === 'pending' ||
                        req.status === 'processing') && (
                        <span className="text-xs font-light text-blue-500">
                          请稍候…
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
