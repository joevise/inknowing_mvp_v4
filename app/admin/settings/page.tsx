/**
 * 系统设置页面
 * 管理AI服务配置 - 分成3个Tab: 对话模型、向量模型、解析模型
 * 每个Tab独立测试和保存
 */

'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BOOK_CHAT_PROMPT,
  CHARACTER_CHAT_PROMPT,
  BOOK_RECOGNITION_PROMPT,
  CHARACTER_EXTRACTION_PROMPT,
} from '@/lib/ai/prompts';

type ModelTab = 'conversation' | 'embedding' | 'parsing';
type Provider = 'aliyun' | 'openai';

interface LLMModelConfig {
  provider: Provider;
  qwen_api_key: string;
  qwen_model: string;
  qwen_base_url: string;
  openai_api_key: string;
  openai_base_url: string;
  openai_model: string;
  temperature: number;
  max_tokens: number;
  book_prompt?: string;  // 对话模型：书籍对话提示词
  character_prompt?: string;  // 对话模型：角色对话提示词
  book_recognition_prompt?: string;  // 解析模型：书籍识别提示词
  character_extraction_prompt?: string;  // 解析模型：角色提取提示词
}

interface EmbeddingModelConfig {
  provider: Provider;
  qwen_api_key: string;
  qwen_model: string;
  qwen_base_url: string;
  openai_api_key: string;
  openai_base_url: string;
  openai_model: string;
  chromadb_url: string;
}

