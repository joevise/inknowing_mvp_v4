/**
 * Markdown 消息渲染组件
 * 支持标题、列表、表格、代码块等完整 Markdown 语法
 */

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export default function MarkdownMessage({ content, className = '' }: MarkdownMessageProps) {
  const components: Components = {
    // 标题样式
    h1: ({ children }) => (
      <h1 className="text-2xl font-light text-gray-900 mb-4 mt-6 pb-2 border-b border-gray-200">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-light text-gray-900 mb-3 mt-5 pb-2 border-b border-gray-200">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-light text-gray-900 mb-2 mt-4">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-light text-gray-900 mb-2 mt-3">
        {children}
      </h4>
    ),

    // 段落
    p: ({ children }) => (
      <p className="mb-3 leading-relaxed">
        {children}
      </p>
    ),

    // 粗体
    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900">
        {children}
      </strong>
    ),

    // 斜体
    em: ({ children }) => (
      <em className="italic text-gray-800">
        {children}
      </em>
    ),

    // 列表
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-3 space-y-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-3 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed">
        {children}
      </li>
    ),

    // 引用
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-[#2C5530] pl-4 py-2 my-3 italic text-gray-700 bg-gray-50">
        {children}
      </blockquote>
    ),

    // 代码块
    code: ({ inline, children, className }) => {
      if (inline) {
        return (
          <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-sm font-mono">
            {children}
          </code>
        );
      }
      return (
        <code className={`block p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto my-3 text-sm font-mono ${className || ''}`}>
          {children}
        </code>
      );
    },

    // 表格
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-50">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="bg-white divide-y divide-gray-200">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr>
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-xs font-light text-gray-700 uppercase tracking-wider border border-gray-200">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-sm text-gray-800 border border-gray-200">
        {children}
      </td>
    ),

    // 链接
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#2C5530] hover:underline"
      >
        {children}
      </a>
    ),

    // 水平分隔线
    hr: () => (
      <hr className="my-6 border-gray-200" />
    ),
  };

  return (
    <div className={`markdown-content font-light ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
