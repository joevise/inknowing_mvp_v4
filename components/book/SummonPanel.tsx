'use client';

/**
 * 召唤书中角色:主召唤按钮 + 指定角色名输入框
 * 书籍详情页用,空角色态和"未满 8 人"两种态都用同一个组件,
 * 父组件传 isEmpty 控制空态标题样式。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

interface SummonPanelProps {
  bookId: string;
  isEmpty: boolean;
  onCharactersUpdated: () => void;
}

type SummonErrorCode =
  | 'quota_exceeded'
  | 'book_full'
  | 'no_new_characters'
  | 'not_in_book'
  | 'invalid_body'
  | 'invalid_mode'
  | 'missing_name'
  | 'book_not_found'
  | 'book_not_published'
  | 'ai_failed'
  | 'internal_error'
  | 'unknown';

export default function SummonPanel({ bookId, isEmpty, onCharactersUpdated }: SummonPanelProps) {
  const t = useTranslations();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [namedInput, setNamedInput] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' } | { kind: 'ok' } | { kind: 'err'; code: SummonErrorCode }>({ kind: 'idle' });

  const callSummon = async (body: { mode: 'main_cast' } | { mode: 'named'; name: string }) => {
    setSubmitting(true);
    setStatus({ kind: 'idle' });
    try {
      const resp = await fetch(`/api/books/${bookId}/characters/summon`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const code = (data?.error as SummonErrorCode) || 'unknown';
        // 401:未登录 → 跳到登录页
        if (resp.status === 401) {
          setStatus({ kind: 'err', code: 'quota_exceeded' });
          router.push('/login');
          return;
        }
        setStatus({ kind: 'err', code });
        return;
      }

      setStatus({ kind: 'ok' });
      setNamedInput('');
      onCharactersUpdated();
    } catch (err) {
      console.error('[SummonPanel] 请求失败:', err);
      setStatus({ kind: 'err', code: 'unknown' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMainCast = () => {
    if (submitting) return;
    void callSummon({ mode: 'main_cast' });
  };

  const handleNamedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = namedInput.trim();
    if (!trimmed) {
      setStatus({ kind: 'err', code: 'missing_name' });
      return;
    }
    void callSummon({ mode: 'named', name: trimmed });
  };

  const errorMessage = (() => {
    if (status.kind !== 'err') return '';
    switch (status.code) {
      case 'quota_exceeded': return t('summon.errQuota');
      case 'book_full': return t('summon.errBookFull');
      case 'no_new_characters': return t('summon.errNoNew');
      case 'not_in_book': return t('summon.errNotInBook');
      case 'missing_name': return t('summon.errNotInBook');
      case 'book_not_found':
      case 'book_not_published': return t('summon.errGeneric');
      case 'ai_failed':
      case 'internal_error':
      case 'invalid_body':
      case 'invalid_mode':
      case 'unknown':
      default:
        return t('summon.errGeneric');
    }
  })();

  // 容器样式:空态用居中卡片,有角色时用单行轻入口
  if (isEmpty) {
    return (
      <div className="bg-white border border-gray-100 rounded-lg p-8 text-center shadow-sm">
        <h2 className="text-2xl font-light text-gray-800 mb-2">{t('summon.emptyTitle')}</h2>
        <p className="text-gray-500 font-light mb-8">{t('summon.emptySubtitle')}</p>

        <div className="flex flex-col items-center gap-5 max-w-md mx-auto">
          <button
            type="button"
            onClick={handleMainCast}
            disabled={submitting}
            className="w-full px-6 py-3 bg-[#2C5530] text-white font-light rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? t('summon.loading') : t('summon.summonMainCast')}
          </button>

          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-light text-gray-400">{t('summon.namedLabel')}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleNamedSubmit} className="w-full flex gap-2">
            <input
              type="text"
              value={namedInput}
              onChange={(e) => setNamedInput(e.target.value)}
              placeholder={t('summon.namedPlaceholder')}
              disabled={submitting}
              maxLength={100}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg font-light text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2C5530] transition-colors disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-3 border border-[#2C5530] text-[#2C5530] font-light rounded-lg hover:bg-[#2C5530] hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? t('summon.loading') : t('summon.namedButton')}
            </button>
          </form>
        </div>

        {status.kind === 'ok' && (
          <div className="mt-6 text-sm font-light text-[#2C5530]">{t('summon.success')}</div>
        )}
        {status.kind === 'err' && (
          <div className="mt-6 text-sm font-light text-red-600">{errorMessage}</div>
        )}
      </div>
    );
  }

  // 非空态:角色列表下方一行轻入口
  return (
    <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
      <button
        type="button"
        onClick={handleMainCast}
        disabled={submitting}
        className="px-5 py-2 bg-[#2C5530] text-white text-sm font-light rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? t('summon.loading') : t('summon.summonMainCast')}
      </button>

      <form onSubmit={handleNamedSubmit} className="flex-1 flex gap-2">
        <input
          type="text"
          value={namedInput}
          onChange={(e) => setNamedInput(e.target.value)}
          placeholder={t('summon.namedPlaceholder')}
          disabled={submitting}
          maxLength={100}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg font-light text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2C5530] transition-colors disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 border border-[#2C5530] text-[#2C5530] text-sm font-light rounded-lg hover:bg-[#2C5530] hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? t('summon.loading') : t('summon.namedButton')}
        </button>
      </form>

      {status.kind === 'ok' && (
        <div className="text-xs font-light text-[#2C5530] whitespace-nowrap">{t('summon.success')}</div>
      )}
      {status.kind === 'err' && (
        <div className="text-xs font-light text-red-600 whitespace-nowrap">{errorMessage}</div>
      )}
    </div>
  );
}