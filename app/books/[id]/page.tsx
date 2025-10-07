/**
 * 书籍详情页面 - 前台用户查看书籍详情和角色
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Character {
  id: string;
  name: string;
  description: string;
}

interface Recommendation {
  id: string;
  title: string;
  author: string;
  cover_url?: string;
  category?: string;
}

interface BookDetail {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url?: string;
  category?: string;
  tags?: string[];
  conversation_strategy: string;
  has_document: boolean;
  character_count: number;
  characters: Character[];
  recommendations: Recommendation[];
}

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bookId) {
      fetchBookDetail();
    }
  }, [bookId]);

  const fetchBookDetail = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/books/${bookId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取书籍详情失败');
      }

      const data: BookDetail = await response.json();
      setBook(data);

      console.log('[BookDetail] 获取书籍详情:', data);
    } catch (err) {
      console.error('[BookDetail] 获取失败:', err);
      setError(err instanceof Error ? err.message : '获取书籍详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStartConversation = (characterId?: string) => {
    if (characterId) {
      router.push(`/conversations/new?bookId=${bookId}&characterId=${characterId}`);
    } else {
      router.push(`/conversations/new?bookId=${bookId}`);
    }
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
            <Link href="/books" className="text-gray-600 hover:text-[#2F5233]">
              浏览书籍
            </Link>
            <Link href="/auth/login" className="text-gray-600 hover:text-[#2F5233]">
              登录
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Link
            href="/books"
            className="text-gray-600 hover:text-[#2F5233] flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回书籍列表
          </Link>
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

        {/* 书籍详情 */}
        {!loading && book && (
          <>
            {/* 书籍基本信息 */}
            <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* 封面 */}
                <div className="w-full md:w-64 flex-shrink-0">
                  <div className="aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* 书籍信息 */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">{book.title}</h1>
                  <p className="text-xl text-gray-600 mb-4">{book.author}</p>

                  {/* 分类标签 */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {book.category && (
                      <span className="px-3 py-1 bg-[#2F5233] text-white text-sm rounded-full">
                        {book.category}
                      </span>
                    )}
                    {book.tags && book.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* 简介 */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">简介</h3>
                    <p className="text-gray-600 leading-relaxed">{book.description}</p>
                  </div>

                  {/* 开始对话按钮 */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleStartConversation()}
                      className="px-6 py-3 bg-[#2F5233] text-white rounded-lg hover:bg-[#1a2e1c] transition-colors font-medium"
                    >
                      开始智能对话
                    </button>
                    <div className="text-sm text-gray-500 flex items-center">
                      {book.character_count} 个可对话角色
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 角色列表 */}
            {book.characters.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">可对话角色</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {book.characters.map((character) => (
                    <div
                      key={character.id}
                      onClick={() => handleStartConversation(character.id)}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-[#2F5233] hover:shadow-md transition-all cursor-pointer"
                    >
                      <h3 className="font-bold text-gray-800 mb-2">{character.name}</h3>
                      <p className="text-sm text-gray-600 line-clamp-3">{character.description}</p>
                      <div className="mt-3 text-sm text-[#2F5233] font-medium">
                        点击开始对话 →
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 推荐书籍 */}
            {book.recommendations.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">相关推荐</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {book.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => router.push(`/books/${rec.id}`)}
                      className="cursor-pointer group"
                    >
                      <div className="aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden mb-2 group-hover:shadow-lg transition-shadow">
                        {rec.cover_url ? (
                          <img
                            src={rec.cover_url}
                            alt={rec.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <h4 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
                        {rec.title}
                      </h4>
                      <p className="text-xs text-gray-600">{rec.author}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
