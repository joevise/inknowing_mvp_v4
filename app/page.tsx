/**
 * 首页 - 智能搜索主页面
 */

'use client';

import { useState, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  query: string;
  intent: string;
  books: Array<{
    id: string;
    title: string;
    author: string;
    description: string;
    cover_url?: string;
    category?: string;
    tags?: string[];
    type: 'book';
  }>;
  characters: Array<{
    id: string;
    name: string;
    book_title: string;
    description: string;
    type: 'character';
  }>;
  suggestions: string[];
  total: {
    books: number;
    characters: number;
  };
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(query.trim())}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '搜索失败');
      }

      const data: SearchResult = await response.json();
      setResults(data);

      console.log('[Search] 搜索结果:', data);
    } catch (err) {
      console.error('[Search] 搜索失败:', err);
      setError(err instanceof Error ? err.message : '搜索失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setResults(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#F5F5DC]">
      <div className="max-w-4xl w-full text-center">
        {/* Logo和标题 */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#2F5233] mb-4">
            知应 InKnowing
          </h1>
          <p className="text-xl text-gray-600">
            AI知识对话平台 MVP
          </p>
        </div>

        {/* 智能搜索框 */}
        <div className="mb-16">
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="搜索书籍、角色，或直接提问..."
              disabled={loading}
              className="w-full text-lg py-4 pl-6 pr-14 border-2 border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-[#2F5233] focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2
                         px-4 py-2 bg-[#2F5233] text-white rounded-lg
                         hover:bg-[#1a2e1c] transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            试试: "我想了解心理学" 或 "和苏格拉底聊天"
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg max-w-2xl mx-auto">
            {error}
          </div>
        )}

        {/* 搜索结果 */}
        {results && (
          <div className="mb-12 max-w-2xl mx-auto">
            {/* 结果统计 */}
            <div className="text-left mb-6 text-gray-600">
              找到 {results.total.books} 本书籍，{results.total.characters} 个角色
            </div>

            {/* 书籍结果 */}
            {results.books.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-left">书籍</h3>
                <div className="space-y-4">
                  {results.books.map((book) => (
                    <div
                      key={book.id}
                      onClick={() => router.push(`/books/${book.id}`)}
                      className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer text-left"
                    >
                      <div className="flex gap-4">
                        {book.cover_url && (
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="w-16 h-24 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-800 mb-1">{book.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                          <p className="text-sm text-gray-500 line-clamp-2">{book.description}</p>
                          {book.category && (
                            <span className="inline-block mt-2 px-2 py-1 bg-[#F5F5DC] text-[#2F5233] text-xs rounded">
                              {book.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 角色结果 */}
            {results.characters.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-left">角色</h3>
                <div className="space-y-4">
                  {results.characters.map((char) => (
                    <div
                      key={char.id}
                      className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer text-left"
                    >
                      <h4 className="font-bold text-gray-800 mb-1">{char.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">来自《{char.book_title}》</p>
                      <p className="text-sm text-gray-500 line-clamp-2">{char.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 无结果 */}
            {results.total.books === 0 && results.total.characters === 0 && (
              <div className="bg-gray-50 p-8 rounded-lg text-gray-600">
                没有找到相关结果，试试其他关键词
              </div>
            )}

            {/* 搜索建议 */}
            {results.suggestions.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-600 mb-3 text-left">相关搜索</h4>
                <div className="flex flex-wrap gap-2">
                  {results.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm
                                 hover:bg-gray-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 快速入口 */}
        {!results && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/books" className="bg-white p-6 rounded-lg shadow-sm hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">浏览书籍</h3>
              <p className="text-gray-600">
                探索精选的10本经典书籍
              </p>
            </a>

            <a href="/auth/login" className="bg-white p-6 rounded-lg shadow-sm hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">登录账户</h3>
              <p className="text-gray-600">
                保存对话历史，继续学习
              </p>
            </a>

            <a href="/admin/login" className="bg-white p-6 rounded-lg shadow-sm hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">管理后台</h3>
              <p className="text-gray-600">
                管理书籍和系统配置
              </p>
            </a>
          </div>
        )}

        {/* 状态信息 */}
        <div className="mt-16 text-center text-sm text-gray-500">
          <p>环境: 开发模式 | 版本: 1.0.0 MVP</p>
          <p className="mt-2">
            基础架构搭建完成 ✓
          </p>
        </div>
      </div>
    </main>
  );
}
