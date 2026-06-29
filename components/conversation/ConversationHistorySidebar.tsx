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
  onDeletedCurrent?: () => void;
}

export default function ConversationHistorySidebar({
  currentConversationId,
  onSelectConversation,
  onDeletedCurrent,
}: ConversationHistorySidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'timeline' | 'book'>('timeline');
  const [error, setError] = useState('');
  const [expandedBooks, setExpandedBooks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConversations();
  }, [currentConversationId]);

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
      console.log('[HistorySidebar] API返回的对话数据:', data.conversations);
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('[HistorySidebar] 加载失败:', err);
      setError(err instanceof Error ? err.message : '加载对话历史失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('确定要删除这个对话吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('删除对话失败');
      }

      // 重新加载对话列表
      await loadConversations();

      // 如果删除的是当前对话,优先交父级决定,未提供再回退到书籍列表
      if (conversationId === currentConversationId) {
        if (onDeletedCurrent) {
          onDeletedCurrent();
        } else {
          window.location.href = '/books';
        }
      }
    } catch (err) {
      console.error('[HistorySidebar] 删除失败:', err);
      alert(err instanceof Error ? err.message : '删除对话失败');
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

  // 切换书籍展开/折叠状态
  const toggleBookExpand = (bookId: string) => {
    setExpandedBooks(prev => ({
      ...prev,
      [bookId]: !prev[bookId],
    }));
  };

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

  // 格式化完整时间戳
  const formatFullTime = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const ConversationItem = ({ conv }: { conv: Conversation }) => {
    const isActive = conv.id === currentConversationId;
    const [isHovering, setIsHovering] = useState(false);

    // 生成显示标题: 优先使用title, 其次使用角色名/书名, 最后默认文本
    const displayTitle = conv.title || conv.character_name || conv.book_title || '新对话';

    return (
      <div
        className="relative group"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <Link
          href={`/conversations/${conv.id}`}
          onClick={(e) => {
            if (onSelectConversation) {
              e.preventDefault();
              onSelectConversation(conv.id);
            }
          }}
          title={`创建时间: ${formatFullTime(conv.created_at)}\n最后更新: ${formatFullTime(conv.updated_at)}`}
          className={`block px-4 py-3 rounded-lg transition-colors ${
            isActive
              ? 'bg-[#2C5530] text-white'
              : 'hover:bg-gray-50 text-gray-700'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 pr-6">
              {/* 对话标题 */}
              <p className={`text-sm font-light truncate ${isActive ? 'text-white' : 'text-gray-800'}`}>
                {displayTitle}
              </p>
              {/* 副标题: 书名和时间 */}
              <div className="flex items-center gap-2 mt-1">
                <p className={`text-xs font-light ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
                  {conv.book_title}
                </p>
                <span className={`text-xs font-light ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                  ·
                </span>
                <span className={`text-xs font-light ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                  {formatTime(conv.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* 删除按钮 - 悬停时显示 */}
        {isHovering && (
          <button
            onClick={(e) => handleDeleteConversation(e, conv.id)}
            className="absolute right-2 top-3 p-1.5 rounded hover:bg-red-50 transition-colors"
            title="删除对话"
          >
            <svg className="w-4 h-4 text-gray-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
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
          <div className="space-y-2">
            {Object.entries(groupedByBook).map(([bookId, group]) => {
              const isExpanded = expandedBooks[bookId] !== false; // 默认展开

              return (
                <div key={bookId}>
                  {/* 书籍文件夹标题 - 可点击展开/折叠 */}
                  <button
                    onClick={() => toggleBookExpand(bookId)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    {/* 展开/折叠图标 */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>

                    {/* 书籍图标 */}
                    <svg className="w-4 h-4 text-[#2C5530]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>

                    {/* 书名 */}
                    <span className="flex-1 text-left text-sm font-light text-gray-700">
                      {group.book_title}
                    </span>

                    {/* 对话数量 */}
                    <span className="text-xs font-light text-gray-400">
                      {group.conversations.length}
                    </span>
                  </button>

                  {/* 对话列表 - 展开时显示 */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {group.conversations.map((conv) => (
                        <ConversationItem key={conv.id} conv={conv} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
