/**
 * 管理后台首页 - 仪表板
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Stats {
  bookCount: number;
  characterCount: number;
  conversationCount: number;
  userCount: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查管理员登录状态
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/me');

        if (!response.ok) {
          console.log('管理员未登录，跳转到登录页');
          router.push('/admin/login');
          return;
        }

        // 验证通过，获取统计数据
        fetchStats();
      } catch (error) {
        console.error('验证失败:', error);
        router.push('/admin/login');
      }
    };

    checkAuth();
  }, [router]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats({
        bookCount: data.bookCount,
        characterCount: data.characterCount,
        conversationCount: data.conversationCount,
        userCount: data.userCount,
      });
    } catch (error) {
      console.error('获取统计失败:', error);
      // 失败时使用默认值
      setStats({
        bookCount: 0,
        characterCount: 0,
        conversationCount: 0,
        userCount: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      {/* 导航栏 */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-[#2F5233]">知应管理后台</h1>
          <div className="flex gap-6">
            <Link
              href="/admin"
              className="text-[#2F5233] hover:text-[#1a2e1c] font-medium"
            >
              仪表板
            </Link>
            <Link
              href="/admin/books"
              className="text-gray-600 hover:text-[#2F5233]"
            >
              书籍管理
            </Link>
            <Link
              href="/admin/characters"
              className="text-gray-600 hover:text-[#2F5233]"
            >
              角色管理
            </Link>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700"
            >
              退出登录
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">系统概览</h2>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            title="书籍总数"
            value={stats?.bookCount || 0}
            icon="📚"
            link="/admin/books"
          />
          <StatCard
            title="角色总数"
            value={stats?.characterCount || 0}
            icon="👤"
            link="/admin/characters"
          />
          <StatCard
            title="对话总数"
            value={stats?.conversationCount || 0}
            icon="💬"
            link="/admin/conversations"
          />
          <StatCard
            title="用户总数"
            value={stats?.userCount || 0}
            icon="👥"
            link="/admin/users"
          />
        </div>

        {/* 快捷操作 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">快捷操作</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActionButton
              title="添加新书籍"
              description="通过AI识别或手动添加"
              icon="➕"
              link="/admin/books/new"
            />
            <ActionButton
              title="管理文档"
              description="上传和向量化书籍文档"
              icon="📄"
              link="/admin/documents"
            />
            <ActionButton
              title="系统配置"
              description="AI服务和系统设置"
              icon="⚙️"
              link="/admin/settings"
            />
          </div>
        </div>

        {/* 最近活动 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">最近活动</h3>
          <div className="space-y-3">
            <ActivityItem
              text="用户 user@example.com 创建了新对话"
              time="5分钟前"
            />
            <ActivityItem
              text="添加了新书籍《红楼梦》"
              time="1小时前"
            />
            <ActivityItem
              text="完成了《三体》的文档向量化"
              time="2小时前"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// 统计卡片组件
function StatCard({
  title,
  value,
  icon,
  link,
}: {
  title: string;
  value: number;
  icon: string;
  link: string;
}) {
  return (
    <Link
      href={link}
      className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-4xl">{icon}</span>
        <span className="text-3xl font-bold text-[#2F5233]">{value}</span>
      </div>
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
    </Link>
  );
}

// 快捷操作按钮组件
function ActionButton({
  title,
  description,
  icon,
  link,
}: {
  title: string;
  description: string;
  icon: string;
  link: string;
}) {
  return (
    <Link
      href={link}
      className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#2F5233] hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">{title}</h4>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </Link>
  );
}

// 活动项组件
function ActivityItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-700">{text}</span>
      <span className="text-sm text-gray-500">{time}</span>
    </div>
  );
}
