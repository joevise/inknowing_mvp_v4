/**
 * 个人设置页面 (MUJI风格)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  created_at: string;
  conversation_count: number;
  last_active: string;
}

interface BookRequest {
  id: string;
  title: string;
  author?: string;
  status: 'pending' | 'processing' | 'created' | 'wishlist' | 'rejected' | 'failed';
  book_id?: string;
  ai_confidence?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'requests'>('profile');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/me');

      if (!response.ok) {
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      setUser(data.user);

      fetchRequests();
    } catch (err) {
      console.error('[Profile] 获取失败:', err);
      setError(err instanceof Error ? err.message : '获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/user/my-requests', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.log('[Profile] 获取申请列表失败:', err);
    }
  };

  const handleUpdateUsername = async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/user/update-username', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: user.username }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('用户名更新成功');
        // 3秒后清除成功消息
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || '更新失败，请重试');
      }
    } catch (err) {
      console.error('[Profile] 更新失败:', err);
      setError('网络错误，请稍后重试');
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
            <h1 className="text-3xl font-light text-gray-800 mb-2">个人设置</h1>
            <p className="text-base font-light text-gray-600">
              管理您的账户信息
            </p>
          </div>
        </section>

        {/* Tab切换 */}
        <section className="px-6 bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-3 text-sm font-light border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-[#2C5530] text-[#2C5530]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                基本信息
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`py-3 text-sm font-light border-b-2 transition-colors ${
                  activeTab === 'requests'
                    ? 'border-[#2C5530] text-[#2C5530]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                我的申请 ({requests.length})
              </button>
            </div>
          </div>
        </section>

        {/* 个人信息区域 */}
        <section className="py-12 px-6">
          <div className="max-w-3xl mx-auto">
            {/* 成功提示 */}
            {success && (
              <div className="mb-6 bg-green-50 text-green-600 px-4 py-3 rounded-lg font-light text-sm">
                ✓ {success}
              </div>
            )}

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

            {/* 用户信息 */}
            {!loading && user && (
              <div className="space-y-6">
                {/* 基本信息卡片 */}
                <div className="bg-white rounded-lg p-8">
                  <h2 className="text-xl font-light text-gray-800 mb-6 pb-4 border-b border-gray-200">
                    基本信息
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm font-light text-gray-600">用户名</span>
                      <span className="text-base font-light text-gray-800">{user.username}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-t border-gray-100">
                      <span className="text-sm font-light text-gray-600">邮箱地址</span>
                      <span className="text-base font-light text-gray-800">{user.email}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-t border-gray-100">
                      <span className="text-sm font-light text-gray-600">注册时间</span>
                      <span className="text-base font-light text-gray-800">
                        {new Date(user.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-t border-gray-100">
                      <span className="text-sm font-light text-gray-600">最后活跃</span>
                      <span className="text-base font-light text-gray-800">
                        {new Date(user.last_active).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 统计信息卡片 */}
                <div className="bg-white rounded-lg p-8">
                  <h2 className="text-xl font-light text-gray-800 mb-6 pb-4 border-b border-gray-200">
                    使用统计
                  </h2>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center p-6 bg-[#FAF9F7] rounded-lg">
                      <div className="text-3xl font-light text-[#2C5530] mb-2">
                        {user.conversation_count}
                      </div>
                      <div className="text-sm font-light text-gray-600">
                        对话次数
                      </div>
                    </div>

                    <div className="text-center p-6 bg-[#FAF9F7] rounded-lg">
                      <div className="text-3xl font-light text-[#2C5530] mb-2">
                        0
                      </div>
                      <div className="text-sm font-light text-gray-600">
                        收藏书籍
                      </div>
                    </div>
                  </div>
                </div>

                {/* 编辑用户名 */}
                <div className="bg-white rounded-lg p-8">
                  <h2 className="text-xl font-light text-gray-800 mb-6 pb-4 border-b border-gray-200">
                    编辑信息
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="username" className="block text-sm font-light text-gray-600 mb-2">
                        用户名
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="username"
                          value={user.username}
                          onChange={(e) => setUser({...user, username: e.target.value})}
                          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors font-light"
                          minLength={2}
                          maxLength={20}
                        />
                        <button
                          onClick={handleUpdateUsername}
                          disabled={loading}
                          className="px-6 py-2 bg-[#2C5530] text-white rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-light text-sm"
                        >
                          {loading ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="bg-white rounded-lg p-8">
                  <h2 className="text-xl font-light text-gray-800 mb-6 pb-4 border-b border-gray-200">
                    账户操作
                  </h2>

                  <div className="space-y-3">
                    <button
                      onClick={() => router.push('/conversations')}
                      className="w-full py-3 bg-[#2C5530] text-white rounded-lg
                               font-light text-sm hover:bg-[#234426] transition-colors"
                    >
                      查看我的对话
                    </button>

                    <button
                      onClick={() => {/* TODO: 实现密码修改 */}}
                      className="w-full py-3 bg-white text-gray-700 rounded-lg border border-gray-200
                               font-light text-sm hover:bg-gray-50 transition-colors"
                    >
                      修改密码
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 我的申请 Tab */}
            {!loading && activeTab === 'requests' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg p-8">
                  <h2 className="text-xl font-light text-gray-800 mb-6 pb-4 border-b border-gray-200">
                    我申请上架的书籍
                  </h2>

                  {requests.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400 font-light mb-4">您还没有申请过任何书籍</p>
                      <a
                        href="/request-book"
                        className="text-[#2C5530] hover:underline font-light text-sm"
                      >
                        去申请一本书 →
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {requests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-light text-gray-800">{req.title}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs font-light ${
                                req.status === 'created' ? 'bg-green-100 text-green-700' :
                                req.status === 'wishlist' ? 'bg-yellow-100 text-yellow-700' :
                                req.status === 'pending' || req.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                req.status === 'rejected' || req.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {req.status === 'created' ? '已上架' :
                                 req.status === 'wishlist' ? '待处理' :
                                 req.status === 'pending' ? '等待中' :
                                 req.status === 'processing' ? '处理中' :
                                 req.status === 'rejected' ? '已拒绝' :
                                 req.status === 'failed' ? '失败' : req.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-light text-gray-400">
                              {req.author && <span>作者: {req.author}</span>}
                              <span>申请时间: {new Date(req.created_at).toLocaleDateString('zh-CN')}</span>
                              {req.ai_confidence && (
                                <span>识别置信度: {Math.round(req.ai_confidence * 100)}%</span>
                              )}
                            </div>
                            {req.error_message && (
                              <p className="text-xs font-light text-red-500 mt-1">{req.error_message}</p>
                            )}
                          </div>
                          <div className="ml-4">
                            {req.status === 'created' && req.book_id && (
                              <a
                                href={`/books/${req.book_id}`}
                                className="px-4 py-2 bg-[#2C5530] text-white rounded-lg font-light text-xs hover:bg-[#234426] transition-colors"
                              >
                                查看书籍
                              </a>
                            )}
                            {req.status === 'wishlist' && (
                              <span className="text-xs font-light text-gray-400">等待管理员处理</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <a
                    href="/request-book"
                    className="text-[#2C5530] hover:underline font-light text-sm"
                  >
                    申请上架新书 →
                  </a>
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
