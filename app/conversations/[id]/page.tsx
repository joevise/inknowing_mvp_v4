/**
 * 对话界面页面
 * 实现完整的对话功能，包括消息发送、流式响应、历史记录等
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  book_id: string;
  character_id?: string;
  type: 'book' | 'character';
  title?: string;
  book_title?: string;
  character_name?: string;
}

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      checkAuthAndLoadConversation();
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkAuthAndLoadConversation = async () => {
    try {
      // 检查登录状态
      const sessionCheck = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!sessionCheck.ok) {
        router.push(`/auth/login?redirect=/conversations/${conversationId}`);
        return;
      }

      await loadConversation();
      await loadMessages();
    } catch (err) {
      console.error('[Conversation] 加载失败:', err);
      setError(err instanceof Error ? err.message : '加载对话失败');
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async () => {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('获取对话信息失败');
    }
    const data = await response.json();
    setConversation(data.conversation);
  };

  const loadMessages = async () => {
    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('获取消息列表失败');
    }
    const data = await response.json();
    setMessages(data.messages || []);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);
    setError('');

    // 立即显示用户消息
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: userMessage }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '发送消息失败');
      }

      const data = await response.json();

      // 替换临时消息并添加AI回复
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [
          ...filtered,
          data.message.userMessage,
          data.message.assistantMessage,
        ];
      });

      console.log('[Conversation] 消息发送成功:', {
        strategy: data.metadata?.strategy,
        queryType: data.metadata?.queryType,
      });

    } catch (err) {
      console.error('[Conversation] 发送失败:', err);
      setError(err instanceof Error ? err.message : '发送消息失败');
      // 移除临时消息
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5DC] flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (error && !conversation) {
    return (
      <div className="min-h-screen bg-[#F5F5DC] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-[#2F5233] text-white rounded-lg hover:bg-[#1a2e1c]"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F5F5DC]">
      {/* 顶部导航 */}
      <nav className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/books" className="text-gray-600 hover:text-[#2F5233]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-800">
                {conversation?.character_name || conversation?.book_title || '对话'}
              </h1>
              <p className="text-sm text-gray-500">
                {conversation?.type === 'character' ? '角色对话' : '书籍对话'}
              </p>
            </div>
          </div>
          <Link href="/" className="text-gray-600 hover:text-[#2F5233]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Link>
        </div>
      </nav>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <p className="mb-2">开始与{conversation?.character_name || conversation?.book_title}对话</p>
              <p className="text-sm">试试问一些问题吧！</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-6 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-[#2F5233] text-white'
                    : 'bg-white text-gray-800 shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-gray-300' : 'text-gray-400'
                  }`}
                >
                  {new Date(message.created_at).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="mb-6 flex justify-start">
              <div className="bg-white text-gray-800 shadow-sm rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-gray-500">思考中...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 px-6 py-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto text-red-600 text-sm">{error}</div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="bg-white border-t px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入你的问题..."
            disabled={sending}
            rows={1}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#2F5233] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '52px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-6 py-3 bg-[#2F5233] text-white rounded-lg hover:bg-[#1a2e1c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {sending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
