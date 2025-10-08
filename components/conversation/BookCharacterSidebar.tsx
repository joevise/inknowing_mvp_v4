/**
 * 书籍角色信息侧边栏组件
 * 显示当前书籍信息和角色列表,支持角色切换
 */

'use client';

import { useState, useEffect } from 'react';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url?: string;
  category?: string;
}

interface Character {
  id: string;
  name: string;
  description: string;
  book_id: string;
}

interface Conversation {
  id: string;
  book_id: string;
  character_id?: string;
  type: 'book' | 'character';
}

interface BookCharacterSidebarProps {
  conversation: Conversation;
  onCharacterSwitch?: (characterId: string) => void;
}

export default function BookCharacterSidebar({
  conversation,
  onCharacterSwitch,
}: BookCharacterSidebarProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (conversation.book_id) {
      loadBookAndCharacters();
    }
  }, [conversation.book_id]);

  const loadBookAndCharacters = async () => {
    try {
      setLoading(true);
      setError('');

      // 加载书籍信息
      const bookRes = await fetch(`/api/books/${conversation.book_id}`);
      if (bookRes.ok) {
        const bookData = await bookRes.json();
        setBook(bookData.book);
      }

      // 加载角色列表
      const charsRes = await fetch(`/api/books/${conversation.book_id}/characters`);
      if (charsRes.ok) {
        const charsData = await charsRes.json();
        setCharacters(charsData.characters || []);
      }

    } catch (err) {
      console.error('[BookCharacterSidebar] 加载失败:', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchCharacter = async (characterId: string) => {
    if (characterId === conversation.character_id) return;

    try {
      setSwitching(true);
      setError('');

      const response = await fetch(`/api/conversations/${conversation.id}/character`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ characterId }),
      });

      if (!response.ok) {
        throw new Error('切换角色失败');
      }

      // 通知父组件
      if (onCharacterSwitch) {
        onCharacterSwitch(characterId);
      }

      // 刷新页面以显示新角色
      window.location.reload();

    } catch (err) {
      console.error('[BookCharacterSidebar] 切换角色失败:', err);
      setError(err instanceof Error ? err.message : '切换角色失败');
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <div className="w-80 h-full bg-white border-l border-gray-200 flex items-center justify-center">
        <p className="text-sm font-light text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
      {/* 书籍信息 */}
      {book && (
        <div className="p-6 border-b border-gray-200">
          {/* 封面 */}
          {book.cover_url ? (
            <div className="aspect-[3/4] w-full bg-gray-200 rounded-lg overflow-hidden mb-4">
              <img
                src={book.cover_url}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] w-full bg-gradient-to-br from-[#2C5530] to-[#234426] rounded-lg flex items-center justify-center mb-4">
              <span className="text-white text-6xl font-light opacity-20">书</span>
            </div>
          )}

          {/* 书籍详情 */}
          <h2 className="text-lg font-light text-gray-800 mb-1">{book.title}</h2>
          <p className="text-sm font-light text-gray-500 mb-3">{book.author}</p>
          <p className="text-xs font-light text-gray-400 line-clamp-4">
            {book.description}
          </p>
          {book.category && (
            <span className="inline-block mt-3 px-3 py-1 bg-[#FAF9F7] text-[#2C5530] text-xs font-light rounded">
              {book.category}
            </span>
          )}
        </div>
      )}

      {/* 角色列表 */}
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-light text-gray-800">角色列表</h3>
          {conversation.type === 'character' && (
            <span className="text-xs font-light text-gray-500">
              当前角色模式
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs font-light text-red-600">
            {error}
          </div>
        )}

        {characters.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm font-light text-gray-400">暂无角色</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 书籍对话模式 */}
            <button
              onClick={() => {
                if (conversation.type === 'book') return;
                // TODO: 切换回书籍对话模式
              }}
              disabled={switching || conversation.type === 'book'}
              className={`w-full p-4 rounded-lg text-left transition-all ${
                conversation.type === 'book'
                  ? 'bg-[#2C5530] text-white shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  conversation.type === 'book'
                    ? 'bg-white bg-opacity-20'
                    : 'bg-gradient-to-br from-[#2C5530] to-[#234426]'
                }`}>
                  <span className={`text-lg font-light ${
                    conversation.type === 'book' ? 'text-white' : 'text-white'
                  }`}>
                    书
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-light ${
                    conversation.type === 'book' ? 'text-white' : 'text-gray-800'
                  }`}>
                    与书籍对话
                  </p>
                  <p className={`text-xs font-light mt-0.5 ${
                    conversation.type === 'book' ? 'text-gray-200' : 'text-gray-500'
                  }`}>
                    综合理解全书内容
                  </p>
                </div>
              </div>
            </button>

            {/* 角色列表 */}
            {characters.map((character) => {
              const isActive = conversation.character_id === character.id;

              return (
                <button
                  key={character.id}
                  onClick={() => handleSwitchCharacter(character.id)}
                  disabled={switching || isActive}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-[#2C5530] text-white shadow-sm'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  } ${switching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isActive
                        ? 'bg-white bg-opacity-20'
                        : 'bg-gradient-to-br from-[#2C5530] to-[#234426]'
                    }`}>
                      <span className={`text-lg font-light ${
                        isActive ? 'text-white' : 'text-white'
                      }`}>
                        {character.name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-light ${
                        isActive ? 'text-white' : 'text-gray-800'
                      }`}>
                        {character.name}
                      </p>
                      <p className={`text-xs font-light mt-0.5 line-clamp-2 ${
                        isActive ? 'text-gray-200' : 'text-gray-500'
                      }`}>
                        {character.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {switching && (
          <div className="mt-4 text-center">
            <p className="text-xs font-light text-gray-500">切换中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
