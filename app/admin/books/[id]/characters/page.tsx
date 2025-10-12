/**
 * 书籍角色管理页面
 * 支持AI提取和手动添加角色
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
}

interface Character {
  id: string;
  name: string;
  description: string;
  personality_traits: any;
  speaking_style?: string;
  background_story?: string;
}

export default function BookCharactersPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<Book | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 手动添加模式
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualCharacter, setManualCharacter] = useState({
    name: '',
    description: '',
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
      fetchData();
    } catch (error) {
      console.error('验证失败:', error);
      router.push('/admin/login');
    }
  };

  const fetchData = async () => {
    try {
      // 获取书籍信息
      const bookResponse = await fetch(`/api/admin/books/${bookId}`);
      if (!bookResponse.ok) {
        throw new Error('获取书籍信息失败');
      }
      const bookData = await bookResponse.json();
      setBook(bookData);

      // 获取角色列表
      const charsResponse = await fetch(`/api/admin/books/${bookId}/characters`);
      if (charsResponse.ok) {
        const charsData = await charsResponse.json();
        setCharacters(charsData.characters || []);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      setError(error instanceof Error ? error.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAIExtract = async () => {
    const confirmMessage = characters.length > 0
      ? `已有${characters.length}个角色。确定要提取更多角色吗？这可能需要几秒钟时间。`
      : '确定要让AI自动提取角色吗？这可能需要几秒钟时间。';

    if (!confirm(confirmMessage)) return;

    setError('');
    setSuccess('');
    setExtracting(true);

    try {
      const response = await fetch(`/api/admin/books/${bookId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ai_extract' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI提取失败');
      }

      setSuccess(data.message || '角色提取成功！');
      // 追加新角色到现有列表
      setCharacters([...characters, ...(data.characters || [])]);
    } catch (error) {
      console.error('AI提取失败:', error);
      setError(error instanceof Error ? error.message : 'AI提取失败');
    } finally {
      setExtracting(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!manualCharacter.name.trim()) {
      setError('角色名称不能为空');
      return;
    }

    try {
      const response = await fetch(`/api/admin/books/${bookId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          character: {
            name: manualCharacter.name,
            description: manualCharacter.description,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建失败');
      }

      setSuccess('角色创建成功！');
      setCharacters([...characters, data.character]);
      setManualCharacter({ name: '', description: '' });
      setShowManualForm(false);
    } catch (error) {
      console.error('创建失败:', error);
      setError(error instanceof Error ? error.message : '创建失败');
    }
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

  if (!book) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-red-600">书籍不存在</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="角色管理">
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Link
            href="/admin/characters"
            className="text-gray-600 hover:text-[#2C5530] font-light"
          >
            ← 返回角色列表
          </Link>
        </div>

        {/* 书籍信息 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-light text-gray-800 mb-2">{book.title}</h2>
          <p className="text-gray-600 mb-1">作者：{book.author}</p>
          <p className="text-sm text-gray-500">{book.description}</p>
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

        {/* 操作区域 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-light text-gray-800 mb-4">添加角色</h3>

          <div className="flex gap-4 mb-6">
            <button
              onClick={handleAIExtract}
              disabled={extracting}
              className="flex-1 bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {extracting
                ? 'AI提取中...'
                : characters.length > 0
                  ? `🤖 提取更多角色 (已有${characters.length}个)`
                  : '🤖 AI自动提取角色'
              }
            </button>
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex-1 border-2 border-[#2C5530] text-[#2C5530] py-3 rounded-lg hover:bg-[#2C5530] hover:text-white transition-colors font-light"
            >
              ✏️ 手动添加角色
            </button>
          </div>

          {/* 手动添加表单 */}
          {showManualForm && (
            <form onSubmit={handleManualAdd} className="border-t pt-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-light text-gray-700 mb-2">
                    角色名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualCharacter.name}
                    onChange={(e) => setManualCharacter({ ...manualCharacter, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                    placeholder="例如：叶文洁"
                  />
                </div>
                <div>
                  <label className="block text-sm font-light text-gray-700 mb-2">
                    角色简介
                  </label>
                  <textarea
                    rows={3}
                    value={manualCharacter.description}
                    onChange={(e) => setManualCharacter({ ...manualCharacter, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                    placeholder="简要描述这个角色..."
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 font-light"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#2C5530] text-white py-2 rounded-lg hover:bg-[#1a2e1c] font-light"
                  >
                    创建角色
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-light text-blue-900 mb-2">💡 提示</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>AI自动提取</strong>：让AI根据书籍信息自动识别并创建主要角色，每次提取3-5个</li>
              <li><strong>提取更多角色</strong>：如果角色较多，可以多次提取，AI会自动跳过已提取的角色</li>
              <li><strong>手动添加</strong>：自己创建角色，可以添加AI未识别的角色</li>
              <li>创建后可以在角色列表中编辑详细信息</li>
            </ul>
          </div>
        </div>

        {/* 现有角色列表 */}
        {characters.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-light text-gray-800">
                现有角色 ({characters.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">角色名</th>
                    <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">简介</th>
                    <th className="px-6 py-3 text-center text-xs font-light text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {characters.map((char) => (
                    <tr key={char.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-light text-gray-900">
                        {char.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {char.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Link
                          href={`/admin/characters/${char.id}/edit`}
                          className="text-[#2C5530] hover:text-[#1a2e1c] text-sm font-light"
                        >
                          编辑
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
