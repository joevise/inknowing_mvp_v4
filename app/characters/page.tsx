/**
 * 热门角色页面 - 前台用户浏览角色 (MUJI风格)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface Character {
  id: string;
  name: string;
  description: string;
  book_title: string;
  book_id: string;
  conversation_count: number;
}

interface UserConversation {
  id: string;
  book_id: string;
  character_id?: string;
  type: 'book' | 'character';
  title?: string;
  updated_at: string;
}

export default function CharactersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const pageSize = 24; // 每页显示24个角色

  const [creatingConversation, setCreatingConversation] = useState<string | null>(null);
  const [continuingCharacterId, setContinuingCharacterId] = useState<string | null>(null);
  const [userConversations, setUserConversations] = useState<UserConversation[]>([]);

  useEffect(() => {
    fetchCharacters();
    fetchUserConversations();
  }, [page]);

  const fetchCharacters = async () => {
    setLoading(true);
    setError('');

    try {
      const offset = (page - 1) * pageSize;
      const response = await fetch(`/api/characters/popular?limit=${pageSize}&offset=${offset}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取角色列表失败');
      }

      const data = await response.json();
      setCharacters(data.characters || []);
      setTotal(data.total || 0);

      console.log('[Characters] 获取角色列表:', data);
    } catch (err) {
      console.error('[Characters] 获取失败:', err);
      setError(err instanceof Error ? err.message : '获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserConversations = async () => {
    try {
      const response = await fetch('/api/conversations?type=character&limit=50', {
        credentials: 'include',
      });

      if (!response.ok) {
        // 未登录或获取失败，静默处理
        return;
      }

      const data = await response.json();
      setUserConversations(data.conversations || []);
    } catch (err) {
      console.error('[Characters] 获取用户对话历史失败:', err);
    }
  };

  const getLatestConversation = (characterId: string): UserConversation | undefined => {
    return userConversations
      .filter((conv) => conv.character_id === characterId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  };

  const handleContinueConversation = async (characterId: string, bookId: string) => {
    if (continuingCharacterId === characterId) return;

    const latest = getLatestConversation(characterId);
    if (latest) {
      setContinuingCharacterId(characterId);
      router.push(`/conversations/${latest.id}`);
    } else {
      handleStartConversation(characterId, bookId);
    }
  };

  const handleStartConversation = async (characterId: string, bookId: string) => {
    // 防止重复点击
    if (creatingConversation === characterId) {
      console.log('[CharactersPage] 已经在创建对话，忽略重复点击');
      return;
    }

    setCreatingConversation(characterId);
    console.log('[CharactersPage] 开始创建角色对话:', characterId);

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          characterId,
          type: 'character',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CharactersPage] 对话创建成功:', data.conversation.id);
        router.push(`/conversations/${data.conversation.id}`);
      } else {
        // 未登录，跳转到登录页
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
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
            <h1 className="text-3xl font-light text-gray-800 mb-2">热门角色</h1>
            <p className="text-base font-light text-gray-600">
              与经典书籍中的角色对话，获得独特的知识体验
            </p>
          </div>
        </section>

        {/* 角色列表区域 */}
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
                <div className="text-gray-400 font-light">加载中...</div>
              </div>
            )}

            {/* 角色列表 */}
            {!loading && characters.length > 0 && (
              <>
                <div className="mb-6 text-sm font-light text-gray-500">
                  共 {total} 个角色 · 第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {characters.map((char) => (
                    <div
                      key={char.id}
                      className="bg-white rounded-lg p-6 hover:shadow-lg transition-shadow"
                    >
                      {/* 角色头像 */}
                      <div className="w-20 h-20 bg-gradient-to-br from-[#2C5530] to-[#234426]
                                    rounded-full flex items-center justify-center mb-4 mx-auto">
                        <span className="text-white text-3xl font-light">
                          {char.name[0]}
                        </span>
                      </div>

                      {/* 角色信息 */}
                      <div className="text-center mb-4">
                        <h3 className="font-light text-lg text-gray-800 mb-1">
                          {char.name}
                        </h3>
                        <p className="font-light text-xs text-gray-500 mb-3">
                          来自《{char.book_title}》
                        </p>
                        <p className="font-light text-xs text-gray-400 line-clamp-3 text-left">
                          {char.description}
                        </p>
                      </div>

                      {/* 对话统计 */}
                      {char.conversation_count > 0 && (
                        <div className="text-center mb-4">
                          <span className="text-xs font-light text-gray-400">
                            {char.conversation_count} 次对话
                          </span>
                        </div>
                      )}

                      {/* 开始/继续对话按钮 */}
                      {(() => {
                        const latestConv = getLatestConversation(char.id);
                        const hasHistory = !!latestConv;

                        return hasHistory ? (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleContinueConversation(char.id, char.book_id)}
                              disabled={continuingCharacterId === char.id}
                              className="w-full py-2 bg-[#2C5530] text-white rounded-lg
                                       font-light text-sm hover:bg-[#234426] transition-colors
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {continuingCharacterId === char.id ? '跳转中...' : '继续上次对话'}
                            </button>
                            <button
                              onClick={() => handleStartConversation(char.id, char.book_id)}
                              disabled={creatingConversation === char.id}
                              className="w-full py-2 bg-white text-[#2C5530] border border-[#2C5530] rounded-lg
                                       font-light text-sm hover:bg-[#FAF9F7] transition-colors
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {creatingConversation === char.id ? '创建中...' : '开新话题'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartConversation(char.id, char.book_id)}
                            disabled={creatingConversation === char.id}
                            className="w-full py-2 bg-[#2C5530] text-white rounded-lg
                                     font-light text-sm hover:bg-[#234426] transition-colors
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {creatingConversation === char.id ? '创建中...' : '开始对话'}
                          </button>
                        );
                      })()}
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
                      上一页
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
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 无结果 */}
            {!loading && characters.length === 0 && (
              <div className="text-center py-20">
                <div className="text-gray-400 font-light mb-4">
                  暂无角色
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
