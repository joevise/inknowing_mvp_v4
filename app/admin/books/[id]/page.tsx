/**
 * 编辑书籍页面
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5DC]">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      {/* 导航栏 */}
      <nav className="bg-white border-b px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#2F5233]">编辑书籍</h1>
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
            <Link href="/admin/settings" className="text-gray-600 hover:text-[#2F5233]">
              系统设置
            </Link>
            <button onClick={handleLogout} className="text-red-600 hover:text-red-700">
              退出登录
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-12">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Link
            href="/admin/books"
            className="text-gray-600 hover:text-[#2F5233]"
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
          <h2 className="text-2xl font-bold text-gray-800 mb-6">书籍信息</h2>

          <div className="space-y-6">
            {/* 书名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                书名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
              />
            </div>

            {/* 作者 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                作者 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
              />
            </div>

            {/* 简介 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                简介 <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
              />
            </div>

            {/* 分类 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分类
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                对话策略
              </label>
              <select
                value={formData.conversation_strategy}
                onChange={(e) => setFormData({ ...formData, conversation_strategy: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
              >
                <option value="ai_native">AI原生 - 仅使用AI知识</option>
                <option value="rag_only">RAG检索 - 仅使用文档知识</option>
                <option value="hybrid">混合模式 - 智能选择</option>
              </select>
            </div>

            {/* 封面URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                封面URL
              </label>
              <input
                type="text"
                value={formData.cover_url}
                onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                placeholder="https://example.com/cover.jpg 或 /covers/xxx.jpg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
              />
            </div>

            {/* 状态 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                状态
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
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
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#2F5233] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
