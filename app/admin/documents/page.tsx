/**
 * 文档管理页面
 * 管理所有书籍的文档和向量化
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Document {
  id: string;
  book_id: string;
  type: 'main' | 'supplement';
  title: string;
  file_path: string;
  file_size: number;
  vectorized: boolean;
  created_at: string;
  updated_at: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  requires_document: boolean;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [vectorizing, setVectorizing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (selectedBook) {
      fetchDocuments(selectedBook);
    }
  }, [selectedBook]);

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
      const response = await fetch('/api/admin/books');
      if (!response.ok) throw new Error('获取书籍列表失败');
      const data = await response.json();
      setBooks(data.books);
      if (data.books.length > 0) {
        setSelectedBook(data.books[0].id);
      }
    } catch (error) {
      console.error('获取书籍失败:', error);
      setError('获取书籍列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (bookId: string) => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}/documents`);
      if (!response.ok) throw new Error('获取文档列表失败');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('获取文档失败:', error);
    }
  };

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;

    if (!file) {
      setError('请选择文件');
      return;
    }

    if (!selectedBook) {
      setError('请选择书籍');
      return;
    }

    setUploading(true);

    try {
      const response = await fetch(`/api/admin/books/${selectedBook}/documents`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '上传失败');
      }

      setSuccess('文档上传成功！');
      fetchDocuments(selectedBook);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      console.error('上传失败:', err);
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleVectorize = async (bookId: string) => {
    setError('');
    setSuccess('');
    setVectorizing(true);

    try {
      const response = await fetch(`/api/admin/books/${bookId}/vectorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '向量化失败');
      }

      setSuccess('向量化处理已开始！');
      fetchDocuments(bookId);
    } catch (err) {
      console.error('向量化失败:', err);
      setError(err instanceof Error ? err.message : '向量化失败，请重试');
    } finally {
      setVectorizing(false);
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
          <h1 className="text-2xl font-bold text-[#2F5233]">文档管理</h1>
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
            <Link
              href="/admin/documents"
              className="text-[#2F5233] hover:text-[#1a2e1c] font-medium"
            >
              文档管理
            </Link>
            <button onClick={handleLogout} className="text-red-600 hover:text-red-700">
              退出登录
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">文档与向量化管理</h2>
          <p className="text-gray-600">
            上传书籍文档并进行向量化处理，以支持RAG智能检索
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
            ✓ {success}
          </div>
        )}

        {books.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">还没有任何书籍</p>
            <Link
              href="/admin/books/new"
              className="inline-block bg-[#2F5233] text-white px-6 py-2 rounded-lg hover:bg-[#1a2e1c]"
            >
              添加第一本书
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧：书籍选择和文档上传 */}
            <div className="lg:col-span-1 space-y-6">
              {/* 书籍选择 */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">选择书籍</h3>
                <select
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                >
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title} - {book.author}
                      {book.requires_document && ' (需要文档)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* 文档上传 */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">上传文档</h3>
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      文档标题 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                      placeholder="例如: 三体第一部"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      文档类型 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="type"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                    >
                      <option value="main">主文档</option>
                      <option value="supplement">补充文档</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      选择文件 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      name="file"
                      required
                      accept=".txt,.md,.markdown"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2F5233] focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      支持格式: TXT, Markdown (.md)
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-[#2F5233] text-white py-2 rounded-lg hover:bg-[#1a2e1c] transition-colors disabled:opacity-50"
                  >
                    {uploading ? '上传中...' : '上传文档'}
                  </button>
                </form>
              </div>
            </div>

            {/* 右侧：文档列表 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-800">文档列表</h3>
                  {documents.length > 0 && (
                    <button
                      onClick={() => handleVectorize(selectedBook)}
                      disabled={vectorizing}
                      className="bg-[#2F5233] text-white px-4 py-2 rounded-lg hover:bg-[#1a2e1c] transition-colors text-sm disabled:opacity-50"
                    >
                      {vectorizing ? '向量化中...' : '批量向量化'}
                    </button>
                  )}
                </div>

                {documents.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-500">
                    暂无文档，请上传文档
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            标题
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            类型
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            大小
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            向量化
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            上传时间
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="font-medium text-gray-900">{doc.title}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 text-xs rounded ${
                                  doc.type === 'main'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {doc.type === 'main' ? '主文档' : '补充'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {(doc.file_size / 1024).toFixed(1)} KB
                            </td>
                            <td className="px-6 py-4">
                              {doc.vectorized ? (
                                <span className="text-green-600 text-sm">✓ 已完成</span>
                              ) : (
                                <span className="text-gray-400 text-sm">未处理</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(doc.created_at).toLocaleDateString('zh-CN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
