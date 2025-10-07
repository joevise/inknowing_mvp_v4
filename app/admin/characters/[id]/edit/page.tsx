/**
 * 角色编辑页面
 * PUT /api/admin/characters/{id}
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Character {
  id: string;
  book_id: string;
  name: string;
  description: string;
  personality_traits: Record<string, any>;
  speaking_style?: string;
  background_story?: string;
  prompt_template?: string;
}

export default function EditCharacterPage() {
  const router = useRouter();
  const params = useParams();
  const characterId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [character, setCharacter] = useState<Character | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    personalityTraits: '',
    speakingStyle: '',
    backgroundStory: '',
    promptTemplate: '',
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
      fetchCharacter();
    } catch (error) {
      console.error('验证失败:', error);
      router.push('/admin/login');
    }
  };

  const fetchCharacter = async () => {
    try {
      const response = await fetch(`/api/admin/characters/${characterId}`);
      if (!response.ok) {
        throw new Error('获取角色信息失败');
      }
      const data = await response.json();
      setCharacter(data.character);

      // 填充表单
      setFormData({
        name: data.character.name,
        description: data.character.description || '',
        personalityTraits: JSON.stringify(data.character.personality_traits || {}, null, 2),
        speakingStyle: data.character.speaking_style || '',
        backgroundStory: data.character.background_story || '',
        promptTemplate: data.character.prompt_template || '',
      });
    } catch (error) {
      console.error('获取角色失败:', error);
      setError('获取角色信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      // 解析personality_traits
      let personalityTraits = {};
      if (formData.personalityTraits.trim()) {
        try {
          personalityTraits = JSON.parse(formData.personalityTraits);
        } catch (err) {
          throw new Error('性格特征JSON格式错误');
        }
      }

      const response = await fetch(`/api/admin/characters/${characterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          personalityTraits,
          speakingStyle: formData.speakingStyle || null,
          backgroundStory: formData.backgroundStory || null,
          promptTemplate: formData.promptTemplate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失败');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/characters');
      }, 1500);
    } catch (err) {
      console.error('更新失败:', err);
      setError(err instanceof Error ? err.message : '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">角色不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      {/* 导航栏 */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <Link
            href="/admin/characters"
            className="text-gray-600 hover:text-[#2F5233]"
          >
            ← 返回角色列表
          </Link>
          <h1 className="text-2xl font-bold text-[#2F5233]">编辑角色</h1>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-8 py-12">
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-sm p-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">角色信息</h2>

            {/* 错误提示 */}
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* 成功提示 */}
            {success && (
              <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm">
                ✓ 更新成功！正在跳转...
              </div>
            )}

            {/* 角色名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角色名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                required
              />
            </div>

            {/* 简介 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                简介
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                placeholder="角色的基本描述"
              />
            </div>

            {/* 性格特征 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                性格特征 (JSON格式)
              </label>
              <textarea
                value={formData.personalityTraits}
                onChange={(e) => setFormData({ ...formData, personalityTraits: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent font-mono text-sm"
                placeholder='{"勇敢": 9, "聪明": 8}'
              />
              <p className="text-xs text-gray-500 mt-1">
                示例: {`{"勇敢": 9, "聪明": 8, "幽默": 7}`}
              </p>
            </div>

            {/* 说话风格 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                说话风格
              </label>
              <textarea
                value={formData.speakingStyle}
                onChange={(e) => setFormData({ ...formData, speakingStyle: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                placeholder="描述角色的说话方式、用词习惯等"
              />
            </div>

            {/* 背景故事 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                背景故事
              </label>
              <textarea
                value={formData.backgroundStory}
                onChange={(e) => setFormData({ ...formData, backgroundStory: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                placeholder="角色的成长经历、重要事件等"
              />
            </div>

            {/* Prompt模板 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt模板 (高级)
              </label>
              <textarea
                value={formData.promptTemplate}
                onChange={(e) => setFormData({ ...formData, promptTemplate: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent font-mono text-sm"
                placeholder="自定义AI对话时使用的prompt模板"
              />
              <p className="text-xs text-gray-500 mt-1">
                留空将使用系统默认模板
              </p>
            </div>

            {/* 按钮 */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/admin/characters')}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={saving}
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#2F5233] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-medium disabled:opacity-50"
                disabled={saving}
              >
                {saving ? '保存中...' : '保存更新'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
