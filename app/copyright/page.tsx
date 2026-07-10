'use client';

import { FormEvent, useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface FormState {
  work_title: string;
  rights_holder: string;
  contact_info: string;
  proof_description: string;
  infringing_content: string;
}

const initialForm: FormState = {
  work_title: '',
  rights_holder: '',
  contact_info: '',
  proof_description: '',
  infringing_content: '',
};

export default function CopyrightPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/copyright-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '提交失败，请稍后重试');
      }

      setForm(initialForm);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10 text-center">
            <h1 className="text-3xl md:text-4xl font-light text-[#2C5530] mb-4">版权投诉</h1>
            <p className="text-sm font-light text-gray-500 leading-relaxed">
              如果您认为平台内容涉及您的著作权作品，请提交以下信息。我们将在收到有效投诉后 48 小时内核验并处理，包括下架、调整或补充说明。
            </p>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100 mb-6">
            <h2 className="text-xl font-light text-[#2C5530] mb-4">投诉流程</h2>
            <div className="space-y-3 font-light text-gray-700 leading-relaxed">
              <p>请提供作品名称、权属证明说明、联系方式，以及涉嫌侵权内容的具体描述（如书名、页面 URL 或相关位置）。</p>
              <p>提交后，管理员会进入审核流程；如投诉有效，我们将对相关内容进行下架或调整。</p>
            </div>
          </div>

          {success && (
            <div className="mb-6 bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-lg font-light text-sm">
              您的投诉已提交，我们将在 48 小时内处理
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg font-light text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-8 shadow-sm border border-gray-100 space-y-6">
            <div>
              <label htmlFor="work_title" className="block text-sm font-light text-gray-700 mb-2">
                作品名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="work_title"
                type="text"
                required
                maxLength={200}
                value={form.work_title}
                onChange={event => updateField('work_title', event.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] bg-white font-light text-gray-700"
              />
            </div>

            <div>
              <label htmlFor="rights_holder" className="block text-sm font-light text-gray-700 mb-2">
                权利人姓名
              </label>
              <input
                id="rights_holder"
                type="text"
                maxLength={100}
                value={form.rights_holder}
                onChange={event => updateField('rights_holder', event.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] bg-white font-light text-gray-700"
              />
            </div>

            <div>
              <label htmlFor="contact_info" className="block text-sm font-light text-gray-700 mb-2">
                联系方式（邮箱/电话） <span className="text-red-500">*</span>
              </label>
              <input
                id="contact_info"
                type="text"
                required
                maxLength={200}
                value={form.contact_info}
                onChange={event => updateField('contact_info', event.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] bg-white font-light text-gray-700"
              />
            </div>

            <div>
              <label htmlFor="proof_description" className="block text-sm font-light text-gray-700 mb-2">
                权属证明说明 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="proof_description"
                required
                maxLength={2000}
                rows={5}
                value={form.proof_description}
                onChange={event => updateField('proof_description', event.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] bg-white font-light text-gray-700"
              />
            </div>

            <div>
              <label htmlFor="infringing_content" className="block text-sm font-light text-gray-700 mb-2">
                涉嫌侵权内容描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="infringing_content"
                required
                maxLength={2000}
                rows={5}
                value={form.infringing_content}
                onChange={event => updateField('infringing_content', event.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#2C5530] bg-white font-light text-gray-700"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 bg-[#2C5530] text-white font-light rounded-lg hover:bg-[#234426] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '提交中...' : '提交投诉'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
