'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * 管理员登录页面
 * 极简管理员登录界面
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('管理员登录成功，跳转到管理后台');
        console.log('Response data:', data);
        // 登录成功，使用window.location强制跳转
        window.location.href = '/admin';
      } else {
        setError(data.message || '密码错误，请重试');
      }
    } catch (err) {
      console.error('管理员登录错误:', err);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* 管理后台标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-[#2C5530] mb-2">
            管理后台
          </h1>
          <p className="text-gray-600 text-sm">
            知应 InKnowing 内容管理系统
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 密码输入 */}
          <div>
            <label htmlFor="password" className="block text-sm text-gray-700 mb-1">
              管理员密码
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors bg-white"
              placeholder="输入管理员密码"
              autoComplete="current-password"
            />
          </div>

          {/* 环境提示 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-50 text-yellow-700 px-4 py-3 rounded-lg text-xs">
              <p>开发环境提示：</p>
              <p>如未设置ADMIN_PASSWORD环境变量，默认密码为: admin123456</p>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-light"
          >
            {loading ? '验证中...' : '进入管理后台'}
          </button>
        </form>

        {/* 安全提示 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            此页面仅供管理员使用。所有操作将被记录。
          </p>
        </div>

        {/* 返回首页 */}
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-[#2C5530] transition-colors"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}