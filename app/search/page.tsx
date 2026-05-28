/**
 * 搜索结果页 - MUJI 风格
 * /search?q=xxx
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FavoriteButton from '@/components/book/FavoriteButton';

interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  cover_url?: string;
  category?: string;
  favorite_count?: number;
}

interface Character {
  id: string;
  name: string;
  description?: string;
  book_title?: string;
  book_id?: string;
}

interface SearchResponse {
  query: string;
  intent?: string;
  books: Book[];
  characters: Character[];
  suggestions?: string[];
}

function SearchPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') || '';

  const [input, setInput] = useState(q);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState('');
  const [favoritedBookIds, setFavoritedBookIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    setError('');
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`搜索失败 (${r.status})`);
        return r.json();
      })
      .then((d: SearchResponse) => setData(d))
      .catch((e: any) => setError(e.message || '搜索失败'))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    // 获取已收藏书籍
    fetch('/api/user/favorites')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.favorites) {
          setFavoritedBookIds(new Set(d.favorites.map((f: any) => f.book_id)));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    router.push(`/search?q=${encodeURIComponent(input.trim())}`);
  };

  const hasNoResults =
    data && data.books.length === 0 && data.characters.length === 0;

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
        {/* 搜索框 */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="relative max-w-3xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="搜索书名、作者或主题…"
              className="w-full px-6 py-4 pr-32 bg-white border border-gray-200 rounded-lg
                         font-light text-base focus:outline-none focus:border-[#2C5530]
                         transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2
                         bg-[#2C5530] text-white text-sm font-light rounded-md
                         hover:bg-[#234426] disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              搜索
            </button>
          </div>
          {q && (
            <p className="mt-4 text-center text-sm font-light text-gray-500">
              当前搜索：<span className="text-gray-700">{q}</span>
            </p>
          )}
        </form>

        {/* 状态 */}
        {loading && (
          <div className="text-center py-20 font-light text-gray-500">
            搜索中…
          </div>
        )}
        {error && (
          <div className="text-center py-20 font-light text-red-500">
            {error}
          </div>
        )}

        {/* 无结果 + 引导申请 */}
        {!loading && hasNoResults && (
          <div className="max-w-2xl mx-auto bg-white rounded-lg p-10 text-center
                          border border-gray-200">
            <p className="text-lg font-light text-gray-700 mb-3">
              没有找到 "{q}" 相关的书或角色
            </p>
            <p className="text-sm font-light text-gray-500 mb-8 leading-relaxed">
              别担心 — 你可以直接申请添加这本书。<br />
              如果 AI 认识它，会立刻为你创建并加入书库；如果还不认识，会进入许愿池等待上架。
            </p>
            <Link
              href={`/request-book?title=${encodeURIComponent(q)}`}
              className="inline-block px-8 py-3 bg-[#2C5530] text-white text-sm
                         font-light rounded-md hover:bg-[#234426] transition-colors"
            >
              📝 申请添加这本书
            </Link>
            {data?.suggestions && data.suggestions.length > 0 && (
              <div className="mt-10 pt-8 border-t border-gray-100">
                <p className="text-xs font-light text-gray-400 mb-3">或试试其他关键词</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {data.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(s);
                        router.push(`/search?q=${encodeURIComponent(s)}`);
                      }}
                      className="px-4 py-1.5 bg-gray-50 text-gray-600 text-xs
                                 font-light rounded-full hover:bg-gray-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 书籍结果 */}
        {!loading && data && data.books.length > 0 && (
          <section className="mb-12">
            <h2 className="text-lg font-light text-gray-800 mb-6">
              相关书籍（{data.books.length}）
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data.books.map((book) => (
                <div
                  key={book.id}
                  onClick={() => router.push(`/books/${book.id}`)}
                  className="bg-white rounded-lg overflow-hidden cursor-pointer
                             hover:shadow-lg transition-all group relative"
                >
                  {book.cover_url ? (
                    <div className="aspect-[3/4] bg-gray-200 overflow-hidden">
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[3/4] bg-gradient-to-br from-[#2C5530] to-[#234426]
                                  flex items-center justify-center">
                      <span className="text-white text-2xl font-light opacity-20">书</span>
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-light text-sm text-gray-800 mb-0.5 line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="font-light text-xs text-gray-500 mb-2">
                      {book.author}
                    </p>
                    <div onClick={(e) => e.stopPropagation()}>
                      <FavoriteButton
                        bookId={book.id}
                        initialFavorited={favoritedBookIds.has(book.id)}
                        showCount={true}
                        favoriteCount={book.favorite_count}
                        size="sm"
                        onToggle={(favorited) => {
                          setFavoritedBookIds((prev) => {
                            const ns = new Set(prev);
                            if (favorited) ns.add(book.id);
                            else ns.delete(book.id);
                            return ns;
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 角色结果 */}
        {!loading && data && data.characters.length > 0 && (
          <section className="mb-12">
            <h2 className="text-lg font-light text-gray-800 mb-6">
              相关角色（{data.characters.length}）
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.characters.map((char) => (
                <div
                  key={char.id}
                  onClick={() => router.push(`/characters/${char.id}`)}
                  className="bg-white rounded-lg p-5 cursor-pointer
                             hover:shadow-md transition-all border border-gray-100"
                >
                  <h3 className="font-light text-base text-gray-800 mb-1">
                    {char.name}
                  </h3>
                  {char.book_title && (
                    <p className="font-light text-xs text-gray-500 mb-3">
                      来自《{char.book_title}》
                    </p>
                  )}
                  {char.description && (
                    <p className="font-light text-sm text-gray-600 line-clamp-3">
                      {char.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 即便有结果，也在底部加一个温和的"申请"入口 */}
        {!loading && data && !hasNoResults && (
          <div className="text-center mt-12 pt-8 border-t border-gray-100">
            <p className="text-sm font-light text-gray-500">
              没找到你想要的？{' '}
              <Link
                href={`/request-book?title=${encodeURIComponent(q)}`}
                className="text-[#2C5530] hover:underline"
              >
                📝 申请添加这本书
              </Link>
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center font-light text-gray-500">
          加载中…
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
