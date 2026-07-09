/**
 * 邀请码管理页
 * 列表 / 生成(可选备注) / 停用 / 删除
 * 风格与其它 admin 页一致: AdminLayout + 表格 + 操作按钮
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';

interface InviteCode {
  id: string;
  code: string;
  status: 'active' | 'used' | 'disabled';
  created_at: string;
  used_by: string | null;
  used_at: string | null;
  note: string | null;
}

const STATUS_LABELS: Record<InviteCode['status'], { label: string; color: string }> = {
  active: { label: '可用', color: 'bg-green-100 text-green-700' },
  used: { label: '已使用', color: 'bg-gray-100 text-gray-700' },
  disabled: { label: '已停用', color: 'bg-red-100 text-red-700' },
};

export default function AdminInviteCodesPage() {
  const router = useRouter();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | InviteCode['status']>('all');

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (!response.ok) {
        router.push('/admin/login');
        return;
      }
      fetchCodes();
    } catch (err) {
      console.error('验证失败:', err);
      router.push('/admin/login');
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/invite-codes');
      if (!response.ok) throw new Error('获取邀请码列表失败');
      const data = await response.json();
      setCodes(data.codes || []);
    } catch (err) {
      console.error('获取邀请码失败:', err);
      setError(err instanceof Error ? err.message : '获取邀请码列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '创建邀请码失败');
      }
      setNote('');
      await fetchCodes();
    } catch (err) {
      console.error('创建邀请码失败:', err);
      setError(err instanceof Error ? err.message : '创建邀请码失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDisable = async (id: string) => {
    if (!confirm('确定停用这个邀请码?停用后将无法再用于注册。')) return;
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/invite-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '停用失败');
      }
      await fetchCodes();
    } catch (err) {
      console.error('停用失败:', err);
      setError(err instanceof Error ? err.message : '停用失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string, status: InviteCode['status']) => {
    const confirmMsg =
      status === 'used'
        ? '该邀请码已被使用,确定要删除吗?(仅删除记录)'
        : '确定要删除这个邀请码吗?';
    if (!confirm(confirmMsg)) return;
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/invite-codes/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }
      await fetchCodes();
    } catch (err) {
      console.error('删除失败:', err);
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setError('');
    } catch {
      setError('复制失败,请手动选择');
    }
  };

  const filteredCodes =
    filter === 'all' ? codes : codes.filter(c => c.status === filter);

  const stats = {
    all: codes.length,
    active: codes.filter(c => c.status === 'active').length,
    used: codes.filter(c => c.status === 'used').length,
    disabled: codes.filter(c => c.status === 'disabled').length,
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-light text-gray-800 mb-1">邀请码管理</h2>
            <p className="text-sm font-light text-gray-500">
              生产前白名单注册使用,每位受邀用户持有一个独立邀请码
            </p>
          </div>
        </div>

        {/* 生成卡片 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-light text-gray-800 mb-4">生成新邀请码</h3>
          <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <label htmlFor="note" className="block text-xs font-light text-gray-500 mb-1">
                备注(可选,如"发给张三")
              </label>
              <input
                type="text"
                id="note"
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={200}
                placeholder="例如: 发给测试用户李四"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] bg-white font-light"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-[#2C5530] text-white font-light rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? '生成中...' : '+ 生成邀请码'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* 过滤标签 */}
        <div className="flex gap-2 mb-4 text-sm">
          {[
            { key: 'all', label: `全部 ${stats.all}` },
            { key: 'active', label: `可用 ${stats.active}` },
            { key: 'used', label: `已使用 ${stats.used}` },
            { key: 'disabled', label: `已停用 ${stats.disabled}` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-1.5 rounded-full font-light transition-colors ${
                filter === tab.key
                  ? 'bg-[#2C5530] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 列表 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 font-light">加载中...</div>
          ) : filteredCodes.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-light">
              {filter === 'all' ? '暂无邀请码,先在上面生成一个吧' : `暂无${STATUS_LABELS[filter as InviteCode['status']]?.label || ''}的邀请码`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      邀请码
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      备注
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      使用时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      创建时间
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-light text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCodes.map(code => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleCopy(code.code)}
                          className="font-mono text-base text-gray-900 hover:text-[#2C5530] tracking-widest"
                          title="点击复制"
                        >
                          {code.code}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded ${STATUS_LABELS[code.status].color}`}
                        >
                          {STATUS_LABELS[code.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {code.note || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {code.used_at
                          ? new Date(code.used_at).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(code.created_at).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {code.status === 'active' && (
                            <button
                              onClick={() => handleDisable(code.id)}
                              disabled={actionLoading === code.id}
                              className="px-3 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 transition-colors disabled:opacity-50"
                            >
                              停用
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(code.id, code.status)}
                            disabled={actionLoading === code.id}
                            className="px-3 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}