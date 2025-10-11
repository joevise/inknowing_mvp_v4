/**
 * 系统设置页面
 * 管理AI服务配置
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AIConfig {
  provider: 'aliyun' | 'openai';
  qwen_api_key: string;
  qwen_model: string;
  qwen_base_url: string;
  qwen_embedding_model: string;
  chromadb_url: string;
  openai_compatible: {
    enabled: boolean;
    base_url: string;
    api_key: string;
    model: string;
    embedding_model: string;
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [needRestart, setNeedRestart] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    test_response?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    provider: 'aliyun' as 'aliyun' | 'openai',
    qwen_api_key: '',
    qwen_model: 'qwen-max',
    qwen_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    qwen_embedding_model: 'text-embedding-v3',
    chromadb_url: 'http://localhost:8000',
    openai_base_url: '',
    openai_api_key: '',
    openai_model: 'gpt-4',
    openai_embedding_model: 'text-embedding-3-small',
  });

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
      fetchConfig();
    } catch (error) {
      console.error('验证失败:', error);
      router.push('/admin/login');
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/config/ai');
      if (!response.ok) throw new Error('获取配置失败');
      const data = await response.json();

      setConfig(data.config);
      setFormData({
        provider: data.config.provider || 'aliyun',
        qwen_api_key: data.config.qwen_api_key || '',
        qwen_model: data.config.qwen_model || 'qwen-max',
        qwen_base_url: data.config.qwen_base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        qwen_embedding_model: data.config.qwen_embedding_model || 'text-embedding-v3',
        chromadb_url: data.config.chromadb_url || 'http://localhost:8000',
        openai_base_url: data.config.openai_compatible?.base_url || '',
        openai_api_key: data.config.openai_compatible?.api_key || '',
        openai_model: data.config.openai_compatible?.model || 'gpt-4',
        openai_embedding_model: data.config.openai_compatible?.embedding_model || 'text-embedding-3-small',
      });
    } catch (error) {
      console.error('获取配置失败:', error);
      setError('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setError('');
    setSuccess('');
    setTestResult(null);
    setTesting(true);

    try {
      const response = await fetch('/api/admin/config/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qwen_api_key: formData.qwen_api_key,
          qwen_model: formData.qwen_model,
          qwen_base_url: formData.qwen_base_url,
        }),
      });

      const data = await response.json();
      setTestResult(data);

      if (data.success) {
        setSuccess('AI服务连接测试成功！');
      } else {
        setError('连接测试失败: ' + (data.error || '未知错误'));
      }
    } catch (err) {
      console.error('测试失败:', err);
      setError('测试失败，请重试');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await fetch('/api/admin/config/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formData.provider,
          qwen_api_key: formData.qwen_api_key,
          qwen_model: formData.qwen_model,
          qwen_base_url: formData.qwen_base_url,
          qwen_embedding_model: formData.qwen_embedding_model,
          chromadb_url: formData.chromadb_url,
          openai_compatible: {
            base_url: formData.openai_base_url,
            api_key: formData.openai_api_key,
            model: formData.openai_model,
            embedding_model: formData.openai_embedding_model,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      setSuccess(data.message || '配置保存成功');
      setNeedRestart(data.needRestart || false);

      // 如果有额外说明，显示提示
      if (data.note) {
        setTimeout(() => {
          alert(data.note);
        }, 500);
      }
    } catch (err) {
      console.error('保存失败:', err);
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      {/* 导航栏 */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-[#2F5233]">系统设置</h1>
          <div className="flex gap-6">
            <Link href="/admin" className="text-gray-600 hover:text-[#2F5233]">
              仪表板
            </Link>
            <Link href="/admin/books" className="text-gray-600 hover:text-[#2F5233]">
              书籍管理
            </Link>
            <Link href="/admin/characters" className="text-gray-600 hover:text-[#2F5233]">
              角色管理
            </Link>
            <Link href="/admin/documents" className="text-gray-600 hover:text-[#2F5233]">
              文档管理
            </Link>
            <Link
              href="/admin/settings"
              className="text-[#2F5233] hover:text-[#1a2e1c] font-medium"
            >
              系统设置
            </Link>
            <button onClick={handleLogout} className="text-red-600 hover:text-red-700">
              退出登录
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">AI服务配置</h2>
          <p className="text-gray-600">
            配置通义千问API和向量数据库服务
          </p>
        </div>

        {/* 错误/成功提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 text-green-600 px-4 py-3 rounded-lg">
            <div className="font-medium">✓ {success}</div>
          </div>
        )}

        {/* 测试结果 */}
        {testResult && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${testResult.success ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
            <div className="font-medium mb-2">
              {testResult.success ? '✓ 连接成功' : '✗ 连接失败'}
            </div>
            {testResult.test_response && (
              <div className="text-sm mt-2">
                <strong>AI响应:</strong> {testResult.test_response}
              </div>
            )}
            {testResult.error && (
              <div className="text-sm mt-2">
                <strong>错误信息:</strong> {testResult.error}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-6">
          {/* 模式选择器 */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">AI服务提供商</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setFormData({ ...formData, provider: 'aliyun' })}
                className={`flex-1 py-3 px-6 rounded-lg border-2 transition-all ${
                  formData.provider === 'aliyun'
                    ? 'border-[#2F5233] bg-[#2F5233] text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-[#2F5233]'
                }`}
              >
                <div className="font-medium">阿里云（通义千问）</div>
                <div className="text-xs mt-1 opacity-80">使用阿里云百炼服务</div>
              </button>
              <button
                onClick={() => setFormData({ ...formData, provider: 'openai' })}
                className={`flex-1 py-3 px-6 rounded-lg border-2 transition-all ${
                  formData.provider === 'openai'
                    ? 'border-[#2F5233] bg-[#2F5233] text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-[#2F5233]'
                }`}
              >
                <div className="font-medium">OpenAI 兼容</div>
                <div className="text-xs mt-1 opacity-80">DeepSeek, Moonshot, OpenAI等</div>
              </button>
            </div>
          </div>

          {/* 阿里云配置 */}
          {formData.provider === 'aliyun' && (
            <>
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">语言模型配置</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.qwen_api_key}
                      onChange={(e) => setFormData({ ...formData, qwen_api_key: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent font-mono text-sm"
                      placeholder="sk-..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      在阿里云百炼控制台获取API Key
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      模型名称
                    </label>
                    <select
                      value={formData.qwen_model}
                      onChange={(e) => setFormData({ ...formData, qwen_model: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                    >
                      <option value="qwen-max">qwen-max (最强性能)</option>
                      <option value="qwen-plus">qwen-plus (平衡性能)</option>
                      <option value="qwen-turbo">qwen-turbo (快速响应)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={formData.qwen_base_url}
                      onChange={(e) => setFormData({ ...formData, qwen_base_url: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent font-mono text-sm"
                      placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">向量模型配置</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Embedding模型
                    </label>
                    <input
                      type="text"
                      value={formData.qwen_embedding_model}
                      onChange={(e) => setFormData({ ...formData, qwen_embedding_model: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                      placeholder="text-embedding-v3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ChromaDB URL
                    </label>
                    <input
                      type="text"
                      value={formData.chromadb_url}
                      onChange={(e) => setFormData({ ...formData, chromadb_url: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent font-mono text-sm"
                      placeholder="http://localhost:8000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      向量数据库服务地址
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* OpenAI兼容配置 */}
          {formData.provider === 'openai' && (
            <>
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">语言模型配置</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.openai_base_url}
                      onChange={(e) => setFormData({ ...formData, openai_base_url: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent font-mono text-sm"
                      placeholder="https://api.deepseek.com/v1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      OpenAI兼容API地址（如DeepSeek, Moonshot等）
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.openai_api_key}
                      onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent font-mono text-sm"
                      placeholder="sk-..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      模型名称
                    </label>
                    <input
                      type="text"
                      value={formData.openai_model}
                      onChange={(e) => setFormData({ ...formData, openai_model: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                      placeholder="deepseek-chat 或 gpt-4"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      填写对话模型名称
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">向量模型配置</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Embedding模型名称
                    </label>
                    <input
                      type="text"
                      value={formData.openai_embedding_model}
                      onChange={(e) => setFormData({ ...formData, openai_embedding_model: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                      placeholder="text-embedding-3-small"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      向量化模型名称
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ChromaDB URL
                    </label>
                    <input
                      type="text"
                      value={formData.chromadb_url}
                      onChange={(e) => setFormData({ ...formData, chromadb_url: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent font-mono text-sm"
                      placeholder="http://localhost:8000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      向量数据库服务地址
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={handleTest}
              disabled={
                testing ||
                (formData.provider === 'aliyun' && !formData.qwen_api_key) ||
                (formData.provider === 'openai' && (!formData.openai_api_key || !formData.openai_base_url))
              }
              className="flex-1 border-2 border-[#2F5233] text-[#2F5233] py-3 rounded-lg hover:bg-[#2F5233] hover:text-white transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button
              onClick={handleSave}
              disabled={
                saving ||
                (formData.provider === 'aliyun' && !formData.qwen_api_key) ||
                (formData.provider === 'openai' && (!formData.openai_api_key || !formData.openai_base_url))
              }
              className="flex-1 bg-[#2F5233] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>

          {/* 说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-blue-900 mb-2">配置说明</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>配置保存后立即生效，无需重启应用</li>
              <li>建议先点击"测试连接"验证API Key有效性</li>
              <li>通义千问API Key可在阿里云百炼控制台获取</li>
              <li>ChromaDB默认运行在 localhost:8000</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
