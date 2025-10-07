'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * 用户登录页面
 * 极简风格的登录表单
 */
export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 确保发送和接收cookies
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('登录成功，跳转到首页');
        // 登录成功，使用window.location进行完整页面重定向以确保cookie生效
        const redirectTo = new URLSearchParams(window.location.search).get('redirect');
        window.location.href = redirectTo || '/';
      } else {
        setError(data.message || '登录失败，请重试');
      }
    } catch (err) {
      console.error('登录错误:', err);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-[#2C5530] mb-2">
            知应 InKnowing
          </h1>
          <p className="text-gray-600 text-sm">
            登录账户，继续知识探索
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

          {/* 邮箱输入 */}
          <div>
            <label htmlFor="email" className="block text-sm text-gray-700 mb-1">
              邮箱
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors bg-white"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          {/* 密码输入 */}
          <div>
            <label htmlFor="password" className="block text-sm text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors bg-white"
              placeholder="输入密码"
              autoComplete="current-password"
            />
          </div>

          {/* 记住我选项（MVP阶段可选） */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                className="mr-2 rounded border-gray-300 text-[#2C5530] focus:ring-[#2C5530]"
              />
              <label htmlFor="remember" className="text-sm text-gray-600">
                记住我
              </label>
            </div>
            {/* 忘记密码链接（MVP阶段暂不实现） */}
            <Link
              href="#"
              className="text-sm text-gray-500 hover:text-[#2C5530] transition-colors"
              onClick={(e) => {
                e.preventDefault();
                alert('忘记密码功能将在后续版本推出');
              }}
            >
              忘记密码？
            </Link>
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-light"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        {/* 注册链接 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            还没有账户？{' '}
            <Link
              href="/auth/register"
              className="text-[#2C5530] hover:underline"
            >
              立即注册
            </Link>
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