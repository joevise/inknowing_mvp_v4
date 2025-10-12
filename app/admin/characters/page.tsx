/**
 * 全局角色管理页面
 * 支持搜索、筛选、排序、分页、批量操作
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';

interface Character {
  id: string;
  book_id: string;
  name: string;
  description: string;
  personality_traits: any;
  speaking_style?: string;
  background_story?: string;
  created_at: string;
  updated_at: string;
  book_title: string;
  book_author: string;
}

interface Book {
  id: string;
  title: string;
}

export default function CharactersPage() {
  const router = useRouter();

  // 数据状态
  const [characters, setCharacters] = useState<Character[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 筛选和排序状态
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 批量操作状态
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [operating, setOperating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (books.length > 0) {
      fetchCharacters();
    }
  }, [page, pageSize, search, selectedBookId, sortBy, sortOrder]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (!response.ok) {
        router.push('/admin/login');
        return;
      }
      await fetchBooks();
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
      setBooks(data.books || []);
    } catch (error) {
      console.error('获取书籍列表失败:', error);
    }
  };

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });

      if (search) params.append('search', search);
      if (selectedBookId) params.append('bookId', selectedBookId);

      const response = await fetch(`/api/admin/characters?${params}`);
      if (!response.ok) throw new Error('获取角色列表失败');

      const data = await response.json();
      setCharacters(data.characters || []);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
      setSelectedCharacters([]);
    } catch (error) {
      console.error('获取角色列表失败:', error);
      setError(error instanceof Error ? error.message : '获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSelectAll = () => {
    if (selectedCharacters.length === characters.length) {
      setSelectedCharacters([]);
    } else {
      setSelectedCharacters(characters.map((c) => c.id));
    }
  };

  const handleToggleCharacter = (id: string) => {
    setSelectedCharacters((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedCharacters.length === 0) {
      setError('请至少选择一个角色');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedCharacters.length} 个角色吗？此操作不可撤销。`)) {
      return;
    }

    setError('');
    setSuccess('');
    setOperating(true);

    try {
      const response = await fetch('/api/admin/characters/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedCharacters }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '批量删除失败');
      }

      setSuccess(data.message || '批量删除成功');
      await fetchCharacters();
    } catch (error) {
      console.error('批量删除失败:', error);
      setError(error instanceof Error ? error.message : '批量删除失败');
    } finally {
      setOperating(false);
    }
  };

  const handleBatchExtract = async () => {
    if (selectedCharacters.length === 0) {
      setError('请至少选择一个角色（系统会为对应的书籍提取更多角色）');
      return;
    }

    // 获取涉及的书籍
    const bookIds = Array.from(
      new Set(
        characters
          .filter((c) => selectedCharacters.includes(c.id))
          .map((c) => c.book_id)
      )
    );

    const bookNames = Array.from(
      new Set(
        characters
          .filter((c) => selectedCharacters.includes(c.id))
          .map((c) => c.book_title)
      )
    );

    if (
      !confirm(
        `将为以下 ${bookIds.length} 本书提取更多角色：\n${bookNames.join('、')}\n\n这可能需要一些时间，确定继续吗？`
      )
    ) {
      return;
    }

    setError('');
    setSuccess('');
    setOperating(true);

    try {
      const response = await fetch('/api/admin/characters/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '批量提取失败');
      }

      setSuccess(data.message || '批量提取成功');
      await fetchCharacters();
    } catch (error) {
      console.error('批量提取失败:', error);
      setError(error instanceof Error ? error.message : '批量提取失败');
    } finally {
      setOperating(false);
    }
  };

  const handleExtractMore = async (bookId: string, bookTitle: string) => {
    if (!confirm(`确定要为《${bookTitle}》提取更多角色吗？`)) {
      return;
    }

    setError('');
    setSuccess('');
    setOperating(true);

    try {
      const response = await fetch('/api/admin/characters/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookIds: [bookId] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '提取失败');
      }

      setSuccess(`已为《${bookTitle}》提取了 ${data.totalNewCharacters} 个新角色`);
      await fetchCharacters();
    } catch (error) {
      console.error('提取失败:', error);
      setError(error instanceof Error ? error.message : '提取失败');
    } finally {
      setOperating(false);
    }
  };

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // 获取涉及的书籍数量（用于批量操作提示）
  const selectedBooksCount = new Set(
    characters
      .filter((c) => selectedCharacters.includes(c.id))
      .map((c) => c.book_id)
  ).size;

  if (loading && characters.length === 0) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">加载中...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="角色管理">
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* 标题和说明 */}
        <div className="mb-8">
          <h2 className="text-3xl font-light text-gray-800 mb-2">角色管理</h2>
          <p className="text-gray-600">
            管理所有书籍中的角色信息，支持搜索、筛选、批量操作
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
            {success}
          </div>
        )}

        {/* 工具栏 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* 搜索和筛选 */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索角色名或书名..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-[#2C5530] text-white rounded-lg hover:bg-[#1a2e1c] font-light"
              >
                搜索
              </button>
            </div>
            <select
              value={selectedBookId}
              onChange={(e) => {
                setSelectedBookId(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
            >
              <option value="">所有书籍</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </div>

          {/* 批量操作 */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    characters.length > 0 && selectedCharacters.length === characters.length
                  }
                  onChange={handleSelectAll}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">全选</span>
              </label>
              {selectedCharacters.length > 0 && (
                <span className="text-sm text-gray-600">
                  已选择 {selectedCharacters.length} 个角色（{selectedBooksCount} 本书）
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBatchExtract}
                disabled={selectedCharacters.length === 0 || operating}
                className="px-4 py-2 bg-[#2C5530] text-white rounded-lg hover:bg-[#1a2e1c] font-light disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {operating ? '提取中...' : '批量提取更多角色'}
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={selectedCharacters.length === 0 || operating}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-light disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                批量删除
              </button>
            </div>
          </div>
        </div>

        {/* 角色表格 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={
                        characters.length > 0 &&
                        selectedCharacters.length === characters.length
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortChange('name')}
                  >
                    角色名{' '}
                    {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortChange('book_title')}
                  >
                    所属书籍{' '}
                    {sortBy === 'book_title' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase">
                    简介
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortChange('created_at')}
                  >
                    创建时间{' '}
                    {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-light text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {characters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {search || selectedBookId ? '没有找到匹配的角色' : '还没有任何角色'}
                    </td>
                  </tr>
                ) : (
                  characters.map((char) => (
                    <tr key={char.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedCharacters.includes(char.id)}
                          onChange={() => handleToggleCharacter(char.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-light text-gray-900">{char.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/admin/books/${char.book_id}/characters`}
                          className="text-[#2C5530] hover:underline text-sm"
                        >
                          {char.book_title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <span className="text-sm text-gray-600 line-clamp-2">
                          {char.description || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(char.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleExtractMore(char.book_id, char.book_title)}
                            disabled={operating}
                            className="text-[#2C5530] hover:text-[#1a2e1c] text-sm font-light disabled:opacity-50"
                            title="为此书提取更多角色"
                          >
                            提取更多
                          </button>
                          <span className="text-gray-300">|</span>
                          <Link
                            href={`/admin/characters/${char.id}/edit`}
                            className="text-[#2C5530] hover:text-[#1a2e1c] text-sm font-light"
                          >
                            编辑
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                共 {total} 个角色，第 {page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  上一页
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 border rounded text-sm ${
                        page === pageNum
                          ? 'bg-[#2C5530] text-white border-[#2C5530]'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  下一页
                </button>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="ml-4 px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value={20}>每页 20 条</option>
                  <option value={50}>每页 50 条</option>
                  <option value={100}>每页 100 条</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </main>
    </AdminLayout>
  );
}
