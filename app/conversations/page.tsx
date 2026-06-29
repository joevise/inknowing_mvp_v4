/**
 * 我的对话页面 - 用户对话列表 (MUJI风格)
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface Conversation {
  id: string;
  book_id: string;
  book_title?: string;
  character_id?: string;
  character_name?: string;
  type: 'book' | 'character';
  title?: string;
  created_at: string;
  updated_at: string;
}

interface ConversationGroup {
  key: string;
  name: string;
  type: 'book' | 'character';
  conversations: Conversation[];
}

export default function ConversationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. 检查登录状态
      const authResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!authResponse.ok) {
        // 未登录，跳转到登录页
        router.push('/auth/login');
        return;
      }

      // 2. 获取对话列表
      const conversationsResponse = await fetch('/api/conversations', {
        credentials: 'include',
      });

      if (!conversationsResponse.ok) {
        throw new Error('获取对话列表失败');
      }

      const data = await conversationsResponse.json();
      setConversations(data.conversations || []);

      console.log('[Conversations] 获取对话列表:', data.conversations);

    } catch (err) {
      console.error('[Conversations] 获取失败:', err);
      setError(err instanceof Error ? err.message : '获取对话列表失败');
    } finally {
      setLoading(false);
    }
  };

  const groupedConversations = useMemo(() => {
    const groupMap = new Map<string, ConversationGroup>();

    for (const conv of conversations) {
      const isCharacter = conv.type === 'character';
      const key = isCharacter && conv.character_id
        ? `character:${conv.character_id}`
        : `book:${conv.book_id}`;
      const name = isCharacter ? conv.character_name : conv.book_title;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          name: name || (isCharacter ? '未命名角色' : '未命名书籍'),
          type: conv.type,
          conversations: [],
        });
      }

      groupMap.get(key)!.conversations.push(conv);
    }

    return Array.from(groupMap.values())
      .map((group) => {
        group.conversations.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        return group;
      })
      .sort((a, b) => {
        const aLatest = new Date(a.conversations[0].updated_at).getTime();
        const bLatest = new Date(b.conversations[0].updated_at).getTime();
        return bLatest - aLatest;
      });
  }, [conversations]);

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* 页面标题区域 */}
        <section className="py-12 px-6 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-light text-gray-800 mb-2">我的对话</h1>
            <p className="text-base font-light text-gray-600">
              查看和继续您的所有对话
            </p>
          </div>
        </section>

        {/* 对话列表区域 */}
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

            {/* 分组对话列表 */}
            {!loading && groupedConversations.length > 0 && (
              <div className="space-y-10">
                {groupedConversations.map((group) => (
                  <div key={group.key}>
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="text-xl font-light text-gray-800">{group.name}</h2>
                      <span className="text-xs font-light text-white bg-[#2C5530] px-2 py-1 rounded-full">
                        {group.conversations.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.conversations.map((conv) => {
                        const displayTitle = conv.title || conv.character_name || conv.book_title || '未命名对话';

                        return (
                          <div
                            key={conv.id}
                            onClick={() => router.push(`/conversations/${conv.id}`)}
                            className="bg-white rounded-lg p-5 hover:shadow-lg transition-all cursor-pointer border border-gray-100 group"
                          >
                            <div className="flex flex-col h-full">
                              {/* 标题 */}
                              <h3 className="font-light text-base text-gray-800 mb-2 line-clamp-2 group-hover:text-[#2C5530] transition-colors">
                                {displayTitle}
                              </h3>

                              {/* 书籍和类型信息 */}
                              <div className="flex items-center gap-2 mb-3">
                                {conv.book_title && (
                                  <span className="text-xs font-light text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                    📖 {conv.book_title}
                                  </span>
                                )}
                                <span className={`text-xs font-light px-2 py-1 rounded ${
                                  conv.type === 'character'
                                    ? 'bg-[#2C5530] text-white'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {conv.type === 'character' ? '角色对话' : '书籍对话'}
                                </span>
                              </div>

                              {/* 时间 */}
                              <div className="mt-auto pt-3 border-t border-gray-100">
                                <p className="text-xs font-light text-gray-400">
                                  最后更新: {new Date(conv.updated_at).toLocaleString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 无对话 */}
            {!loading && conversations.length === 0 && (
              <div className="text-center py-20">
                <div className="text-gray-400 font-light mb-4">
                  暂无对话记录
                </div>
                <button
                  onClick={() => router.push('/books')}
                  className="px-6 py-2 bg-[#2C5530] text-white rounded-lg
                           font-light text-sm hover:bg-[#234426] transition-colors"
                >
                  开始新对话
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
