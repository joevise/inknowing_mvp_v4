/**
 * 书籍申请管理页面
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';

interface BookRequest {
  id: string;
  user_id: string;
  username?: string;
  title: string;
  author?: string;
  status: 'pending' | 'processing' | 'created' | 'wishlist' | 'rejected' | 'failed';
  book_id?: string;
  ai_confidence?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'bg-blue-100 text-blue-700' },
  processing: { label: '处理中', color: 'bg-blue-100 text-blue-700' },
  created: { label: '已上架', color: 'bg-green-100 text-green-700' },
  wishlist: { label: '许愿池', color: 'bg-yellow-100 text-yellow-700' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
};

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'wishlist', label: '许愿池' },
  { key: 'pending', label: '等待中' },
  { key: 'processing', label: '处理中' },
  { key: 'created', label: '已上架' },
  { key: 'failed', label: '失败' },
  { key: 'rejected', label: '已拒绝' },
];

export default function AdminBookRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('wishlist');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null }>({ open: false, requestId: null });
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchRequests();
    }
  }, [activeTab]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (!response.ok) {
        router.push('/admin/login');
        return;
      }
      fetchRequests();
    } catch (error) {
      console.error('验证失败:', error);
      router.push('/admin/login');
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') {
        params.append('status', activeTab);
      }
      const res = await fetch(`/api/admin/book-requests?${params.toString()}`);
      if (!res.ok) {
        throw new Error('获取申请列表失败');
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('获取申请失败:', error);
      setError(error instanceof Error ? error.message : '获取申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    if (!confirm('确定要重试识别这本书吗？')) return;

    setActionLoading(id);
    setError('');
    try {
      const response = await fetch(`/api/admin/book-requests/${id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '重试失败');
      }
      await fetchRequests();
    } catch (error) {
      console.error('重试失败:', error);
      setError(error instanceof Error ? error.message : '重试失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.requestId) return;

    setActionLoading(rejectModal.requestId);
    setError('');
    try {
      const response = await fetch(`/api/admin/book-requests/${rejectModal.requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '拒绝失败');
      }
      setRejectModal({ open: false, requestId: null });
      setRejectReason('');
      await fetchRequests();
    } catch (error) {
      console.error('拒绝失败:', error);
      setError(error instanceof Error ? error.message : '拒绝失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条申请记录吗？')) return;

    setActionLoading(id);
    setError('');
    try {
      const response = await fetch(`/api/admin/book-requests/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '删除失败');
      }
      await fetchRequests();
    } catch (error) {
      console.error('删除失败:', error);
      setError(error instanceof Error ? error.message : '删除失败');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRequests = activeTab === 'all'
    ? requests
    : requests.filter(r => r.status === activeTab);

  return (
    <AdminLayout title="书籍申请管理">
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg font-light text-sm">
            {error}
          </div>
        )}

        {/* Tab切换 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-light transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#2C5530] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                {tab.key !== 'all' && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({requests.filter(r => r.status === tab.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-20">
            <div className="text-gray-400 font-light">加载中...</div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && filteredRequests.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-light text-gray-900 mb-2">暂无申请</h3>
            <p className="text-gray-500 font-light">
              {activeTab === 'all' ? '暂时没有书籍申请' : `没有${TABS.find(t => t.key === activeTab)?.label}的申请`}
            </p>
          </div>
        )}

        {/* 申请列表 */}
        {!loading && filteredRequests.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">书名</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">作者</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">申请人</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">AI置信度</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">申请时间</th>
                  <th className="px-6 py-3 text-right text-xs font-light text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-light text-gray-900">{req.title}</div>
                      {req.error_message && (
                        <div className="text-xs text-red-500 mt-1">{req.error_message}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-light text-sm">
                      {req.author || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-light text-sm">
                      {req.username || req.user_id}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full font-light ${STATUS_LABELS[req.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[req.status]?.label || req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-light text-sm">
                      {req.ai_confidence != null ? `${Math.round(req.ai_confidence * 100)}%` : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-light text-sm">
                      {new Date(req.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-light whitespace-nowrap">
                      {(req.status === 'wishlist' || req.status === 'failed') && (
                        <button
                          onClick={() => handleRetry(req.id)}
                          disabled={actionLoading === req.id}
                          className="text-[#2C5530] hover:text-[#234426] mr-4 disabled:opacity-50"
                        >
                          {actionLoading === req.id ? '处理中...' : '重试识别'}
                        </button>
                      )}
                      {(req.status === 'wishlist' || req.status === 'pending') && (
                        <button
                          onClick={() => setRejectModal({ open: true, requestId: req.id })}
                          disabled={actionLoading === req.id}
                          className="text-red-600 hover:text-red-900 mr-4 disabled:opacity-50"
                        >
                          拒绝
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(req.id)}
                        disabled={actionLoading === req.id}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 拒绝弹窗 */}
        {rejectModal.open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-light text-gray-800 mb-4">拒绝申请</h3>
              <div className="mb-4">
                <label className="block text-sm font-light text-gray-600 mb-2">
                  拒绝理由（选填）
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="请输入拒绝理由..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] font-light text-sm"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setRejectModal({ open: false, requestId: null });
                    setRejectReason('');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-light text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-light text-sm disabled:opacity-50"
                >
                  {actionLoading ? '处理中...' : '确认拒绝'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}