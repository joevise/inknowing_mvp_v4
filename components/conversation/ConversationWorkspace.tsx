/**
 * 对话工作区 - SPA 状态中枢
 * 外框(Header + 三栏容器)只挂载一次, 仅中栏随 activeId 局部刷新
 * 移动端：默认只显示中间对话栏, 左右 sidebar 通过 drawer 抽屉式滑入
 */

'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import ConversationHistorySidebar from '@/components/conversation/ConversationHistorySidebar';
import ConversationView from '@/components/conversation/ConversationView';
import BookCharacterSidebar from '@/components/conversation/BookCharacterSidebar';

interface Conversation {
  id: string;
  book_id: string;
  character_id?: string;
  type: 'book' | 'character';
  title?: string;
  book_title?: string;
  character_name?: string;
  cover_url?: string;
  user?: {
    id: string;
    username: string;
  };
}

interface ConversationWorkspaceProps {
  initialConversationId: string;
}

export default function ConversationWorkspace({
  initialConversationId,
}: ConversationWorkspaceProps) {
  const [activeId, setActiveId] = useState<string>(initialConversationId);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showCharactersDrawer, setShowCharactersDrawer] = useState(false);

  const handleSelect = (id: string) => {
    if (id === activeId) {
      setShowHistoryDrawer(false);
      return;
    }
    setActiveId(id);
    setShowHistoryDrawer(false);
    window.history.pushState(
      { conversationId: id },
      '',
      `/conversations/${id}`
    );
  };

  // 关角色抽屉 - 切换对话时自动触发（点击角色卡片）
  const handleSwitchFromCharacters = (id: string) => {
    setShowCharactersDrawer(false);
    handleSelect(id);
  };

  useEffect(() => {
    const onPop = () => {
      const match = location.pathname.match(/\/conversations\/([^/]+)/);
      if (match) {
        setActiveId(match[1]);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 任一抽屉打开时锁定 body 滚动
  useEffect(() => {
    const anyOpen = showHistoryDrawer || showCharactersDrawer;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showHistoryDrawer, showCharactersDrawer]);

  return (
    <div className="h-screen flex flex-col bg-[#FAF9F7]">
      <Header />
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧历史侧栏: md+ 常驻, 移动端 drawer */}
        <div
          className={`
            ${showHistoryDrawer ? 'fixed inset-y-0 left-0 z-50 w-72 md:static md:w-auto md:z-auto' : 'hidden'}
            md:flex md:relative
          `}
        >
          <ConversationHistorySidebar
            currentConversationId={activeId}
            onSelectConversation={handleSelect}
          />
        </div>

        {/* 移动端历史侧栏的遮罩 */}
        {showHistoryDrawer && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setShowHistoryDrawer(false)}
          />
        )}

        {/* 中间对话栏 */}
        <ConversationView
          conversationId={activeId}
          onConversationLoaded={setCurrentConversation}
          onNavigate={handleSelect}
          onOpenHistoryDrawer={() => setShowHistoryDrawer(true)}
          onOpenCharactersDrawer={() => setShowCharactersDrawer(true)}
        />

        {/* 右侧角色侧栏: md+ 常驻, 移动端 drawer */}
        {currentConversation && (
          <>
            <div
              className={`
                ${showCharactersDrawer ? 'fixed inset-y-0 right-0 z-50 w-80 md:static md:w-auto md:z-auto' : 'hidden'}
                md:flex md:relative
              `}
            >
              <BookCharacterSidebar
                conversation={currentConversation}
                onSwitch={handleSwitchFromCharacters}
              />
            </div>

            {/* 移动端角色侧栏的遮罩 */}
            {showCharactersDrawer && (
              <div
                className="fixed inset-0 bg-black/40 z-40 md:hidden"
                onClick={() => setShowCharactersDrawer(false)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
