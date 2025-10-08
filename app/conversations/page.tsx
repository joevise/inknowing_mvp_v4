/**
 * 我的对话页面 - 用户对话列表 (MUJI风格)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface Conversation {
  id: string;
  book_id: string;
  character_id?: string;
  type: 'book' | 'character';
  title?: string;
  created_at: string;
  updated_at: string;
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
      const response = await fetch('/api/auth/me');

      if (!response.ok) {
        // 未登录，跳转到登录页
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      // 这里需要从用户信息中获取对话列表
      // 暂时返回空数组，需要实现获取对话列表的API
      setConversations([]);

    } catch (err) {
      console.error('[Conversations] 获取失败:', err);
      setError(err instanceof Error ? err.message : '获取对话列表失败');
    } finally {
      setLoading(false);
    }
  };

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

            {/* 对话列表 */}
            {!loading && conversations.length > 0 && (
              <div className="space-y-4">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => router.push(`/conversations/${conv.id}`)}
                    className="bg-white rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-light text-lg text-gray-800 mb-2">
                          {conv.title || '未命名对话'}
                        </h3>
                        <p className="text-sm font-light text-gray-500">
                          {conv.type === 'book' ? '书籍对话' : '角色对话'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-light text-gray-400">
                          {new Date(conv.updated_at).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
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
