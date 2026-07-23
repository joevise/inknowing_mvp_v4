/**
 * 套餐管理页
 * 列表 / 新增 / 编辑 / 停用
 * 风格与其它 admin 页一致: AdminLayout + 表格 + 操作按钮
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';

interface Plan {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface PlanFeature {
  feature_key: string;
  feature_value: string;
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
  free: '免费',
  monthly: '月度',
  quarterly: '季度',
  yearly: '年度',
  lifetime: '终身',
};

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return '免费';
  const yuan = (cents / 100).toFixed(2);
  return currency === 'CNY' ? `¥${yuan}` : `${yuan} ${currency}`;
}

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 编辑/新增弹窗
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    description: '',
    price_cents: '0',
    currency: 'CNY',
    billing_cycle: 'monthly',
    sort_order: '0',
    is_active: true,
    is_default: false,
  });
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [newFeatureKey, setNewFeatureKey] = useState('');
  const [newFeatureValue, setNewFeatureValue] = useState('');
  const [saving, setSaving] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (!response.ok) {
        router.push('/admin/login');
        return;
      }
      fetchPlans();
    } catch (err) {
      console.error('验证失败:', err);
      router.push('/admin/login');
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/plans');
      if (!response.ok) throw new Error('获取套餐列表失败');
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err) {
      console.error('获取套餐失败:', err);
      setError(err instanceof Error ? err.message : '获取套餐列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreateEditor = () => {
    setEditorMode('create');
    setEditingPlan(null);
    setFormData({
      name: '',
      name_en: '',
      description: '',
      price_cents: '0',
      currency: 'CNY',
      billing_cycle: 'monthly',
      sort_order: String(plans.length),
      is_active: true,
      is_default: false,
    });
    setFeatures([]);
    setShowEditor(true);
  };

  const openEditEditor = async (plan: Plan) => {
    setEditorMode('edit');
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      name_en: plan.name_en || '',
      description: plan.description || '',
      price_cents: String(plan.price_cents),
      currency: plan.currency,
      billing_cycle: plan.billing_cycle,
      sort_order: String(plan.sort_order),
      is_active: plan.is_active,
      is_default: plan.is_default,
    });

    // 获取功能权限
    try {
      const response = await fetch(`/api/admin/plans/${plan.id}`);
      const data = await response.json();
      const featureMap = data.features || {};
      setFeatures(
        Object.entries(featureMap).map(([key, value]) => ({
          feature_key: key,
          feature_value: String(value),
        }))
      );
    } catch {
      setFeatures([]);
    }

    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');

    try {
      // 保存套餐基本信息
      const url = editorMode === 'create'
        ? '/api/admin/plans'
        : `/api/admin/plans/${editingPlan!.id}`;
      const method = editorMode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price_cents: parseInt(formData.price_cents, 10) || 0,
          sort_order: parseInt(formData.sort_order, 10) || 0,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      // 保存功能权限（仅编辑模式）
      if (editorMode === 'edit' && editingPlan) {
        const featuresObj: Record<string, string> = {};
        features.forEach(f => {
          featuresObj[f.feature_key] = f.feature_value;
        });

        const featResponse = await fetch(
          `/api/admin/plans/${editingPlan.id}/features`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features: featuresObj }),
          }
        );
        if (!featResponse.ok) {
          const featData = await featResponse.json();
          throw new Error(featData.error || '保存功能权限失败');
        }
      }

      setShowEditor(false);
      await fetchPlans();
    } catch (err) {
      console.error('保存失败:', err);
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    const action = plan.is_active ? '停用' : '启用';
    if (!confirm(`确定${action}套餐「${plan.name}」?`)) return;

    try {
      const response = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${action}失败`);
      await fetchPlans();
    } catch (err) {
      console.error(`${action}失败:`, err);
      setError(err instanceof Error ? err.message : `${action}失败`);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`确定删除套餐「${plan.name}」?（停用后不可恢复）`)) return;
    try {
      const response = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '删除失败');
      await fetchPlans();
    } catch (err) {
      console.error('删除失败:', err);
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const addFeature = () => {
    const key = newFeatureKey.trim();
    const value = newFeatureValue.trim();
    if (!key) return;
    if (features.some(f => f.feature_key === key)) {
      setError(`功能「${key}」已存在`);
      return;
    }
    setFeatures([...features, { feature_key: key, feature_value: value }]);
    setNewFeatureKey('');
    setNewFeatureValue('');
  };

  const removeFeature = (key: string) => {
    setFeatures(features.filter(f => f.feature_key !== key));
  };

  const updateFeatureValue = (key: string, value: string) => {
    setFeatures(features.map(f =>
      f.feature_key === key ? { ...f, feature_value: value } : f
    ));
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-light text-gray-800 mb-1">套餐管理</h2>
            <p className="text-sm font-light text-gray-500">
              管理订阅套餐及功能权限配置
            </p>
          </div>
          <button
            onClick={openCreateEditor}
            className="px-6 py-2 bg-[#2C5530] text-white font-light rounded-lg hover:bg-[#234426] transition-colors"
          >
            + 新增套餐
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">关闭</button>
          </div>
        )}

        {/* 套餐列表 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 font-light">加载中...</div>
          ) : plans.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-light">
              暂无套餐，点击右上角「新增套餐」创建
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      套餐名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      价格
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      周期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      排序
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-light text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plans.map(plan => (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-light text-gray-900">{plan.name}</div>
                        {plan.name_en && (
                          <div className="text-xs text-gray-500">{plan.name_en}</div>
                        )}
                        {plan.is_default && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                            默认
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatPrice(plan.price_cents, plan.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {BILLING_CYCLE_LABELS[plan.billing_cycle] || plan.billing_cycle}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {plan.sort_order}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            plan.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {plan.is_active ? '上架' : '已停用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditEditor(plan)}
                            className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleToggleActive(plan)}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              plan.is_active
                                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {plan.is_active ? '停用' : '启用'}
                          </button>
                          {!plan.is_default && (
                            <button
                              onClick={() => handleDelete(plan)}
                              className="px-3 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 编辑/新增弹窗 */}
        {showEditor && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-light text-gray-800">
                  {editorMode === 'create' ? '新增套餐' : '编辑套餐'}
                </h3>
                <button
                  onClick={() => setShowEditor(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-light text-gray-500 mb-1">
                      套餐名称 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] font-light"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-light text-gray-500 mb-1">
                      英文名称
                    </label>
                    <input
                      type="text"
                      value={formData.name_en}
                      onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] font-light"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-light text-gray-500 mb-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] font-light"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-light text-gray-500 mb-1">
                      价格（分）
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.price_cents}
                      onChange={e => setFormData({ ...formData, price_cents: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] font-light"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-light text-gray-500 mb-1">
                      币种
                    </label>
                    <select
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] font-light bg-white"
                    >
                      <option value="CNY">CNY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-light text-gray-500 mb-1">
                      周期
                    </label>
                    <select
                      value={formData.billing_cycle}
                      onChange={e => setFormData({ ...formData, billing_cycle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] font-light bg-white"
                    >
                      <option value="free">免费</option>
                      <option value="monthly">月度</option>
                      <option value="quarterly">季度</option>
                      <option value="yearly">年度</option>
                      <option value="lifetime">终身</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-light text-gray-500 mb-1">
                      排序（数字越小越靠前）
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.sort_order}
                      onChange={e => setFormData({ ...formData, sort_order: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] font-light"
                    />
                  </div>
                  <div className="flex items-end gap-4 pb-2">
                    <label className="flex items-center gap-2 text-sm font-light text-gray-700">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4"
                      />
                      上架
                    </label>
                    <label className="flex items-center gap-2 text-sm font-light text-gray-700">
                      <input
                        type="checkbox"
                        checked={formData.is_default}
                        onChange={e => setFormData({ ...formData, is_default: e.target.checked })}
                        className="w-4 h-4"
                      />
                      默认套餐
                    </label>
                  </div>
                </div>

                {/* 功能权限编辑器（仅编辑模式） */}
                {editorMode === 'edit' && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-light text-gray-700 mb-3">功能权限</h4>

                    {features.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {features.map(f => (
                          <div key={f.feature_key} className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-600 w-48 truncate">
                              {f.feature_key}
                            </span>
                            <input
                              type="text"
                              value={f.feature_value}
                              onChange={e => updateFeatureValue(f.feature_key, e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm font-light focus:outline-none focus:border-[#2C5530]"
                            />
                            <button
                              type="button"
                              onClick={() => removeFeature(f.feature_key)}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="功能 key（如 daily_message_limit）"
                        value={newFeatureKey}
                        onChange={e => setNewFeatureKey(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm font-light focus:outline-none focus:border-[#2C5530]"
                      />
                      <input
                        type="text"
                        placeholder="值（如 -1, true, 20）"
                        value={newFeatureValue}
                        onChange={e => setNewFeatureValue(e.target.value)}
                        className="w-32 px-2 py-1 border border-gray-200 rounded text-sm font-light focus:outline-none focus:border-[#2C5530]"
                      />
                      <button
                        type="button"
                        onClick={addFeature}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        添加
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      提示：数字直接填（-1 表示无限），布尔用 true/false
                    </p>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowEditor(false)}
                    className="px-4 py-2 text-sm font-light text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 text-sm font-light bg-[#2C5530] text-white rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
