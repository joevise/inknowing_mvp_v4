/**
 * 编辑书籍页面
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';

interface Character {
  id: string;
  name: string;
  description: string;
  personality_traits: any;
  speaking_style?: string;
  background_story?: string;
  created_at: string;
  updated_at: string;
}

interface BookData {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url?: string;
  category: string;
  tags: string[];
  ai_knowledge_level: number;
  conversation_strategy: 'ai_native' | 'rag_only' | 'hybrid';
  status: 'draft' | 'published';
}

export default function EditBookPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<BookData>({
    id: '',
    title: '',
    author: '',
    description: '',
    cover_url: '',
    category: '文学',
    tags: [],
    ai_knowledge_level: 5,
    conversation_strategy: 'hybrid',
    status: 'draft'
  });

  const [tagInput, setTagInput] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [charsLoading, setCharsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', personality_traits: '', speaking_style: '', background_story: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (bookId) {
      fetchBookData();
      fetchCharacters();
    }
  }, [bookId]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (!response.ok) {
        router.push('/admin/login');
        return;
      }
      fetchBookData();
    } catch (error) {
      console.error('验证失败:', error);
      router.push('/admin/login');
    }
  };

  const fetchBookData = async () => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}`);
      if (!response.ok) {
        throw new Error('获取书籍信息失败');
      }
      const data = await response.json();

      setFormData({
        id: data.id,
        title: data.title || '',
        author: data.author || '',
        description: data.description || '',
        cover_url: data.cover_url || '',
        category: data.category || '文学',
        tags: data.tags || [],
        ai_knowledge_level: data.ai_knowledge_level || 5,
        conversation_strategy: data.conversation_strategy || 'hybrid',
        status: data.status || 'draft'
      });
    } catch (error) {
      console.error('获取书籍失败:', error);
      setError(error instanceof Error ? error.message : '获取书籍失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCharacters = async () => {
    try {
      setCharsLoading(true);
      const res = await fetch(`/api/admin/characters?bookId=${bookId}&pageSize=100`);
      if (!res.ok) throw new Error('获取角色失败');
      const data = await res.json();
      setCharacters(data.characters || []);
    } catch (error) {
      console.error('获取角色失败:', error);
    } finally {
      setCharsLoading(false);
    }
  };

  const handleExtractMore = async () => {
    if (!confirm('确定要为本书提取更多角色吗？')) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/admin/characters/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookIds: [bookId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提取失败');
      setSuccess(`已提取 ${data.totalNewCharacters || 0} 个新角色`);
      await fetchCharacters();
    } catch (error) {
      setError(error instanceof Error ? error.message : '提取失败');
    } finally {
      setExtracting(false);
    }
  };

  const handleAddCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setAddSubmitting(true);
    try {
      const traits = addForm.personality_traits ? addForm.personality_traits.split(',').map(t => t.trim()).filter(Boolean) : [];
      const res = await fetch('/api/admin/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          name: addForm.name,
          description: addForm.description,
          personality_traits: traits,
          speaking_style: addForm.speaking_style,
          background_story: addForm.background_story,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      setShowAddModal(false);
      setAddForm({ name: '', description: '', personality_traits: '', speaking_style: '', background_story: '' });
      await fetchCharacters();
    } catch (error) {
      setError(error instanceof Error ? error.message : '创建失败');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleDeleteCharacter = async (id: string, name: string) => {
    if (!confirm(`确定要删除角色"${name}"吗？`)) return;
    try {
      const res = await fetch(`/api/admin/characters/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      await fetchCharacters();
    } catch (error) {
      setError(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          author: formData.author,
          description: formData.description,
          cover_url: formData.cover_url,
          category: formData.category,
          tags: formData.tags,
          ai_score: formData.ai_knowledge_level,
          conversation_strategy: formData.conversation_strategy,
          status: formData.status
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '保存失败');
      }

      setSuccess('保存成功！');
      setTimeout(() => {
        router.push('/admin/books');
      }, 1000);
    } catch (error) {
      console.error('保存失败:', error);
      setError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
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
    <AdminLayout title="编辑书籍">
      <main className="max-w-4xl mx-auto px-8 py-12">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Link
            href="/admin/books"
            className="text-gray-600 hover:text-[#2C5530] font-light"
          >
            ← 返回书籍列表
          </Link>
        </div>

        {/* 错误/成功提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 text-green-600 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* 编辑表单 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-light text-gray-800 mb-6">书籍信息</h2>

          <div className="space-y-6">
            {/* 书名 */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                书名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              />
            </div>

            {/* 作者 */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                作者 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              />
            </div>

            {/* 简介 */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                简介 <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              />
            </div>

            {/* 分类 */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                分类
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              >
                <option value="文学">文学</option>
                <option value="商业">商业</option>
                <option value="科学">科学</option>
                <option value="心理">心理</option>
                <option value="哲学">哲学</option>
              </select>
            </div>

            {/* 标签 */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                标签
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="输入标签后按回车"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  添加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* AI了解度 */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                AI了解度: {formData.ai_knowledge_level}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.ai_knowledge_level}
                onChange={(e) => setFormData({ ...formData, ai_knowledge_level: parseInt(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                AI对这本书的了解程度
              </p>
            </div>

            {/* 对话策略 */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                对话策略
              </label>
              <select
                value={formData.conversation_strategy}
                onChange={(e) => setFormData({ ...formData, conversation_strategy: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              >
                <option value="ai_native">AI原生 - 仅使用AI知识</option>
                <option value="rag_only">RAG检索 - 仅使用文档知识</option>
                <option value="hybrid">混合模式 - 智能选择</option>
              </select>
            </div>

            {/* 封面URL */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                封面URL
              </label>
              <input
                type="text"
                value={formData.cover_url}
                onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                placeholder="https://example.com/cover.jpg 或 /covers/xxx.jpg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              />
            </div>

            {/* 状态 */}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-2">
                状态
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              >
                <option value="draft">草稿</option>
                <option value="published">已上架</option>
              </select>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/admin/books')}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors font-light"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>

        {/* 角色管理 Section */}
        <div className="mt-10 bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-gray-800">角色管理</h2>
            <div className="flex gap-2">
              <button
                onClick={handleExtractMore}
                disabled={extracting}
                className="px-4 py-2 bg-[#2C5530] text-white rounded-lg hover:bg-[#1a2e1c] font-light text-sm disabled:opacity-50"
              >
                {extracting ? '提取中...' : '🤖 AI 提取更多角色'}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 border border-[#2C5530] text-[#2C5530] rounded-lg hover:bg-[#f5f9f6] font-light text-sm"
              >
                ➕ 手动添加角色
              </button>
              <Link
                href={`/admin/characters?bookId=${bookId}`}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-light text-sm"
              >
                打开全局管理
              </Link>
            </div>
          </div>

          {charsLoading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : characters.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              当前共 0 个角色
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map((char) => (
                <div key={char.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-light text-gray-900">{char.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {char.description || '暂无简介'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <Link
                      href={`/admin/characters/${char.id}/edit`}
                      className="text-xs text-[#2C5530] hover:underline"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDeleteCharacter(char.id, char.name)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 添加角色弹窗 */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-light text-gray-800 mb-4">手动添加角色</h3>
              <form onSubmit={handleAddCharacter} className="space-y-4">
                <div>
                  <label className="block text-sm font-light text-gray-700 mb-1">
                    角色名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-light text-gray-700 mb-1">简介</label>
                  <textarea
                    rows={3}
                    value={addForm.description}
                    onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-light text-gray-700 mb-1">性格特征（逗号分隔）</label>
                  <input
                    type="text"
                    value={addForm.personality_traits}
                    onChange={(e) => setAddForm({ ...addForm, personality_traits: e.target.value })}
                    placeholder="勇敢,聪明,善良"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-light text-gray-700 mb-1">说话风格</label>
                  <input
                    type="text"
                    value={addForm.speaking_style}
                    onChange={(e) => setAddForm({ ...addForm, speaking_style: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-light text-gray-700 mb-1">背景故事</label>
                  <textarea
                    rows={2}
                    value={addForm.background_story}
                    onChange={(e) => setAddForm({ ...addForm, background_story: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 font-light"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={addSubmitting}
                    className="flex-1 bg-[#2C5530] text-white py-2 rounded-lg hover:bg-[#1a2e1c] font-light disabled:opacity-50"
                  >
                    {addSubmitting ? '创建中...' : '创建'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
