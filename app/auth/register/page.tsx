'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * 用户注册页面
 * 极简风格的注册表单
 */
export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // 验证密码确认
    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.errorPasswordMismatch'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('注册成功，跳转到首页');
        // 显示成功消息
        setSuccess(true);
        // 2秒后自动跳转到首页（已自动登录）
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setError(data.message || t('auth.errorRegisterFailed'));
      }
    } catch (err) {
      console.error('注册错误:', err);
      setError(t('auth.errorNetwork'));
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
            {t('common.appName')}
          </h1>
          <p className="text-gray-600 text-sm">
            {t('auth.registerSubtitle')}
          </p>
        </div>

        {/* 注册表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 成功提示 */}
          {success && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm">
              {t('auth.successMessage')}
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 用户名输入 */}
          <div>
            <label htmlFor="username" className="block text-sm font-light text-gray-700 mb-1">
              {t('auth.username')}
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              value={formData.username}
              onChange={handleChange}
              disabled={loading}
              minLength={2}
              maxLength={20}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors bg-white font-light"
              placeholder={t('auth.usernamePlaceholder')}
            />
          </div>

          {/* 邮箱输入 */}
          <div>
            <label htmlFor="email" className="block text-sm font-light text-gray-700 mb-1">
              {t('auth.email')}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors bg-white font-light"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          {/* 密码输入 */}
          <div>
            <label htmlFor="password" className="block text-sm text-gray-700 mb-1">
              {t('auth.password')}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              minLength={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors bg-white"
              placeholder={t('auth.passwordPlaceholderRegister')}
            />
          </div>

          {/* 确认密码 */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm text-gray-700 mb-1">
              {t('auth.confirmPassword')}
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              minLength={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] transition-colors bg-white"
              placeholder={t('auth.confirmPasswordPlaceholder')}
            />
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-light"
          >
            {loading ? t('auth.registering') : t('auth.registerSubmitButton')}
          </button>
        </form>

        {/* 登录链接 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {t('auth.hasAccount')}{' '}
            <Link
              href="/auth/login"
              className="text-[#2C5530] hover:underline"
            >
              {t('auth.goLogin')}
            </Link>
          </p>
        </div>

        {/* 返回首页 */}
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-[#2C5530] transition-colors"
          >
            {t('auth.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