interface AIConfig {
  conversation: LLMModelConfig;
  embedding: EmbeddingModelConfig;
  parsing: LLMModelConfig;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<Record<ModelTab, boolean>>({
    conversation: false,
    embedding: false,
    parsing: false,
  });
  const [saving, setSaving] = useState<Record<ModelTab, boolean>>({
    conversation: false,
    embedding: false,
    parsing: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ModelTab>('conversation');

  const [formData, setFormData] = useState<AIConfig>({
    conversation: {
      provider: 'aliyun',
      qwen_api_key: '',
      qwen_model: 'qwen-turbo',
      qwen_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      openai_api_key: '',
      openai_base_url: '',
      openai_model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 2000,
      book_prompt: BOOK_CHAT_PROMPT,
      character_prompt: CHARACTER_CHAT_PROMPT,
    },
    embedding: {
      provider: 'aliyun',
      qwen_api_key: '',
      qwen_model: 'text-embedding-v3',
      qwen_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      openai_api_key: '',
      openai_base_url: '',
      openai_model: 'text-embedding-3-small',
      chromadb_url: 'http://localhost:8000',
    },
    parsing: {
      provider: 'aliyun',
      qwen_api_key: '',
      qwen_model: 'qwen-max',
      qwen_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      openai_api_key: '',
      openai_base_url: '',
      openai_model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 4000,
      book_recognition_prompt: BOOK_RECOGNITION_PROMPT,
      character_extraction_prompt: CHARACTER_EXTRACTION_PROMPT,
    },
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

      if (data.config) {
        setFormData(data.config);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
      setError('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (tab: ModelTab) => {
    setError('');
    setSuccess('');
    setTestResult(null);
    setTesting({ ...testing, [tab]: true });

    try {
      const config = formData[tab];
      const response = await fetch('/api/admin/config/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, config }),
      });

      const data = await response.json();
      setTestResult(data);

      if (data.success) {
        setSuccess(`${getTabName(tab)}测试成功！`);
      } else {
        setError(`${getTabName(tab)}测试失败: ` + (data.error || '未知错误'));
      }
    } catch (err) {
      console.error('测试失败:', err);
      setError('测试失败，请重试');
    } finally {
      setTesting({ ...testing, [tab]: false });
    }
  };

  const handleSave = async (tab: ModelTab) => {
    setError('');
    setSuccess('');
    setSaving({ ...saving, [tab]: true });

    try {
      const response = await fetch('/api/admin/config/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, config: formData[tab] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      setSuccess(`${getTabName(tab)}配置保存成功`);

      // 重新加载配置以确保显示最新数据
      await fetchConfig();
    } catch (err) {
      console.error('保存失败:', err);
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving({ ...saving, [tab]: false });
    }
  };

  const getTabName = (tab: ModelTab): string => {
    const names = {
      conversation: '对话模型',
      embedding: '向量模型',
      parsing: '解析模型',
    };
    return names[tab];
  };

  const updateTabConfig = (tab: ModelTab, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        [field]: value,
      },
    }));
  };

  const renderLLMModelConfig = (tab: 'conversation' | 'parsing', config: LLMModelConfig, title: string, description: string) => {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-light text-gray-800 mb-2">{title}</h3>
          <p className="text-sm font-light text-gray-600">{description}</p>
        </div>

        {/* Provider选择 */}
        <div>
          <h4 className="text-base font-light text-gray-800 mb-3">服务提供商</h4>
          <div className="flex gap-4">
            <button
              onClick={() => updateTabConfig(tab, 'provider', 'aliyun')}
              className={`flex-1 py-3 px-6 rounded-lg border-2 transition-all ${
                config.provider === 'aliyun'
                  ? 'border-[#2C5530] bg-[#2C5530] text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-[#2C5530]'
              }`}
            >
              <div className="font-light">阿里云（通义千问）</div>
              <div className="text-xs mt-1 opacity-80">使用阿里云百炼服务</div>
            </button>
            <button
              onClick={() => updateTabConfig(tab, 'provider', 'openai')}
              className={`flex-1 py-3 px-6 rounded-lg border-2 transition-all ${
                config.provider === 'openai'
                  ? 'border-[#2C5530] bg-[#2C5530] text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-[#2C5530]'
              }`}
            >
              <div className="font-light">OpenAI 兼容</div>
              <div className="text-xs mt-1 opacity-80">DeepSeek, Moonshot, OpenAI等</div>
            </button>
          </div>
        </div>

        {/* 阿里云配置 */}
        {config.provider === 'aliyun' && (
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={config.qwen_api_key}
                onChange={(e) => updateTabConfig(tab, 'qwen_api_key', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                模型名称
              </label>
              <input
                type="text"
                value={config.qwen_model}
                onChange={(e) => updateTabConfig(tab, 'qwen_model', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                placeholder="qwen-max"
              />
              <p className="text-xs text-gray-500 mt-1">
                推荐: qwen-max (最强), qwen-plus (平衡), qwen-turbo (快速)
              </p>
            </div>

            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                Base URL
              </label>
              <input
                type="text"
                value={config.qwen_base_url}
                onChange={(e) => updateTabConfig(tab, 'qwen_base_url', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              />
            </div>
          </div>
        )}

        {/* OpenAI兼容配置 */}
        {config.provider === 'openai' && (
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                Base URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.openai_base_url}
                onChange={(e) => updateTabConfig(tab, 'openai_base_url', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
                placeholder="https://api.deepseek.com/v1"
              />
            </div>

            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={config.openai_api_key}
                onChange={(e) => updateTabConfig(tab, 'openai_api_key', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                模型名称
              </label>
              <input
                type="text"
                value={config.openai_model}
                onChange={(e) => updateTabConfig(tab, 'openai_model', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                placeholder="deepseek-chat 或 gpt-4"
              />
            </div>
          </div>
        )}

        {/* 模型参数配置 */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-base font-light text-gray-800 mb-4">模型参数</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                Temperature（温度）
              </label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => updateTabConfig(tab, 'temperature', parseFloat(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                控制输出随机性，0-2，默认0.7
              </p>
            </div>
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                Max Tokens（最大输出）
              </label>
              <input
                type="number"
                min="100"
                max="8000"
                step="100"
                value={config.max_tokens}
                onChange={(e) => updateTabConfig(tab, 'max_tokens', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                最大输出token数
              </p>
            </div>
          </div>
        </div>

        {/* 提示词配置 - 对话模型 */}
        {tab === 'conversation' && (
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-base font-light text-gray-800 mb-4">提示词配置</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-light text-gray-700 mb-2">
                  书籍对话提示词
                </label>
                <textarea
                  value={config.book_prompt || ''}
                  onChange={(e) => updateTabConfig(tab, 'book_prompt', e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-xs"
                  placeholder="用户与书籍对话时使用的系统提示词..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  支持变量: {'{bookTitle}'}, {'{author}'}, {'{bookDescription}'}, {'{ragContext}'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-light text-gray-700 mb-2">
                  角色对话提示词
                </label>
                <textarea
                  value={config.character_prompt || ''}
                  onChange={(e) => updateTabConfig(tab, 'character_prompt', e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-xs"
                  placeholder="用户与角色对话时使用的系统提示词..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  支持变量: {'{bookTitle}'}, {'{characterName}'}, {'{description}'}, {'{personality}'}, {'{speakingStyle}'}, {'{backgroundStory}'}, {'{keyQuotes}'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 提示词配置 - 解析模型 */}
        {tab === 'parsing' && (
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-base font-light text-gray-800 mb-4">提示词配置</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-light text-gray-700 mb-2">
                  书籍识别提示词
                </label>
                <textarea
                  value={config.book_recognition_prompt || ''}
                  onChange={(e) => updateTabConfig(tab, 'book_recognition_prompt', e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-xs"
                  placeholder="用户输入书名时,AI识别并返回书籍信息的提示词..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  用于书籍信息识别和提取
                </p>
              </div>

              <div>
                <label className="block text-sm font-light text-gray-700 mb-2">
                  角色提取提示词
                </label>
                <textarea
                  value={config.character_extraction_prompt || ''}
                  onChange={(e) => updateTabConfig(tab, 'character_extraction_prompt', e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-xs"
                  placeholder="根据书籍信息提取角色的提示词..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  用于从书籍中提取和生成角色信息
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <button
            onClick={() => handleTest(tab)}
            disabled={testing[tab]}
            className="flex-1 border-2 border-[#2C5530] text-[#2C5530] py-3 rounded-lg hover:bg-[#2C5530] hover:text-white transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing[tab] ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={() => handleSave(tab)}
            disabled={saving[tab]}
            className="flex-1 bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving[tab] ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    );
  };

  const renderEmbeddingModelConfig = () => {
    const config = formData.embedding;
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-light text-gray-800 mb-2">向量模型配置</h3>
          <p className="text-sm font-light text-gray-600">配置文档向量化和检索使用的Embedding模型</p>
        </div>

        {/* Provider选择 */}
        <div>
          <h4 className="text-base font-light text-gray-800 mb-3">服务提供商</h4>
          <div className="flex gap-4">
            <button
              onClick={() => updateTabConfig('embedding', 'provider', 'aliyun')}
              className={`flex-1 py-3 px-6 rounded-lg border-2 transition-all ${
                config.provider === 'aliyun'
                  ? 'border-[#2C5530] bg-[#2C5530] text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-[#2C5530]'
              }`}
            >
              <div className="font-light">阿里云（通义千问）</div>
              <div className="text-xs mt-1 opacity-80">使用阿里云百炼服务</div>
            </button>
            <button
              onClick={() => updateTabConfig('embedding', 'provider', 'openai')}
              className={`flex-1 py-3 px-6 rounded-lg border-2 transition-all ${
                config.provider === 'openai'
                  ? 'border-[#2C5530] bg-[#2C5530] text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-[#2C5530]'
              }`}
            >
              <div className="font-light">OpenAI 兼容</div>
              <div className="text-xs mt-1 opacity-80">DeepSeek, Moonshot, OpenAI等</div>
            </button>
          </div>
        </div>

        {/* 阿里云配置 */}
        {config.provider === 'aliyun' && (
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={config.qwen_api_key}
                onChange={(e) => updateTabConfig('embedding', 'qwen_api_key', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                模型名称
              </label>
              <input
                type="text"
                value={config.qwen_model}
                onChange={(e) => updateTabConfig('embedding', 'qwen_model', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                placeholder="text-embedding-v3"
              />
            </div>

            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                Base URL
              </label>
              <input
                type="text"
                value={config.qwen_base_url}
                onChange={(e) => updateTabConfig('embedding', 'qwen_base_url', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              />
            </div>
          </div>
        )}

        {/* OpenAI兼容配置 */}
        {config.provider === 'openai' && (
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                Base URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.openai_base_url}
                onChange={(e) => updateTabConfig('embedding', 'openai_base_url', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={config.openai_api_key}
                onChange={(e) => updateTabConfig('embedding', 'openai_api_key', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                模型名称
              </label>
              <input
                type="text"
                value={config.openai_model}
                onChange={(e) => updateTabConfig('embedding', 'openai_model', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                placeholder="text-embedding-3-small"
              />
            </div>
          </div>
        )}

        {/* ChromaDB配置 */}
        <div className="border-t border-gray-200 pt-6">
          <div>
            <label className="block text-sm font-light text-gray-700 mb-2">
              ChromaDB URL
            </label>
            <input
              type="text"
              value={config.chromadb_url}
              onChange={(e) => updateTabConfig('embedding', 'chromadb_url', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent font-mono text-sm"
              placeholder="http://localhost:8000"
            />
            <p className="text-xs text-gray-500 mt-1">
              向量数据库服务地址
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <button
            onClick={() => handleTest('embedding')}
            disabled={testing.embedding}
            className="flex-1 border-2 border-[#2C5530] text-[#2C5530] py-3 rounded-lg hover:bg-[#2C5530] hover:text-white transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing.embedding ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={() => handleSave('embedding')}
            disabled={saving.embedding}
            className="flex-1 bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving.embedding ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">加载中...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="系统设置">
      <main className="max-w-5xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-light text-gray-800 mb-2">AI服务配置</h2>
          <p className="text-gray-600">
            分别配置对话、向量化和解析服务的AI模型
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
            <div className="font-light">✓ {success}</div>
          </div>
        )}

        {/* 测试结果 */}
        {testResult && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${testResult.success ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
            <div className="font-light mb-2">
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

        {/* Tab导航 */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('conversation')}
                className={`flex-1 px-6 py-4 text-sm font-light transition-colors border-b-2 ${
                  activeTab === 'conversation'
                    ? 'border-[#2C5530] text-[#2C5530] bg-[#FAF9F7]'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <div className="font-light">对话模型</div>
                <div className="text-xs mt-1 opacity-70">用于用户对话交互</div>
              </button>
              <button
                onClick={() => setActiveTab('embedding')}
                className={`flex-1 px-6 py-4 text-sm font-light transition-colors border-b-2 ${
                  activeTab === 'embedding'
                    ? 'border-[#2C5530] text-[#2C5530] bg-[#FAF9F7]'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <div className="font-light">向量模型</div>
                <div className="text-xs mt-1 opacity-70">用于文档向量化</div>
              </button>
              <button
                onClick={() => setActiveTab('parsing')}
                className={`flex-1 px-6 py-4 text-sm font-light transition-colors border-b-2 ${
                  activeTab === 'parsing'
                    ? 'border-[#2C5530] text-[#2C5530] bg-[#FAF9F7]'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <div className="font-light">解析模型</div>
                <div className="text-xs mt-1 opacity-70">用于书籍解析和角色生成</div>
              </button>
            </div>
          </div>
        </div>

        {/* Tab内容 */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          {activeTab === 'conversation' && renderLLMModelConfig(
            'conversation',
            formData.conversation,
            '对话模型配置',
            '配置与用户对话交互使用的AI模型（建议使用性价比高的模型）'
          )}
          {activeTab === 'embedding' && renderEmbeddingModelConfig()}
          {activeTab === 'parsing' && renderLLMModelConfig(
            'parsing',
            formData.parsing,
            '解析模型配置',
            '配置书籍信息解析和角色生成使用的AI模型（建议使用性能强大的模型）'
          )}

          {/* 说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h4 className="font-light text-blue-900 mb-2">配置说明</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>配置保存后立即生效，无需重启应用</li>
              <li>每个模型可独立配置和测试</li>
              <li>对话模型建议用便宜的模型降低成本</li>
              <li>解析模型建议用强大的模型保证解析质量</li>
              <li>Temperature越低输出越确定，越高越随机</li>
            </ul>
          </div>
        </div>
      </main>
    </AdminLayout>
  );
}
