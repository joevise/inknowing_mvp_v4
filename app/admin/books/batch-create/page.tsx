/**
 * 批量创建书籍页面
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RecommendedBook {
  title: string;
  author: string;
  brief_reason: string;
  selected: boolean;
}

interface BatchResult {
  title: string;
  success: boolean;
  bookId?: string;
  coverUrl?: string;
  error?: string;
}

export default function BatchCreatePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [recommendedBooks, setRecommendedBooks] = useState<RecommendedBook[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [createCharacters, setCreateCharacters] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (!response.ok) {
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('验证失败:', error);
      router.push('/admin/login');
    }
  };

  const handleGetRecommendations = async () => {
    if (!query.trim()) {
      setError('请输入查询条件');
      return;
    }

    setError('');
    setLoading(true);
    setRecommendedBooks([]);
    setResults([]);

    try {
      const response = await fetch('/api/admin/books/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), count }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取推荐失败');
      }

      const data = await response.json();
      if (data.books && Array.isArray(data.books)) {
        setRecommendedBooks(
          data.books.map((book: any) => ({ ...book, selected: false }))
        );
      } else {
        throw new Error('返回数据格式错误');
      }
    } catch (error) {
      console.error('获取推荐失败:', error);
      setError(error instanceof Error ? error.message : '获取推荐失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBook = (index: number) => {
    setRecommendedBooks(prev =>
      prev.map((book, i) =>
        i === index ? { ...book, selected: !book.selected } : book
      )
    );
  };

  const handleSelectAll = () => {
    const allSelected = recommendedBooks.every(book => book.selected);
    setRecommendedBooks(prev =>
      prev.map(book => ({ ...book, selected: !allSelected }))
    );
  };

  const handleBatchCreate = async () => {
    const selectedBooks = recommendedBooks.filter(book => book.selected);

    if (selectedBooks.length === 0) {
      setError('请至少选择一本书籍');
      return;
    }

    if (!confirm(`确定要创建 ${selectedBooks.length} 本书籍吗？这可能需要一些时间。`)) {
      return;
    }

    setError('');
    setCreating(true);
    setResults([]);
    setProgress({ current: 0, total: selectedBooks.length });

    try {
      const response = await fetch('/api/admin/books/batch-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          books: selectedBooks.map(({ selected, ...book }) => book),
          createCharacters,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '批量创建失败');
      }

      const data = await response.json();
      setResults(data.results || []);
      setProgress({ current: data.successCount, total: selectedBooks.length });

      // 清空推荐列表
      if (data.successCount > 0) {
        setRecommendedBooks([]);
        setQuery('');
      }
    } catch (error) {
      console.error('批量创建失败:', error);
      setError(error instanceof Error ? error.message : '批量创建失败');
    } finally {
      setCreating(false);
    }
  };

  const selectedCount = recommendedBooks.filter(book => book.selected).length;

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      <nav className="bg-white border-b px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#2F5233]">批量创建书籍</h1>
          <div className="flex gap-6">
            <Link href="/admin" className="text-gray-600 hover:text-[#2F5233]">
              仪表板
            </Link>
            <Link href="/admin/books" className="text-gray-600 hover:text-[#2F5233]">
              书籍管理
            </Link>
            <Link href="/admin/books/new" className="text-gray-600 hover:text-[#2F5233]">
              单个添加
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 查询输入区域 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">获取AI推荐</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                查询条件
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例如：人生成长方面的书籍、莎士比亚的所有作品"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F5233]"
                disabled={loading || creating}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  推荐数量
                </label>
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 20)}
                  min="1"
                  max="50"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F5233]"
                  disabled={loading || creating}
                />
              </div>
              <div className="flex-1 flex items-end">
                <button
                  onClick={handleGetRecommendations}
                  disabled={loading || creating}
                  className="w-full px-6 py-2 bg-[#2F5233] text-white rounded-lg hover:bg-[#1a2e1c] disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? '获取中...' : '获取推荐'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 推荐书籍列表 */}
        {recommendedBooks.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                推荐书籍 ({recommendedBooks.length}本)
              </h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-[#2F5233] hover:underline"
                  disabled={creating}
                >
                  {recommendedBooks.every(book => book.selected) ? '取消全选' : '全选'}
                </button>
                <span className="text-sm text-gray-600">
                  已选择 {selectedCount} 本
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {recommendedBooks.map((book, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg cursor-pointer transition ${
                    book.selected
                      ? 'border-[#2F5233] bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleToggleBook(index)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={book.selected}
                      onChange={() => handleToggleBook(index)}
                      className="mt-1"
                      disabled={creating}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{book.title}</span>
                        <span className="text-sm text-gray-500">- {book.author}</span>
                      </div>
                      <p className="text-sm text-gray-600">{book.brief_reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={createCharacters}
                    onChange={(e) => setCreateCharacters(e.target.checked)}
                    disabled={creating}
                  />
                  同时创建角色（可选）
                </label>
              </div>
              <button
                onClick={handleBatchCreate}
                disabled={creating || selectedCount === 0}
                className="w-full px-6 py-3 bg-[#2F5233] text-white rounded-lg hover:bg-[#1a2e1c] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {creating ? `创建中... (${progress.current}/${progress.total})` : `批量创建 (${selectedCount}本)`}
              </button>
            </div>
          </div>
        )}

        {/* 创建结果 */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              创建结果
            </h2>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    result.success ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={result.success ? 'text-green-600' : 'text-red-600'}>
                      {result.success ? '✓' : '✗'}
                    </span>
                    <span className="text-gray-900">{result.title}</span>
                  </div>
                  {result.success ? (
                    <Link
                      href={`/admin/books/${result.bookId}`}
                      className="text-sm text-[#2F5233] hover:underline"
                    >
                      查看详情
                    </Link>
                  ) : (
                    <span className="text-sm text-red-600">{result.error}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                成功创建 {results.filter(r => r.success).length} 本，
                失败 {results.filter(r => !r.success).length} 本
              </p>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        {recommendedBooks.length === 0 && results.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">批量创建书籍</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              输入查询条件（如"科幻小说"、"村上春树的作品"），AI会推荐相关书籍。
              选择您需要的书籍后，系统会自动识别详细信息、抓取豆瓣封面并创建书籍记录。
            </p>
            <div className="text-left max-w-xl mx-auto space-y-2 text-sm text-gray-600">
              <p>📝 支持按主题、作者、类型等查询</p>
              <p>🎯 AI会智能推荐经典和优质书籍</p>
              <p>🖼️ 自动从豆瓣抓取书籍封面</p>
              <p>🤖 AI识别书籍详细信息</p>
              <p>👥 可选择同时创建角色信息</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
