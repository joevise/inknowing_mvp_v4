/**
 * 对话界面页面 - 完整重构版
 * 实现三栏布局: 历史记录 | 对话区域 | 书籍角色信息
 * 支持SSE流式响应、角色切换、AI路由策略显示
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import ConversationHistorySidebar from '@/components/conversation/ConversationHistorySidebar';
import BookCharacterSidebar from '@/components/conversation/BookCharacterSidebar';
import MarkdownMessage from '@/components/conversation/MarkdownMessage';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: {
    strategy?: 'ai_native' | 'rag_retrieval' | 'hybrid';
    queryType?: string;
    sources?: Array<{
      content: string;
      score: number;
    }>;
    cover_url?: string;
    character_name?: string;
    book_title?: string;
  };
}

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

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (conversationId) {
      checkAuthAndLoadConversation();
    }

    // 清理EventSource
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

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

  const handleSendWithStream = async () => {
    if (!input.trim() || sending || streaming) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);
    setStreaming(true);
    setStreamingMessage('');
    setError('');

    // 立即显示用户消息
    const tempUserMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // 使用流式API
      const response = await fetch(`/api/conversations/${conversationId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: userMessage }),
      });

      if (!response.ok) {
        throw new Error('发送消息失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let assistantMessage = '';
      let metadata: any = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk') {
                // 处理元数据(第一个chunk可能包含metadata)
                if (data.metadata) {
                  metadata = data.metadata;
                }
                // 处理文本内容
                if (data.data) {
                  assistantMessage += data.data;
                  setStreamingMessage(assistantMessage);
                }
              } else if (data.type === 'done') {
                // 流式响应完成,添加完整消息
                if (data.metadata) {
                  metadata = { ...metadata, ...data.metadata };
                }

                const finalMessage: Message = {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: assistantMessage,
                  created_at: new Date().toISOString(),
                  metadata: metadata,
                };

                setMessages(prev => {
                  const filtered = prev.filter(m => m.id !== tempUserMsg.id);
                  return [
                    ...filtered,
                    {
                      ...tempUserMsg,
                      id: `user-${Date.now()}`,
                    },
                    finalMessage,
                  ];
                });

                setStreamingMessage('');
                setStreaming(false);
                setSending(false);
              } else if (data.type === 'error') {
                throw new Error(data.data || '生成回复失败');
              }
            } catch (e) {
              console.error('[Stream] 解析数据失败:', e);
            }
          }
        }
      }

    } catch (err) {
      console.error('[Conversation] 发送失败:', err);
      setError(err instanceof Error ? err.message : '发送消息失败');
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      setStreamingMessage('');
    } finally {
      setStreaming(false);
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendWithStream();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center">
        <div className="text-gray-600 font-light">加载中...</div>
      </div>
    );
  }

  if (error && !conversation) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-red-600 font-light mb-4">{error}</div>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 bg-[#2C5530] text-white font-light rounded-lg hover:bg-[#234426] transition-colors"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#FAF9F7]">
      {/* 统一Header */}
      <Header />

      {/* 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧: 历史记录侧边栏 */}
        <ConversationHistorySidebar currentConversationId={conversationId} />

        {/* 中间: 对话区域 */}
        <div className="flex-1 flex flex-col bg-[#FAF9F7]">
          {/* 对话标题栏 */}
          <div className="px-6 py-4 bg-white border-b border-gray-200">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-lg font-light text-gray-800">
                {conversation?.character_name || conversation?.book_title || '对话'}
              </h1>
              <p className="text-sm font-light text-gray-500">
                {conversation?.type === 'character' ? '角色对话模式' : '书籍对话模式'}
              </p>
            </div>
          </div>

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {messages.length === 0 && !streamingMessage && (
                <div className="text-center text-gray-500 font-light py-12">
                  <p className="mb-2">开始与{conversation?.character_name || conversation?.book_title}对话</p>
                  <p className="text-sm">试试问一些问题吧！</p>
                </div>
              )}

              {messages.map((message) => {
                // 优先使用消息自己的 metadata 中的头像信息，否则使用当前 conversation 的
                const messageCoverUrl = message.metadata?.cover_url || conversation?.cover_url;
                const messageCharacterName = message.metadata?.character_name || conversation?.character_name;
                const messageBookTitle = message.metadata?.book_title || conversation?.book_title;

                return (
                <div
                  key={message.id}
                  className={`mb-6 flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* 助手消息 - 左侧显示书籍/角色头像 */}
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      {messageCoverUrl ? (
                        <img
                          src={messageCoverUrl}
                          alt={messageCharacterName || messageBookTitle || ''}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#2C5530] flex items-center justify-center text-white text-sm font-light">
                          {(messageCharacterName || messageBookTitle || '书')?.charAt(0)}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[75%] rounded-lg px-5 py-3 ${
                      message.role === 'user'
                        ? 'bg-[#2C5530] text-white'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-100'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap font-light leading-relaxed">
                        {message.content}
                      </p>
                    ) : (
                      <MarkdownMessage content={message.content} />
                    )}

                    <p className={`text-xs mt-2 font-light ${
                      message.role === 'user' ? 'text-gray-300' : 'text-gray-400'
                    }`}>
                      {new Date(message.created_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* 用户消息 - 右侧显示用户头像 */}
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm font-light">
                        {conversation?.user?.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}

              {/* 流式响应中的消息 */}
              {streamingMessage && (
                <div className="mb-6 flex gap-3 justify-start">
                  {/* 助手头像 */}
                  <div className="flex-shrink-0">
                    {conversation?.cover_url ? (
                      <img
                        src={conversation.cover_url}
                        alt={conversation.character_name || conversation.book_title || ''}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#2C5530] flex items-center justify-center text-white text-sm font-light">
                        {(conversation?.character_name || conversation?.book_title || '书')?.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="max-w-[75%] bg-white text-gray-800 shadow-sm border border-gray-100 rounded-lg px-5 py-3">
                    <MarkdownMessage content={streamingMessage} />
                    <span className="inline-block w-1 h-4 ml-1 bg-[#2C5530] animate-pulse"></span>
                  </div>
                </div>
              )}

              {sending && !streamingMessage && (
                <div className="mb-6 flex gap-3 justify-start">
                  {/* 助手头像 */}
                  <div className="flex-shrink-0">
                    {conversation?.cover_url ? (
                      <img
                        src={conversation.cover_url}
                        alt={conversation.character_name || conversation.book_title || ''}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#2C5530] flex items-center justify-center text-white text-sm font-light">
                        {(conversation?.character_name || conversation?.book_title || '书')?.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="bg-white text-gray-800 shadow-sm border border-gray-100 rounded-lg px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm font-light text-gray-500">思考中...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border-t border-red-200 px-6 py-3">
              <div className="max-w-4xl mx-auto text-red-600 text-sm font-light">{error}</div>
            </div>
          )}

          {/* 输入区域 */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="max-w-4xl mx-auto flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入你的问题..."
                disabled={sending || streaming}
                rows={1}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#2C5530] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed font-light"
                style={{ minHeight: '52px', maxHeight: '120px' }}
              />
              <button
                onClick={handleSendWithStream}
                disabled={!input.trim() || sending || streaming}
                className="px-6 py-3 bg-[#2C5530] text-white font-light rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {sending || streaming ? '发送中...' : '发送'}
              </button>
            </div>
          </div>
        </div>

        {/* 右侧: 书籍角色信息侧边栏 */}
        {conversation && (
          <BookCharacterSidebar
            conversation={conversation}
            onCharacterSwitch={async (characterId) => {
              console.log('[Conversation] 角色切换:', characterId);
              // 重新加载对话信息以获取最新的character_id和type
              await loadConversation();
            }}
          />
        )}
      </div>
    </div>
  );
}
