/**
 * 角色管理页面
 * 显示所有书籍的所有角色
 */

'use client';

import AdminLayout from '@/components/layout/AdminLayout';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  created_at: string;
  updated_at: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
}

export default function CharactersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [charactersByBook, setCharactersByBook] = useState<Record<string, Character[]>>({});

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
      // 获取所有书籍
      const booksResponse = await fetch('/api/admin/books');
      if (!booksResponse.ok) {
        throw new Error('获取书籍列表失败');
      }
      const booksData = await booksResponse.json();
      setBooks(booksData.books);

      // 获取每本书的角色
      const charactersData: Record<string, Character[]> = {};
      for (const book of booksData.books) {
        const charResponse = await fetch(`/api/admin/books/${book.id}/characters`);
        if (charResponse.ok) {
          const charData = await charResponse.json();
          charactersData[book.id] = charData.characters || [];
        } else {
          charactersData[book.id] = [];
        }
      }
      setCharactersByBook(charactersData);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
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

  return (
    <AdminLayout title="角色管理">
      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-light text-gray-800 mb-2">角色总览</h2>
          <p className="text-gray-600">
            管理所有书籍中的角色信息，包括性格特征、说话风格等
          </p>
        </div>

        {books.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">还没有任何书籍</p>
            <Link
              href="/admin/books/new"
              className="inline-block bg-[#2C5530] text-white px-6 py-2 rounded-lg hover:bg-[#1a2e1c]"
            >
              添加第一本书
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {books.map((book) => (
              <BookCharactersSection
                key={book.id}
                book={book}
                characters={charactersByBook[book.id] || []}
                onRefresh={fetchData}
              />
            ))}
          </div>
        )}
      </main>
    </AdminLayout>
  );
}

// 单个书籍的角色部分
function BookCharactersSection({
  book,
  characters,
  onRefresh,
}: {
  book: Book;
  characters: Character[];
  onRefresh: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* 书籍标题 */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-light text-gray-800">{book.title}</h3>
          <p className="text-sm text-gray-500">作者: {book.author}</p>
        </div>
        <div className="text-sm text-gray-500">
          {characters.length} 个角色
        </div>
      </div>

      {/* 角色列表 */}
      {characters.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-500">
          <p className="mb-4">暂无角色信息</p>
          <Link
            href={`/admin/books/${book.id}/characters`}
            className="text-[#2C5530] hover:underline"
          >
            为此书添加角色 →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                  角色名
                </th>
                <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                  简介
                </th>
                <th className="px-6 py-3 text-left text-xs font-light text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-6 py-3 text-center text-xs font-light text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {characters.map((character) => (
                <tr key={character.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-light text-gray-900">{character.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 line-clamp-2">
                      {character.description || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(character.created_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <Link
                      href={`/admin/characters/${character.id}/edit`}
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
      )}
    </div>
  );
}
