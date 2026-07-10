'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';

interface CopyrightReport {
  id: string;
  work_title: string;
  rights_holder: string | null;
  contact_info: string;
  proof_description: string;
  infringing_content: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<CopyrightReport['status'], { label: string; color: string }> = {
  pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-700' },
  reviewing: { label: '审核中', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: '已处理', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已驳回', color: 'bg-gray-100 text-gray-700' },
};

const STATUS_OPTIONS: CopyrightReport['status'][] = ['pending', 'reviewing', 'resolved', 'rejected'];

export default function AdminCopyrightReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<CopyrightReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<CopyrightReport['status']>('pending');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedReport = useMemo(
    () => reports.find(report => report.id === selectedId) || null,
    [reports, selectedId]
  );

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (!response.ok) {
        router.push('/admin/login');
        return;
      }
      fetchReports();
    } catch (err) {
      console.error('验证失败:', err);
      router.push('/admin/login');
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/copyright-reports');
      const data: { reports?: CopyrightReport[]; error?: string } = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '获取版权投诉列表失败');
      }
      const nextReports = data.reports || [];
      setReports(nextReports);
      if (!selectedId && nextReports.length > 0) {
        selectReport(nextReports[0]);
      }
    } catch (err) {
      console.error('获取版权投诉失败:', err);
      setError(err instanceof Error ? err.message : '获取版权投诉列表失败');
    } finally {
      setLoading(false);
    }
  };

  const selectReport = (report: CopyrightReport) => {
    setSelectedId(report.id);
    setEditStatus(report.status);
    setEditNote(report.admin_note || '');
    setSuccess('');
    setError('');
  };

  const handleSave = async () => {
    if (!selectedReport || saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/copyright-reports/${selectedReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, admin_note: editNote }),
      });
      const data: { report?: CopyrightReport; error?: string } = await response.json();
      if (!response.ok || !data.report) {
        throw new Error(data.error || '更新版权投诉失败');
      }
      const updatedReport = data.report;
      setReports(prev => prev.map(report => report.id === updatedReport.id ? updatedReport : report));
      setSelectedId(updatedReport.id);
      setEditStatus(updatedReport.status);
      setEditNote(updatedReport.admin_note || '');
      setSuccess('已更新版权投诉处理状态');
    } catch (err) {
      console.error('更新版权投诉失败:', err);
      setError(err instanceof Error ? err.message : '更新版权投诉失败');
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    all: reports.length,
    pending: reports.filter(report => report.status === 'pending').length,
    reviewing: reports.filter(report => report.status === 'reviewing').length,
    resolved: reports.filter(report => report.status === 'resolved').length,
    rejected: reports.filter(report => report.status === 'rejected').length,
  };

  return (
    <AdminLayout title="版权投诉">
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-light text-gray-800 mb-1">版权投诉</h2>
            <p className="text-sm font-light text-gray-500">
              处理著作权人提交的通知-删除投诉，48 小时内完成审核记录
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs font-light">
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">全部 {stats.all}</div>
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">待处理 {stats.pending}</div>
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">审核中 {stats.reviewing}</div>
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">已处理 {stats.resolved}</div>
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">已驳回 {stats.rejected}</div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg font-light text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 text-green-700 px-4 py-3 rounded-lg font-light text-sm">
            {success}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500 font-light">加载中...</div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500 font-light">暂无版权投诉</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">作品</th>
                      <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">联系人</th>
                      <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">提交时间</th>
                      <th className="px-6 py-3 text-right text-xs font-light text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reports.map(report => (
                      <tr key={report.id} className={selectedId === report.id ? 'bg-[#F5F7F3]' : 'hover:bg-gray-50'}>
                        <td className="px-6 py-4">
                          <div className="font-light text-gray-900 line-clamp-1">{report.work_title}</div>
                          <div className="text-xs text-gray-400 mt-1 line-clamp-1">{report.infringing_content}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-light text-gray-600">
                          <div>{report.rights_holder || '未填写'}</div>
                          <div className="text-xs text-gray-400 mt-1">{report.contact_info}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full font-light ${STATUS_LABELS[report.status].color}`}>
                            {STATUS_LABELS[report.status].label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-light text-gray-500 whitespace-nowrap">
                          {new Date(report.created_at).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => selectReport(report)}
                            className="px-3 py-1 text-xs bg-[#2C5530] text-white rounded hover:bg-[#234426] transition-colors"
                          >
                            查看详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 h-fit">
              {selectedReport ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-light text-[#2C5530] mb-2">投诉详情</h3>
                    <p className="text-xs font-light text-gray-400">ID: {selectedReport.id}</p>
                  </div>

                  <div>
                    <div className="text-xs font-light text-gray-400 mb-1">作品名称</div>
                    <div className="text-sm font-light text-gray-800 leading-relaxed">{selectedReport.work_title}</div>
                  </div>

                  <div>
                    <div className="text-xs font-light text-gray-400 mb-1">权利人</div>
                    <div className="text-sm font-light text-gray-800 leading-relaxed">{selectedReport.rights_holder || '未填写'}</div>
                  </div>

                  <div>
                    <div className="text-xs font-light text-gray-400 mb-1">联系方式</div>
                    <div className="text-sm font-light text-gray-800 leading-relaxed break-words">{selectedReport.contact_info}</div>
                  </div>

                  <div>
                    <div className="text-xs font-light text-gray-400 mb-1">权属证明说明</div>
                    <div className="text-sm font-light text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedReport.proof_description}</div>
                  </div>

                  <div>
                    <div className="text-xs font-light text-gray-400 mb-1">涉嫌侵权内容</div>
                    <div className="text-sm font-light text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedReport.infringing_content}</div>
                  </div>

                  <div>
                    <label htmlFor="status" className="block text-xs font-light text-gray-500 mb-2">处理状态</label>
                    <select
                      id="status"
                      value={editStatus}
                      onChange={event => setEditStatus(event.target.value as CopyrightReport['status'])}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] bg-white font-light"
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>{STATUS_LABELS[status].label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="admin_note" className="block text-xs font-light text-gray-500 mb-2">管理员备注</label>
                    <textarea
                      id="admin_note"
                      rows={5}
                      maxLength={2000}
                      value={editNote}
                      onChange={event => setEditNote(event.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] bg-white font-light text-sm"
                    />
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full px-6 py-2 bg-[#2C5530] text-white font-light rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? '保存中...' : '保存处理结果'}
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-400 font-light py-12">请选择一条投诉查看详情</div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
