/**
 * 对话创建页面
 * 处理对话创建逻辑，然后跳转到对话界面
 */

'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

function NewConversationContent() {
  const router = useRouter();
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(true);
  const hasCreated = useRef(false);

  const bookId = searchParams.get('bookId');
  const characterId = searchParams.get('characterId');

  useEffect(() => {
    // 防止 React StrictMode 导致的重复执行
    if (hasCreated.current) {
      console.log('[NewConversation] 已经创建过对话，忽略重复执行');
      return;
    }

    if (bookId) {
      hasCreated.current = true;
      createConversation();
    } else {
      setError(t('conversationNew.errorMissingBookId'));
      setCreating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, characterId]);

  const createConversation = async () => {
    console.log('[NewConversation] 开始创建对话:', { bookId, characterId });

    try {
      setCreating(true);
      setError('');

      // 检查是否登录
      const sessionCheck = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!sessionCheck.ok) {
        console.log('[NewConversation] 用户未登录，跳转到登录页');
        // 未登录，跳转到登录页并保存当前URL
        const currentUrl = `/conversations/new?bookId=${bookId}${characterId ? `&characterId=${characterId}` : ''}`;
        router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
        return;
      }

      // 创建对话
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookId,
          characterId: characterId || undefined,
          type: characterId ? 'character' : 'book',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('conversationNew.errorCreateFailed'));
      }

      const data = await response.json();
      const conversationId = data.conversation.id;

      console.log('[NewConversation] 对话创建成功:', {
        conversationId,
        type: characterId ? 'character' : 'book',
      });

      // 跳转到对话界面
      router.push(`/conversations/${conversationId}`);

    } catch (err) {
      console.error('[NewConversation] 创建失败:', err);
      setError(err instanceof Error ? err.message : t('conversationNew.errorCreateFailed'));
      setCreating(false);
      hasCreated.current = false; // 重置状态以便重试
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
        {creating && (
          <>
            <div className="mb-4">
              <svg
                className="animate-spin h-12 w-12 mx-auto text-[#2F5233]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p className="text-gray-600">{t('conversationNew.creating')}</p>
          </>
        )}

        {error && (
          <>
            <div className="mb-4 text-red-600">
              <svg
                className="h-12 w-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 bg-[#2F5233] text-white rounded-lg hover:bg-[#1a2e1c] transition-colors"
            >
              {t('conversationNew.back')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  const t = useTranslations();
  return (
    <div className="min-h-screen bg-[#F5F5DC] flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="mb-4">
          <svg
            className="animate-spin h-12 w-12 mx-auto text-[#2F5233]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <p className="text-gray-600">{t('conversationNew.loading')}</p>
      </div>
    </div>
  );
}

export default function NewConversationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NewConversationContent />
    </Suspense>
  );
}
