/**
 * 对话工作区 - SPA 状态中枢
 * 外框(Header + 三栏容器)只挂载一次, 仅中栏随 activeId 局部刷新
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

  const handleSelect = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    window.history.pushState(
      { conversationId: id },
      '',
      `/conversations/${id}`
    );
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

  return (
    <div className="h-screen flex flex-col bg-[#FAF9F7]">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <ConversationHistorySidebar
          currentConversationId={activeId}
          onSelectConversation={handleSelect}
        />
        <ConversationView
          conversationId={activeId}
          onConversationLoaded={setCurrentConversation}
          onNavigate={handleSelect}
        />
        {currentConversation && (
          <BookCharacterSidebar
            conversation={currentConversation}
            onSwitch={handleSelect}
          />
        )}
      </div>
    </div>
  );
}
