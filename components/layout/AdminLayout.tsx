/**
 * 管理后台统一布局组件
 * 与主首页保持一致的MUJI风格设计
 * 桌面端水平导航 + 移动端汉堡菜单
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AdminLayoutProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const ADMIN_NAV_ITEMS = [
  { href: '/admin', label: '仪表板', exact: true },
  { href: '/admin/books', label: '书籍管理' },
  { href: '/admin/characters', label: '角色管理' },
  { href: '/admin/book-requests', label: '书籍申请' },
  { href: '/admin/documents', label: '文档管理' },
  { href: '/admin/settings', label: '系统设置' },
  { href: '/admin/invite-codes', label: '邀请码' },
];

export default function AdminLayout({ children, title, actions }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) {
      return pathname === path;
    }
    return pathname === path || pathname?.startsWith(path + '/');
  };

  // 切换路由时关闭移动菜单
  useEffect(() => {
    setShowMobileMenu(false);
    setShowUserMenu(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      {/* 统一的Header - 与主首页相同的深绿色风格 */}
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
                <span className="font-light text-xs opacity-90 hidden sm:block">管理后台</span>
              </div>
            </Link>

            {/* 中间：桌面导航菜单 */}
            <nav className="hidden md:flex items-center gap-8">
              {ADMIN_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-light text-sm transition-opacity ${
                    isActive(item.href, item.exact)
                      ? 'opacity-100 border-b border-white'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* 右侧：用户菜单 + 移动端汉堡按钮 */}
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="font-light text-sm">管</span>
                  </div>
                  <span className="font-light text-sm hidden md:block">管理员</span>
                </button>

                {/* 用户下拉菜单 */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2">
                    <Link
                      href="/"
                      className="block px-4 py-2 text-sm font-light text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      返回前台
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
            <div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setShowMobileMenu(false)}
            />
            <div className="fixed top-[64px] left-0 right-0 bg-white shadow-lg z-40 md:hidden max-h-[calc(100vh-64px)] overflow-y-auto">
              <nav className="px-6 py-4 border-b border-gray-100">
                {ADMIN_NAV_ITEMS.map((item, idx) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block py-3 text-sm font-light ${
                      idx !== ADMIN_NAV_ITEMS.length - 1 ? 'border-b border-gray-100' : ''
                    } ${
                      isActive(item.href, item.exact)
                        ? 'text-[#2C5530] font-normal'
                        : 'text-gray-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="px-6 py-4">
                <Link
                  href="/"
                  className="block py-3 text-sm font-light text-gray-700 border-b border-gray-100"
                >
                  返回前台
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left py-3 text-sm font-light text-red-600"
                >
                  退出登录
                </button>
              </div>
            </div>
          </>
        )}
      </header>

      {/* 主内容区域 */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#FAF9F7] border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="text-center">
            <p className="font-light text-xs text-gray-500">
              © {new Date().getFullYear()} InKnowing 知应 管理后台
            </p>
            <p className="font-light text-xs text-gray-400 mt-2">
              Powered by AI · Made with care
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
