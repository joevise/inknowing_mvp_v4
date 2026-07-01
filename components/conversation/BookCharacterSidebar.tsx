/**
 * 书籍角色信息侧边栏组件
 * 显示当前书籍信息和角色列表,支持进入角色/书籍的独立对话
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

interface UserConversation {
  id: string;
  book_id: string;
  character_id?: string | null;
  type: 'book' | 'character';
  updated_at: string;
}

interface BookCharacterSidebarProps {
  conversation: Conversation;
  onCharacterSwitch?: (characterId: string) => void;
  onSwitch?: (conversationId: string) => void;
}

export default function BookCharacterSidebar({
  conversation,
  onCharacterSwitch,
  onSwitch,
}: BookCharacterSidebarProps) {
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [userConversations, setUserConversations] = useState<UserConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  // 书籍信息和角色列表只依赖 book_id：同书内切换角色不必重拉，省请求
  useEffect(() => {
    if (conversation.book_id) {
      loadBookAndCharacters();
    }
  }, [conversation.book_id]);

  // 用户对话历史依赖 conversation.id：每次切换/新建对话都刷新快照，
  // 否则同书内点角色时拿到的是进书那一刻的旧快照，新建的对话不在其中，
  // 会被误判为"没聊过"而反复新建空对话。
  useEffect(() => {
    if (conversation.book_id) {
      loadUserConversations();
    }
  }, [conversation.id]);

  // 切换完成(父组件传入新对话, id变化)即复位 switching, 否则 SPA 常驻组件会一直卡 disabled
  useEffect(() => {
    setSwitching(false);
  }, [conversation.id]);

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

  const loadUserConversations = async (): Promise<UserConversation[]> => {
    try {
      const response = await fetch(
        `/api/conversations?bookId=${conversation.book_id}&limit=100`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const list: UserConversation[] = data.conversations || [];
      setUserConversations(list);
      return list;
    } catch (err) {
      console.error('[BookCharacterSidebar] 获取用户对话历史失败:', err);
      return [];
    }
  };

  const getLatestCharacterConversation = (
    convs: UserConversation[],
    characterId: string
  ): UserConversation | undefined => {
    return convs
      .filter((conv) => conv.book_id === conversation.book_id && conv.character_id === characterId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  };

  const getLatestBookConversation = (
    convs: UserConversation[]
  ): UserConversation | undefined => {
    return convs
      .filter((conv) => conv.book_id === conversation.book_id && conv.type === 'book' && !conv.character_id)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  };

  const handleSwitchCharacter = async (characterId: string) => {
    if (onCharacterSwitch) {
      await onCharacterSwitch(characterId);
    }

    if (characterId === conversation.character_id) return;

    setSwitching(true);
    setError('');

    try {
      const convs = await loadUserConversations();
      const latest = getLatestCharacterConversation(convs, characterId);
      if (latest) {
        onSwitch?.(latest.id);
        return;
      }

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookId: conversation.book_id,
          characterId,
          type: 'character',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onSwitch?.(data.conversation.id);
      } else {
        // 仅 401/403 才视为未登录跳登录页;500 等服务端错误只提示,不再把已登录用户误踢去登录
        if (response.status === 401 || response.status === 403) {
          router.push('/auth/login');
        } else {
          setError('操作失败,请稍后重试');
        }
        setSwitching(false);
      }
    } catch (err) {
      console.error('[BookCharacterSidebar] 进入角色对话失败:', err);
      setError(err instanceof Error ? err.message : '进入角色对话失败');
      setSwitching(false);
    }
  };

  const handleSwitchToBook = async () => {
    if (conversation.type === 'book') return;

    setSwitching(true);
    setError('');

    try {
      const convs = await loadUserConversations();
      const latest = getLatestBookConversation(convs);
      if (latest) {
        onSwitch?.(latest.id);
        return;
      }

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookId: conversation.book_id,
          type: 'book',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onSwitch?.(data.conversation.id);
      } else {
        // 仅 401/403 才视为未登录跳登录页;500 等服务端错误只提示,不再把已登录用户误踢去登录
        if (response.status === 401 || response.status === 403) {
          router.push('/auth/login');
        } else {
          setError('操作失败,请稍后重试');
        }
        setSwitching(false);
      }
    } catch (err) {
      console.error('[BookCharacterSidebar] 进入书籍对话失败:', err);
      setError(err instanceof Error ? err.message : '进入书籍对话失败');
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
              onClick={() => handleSwitchToBook()}
              disabled={switching || conversation.type === 'book'}
              className={`w-full p-4 rounded-lg text-left transition-all ${
                conversation.type === 'book'
                  ? 'bg-[#2C5530] text-white shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
              } ${switching ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        {character.name.charAt(0)}
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
            <p className="text-xs font-light text-gray-500">打开中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
