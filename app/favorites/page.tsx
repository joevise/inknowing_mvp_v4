/**
 * 我的收藏页面 - MUJI风格
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FavoriteButton from '@/components/book/FavoriteButton';

interface FavoriteBook {
  id: string;
  book_id: string;
  created_at: string;
  book: {
    id: string;
    title: string;
    author: string;
    description: string;
    cover_url: string;
    category: string;
  };
}

export default function FavoritesPage() {
  const router = useRouter();
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteBook[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    setLoading(true);
    setError('');

    try {
      // 检查登录状态
      const authResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!authResponse.ok) {
        router.push('/auth/login');
        return;
      }

      // 获取收藏列表
      const favoritesResponse = await fetch('/api/favorites', {
        credentials: 'include',
      });

      if (!favoritesResponse.ok) {
        throw new Error(t('favorites.errorFetchFailed'));
      }

      const data = await favoritesResponse.json();
      setFavorites(data.favorites || []);

      console.log('[Favorites] 获取收藏列表:', data.favorites);
    } catch (err) {
      console.error('[Favorites] 获取失败:', err);
      setError(err instanceof Error ? err.message : t('favorites.errorFetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = () => {
    // 刷新列表
    fetchFavorites();
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* 页面标题区域 */}
        <section className="py-12 px-6 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-light text-gray-800 mb-2">{t('favorites.title')}</h1>
            <p className="text-base font-light text-gray-600">
              {t('favorites.subtitle')}
            </p>
          </div>
        </section>

        {/* 收藏列表区域 */}
        <section className="py-12 px-6">
          <div className="max-w-7xl mx-auto">
            {/* 错误提示 */}
            {error && (
              <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg font-light text-sm">
                {error}
              </div>
            )}

            {/* 加载状态 */}
            {loading && (
              <div className="text-center py-20">
                <div className="text-gray-400 font-light">{t('common.loading')}</div>
              </div>
            )}

            {/* 收藏书籍网格 */}
            {!loading && favorites.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    onClick={() => router.push(`/books/${fav.book.id}`)}
                    className="bg-white rounded-lg overflow-hidden cursor-pointer
                             hover:shadow-lg transition-all group relative"
                  >
                    {/* 封面 */}
                    {fav.book.cover_url ? (
                      <div className="aspect-[3/4] bg-gray-200 overflow-hidden">
                        <img
                          src={fav.book.cover_url}
                          alt={fav.book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[3/4] bg-gradient-to-br from-[#2C5530] to-[#234426]
                                    flex items-center justify-center">
                        <span className="text-white text-2xl font-light opacity-20">{t('favorites.placeholderCover')}</span>
                      </div>
                    )}

                    {/* 信息 */}
                    <div className="p-3">
                      <h3 className="font-light text-sm text-gray-800 mb-0.5 line-clamp-2">
                        {fav.book.title}
                      </h3>
                      <p className="font-light text-xs text-gray-500 mb-2">
                        {fav.book.author}
                      </p>
                      {/* 收藏按钮 */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <FavoriteButton
                          bookId={fav.book.id}
                          initialFavorited={true}
                          showCount={false}
                          size="sm"
                          onToggle={(favorited) => {
                            if (!favorited) {
                              handleRemoveFavorite();
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 无收藏 */}
            {!loading && favorites.length === 0 && (
              <div className="text-center py-20">
                <div className="text-gray-400 font-light mb-4">
                  {t('favorites.empty')}
                </div>
                <button
                  onClick={() => router.push('/books')}
                  className="px-6 py-2 bg-[#2C5530] text-white rounded-lg
                           font-light text-sm hover:bg-[#234426] transition-colors"
                >
                  {t('favorites.browseBooks')}
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
