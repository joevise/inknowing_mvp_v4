/**
 * 书籍管理页面
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminBooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      fetchBooks();
    } catch (error) {
      console.error('验证失败:', error);
      router.push('/admin/login');
    }
  };

  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/admin/books');
      if (!res.ok) {
        throw new Error('获取书籍列表失败');
      }
      const data = await res.json();
      // API返回格式: { books: [...], total: number }
      if (data.books) {
        setBooks(data.books);
      } else {
        setError('数据格式错误');
      }
    } catch (error) {
      console.error('获取书籍失败:', error);
      setError(error instanceof Error ? error.message : '获取书籍失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这本书吗？删除后无法恢复。')) return;

    setError('');
    try {
      const response = await fetch(`/api/admin/books/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }
      // 刷新列表
      await fetchBooks();
    } catch (error) {
      console.error('删除失败:', error);
      setError(error instanceof Error ? error.message : '删除失败');
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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5DC]">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      <nav className="bg-white border-b px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#2F5233]">书籍管理</h1>
          <div className="flex gap-6">
            <Link href="/admin" className="text-gray-600 hover:text-[#2F5233]">
              仪表板
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
            <Link
              href="/admin/books/batch-create"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              批量创建
            </Link>
            <Link
              href="/admin/books/new"
              className="px-4 py-2 bg-[#2F5233] text-white rounded hover:bg-[#1a2e1c]"
            >
              添加新书
            </Link>
            <button onClick={handleLogout} className="text-red-600 hover:text-red-700">
              退出登录
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 空状态 */}
        {!loading && books.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无书籍</h3>
            <p className="text-gray-500 mb-4">开始添加您的第一本书籍</p>
            <Link
              href="/admin/books/new"
              className="inline-block px-4 py-2 bg-[#2F5233] text-white rounded hover:bg-[#1a2e1c]"
            >
              添加新书
            </Link>
          </div>
        )}

        {/* 书籍列表 */}
        {books.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">书名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">作者</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI了解度</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {books.map((book: any) => (
                <tr key={book.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{book.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{book.author}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {book.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      book.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {book.status === 'published' ? '已上架' : '草稿'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-700">{book.ai_knowledge_level}/10</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/books/${book.id}`}
                      className="text-[#2F5233] hover:text-[#1a2e1c] mr-4"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(book.id)}
                      className="text-red-600 hover:text-red-900"
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
      </main>
    </div>
  );
}
