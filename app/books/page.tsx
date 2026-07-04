/**
 * 书籍列表页面 - 前台用户浏览书籍 (MUJI风格)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FavoriteButton from '@/components/book/FavoriteButton';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url?: string;
  category?: string;
  tags?: string[];
  favorite_count?: number;
}

interface BooksResponse {
  books: Book[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export default function BooksPage() {
  const router = useRouter();
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [favoritedBookIds, setFavoritedBookIds] = useState<Set<string>>(new Set());

  // 筛选状态
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 24; // 每页显示24本书

  const categories = ['文学', '商业', '科学', '心理', '哲学'];

  useEffect(() => {
    fetchBooks();
    fetchFavorites();
  }, [selectedCategory, selectedTags, page]);

  const fetchBooks = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('limit', pageSize.toString());
      params.append('offset', ((page - 1) * pageSize).toString());

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
      }

      const response = await fetch(`/api/books?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('books.errorFetchFailed'));
      }

      const data: BooksResponse = await response.json();
      setBooks(data.books);
      setTotal(data.total);

      console.log('[Books] 获取书籍列表:', data);
    } catch (err) {
      console.error('[Books] 获取失败:', err);
      setError(err instanceof Error ? err.message : t('books.errorFetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const favoritesRes = await fetch('/api/favorites', {
        credentials: 'include',
      });
      if (favoritesRes.ok) {
        const favoritesData = await favoritesRes.json();
        const bookIds = new Set<string>(
          favoritesData.favorites?.map((fav: any) => fav.book_id as string) || []
        );
        setFavoritedBookIds(bookIds);
      }
    } catch (err) {
      // 用户未登录或获取失败，忽略错误
      console.log('User not logged in or failed to fetch favorites');
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category === selectedCategory ? '' : category);
    setPage(1); // 重置到第一页
  };

  const [creatingConversation, setCreatingConversation] = useState<string | null>(null);

  const handleStartBookConversation = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation(); // 阻止冒泡到卡片点击

    // 防止重复点击
    if (creatingConversation === bookId) {
      console.log('[BooksPage] 已经在创建对话，忽略重复点击');
      return;
    }

    setCreatingConversation(bookId);
    console.log('[BooksPage] 开始创建书籍对话:', bookId);

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          type: 'book',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[BooksPage] 对话创建成功:', data.conversation.id);
        router.push(`/conversations/${data.conversation.id}`);
      } else {
        // 未登录，跳转到登录页
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to start book conversation:', error);
      setCreatingConversation(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* 页面标题区域 */}
        <section className="py-12 px-6 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-light text-gray-800 mb-2">{t('books.title')}</h1>
            <p className="text-base font-light text-gray-600">{t('books.subtitle')}</p>
          </div>
        </section>

        {/* 分类筛选区域 */}
        <section className="py-8 px-6 bg-[#FAF9F7]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-light text-gray-600">{t('books.categoryLabel')}</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleCategoryChange('')}
                  className={`px-4 py-2 rounded-lg text-sm font-light transition-colors ${
                    selectedCategory === ''
                      ? 'bg-[#2C5530] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {t('books.categoryAll')}
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryChange(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-light transition-colors ${
                      selectedCategory === category
                        ? 'bg-[#2C5530] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 书籍列表区域 */}
        <section className="py-8 px-6">
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

            {/* 书籍列表 */}
            {!loading && books.length > 0 && (
              <>
                <div className="mb-6 text-sm font-light text-gray-500">
                  {t('books.totalCount', { total, page, totalPages: Math.ceil(total / pageSize) })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      onClick={() => router.push(`/books/${book.id}`)}
                      className="bg-white rounded-lg overflow-hidden cursor-pointer
                               hover:shadow-lg transition-all group relative"
                    >
                      {/* 封面图片 */}
                      <div className="aspect-[3/4] bg-gray-200 relative overflow-hidden">
                        {book.cover_url ? (
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center
                                        bg-gradient-to-br from-[#2C5530] to-[#234426]">
                            <span className="text-white text-2xl font-light opacity-20">{t('books.placeholderCover')}</span>
                          </div>
                        )}
                      </div>

                      {/* 书籍信息 - 更紧凑 */}
                      <div className="p-3">
                        <h3 className="font-light text-sm text-gray-800 mb-0.5 line-clamp-2">
                          {book.title}
                        </h3>
                        <p className="text-xs font-light text-gray-500 mb-2">{book.author}</p>
                        {/* 收藏按钮 */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <FavoriteButton
                            bookId={book.id}
                            initialFavorited={favoritedBookIds.has(book.id)}
                            showCount={true}
                            favoriteCount={book.favorite_count}
                            size="sm"
                            onToggle={(favorited) => {
                              // 更新本地状态
                              setFavoritedBookIds(prev => {
                                const newSet = new Set(prev);
                                if (favorited) {
                                  newSet.add(book.id);
                                } else {
                                  newSet.delete(book.id);
                                }
                                return newSet;
                              });
                            }}
                          />
                        </div>
                      </div>

                      {/* 悬停显示的对话按钮 */}
                      <div className="absolute inset-0 bg-white bg-opacity-0 group-hover:bg-opacity-50
                                    transition-all duration-300 flex items-end justify-center pb-4
                                    opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => handleStartBookConversation(e, book.id)}
                          disabled={creatingConversation === book.id}
                          className="px-4 py-2 bg-[#2C5530] text-white rounded-lg font-light text-sm
                                   hover:bg-[#234426] transition-colors shadow-lg transform
                                   translate-y-2 group-hover:translate-y-0
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {creatingConversation === book.id ? t('books.creatingChat') : t('books.startChat')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 分页控件 */}
                {Math.ceil(total / pageSize) > 1 && (
                  <div className="mt-12 flex items-center justify-center gap-2">
                    {/* 上一页按钮 */}
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg font-light text-sm transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed
                               bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      {t('books.prevPage')}
                    </button>

                    {/* 页码 */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, Math.ceil(total / pageSize)) }, (_, i) => {
                        const totalPages = Math.ceil(total / pageSize);
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`w-10 h-10 rounded-lg font-light text-sm transition-colors
                                     ${page === pageNum
                                       ? 'bg-[#2C5530] text-white'
                                       : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* 下一页按钮 */}
                    <button
                      onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                      disabled={page >= Math.ceil(total / pageSize)}
                      className="px-4 py-2 rounded-lg font-light text-sm transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed
                               bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      {t('books.nextPage')}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 无结果 */}
            {!loading && books.length === 0 && (
              <div className="text-center py-20">
                <div className="text-gray-400 font-light mb-4">
                  {selectedCategory || selectedTags.length > 0
                    ? t('books.emptyFiltered')
                    : t('books.empty')}
                </div>
                {(selectedCategory || selectedTags.length > 0) && (
                  <button
                    onClick={() => {
                      setSelectedCategory('');
                      setSelectedTags([]);
                    }}
                    className="text-[#2C5530] hover:opacity-70 transition-opacity font-light text-sm"
                  >
                    {t('books.clearFilters')}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
