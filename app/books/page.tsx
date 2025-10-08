/**
 * 书籍列表页面 - 前台用户浏览书籍 (MUJI风格)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url?: string;
  category?: string;
  tags?: string[];
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
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  // 筛选状态
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const categories = ['文学', '商业', '科学', '心理', '哲学'];

  useEffect(() => {
    fetchBooks();
  }, [selectedCategory, selectedTags]);

  const fetchBooks = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (selectedCategory) {
        params.append('category', selectedCategory);
      }
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
      }

      const response = await fetch(`/api/books?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取书籍列表失败');
      }

      const data: BooksResponse = await response.json();
      setBooks(data.books);
      setTotal(data.total);

      console.log('[Books] 获取书籍列表:', data);
    } catch (err) {
      console.error('[Books] 获取失败:', err);
      setError(err instanceof Error ? err.message : '获取书籍列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category === selectedCategory ? '' : category);
  };

  const handleStartBookConversation = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation(); // 阻止冒泡到卡片点击
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
        router.push(`/conversations/${data.conversation.id}`);
      } else {
        // 未登录，跳转到登录页
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to start book conversation:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* 页面标题区域 */}
        <section className="py-12 px-6 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-light text-gray-800 mb-2">浏览书籍</h1>
            <p className="text-base font-light text-gray-600">探索精选的经典书籍，与AI开启智能对话</p>
          </div>
        </section>

        {/* 分类筛选区域 */}
        <section className="py-8 px-6 bg-[#FAF9F7]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-light text-gray-600">分类：</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleCategoryChange('')}
                  className={`px-4 py-2 rounded-lg text-sm font-light transition-colors ${
                    selectedCategory === ''
                      ? 'bg-[#2C5530] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  全部
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
                <div className="text-gray-400 font-light">加载中...</div>
              </div>
            )}

            {/* 书籍列表 */}
            {!loading && books.length > 0 && (
              <>
                <div className="mb-6 text-sm font-light text-gray-500">
                  共 {total} 本书籍
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
                            <span className="text-white text-2xl font-light opacity-20">书</span>
                          </div>
                        )}
                      </div>

                      {/* 书籍信息 - 更紧凑 */}
                      <div className="p-3">
                        <h3 className="font-light text-sm text-gray-800 mb-0.5 line-clamp-2">
                          {book.title}
                        </h3>
                        <p className="text-xs font-light text-gray-500">{book.author}</p>
                      </div>

                      {/* 悬停显示的对话按钮 */}
                      <div className="absolute inset-0 bg-white bg-opacity-0 group-hover:bg-opacity-50
                                    transition-all duration-300 flex items-end justify-center pb-4
                                    opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => handleStartBookConversation(e, book.id)}
                          className="px-4 py-2 bg-[#2C5530] text-white rounded-lg font-light text-sm
                                   hover:bg-[#234426] transition-colors shadow-lg transform
                                   translate-y-2 group-hover:translate-y-0"
                        >
                          开始对话
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 无结果 */}
            {!loading && books.length === 0 && (
              <div className="text-center py-20">
                <div className="text-gray-400 font-light mb-4">
                  {selectedCategory || selectedTags.length > 0
                    ? '没有找到符合条件的书籍'
                    : '暂无书籍'}
                </div>
                {(selectedCategory || selectedTags.length > 0) && (
                  <button
                    onClick={() => {
                      setSelectedCategory('');
                      setSelectedTags([]);
                    }}
                    className="text-[#2C5530] hover:opacity-70 transition-opacity font-light text-sm"
                  >
                    清除筛选条件
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
