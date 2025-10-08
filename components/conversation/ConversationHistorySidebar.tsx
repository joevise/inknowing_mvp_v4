/**
 * 对话历史侧边栏组件
 * 显示用户的所有历史对话,支持按书籍分组和时间轴视图
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Conversation {
  id: string;
  book_id: string;
  character_id?: string;
  type: 'book' | 'character';
  title?: string;
  book_title?: string;
  character_name?: string;
  updated_at: string;
  created_at: string;
}

interface ConversationHistorySidebarProps {
  currentConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
}

export default function ConversationHistorySidebar({
  currentConversationId,
  onSelectConversation,
}: ConversationHistorySidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'timeline' | 'book'>('timeline');
  const [error, setError] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/conversations', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('获取对话历史失败');
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('[HistorySidebar] 加载失败:', err);
      setError(err instanceof Error ? err.message : '加载对话历史失败');
    } finally {
      setLoading(false);
    }
  };

  // 按书籍分组
  const groupedByBook = conversations.reduce((groups, conv) => {
    const bookId = conv.book_id;
    if (!groups[bookId]) {
      groups[bookId] = {
        book_title: conv.book_title || '未知书籍',
        conversations: [],
      };
    }
    groups[bookId].conversations.push(conv);
    return groups;
  }, {} as Record<string, { book_title: string; conversations: Conversation[] }>);

  // 时间轴排序
  const sortedByTime = [...conversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const ConversationItem = ({ conv }: { conv: Conversation }) => {
    const isActive = conv.id === currentConversationId;

    return (
      <Link
        href={`/conversations/${conv.id}`}
        onClick={(e) => {
          if (onSelectConversation) {
            e.preventDefault();
            onSelectConversation(conv.id);
          }
        }}
        className={`block px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-[#2C5530] text-white'
            : 'hover:bg-gray-50 text-gray-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-light truncate ${isActive ? 'text-white' : 'text-gray-800'}`}>
              {conv.character_name || conv.book_title || '对话'}
            </p>
            <p className={`text-xs font-light mt-1 ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
              {conv.type === 'character' ? '角色对话' : '书籍对话'}
            </p>
          </div>
          <span className={`text-xs font-light flex-shrink-0 ${isActive ? 'text-gray-200' : 'text-gray-400'}`}>
            {formatTime(conv.updated_at)}
          </span>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="w-64 h-full bg-white border-r border-gray-200 flex items-center justify-center">
        <p className="text-sm font-light text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col">
      {/* 标题栏 */}
      <div className="px-4 py-4 border-b border-gray-200">
        <h2 className="text-base font-light text-gray-800">对话历史</h2>
      </div>

      {/* 视图切换 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('timeline')}
            className={`flex-1 px-3 py-1.5 text-xs font-light rounded transition-colors ${
              viewMode === 'timeline'
                ? 'bg-[#2C5530] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            时间轴
          </button>
          <button
            onClick={() => setViewMode('book')}
            className={`flex-1 px-3 py-1.5 text-xs font-light rounded transition-colors ${
              viewMode === 'book'
                ? 'bg-[#2C5530] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            按书籍
          </button>
        </div>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {error && (
          <div className="text-xs font-light text-red-600 px-4 py-2">
            {error}
          </div>
        )}

        {conversations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm font-light text-gray-400">暂无对话历史</p>
          </div>
        ) : viewMode === 'timeline' ? (
          <div className="space-y-2">
            {sortedByTime.map((conv) => (
              <ConversationItem key={conv.id} conv={conv} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByBook).map(([bookId, group]) => (
              <div key={bookId}>
                <h3 className="text-xs font-light text-gray-500 mb-2 px-2">
                  《{group.book_title}》
                </h3>
                <div className="space-y-2">
                  {group.conversations.map((conv) => (
                    <ConversationItem key={conv.id} conv={conv} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建对话按钮 */}
      <div className="px-4 py-3 border-t border-gray-200">
        <Link
          href="/books"
          className="block w-full px-4 py-2 bg-[#2C5530] text-white text-sm font-light text-center rounded-lg hover:bg-[#234426] transition-colors"
        >
          开始新对话
        </Link>
      </div>
    </div>
  );
}
