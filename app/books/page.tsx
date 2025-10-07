/**
 * 书籍列表页面 - 前台用户浏览书籍
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      {/* 顶部导航 */}
      <nav className="bg-white border-b px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-[#2F5233]">
            知应 InKnowing
          </Link>
          <div className="flex gap-6">
            <Link href="/" className="text-gray-600 hover:text-[#2F5233]">
              首页
            </Link>
            <Link href="/books" className="text-[#2F5233] font-medium">
              浏览书籍
            </Link>
            <Link href="/auth/login" className="text-gray-600 hover:text-[#2F5233]">
              登录
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">浏览书籍</h1>
          <p className="text-gray-600">探索精选的经典书籍，与AI开启智能对话</p>
        </div>

        {/* 分类筛选 */}
        <div className="mb-8 bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">分类筛选</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleCategoryChange('')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === ''
                  ? 'bg-[#2F5233] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-[#2F5233] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-gray-600">加载中...</div>
          </div>
        )}

        {/* 书籍列表 */}
        {!loading && books.length > 0 && (
          <>
            <div className="mb-6 text-gray-600">
              共找到 {total} 本书籍
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {books.map((book) => (
                <div
                  key={book.id}
                  onClick={() => router.push(`/books/${book.id}`)}
                  className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                >
                  {/* 封面图片 */}
                  <div className="aspect-[3/4] bg-gray-200 relative">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* 书籍信息 */}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 mb-1 line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                    <p className="text-sm text-gray-500 line-clamp-3 mb-3">
                      {book.description}
                    </p>

                    {/* 分类标签 */}
                    <div className="flex flex-wrap gap-2">
                      {book.category && (
                        <span className="inline-block px-2 py-1 bg-[#F5F5DC] text-[#2F5233] text-xs rounded">
                          {book.category}
                        </span>
                      )}
                      {book.tags && book.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 无结果 */}
        {!loading && books.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
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
                className="text-[#2F5233] hover:underline"
              >
                清除筛选条件
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
