/**
 * 书籍详情页面 - 统一MUJI风格设计
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';

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
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      {/* 统一Header */}
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* 返回按钮 */}
          <div className="mb-8">
            <Link
              href="/books"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-[#2C5530] font-light transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回书籍列表
            </Link>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded font-light">
              {error}
            </div>
          )}

          {/* 加载状态 */}
          {loading && (
            <div className="text-center py-20">
              <div className="text-gray-500 font-light">加载中...</div>
            </div>
          )}

          {/* 书籍详情 */}
          {!loading && book && (
            <div className="space-y-8">
              {/* 书籍基本信息 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex flex-col md:flex-row gap-0">
                  {/* 封面 */}
                  <div className="w-full md:w-80 flex-shrink-0 bg-gray-50">
                    <div className="aspect-[3/4] md:aspect-auto md:h-full">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2C5530] to-[#234426]">
                          <span className="text-white text-8xl font-light opacity-20">书</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 书籍信息 */}
                  <div className="flex-1 p-8 md:p-12">
                    <h1 className="text-3xl md:text-4xl font-light text-gray-800 mb-3">{book.title}</h1>
                    <p className="text-xl font-light text-gray-600 mb-6">{book.author}</p>

                    {/* 分类标签 */}
                    <div className="flex flex-wrap gap-2 mb-8">
                      {book.category && (
                        <span className="px-3 py-1 bg-[#2C5530] text-white text-sm font-light rounded">
                          {book.category}
                        </span>
                      )}
                      {book.tags && book.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-[#FAF9F7] text-gray-700 text-sm font-light rounded border border-gray-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* 简介 */}
                    <div className="mb-8">
                      <h3 className="text-base font-normal text-gray-800 mb-3">关于本书</h3>
                      <p className="text-gray-600 font-light leading-relaxed">{book.description}</p>
                    </div>

                    {/* 开始对话按钮 */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <button
                        onClick={() => handleStartConversation()}
                        className="px-8 py-3 bg-[#2C5530] text-white font-light rounded hover:bg-[#234426] transition-colors"
                      >
                        开始智能对话
                      </button>
                      <div className="text-sm font-light text-gray-500">
                        {book.character_count} 个可对话角色
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 角色列表 */}
              {book.characters.length > 0 && (
                <div>
                  <h2 className="text-2xl font-light text-gray-800 mb-6">可对话角色</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {book.characters.map((character) => (
                      <div
                        key={character.id}
                        onClick={() => handleStartConversation(character.id)}
                        className="bg-white border border-gray-200 rounded-lg p-6 hover:border-[#2C5530] hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2C5530] to-[#234426] flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xl font-light">{character.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-normal text-gray-800 mb-2">{character.name}</h3>
                            <p className="text-sm font-light text-gray-600 line-clamp-3">{character.description}</p>
                            <div className="mt-3 text-sm font-light text-[#2C5530] opacity-0 group-hover:opacity-100 transition-opacity">
                              点击开始对话 →
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 推荐书籍 */}
              {book.recommendations.length > 0 && (
                <div>
                  <h2 className="text-2xl font-light text-gray-800 mb-6">相关推荐</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {book.recommendations.map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => router.push(`/books/${rec.id}`)}
                        className="cursor-pointer group"
                      >
                        <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden mb-3 group-hover:shadow-lg transition-shadow border border-gray-200">
                          {rec.cover_url ? (
                            <img
                              src={rec.cover_url}
                              alt={rec.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2C5530] to-[#234426]">
                              <span className="text-white text-4xl font-light opacity-20">书</span>
                            </div>
                          )}
                        </div>
                        <h4 className="text-sm font-light text-gray-800 line-clamp-2 mb-1">
                          {rec.title}
                        </h4>
                        <p className="text-xs font-light text-gray-500">{rec.author}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
