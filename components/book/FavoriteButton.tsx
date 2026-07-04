/**
 * 收藏按钮组件 - 使用书架图标
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface FavoriteButtonProps {
  bookId: string;
  initialFavorited?: boolean;
  showCount?: boolean;
  favoriteCount?: number;
  size?: 'sm' | 'md' | 'lg';
  onToggle?: (favorited: boolean) => void;
}

export default function FavoriteButton({
  bookId,
  initialFavorited = false,
  showCount = false,
  favoriteCount = 0,
  size = 'md',
  onToggle,
}: FavoriteButtonProps) {
  const t = useTranslations();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(favoriteCount);
  const [loading, setLoading] = useState(false);

  // 尺寸映射
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);

    try {
      if (favorited) {
        // 移除收藏
        const response = await fetch(`/api/favorites/${bookId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (response.ok) {
          setFavorited(false);
          setCount(prev => Math.max(0, prev - 1));
          onToggle?.(false);
        } else if (response.status === 401) {
          window.location.href = '/auth/login';
        }
      } else {
        // 添加收藏
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ bookId }),
        });

        if (response.ok) {
          setFavorited(true);
          setCount(prev => prev + 1);
          onToggle?.(true);
        } else if (response.status === 401) {
          window.location.href = '/auth/login';
        }
      }
    } catch (error) {
      console.error('[FavoriteButton] Toggle failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleFavorite}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all
                  ${favorited
                    ? 'bg-[#2C5530] text-white hover:bg-[#234426]'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                  ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                  font-light ${textSizeClasses[size]}`}
      title={favorited ? t('favorite.remove') : t('favorite.add')}
    >
      {/* 书架图标 */}
      <svg
        className={sizeClasses[size]}
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={favorited ? 0 : 2}
          d="M5 3v18l7-3 7 3V3a1 1 0 00-1-1H6a1 1 0 00-1 1z"
        />
      </svg>

      {showCount && (
        <span>{count}</span>
      )}
    </button>
  );
}
