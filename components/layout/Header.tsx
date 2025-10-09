'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
}

/**
 * 统一的页面头部组件
 * MUJI风格：简洁、细字体、深绿色主题
 */
export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          console.log('[Header] API response:', data);
          console.log('[Header] User data:', data.user);
          setUser(data.user);
        } else {
          console.log('[Header] Auth failed:', response.status);
        }
      } catch (error) {
        console.error('[Header] Failed to check auth:', error);
      }
    };

    checkAuth();
  }, []);

  // 处理登出
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className="bg-[#2C5530] text-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左侧：Logo + 品牌名 */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
              <span className="text-[#2C5530] font-light text-lg">知</span>
            </div>
            <div className="flex flex-col">
              <span className="font-light text-lg leading-tight">InKnowing</span>
              <span className="font-light text-xs opacity-90">知应</span>
            </div>
          </Link>

          {/* 中间：导航 */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className={`font-light text-sm transition-opacity ${
                isActive('/') ? 'opacity-100 border-b border-white' : 'opacity-70 hover:opacity-100'
              }`}
            >
              首页
            </Link>
            <Link
              href="/books"
              className={`font-light text-sm transition-opacity ${
                isActive('/books') ? 'opacity-100 border-b border-white' : 'opacity-70 hover:opacity-100'
              }`}
            >
              浏览书籍
            </Link>
            <Link
              href="/characters"
              className={`font-light text-sm transition-opacity ${
                isActive('/characters') ? 'opacity-100 border-b border-white' : 'opacity-70 hover:opacity-100'
              }`}
            >
              热门角色
            </Link>
            <Link
              href="/about"
              className={`font-light text-sm transition-opacity ${
                isActive('/about') ? 'opacity-100 border-b border-white' : 'opacity-70 hover:opacity-100'
              }`}
            >
              关于知应
            </Link>
          </nav>

          {/* 右侧：用户信息/登录 */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="font-light text-sm">{user.username[0].toUpperCase()}</span>
                  </div>
                  <span className="font-light text-sm hidden md:block">{user.username}</span>
                </button>

                {/* 用户下拉菜单 */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2">
                    <Link
                      href="/conversations"
                      className="block px-4 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      我的对话
                    </Link>
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      个人设置
                    </Link>
                    <hr className="my-2 border-gray-100" />
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm font-light text-red-600 hover:bg-gray-50 transition-colors"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/login"
                  className="font-light text-sm opacity-70 hover:opacity-100 transition-opacity"
                >
                  登录
                </Link>
                <Link
                  href="/auth/register"
                  className="font-light text-sm px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
