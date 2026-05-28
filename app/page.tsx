/**
 * 首页 - 重新设计的MUJI风格首页
 */

'use client';

import { useState, KeyboardEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FavoriteButton from '@/components/book/FavoriteButton';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url?: string;
  category?: string;
  tags?: string[];
  favorite_count?: number;
}

interface Character {
  id: string;
  name: string;
  description: string;
  book_title: string;
  book_id: string;
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [favoritedBookIds, setFavoritedBookIds] = useState<Set<string>>(new Set());

  // 加载书籍和角色数据
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载书籍
        const booksRes = await fetch('/api/books?status=published&limit=12');
        if (booksRes.ok) {
          const booksData = await booksRes.json();
          setBooks(booksData.books || []);

          // 提取分类
          const cats = new Set<string>();
          booksData.books?.forEach((book: Book) => {
            if (book.category) cats.add(book.category);
          });
          setCategories(['all', ...Array.from(cats)]);
        }

        // 加载热门角色
        const charsRes = await fetch('/api/characters/popular?limit=8');
        if (charsRes.ok) {
          const charsData = await charsRes.json();
          setCharacters(charsData.characters || []);
        }

        // 加载用户收藏列表
        try {
          const favoritesRes = await fetch('/api/favorites', {
            credentials: 'include',
          });
          if (favoritesRes.ok) {
            const favoritesData = await favoritesRes.json();
            const bookIds = new Set(
              favoritesData.favorites?.map((fav: any) => fav.book_id) || []
            );
            setFavoritedBookIds(bookIds);
          }
        } catch (err) {
          // 用户未登录或获取失败，忽略错误
          console.log('User not logged in or failed to fetch favorites');
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, []);

  const handleSearch = () => {
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredBooks = selectedCategory === 'all'
    ? books
    : books.filter(book => book.category === selectedCategory);

  const [creatingCharConversation, setCreatingCharConversation] = useState<string | null>(null);

  const handleStartConversation = async (characterId: string, bookId: string) => {
    // 防止重复点击
    if (creatingCharConversation === characterId) {
      console.log('[HomePage] 已经在创建角色对话，忽略重复点击');
      return;
    }

    setCreatingCharConversation(characterId);
    console.log('[HomePage] 开始创建角色对话:', characterId);

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          characterId,
          type: 'character',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[HomePage] 角色对话创建成功:', data.conversation.id);
        router.push(`/conversations/${data.conversation.id}`);
      } else {
        // 未登录，跳转到登录页
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setCreatingCharConversation(null);
    }
  };

  const [creatingConversation, setCreatingConversation] = useState<string | null>(null);

  const handleStartBookConversation = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation(); // 阻止冒泡到卡片点击

    // 防止重复点击
    if (creatingConversation === bookId) {
      console.log('[HomePage] 已经在创建对话，忽略重复点击');
      return;
    }

