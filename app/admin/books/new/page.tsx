/**
 * 添加新书页面
 * 使用AI识别书籍信息并创建
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';

interface BookInfo {
  title: string;
  author: string;
  description: string;
  publisher?: string;
  publishDate?: string;
  category: string;
  tags: string[];
}

interface IdentifyResult {
  bookInfo: BookInfo;
  aiScore: number;
  coverOptions: string[];
  requiresDocument: boolean;
}

export default function NewBookPage() {
  const router = useRouter();
  const [step, setStep] = useState<'input' | 'identifying' | 'review' | 'creating'>('input');
  const [bookTitle, setBookTitle] = useState('');
  const [identifyResult, setIdentifyResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState('');

  // 步骤1: AI识别书籍
  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!bookTitle.trim()) {
      setError('请输入书籍名称');
      return;
    }

    setStep('identifying');

    try {
      const response = await fetch('/api/admin/books/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookTitle: bookTitle.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '识别失败');
      }

      setIdentifyResult(data.data);
      setStep('review');
    } catch (err) {
      console.error('识别失败:', err);
      setError(err instanceof Error ? err.message : '识别失败，请重试');
      setStep('input');
    }
  };

  // 步骤2: 创建书籍
  const handleCreate = async () => {
    if (!identifyResult) return;

    setStep('creating');
    setError('');

    try {
      const response = await fetch('/api/admin/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...identifyResult.bookInfo,
          aiScore: identifyResult.aiScore,
          conversationStrategy: 'hybrid'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建失败');
      }

      // 创建成功，跳转到书籍列表
      router.push('/admin/books');
    } catch (err) {
      console.error('创建失败:', err);
      setError(err instanceof Error ? err.message : '创建失败，请重试');
      setStep('review');
    }
  };

  return (
    <AdminLayout title="添加新书">
      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-8 py-12">
        <div className="mb-6">
          <Link
            href="/admin/books"
            className="text-gray-600 hover:text-[#2C5530] font-light"
          >
            ← 返回书籍列表
          </Link>
        </div>

        {/* 步骤指示器 */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <Step number={1} label="输入书名" active={step === 'input'} completed={step !== 'input'} />
            <div className="flex-1 h-0.5 bg-gray-300" />
            <Step number={2} label="AI识别" active={step === 'identifying'} completed={step === 'review' || step === 'creating'} />
            <div className="flex-1 h-0.5 bg-gray-300" />
            <Step number={3} label="确认信息" active={step === 'review'} completed={step === 'creating'} />
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 步骤1: 输入书名 */}
        {step === 'input' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-xl font-light text-gray-800 mb-4">请输入书籍名称</h2>
            <p className="text-gray-600 mb-6">
              AI将自动识别书籍信息，包括作者、简介、分类等。
            </p>

            <form onSubmit={handleIdentify}>
              <div className="mb-6">
                <label className="block text-sm font-light text-gray-700 mb-2">
                  书籍名称
                </label>
                <input
                  type="text"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="例如：三体"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C5530] focus:border-transparent"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-light"
              >
                开始AI识别
              </button>
            </form>
          </div>
        )}

        {/* 步骤2: AI识别中 */}
        {step === 'identifying' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-[#2C5530] border-t-transparent rounded-full animate-spin" />
              <p className="text-lg text-gray-700">AI正在识别《{bookTitle}》...</p>
              <p className="text-sm text-gray-500">这可能需要几秒钟时间</p>
            </div>
          </div>
        )}

        {/* 步骤3: 确认信息 */}
        {step === 'review' && identifyResult && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-xl font-light text-gray-800 mb-6">确认书籍信息</h2>

            <div className="space-y-4 mb-6">
              <InfoRow label="书名" value={identifyResult.bookInfo.title} />
              <InfoRow label="作者" value={identifyResult.bookInfo.author} />
              <InfoRow label="分类" value={identifyResult.bookInfo.category} />
              <InfoRow label="简介" value={identifyResult.bookInfo.description} />
              {identifyResult.bookInfo.publisher && (
                <InfoRow label="出版社" value={identifyResult.bookInfo.publisher} />
              )}
              {identifyResult.bookInfo.publishDate && (
                <InfoRow label="出版年份" value={identifyResult.bookInfo.publishDate} />
              )}
              <InfoRow
                label="标签"
                value={identifyResult.bookInfo.tags.join(', ')}
              />
            </div>

            {/* AI知识水平提示 */}
            <div className={`p-4 rounded-lg mb-6 ${
              identifyResult.aiScore >= 8
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-light">
                  AI了解度: {identifyResult.aiScore}/10
                </span>
                {identifyResult.requiresDocument && (
                  <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded">
                    需要上传文档
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {identifyResult.aiScore >= 8
                  ? '✓ AI对这本书非常了解，可以直接进行AI原生对话，也可以选择上传文档增强知识。'
                  : '⚠️ AI对这本书了解有限，建议上传书籍文档以获得更准确的对话效果。'
                }
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep('input');
                  setIdentifyResult(null);
                }}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors font-light"
              >
                重新识别
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 bg-[#2C5530] text-white py-3 rounded-lg hover:bg-[#1a2e1c] transition-colors font-light"
              >
                确认创建
              </button>
            </div>
          </div>
        )}

        {/* 创建中 */}
        {step === 'creating' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-[#2C5530] border-t-transparent rounded-full animate-spin" />
              <p className="text-lg text-gray-700">正在创建书籍...</p>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}

// 步骤指示器组件
function Step({ number, label, active, completed }: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center font-light text-sm
        ${completed ? 'bg-[#2C5530] text-white' :
          active ? 'bg-[#2C5530] text-white' :
          'bg-gray-200 text-gray-500'}
      `}>
        {completed ? '✓' : number}
      </div>
      <span className={`text-sm ${active || completed ? 'text-gray-800 font-light' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}

// 信息展示行组件
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-gray-100 pb-3">
      <span className="text-sm text-gray-500">{label}</span>
      <p className="text-gray-800 mt-1">{value}</p>
    </div>
  );
}
