/**
 * 书籍管理页面
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';

export default function AdminBooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'ai_knowledge_level'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      const res = await fetch('/api/admin/books?limit=1000');
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

  // 批量操作
  const handleBatchPublish = async () => {
    if (selectedBooks.length === 0) return;
    if (!confirm(`确定要上架选中的 ${selectedBooks.length} 本书籍吗？`)) return;

    setError('');
    try {
      const response = await fetch('/api/admin/books/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedBooks, action: 'publish' }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '批量上架失败');
      }
      setSelectedBooks([]);
      await fetchBooks();
    } catch (error) {
      console.error('批量上架失败:', error);
      setError(error instanceof Error ? error.message : '批量上架失败');
    }
  };

  const handleBatchUnpublish = async () => {
    if (selectedBooks.length === 0) return;
    if (!confirm(`确定要下架选中的 ${selectedBooks.length} 本书籍吗？`)) return;

    setError('');
    try {
      const response = await fetch('/api/admin/books/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedBooks, action: 'unpublish' }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '批量下架失败');
      }
      setSelectedBooks([]);
      await fetchBooks();
    } catch (error) {
      console.error('批量下架失败:', error);
      setError(error instanceof Error ? error.message : '批量下架失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedBooks.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedBooks.length} 本书籍吗？删除后无法恢复。`)) return;

    setError('');
    try {
      const response = await fetch('/api/admin/books/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedBooks }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '批量删除失败');
      }
      setSelectedBooks([]);
      await fetchBooks();
    } catch (error) {
      console.error('批量删除失败:', error);
      setError(error instanceof Error ? error.message : '批量删除失败');
    }
  };

  // 全选/取消全选
  const handleToggleAll = () => {
    if (selectedBooks.length === filteredAndSortedBooks.length) {
      setSelectedBooks([]);
    } else {
      setSelectedBooks(filteredAndSortedBooks.map((book: any) => book.id));
    }
  };

  // 单选
  const handleToggleBook = (id: string) => {
    setSelectedBooks(prev =>
      prev.includes(id) ? prev.filter(bookId => bookId !== id) : [...prev, id]
    );
  };

  // 筛选和排序
  const filteredAndSortedBooks = books
    .filter((book: any) => {
      if (filterStatus !== 'all' && book.status !== filterStatus) return false;
      if (filterCategory !== 'all' && book.category !== filterCategory) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'ai_knowledge_level') {
        comparison = a.ai_knowledge_level - b.ai_knowledge_level;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // 获取所有分类
  const categories = Array.from(new Set(books.map((book: any) => book.category).filter(Boolean)));

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
    <AdminLayout
      title="书籍管理"
      actions={
        <>
          <Link
            href="/admin/books/batch-create"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-light"
          >
            批量创建
          </Link>
          <Link
            href="/admin/books/new"
            className="px-4 py-2 bg-[#2C5530] text-white rounded hover:bg-[#1a2e1c] font-light"
          >
            添加新书
          </Link>
        </>
      }
    >
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 筛选和排序栏 */}
        {books.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* 状态筛选 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-light text-gray-600">状态:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-1.5 border border-gray-300 rounded font-light text-sm focus:outline-none focus:ring-2 focus:ring-[#2C5530]"
                >
                  <option value="all">全部</option>
                  <option value="published">已上架</option>
                  <option value="draft">草稿</option>
                </select>
              </div>

              {/* 分类筛选 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-light text-gray-600">分类:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded font-light text-sm focus:outline-none focus:ring-2 focus:ring-[#2C5530]"
                >
                  <option value="all">全部分类</option>
                  {categories.map((cat: any) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 排序 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-light text-gray-600">排序:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 border border-gray-300 rounded font-light text-sm focus:outline-none focus:ring-2 focus:ring-[#2C5530]"
                >
                  <option value="created_at">创建时间</option>
                  <option value="title">书名</option>
                  <option value="ai_knowledge_level">AI了解度</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  title={sortOrder === 'asc' ? '升序' : '降序'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>

              {/* 显示数量 */}
              <div className="ml-auto text-sm font-light text-gray-600">
                显示 {filteredAndSortedBooks.length} / {books.length} 本书籍
              </div>
            </div>
          </div>
        )}

        {/* 批量操作栏 */}
        {selectedBooks.length > 0 && (
          <div className="bg-[#2C5530] text-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="font-light">已选择 {selectedBooks.length} 本书籍</span>
              <div className="flex gap-2">
                <button
                  onClick={handleBatchPublish}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-light transition-colors"
                >
                  批量上架
                </button>
                <button
                  onClick={handleBatchUnpublish}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-light transition-colors"
                >
                  批量下架
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-light transition-colors"
                >
                  批量删除
                </button>
                <button
                  onClick={() => setSelectedBooks([])}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-light transition-colors"
                >
                  取消选择
                </button>
              </div>
            </div>
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
            <h3 className="text-lg font-light text-gray-900 mb-2">暂无书籍</h3>
            <p className="text-gray-500 mb-4">开始添加您的第一本书籍</p>
            <Link
              href="/admin/books/new"
              className="inline-block px-4 py-2 bg-[#2C5530] text-white rounded hover:bg-[#1a2e1c] font-light"
            >
              添加新书
            </Link>
          </div>
        )}

        {/* 书籍列表 */}
        {filteredAndSortedBooks.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedBooks.length === filteredAndSortedBooks.length}
                      onChange={handleToggleAll}
                      className="w-4 h-4 text-[#2C5530] rounded focus:ring-[#2C5530]"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">书名</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">作者</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">分类</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">AI了解度</th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">角色数</th>
                  <th className="px-6 py-3 text-right text-xs font-light text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAndSortedBooks.map((book: any) => (
                <tr key={book.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedBooks.includes(book.id)}
                      onChange={() => handleToggleBook(book.id)}
                      className="w-4 h-4 text-[#2C5530] rounded focus:ring-[#2C5530]"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/admin/books/${book.id}`} className="font-light text-gray-900 hover:text-[#2C5530] hover:underline">
                      {book.title}
                    </Link>
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/admin/books/${book.id}`}
                      className={`text-sm hover:underline ${(book as any).character_count === 0 ? 'text-red-600' : 'text-[#2C5530]'}`}
                    >
                      {(book as any).character_count ?? 0}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-light">
                    <Link
                      href={`/admin/books/${book.id}`}
                      className="text-[#2C5530] hover:text-[#1a2e1c] mr-4"
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

        {/* 筛选后无结果 */}
        {filteredAndSortedBooks.length === 0 && books.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">没有符合筛选条件的书籍</p>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