    setCreatingConversation(bookId);
    console.log('[HomePage] 开始创建书籍对话:', bookId);

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          type: 'book',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[HomePage] 对话创建成功:', data.conversation.id);
        router.push(`/conversations/${data.conversation.id}`);
      } else {
        // 未登录，跳转到登录页
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to start book conversation:', error);
      setCreatingConversation(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero 区域 */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* 产品介绍 */}
            <h1 className="text-4xl font-light text-[#2C5530] mb-4">
              与经典对话，让知识流动
            </h1>
            <p className="text-lg font-light text-gray-600 mb-12 max-w-2xl mx-auto">
              InKnowing 知应是一个基于 AI 的知识对话平台。
              在这里，您可以与经典书籍对话，向历史人物提问，开启全新的学习体验。
            </p>

            {/* 精致搜索框 */}
            <div className="relative max-w-2xl mx-auto">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="搜索书籍、角色，或直接提问..."
                className="w-full text-base font-light py-4 pl-6 pr-32
                         border border-gray-300 rounded-lg
                         focus:outline-none focus:border-[#2C5530] focus:ring-1 focus:ring-[#2C5530]
                         transition-all bg-white"
              />
              <button
                onClick={handleSearch}
                disabled={!query.trim()}
                className="absolute right-2 top-1/2 transform -translate-y-1/2
                         px-6 py-2 bg-[#2C5530] text-white rounded-md
                         font-light text-sm
                         hover:bg-[#234426] transition-colors
                         disabled:opacity-30 disabled:cursor-not-allowed"
              >
                搜索
              </button>
            </div>
            <p className="mt-4 text-xs font-light text-gray-400">
              试试: "我想了解心理学" 或 "和苏格拉底聊天"
            </p>
            <p className="mt-3 text-sm font-light text-gray-500">
              找不到想看的书？<Link href="/request-book" className="text-[#2C5530] hover:underline">📝 申请上架</Link>
            </p>
          </div>
        </section>

        {/* 书籍展示区域 */}
        <section className="py-16 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-light text-gray-800">精选书籍</h2>

              <div className="flex items-center gap-4">
                {/* 分类筛选 */}
                <div className="flex gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-lg text-sm font-light transition-colors
                                ${selectedCategory === cat
                                  ? 'bg-[#2C5530] text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {cat === 'all' ? '全部' : cat}
                    </button>
                  ))}
                </div>

                {/* 查看更多按钮 */}
                <Link
                  href="/books"
                  className="px-4 py-2 text-sm font-light text-[#2C5530] hover:text-[#234426]
                           border border-[#2C5530] rounded-lg hover:bg-[#2C5530] hover:text-white
                           transition-all whitespace-nowrap"
                >
                  查看更多 →
                </Link>
              </div>
            </div>

            {/* 书籍卡片网格 - 更小更紧凑 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredBooks.map(book => (
                <div
                  key={book.id}
                  onClick={() => router.push(`/books/${book.id}`)}
                  className="bg-white rounded-lg overflow-hidden cursor-pointer
                           hover:shadow-lg transition-all group relative"
                >
                  {/* 封面 */}
                  {book.cover_url ? (
                    <div className="aspect-[3/4] bg-gray-200 overflow-hidden">
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[3/4] bg-gradient-to-br from-[#2C5530] to-[#234426]
                                  flex items-center justify-center">
                      <span className="text-white text-2xl font-light opacity-20">书</span>
                    </div>
                  )}

                  {/* 信息 - 更紧凑 */}
                  <div className="p-3">
                    <h3 className="font-light text-sm text-gray-800 mb-0.5 line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="font-light text-xs text-gray-500 mb-2">
                      {book.author}
                    </p>
                    {/* 收藏按钮 */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <FavoriteButton
                        bookId={book.id}
                        initialFavorited={favoritedBookIds.has(book.id)}
                        showCount={true}
                        favoriteCount={book.favorite_count}
                        size="sm"
                        onToggle={(favorited) => {
                          // 更新本地状态
                          setFavoritedBookIds(prev => {
                            const newSet = new Set(prev);
                            if (favorited) {
                              newSet.add(book.id);
                            } else {
                              newSet.delete(book.id);
                            }
                            return newSet;
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* 悬停显示的对话按钮 */}
                  <div className="absolute inset-0 bg-white bg-opacity-0 group-hover:bg-opacity-50
                                transition-all duration-300 flex items-end justify-center pb-4
                                opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => handleStartBookConversation(e, book.id)}
                      disabled={creatingConversation === book.id}
                      className="px-4 py-2 bg-[#2C5530] text-white rounded-lg font-light text-sm
                               hover:bg-[#234426] transition-colors shadow-lg transform
                               translate-y-2 group-hover:translate-y-0
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingConversation === book.id ? '创建中...' : '开始对话'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredBooks.length === 0 && (
              <div className="text-center py-12 text-gray-400 font-light">
                暂无书籍
              </div>
            )}
          </div>
        </section>

        {/* 角色展示区域 */}
        <section className="py-16 px-6 bg-[#FAF9F7]">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-light text-gray-800">热门角色</h2>
                <p className="text-sm font-light text-gray-500 mt-2">
                  直接与经典角色开始对话
                </p>
              </div>

              {/* 查看更多按钮 */}
              <Link
                href="/characters"
                className="px-4 py-2 text-sm font-light text-[#2C5530] hover:text-[#234426]
                         border border-[#2C5530] rounded-lg hover:bg-[#2C5530] hover:text-white
                         transition-all whitespace-nowrap"
              >
                查看更多 →
              </Link>
            </div>

            {/* 角色卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {characters.map(char => (
                <div
                  key={char.id}
                  className="bg-white rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  {/* 角色头像 */}
                  <div className="w-16 h-16 bg-gradient-to-br from-[#2C5530] to-[#234426]
                                rounded-full flex items-center justify-center mb-4 mx-auto">
                    <span className="text-white text-2xl font-light">
                      {char.name[0]}
                    </span>
                  </div>

                  {/* 角色信息 */}
                  <h3 className="font-light text-base text-gray-800 mb-1 text-center">
                    {char.name}
                  </h3>
                  <p className="font-light text-xs text-gray-500 mb-3 text-center">
                    来自《{char.book_title}》
                  </p>
                  <p className="font-light text-xs text-gray-400 line-clamp-3 mb-4">
                    {char.description}
                  </p>

                  {/* 开始对话按钮 */}
                  <button
                    onClick={() => handleStartConversation(char.id, char.book_id)}
                    disabled={creatingCharConversation === char.id}
                    className="w-full py-2 bg-[#2C5530] text-white rounded-lg
                             font-light text-sm hover:bg-[#234426] transition-colors
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingCharConversation === char.id ? '创建中...' : '开始对话'}
                  </button>
                </div>
              ))}
            </div>

            {characters.length === 0 && (
              <div className="text-center py-12 text-gray-400 font-light">
                暂无角色
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
