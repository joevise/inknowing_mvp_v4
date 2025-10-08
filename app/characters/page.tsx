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

export default function CharactersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/characters/popular?limit=20');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取角色列表失败');
      }

      const data = await response.json();
      setCharacters(data.characters || []);

      console.log('[Characters] 获取角色列表:', data);
    } catch (err) {
      console.error('[Characters] 获取失败:', err);
      setError(err instanceof Error ? err.message : '获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStartConversation = async (characterId: string, bookId: string) => {
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
        router.push(`/conversations/${data.conversation.id}`);
      } else {
        // 未登录，跳转到登录页
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
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
                  共 {characters.length} 个角色
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

                      {/* 开始对话按钮 */}
                      <button
                        onClick={() => handleStartConversation(char.id, char.book_id)}
                        className="w-full py-2 bg-[#2C5530] text-white rounded-lg
                                 font-light text-sm hover:bg-[#234426] transition-colors"
                      >
                        开始对话
                      </button>
                    </div>
                  ))}
                </div>
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
