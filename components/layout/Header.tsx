'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';

interface User {
  id: string;
  username: string;
  email: string;
}

/**
 * 统一的页面头部组件
 * MUJI风格：简洁、细字体、深绿色主题
 * 桌面端水平导航 + 移动端汉堡菜单
 */
export default function Header() {
  const pathname = usePathname();
  const t = useTranslations();
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

  // 切换路由时关闭移动菜单
  useEffect(() => {
    setShowMobileMenu(false);
    setShowUserMenu(false);
  }, [pathname]);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左侧：Logo + 品牌名 */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
              <span className="text-[#2C5530] font-light text-lg">知</span>
            </div>
            <div className="flex flex-col">
              <span className="font-light text-lg leading-tight">InKnowing</span>
              <span className="font-light text-xs opacity-90 hidden sm:block">{t('header.brandSub')}</span>
            </div>
          </Link>

          {/* 中间：桌面导航 */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className={`font-light text-sm transition-opacity ${
                isActive('/') ? 'opacity-100 border-b border-white' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {t('nav.home')}
            </Link>
            <Link
              href="/books"
              className={`font-light text-sm transition-opacity ${
                isActive('/books') ? 'opacity-100 border-b border-white' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {t('header.browseBooks')}
            </Link>
            <Link
              href="/characters"
              className={`font-light text-sm transition-opacity ${
                isActive('/characters') ? 'opacity-100 border-b border-white' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {t('header.popularCharacters')}
            </Link>
            <Link
              href="/about"
              className={`font-light text-sm transition-opacity ${
                isActive('/about') ? 'opacity-100 border-b border-white' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {t('header.aboutUs')}
            </Link>
          </nav>

          {/* 右侧：用户信息/登录 + 移动端汉堡按钮 */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            {user ? (
              <div className="relative hidden sm:block">
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
                      {t('header.myConversations')}
                    </Link>
                    <Link
                      href="/favorites"
                      className="block px-4 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('header.myFavorites')}
                    </Link>
                    <Link
                      href="/my-requests"
                      className="block px-4 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('header.myRequests')}
                    </Link>
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('header.profileSettings')}
                    </Link>
                    <hr className="my-2 border-gray-100" />
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm font-light text-red-600 hover:bg-gray-50 transition-colors"
                    >
                      {t('common.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-3">
                <Link
                  href="/auth/login"
                  className="font-light text-sm opacity-70 hover:opacity-100 transition-opacity"
                >
                  {t('common.login')}
                </Link>
                <Link
                  href="/auth/register"
                  className="font-light text-sm px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  {t('common.register')}
                </Link>
              </div>
            )}

            {/* 汉堡菜单按钮 - 仅移动端显示 */}
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 hover:opacity-80 transition-opacity"
              aria-label="切换菜单"
            >
              {showMobileMenu ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 移动端汉堡菜单抽屉 */}
      {showMobileMenu && (
        <>
          {/* 半透明遮罩 */}
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* 抽屉内容 */}
          <div className="fixed top-[64px] left-0 right-0 bg-white shadow-lg z-40 md:hidden max-h-[calc(100vh-64px)] overflow-y-auto">
            <nav className="px-6 py-4 border-b border-gray-100">
              <Link
                href="/"
                className={`block py-3 text-sm font-light border-b border-gray-100 ${
                  isActive('/') ? 'text-[#2C5530] font-normal' : 'text-gray-700'
                }`}
              >
                {t('nav.home')}
              </Link>
              <Link
                href="/books"
                className={`block py-3 text-sm font-light border-b border-gray-100 ${
                  isActive('/books') ? 'text-[#2C5530] font-normal' : 'text-gray-700'
                }`}
              >
                {t('header.browseBooks')}
              </Link>
              <Link
                href="/characters"
                className={`block py-3 text-sm font-light border-b border-gray-100 ${
                  isActive('/characters') ? 'text-[#2C5530] font-normal' : 'text-gray-700'
                }`}
              >
                {t('header.popularCharacters')}
              </Link>
              <Link
                href="/about"
                className={`block py-3 text-sm font-light ${
                  isActive('/about') ? 'text-[#2C5530] font-normal' : 'text-gray-700'
                }`}
              >
                {t('header.aboutUs')}
              </Link>
            </nav>

            {user && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-light text-gray-400 mb-2">{user.username}</p>
                <Link
                  href="/conversations"
                  className="block py-3 text-sm font-light text-gray-700 border-b border-gray-100"
                >
                  {t('header.myConversations')}
                </Link>
                <Link
                  href="/favorites"
                  className="block py-3 text-sm font-light text-gray-700 border-b border-gray-100"
                >
                  {t('header.myFavorites')}
                </Link>
                <Link
                  href="/my-requests"
                  className="block py-3 text-sm font-light text-gray-700 border-b border-gray-100"
                >
                  {t('header.myRequests')}
                </Link>
                <Link
                  href="/profile"
                  className="block py-3 text-sm font-light text-gray-700"
                >
                  {t('header.profileSettings')}
                </Link>
              </div>
            )}

            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-xs font-light text-gray-400 mb-2">{t('language.switchTo')}</p>
              <LanguageSwitcher />
            </div>

            {user ? (
              <div className="px-6 py-4">
                <button
                  onClick={handleLogout}
                  className="block w-full text-left text-sm font-light text-red-600"
                >
                  {t('common.logout')}
                </button>
              </div>
            ) : (
              <div className="px-6 py-4 flex flex-col gap-3">
                <Link
                  href="/auth/login"
                  className="block w-full text-center py-2 text-sm font-light text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('common.login')}
                </Link>
                <Link
                  href="/auth/register"
                  className="block w-full text-center py-2 text-sm font-light text-white bg-[#2C5530] rounded-lg hover:bg-[#234426] transition-colors"
                >
                  {t('common.register')}
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}
