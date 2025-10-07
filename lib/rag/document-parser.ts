/**
 * 文档解析器
 * 负责解析TXT和Markdown文档，提取章节结构和段落
 */

import { promises as fs } from 'fs';
import path from 'path';
import { RAG_CONFIG } from './config';

// 文档结构定义
export interface ParsedDocument {
  title?: string;
  chapters: Chapter[];
  totalLength: number;
  format: 'txt' | 'markdown';
  metadata: {
    parsedAt: string;
    encoding: string;
    originalSize: number;
  };
}

export interface Chapter {
  title: string;
  level: number; // 1-6 表示层级
  content: string;
  paragraphs: Paragraph[];
  startIndex: number;
  endIndex: number;
}

export interface Paragraph {
  content: string;
  chapterTitle: string;
  paragraphIndex: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 解析文档主入口
 * @param filePath 文件路径
 * @param format 文件格式（可选，会自动检测）
 */
export async function parseDocument(
  filePath: string,
  format?: 'txt' | 'markdown'
): Promise<ParsedDocument> {
  // 读取文件内容
  const content = await fs.readFile(filePath, RAG_CONFIG.document.encoding);
  const stats = await fs.stat(filePath);

  // 自动检测格式
  if (!format) {
    const ext = path.extname(filePath).toLowerCase();
    format = (ext === '.md' || ext === '.markdown') ? 'markdown' : 'txt';
  }

  // 根据格式选择解析器
  let parsedDoc: ParsedDocument;
  if (format === 'markdown') {
    parsedDoc = await parseMarkdownDocument(content);
  } else {
    parsedDoc = await parseTextDocument(content);
  }

  // 添加元数据
  parsedDoc.metadata = {
    parsedAt: new Date().toISOString(),
    encoding: RAG_CONFIG.document.encoding,
    originalSize: stats.size
  };

  return parsedDoc;
}

/**
 * 解析纯文本文档
 * @param content 文档内容
 */
export async function parseTextDocument(content: string): Promise<ParsedDocument> {
  const chapters: Chapter[] = [];
  const lines = content.split(/\r?\n/);

  // 章节标题模式
  const chapterPatterns = [
    /^第[一二三四五六七八九十\d]+[章节部分篇]/,
    /^Chapter\s+\d+/i,
    /^Part\s+\d+/i,
    /^\d+\.\s+/,
    /^[一二三四五六七八九十]+[、\.]/
  ];

  let currentChapter: Chapter | null = null;
  let currentContent: string[] = [];
  let currentIndex = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 检测是否为章节标题
    const isChapterTitle = chapterPatterns.some(pattern => pattern.test(trimmedLine));

    if (isChapterTitle && trimmedLine.length > 0 && trimmedLine.length < 100) {
      // 保存前一个章节
      if (currentChapter) {
        currentChapter.content = currentContent.join('\n');
        currentChapter.paragraphs = splitIntoParagraphs(
          currentChapter.content,
          currentChapter.title
        );
        currentChapter.endIndex = currentIndex;
        chapters.push(currentChapter);
      }

      // 开始新章节
      currentChapter = {
        title: trimmedLine,
        level: 1,
        content: '',
        paragraphs: [],
        startIndex: currentIndex,
        endIndex: currentIndex
      };
      currentContent = [];
    } else if (trimmedLine.length > 0) {
      currentContent.push(line);
    }

    currentIndex += line.length + 1; // +1 for newline
  }

  // 保存最后一个章节
  if (currentChapter) {
    currentChapter.content = currentContent.join('\n');
    currentChapter.paragraphs = splitIntoParagraphs(
      currentChapter.content,
      currentChapter.title
    );
    currentChapter.endIndex = currentIndex;
    chapters.push(currentChapter);
  }

  // 如果没有检测到章节，将整个文档作为一个章节
  if (chapters.length === 0) {
    const mainChapter: Chapter = {
      title: '正文',
      level: 1,
      content: content,
      paragraphs: splitIntoParagraphs(content, '正文'),
      startIndex: 0,
      endIndex: content.length
    };
    chapters.push(mainChapter);
  }

  return {
    chapters,
    totalLength: content.length,
    format: 'txt',
    metadata: {
      parsedAt: new Date().toISOString(),
      encoding: RAG_CONFIG.document.encoding,
      originalSize: content.length
    }
  };
}

/**
 * 解析Markdown文档
 * @param content 文档内容
 */
export async function parseMarkdownDocument(content: string): Promise<ParsedDocument> {
  const chapters: Chapter[] = [];
  const lines = content.split(/\r?\n/);

  // Markdown标题模式
  const headerPattern = /^(#{1,6})\s+(.+)$/;

  let currentChapter: Chapter | null = null;
  let currentContent: string[] = [];
  let currentIndex = 0;
  let documentTitle: string | undefined;

  for (const line of lines) {
    const headerMatch = line.match(headerPattern);

    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // 第一个一级标题作为文档标题
      if (level === 1 && !documentTitle) {
        documentTitle = title;
        currentIndex += line.length + 1;
        continue;
      }

      // 保存前一个章节
      if (currentChapter) {
        currentChapter.content = currentContent.join('\n');
        currentChapter.paragraphs = splitIntoParagraphs(
          currentChapter.content,
          currentChapter.title
        );
        currentChapter.endIndex = currentIndex;
        chapters.push(currentChapter);
      }

      // 开始新章节
      currentChapter = {
        title,
        level,
        content: '',
        paragraphs: [],
        startIndex: currentIndex,
        endIndex: currentIndex
      };
      currentContent = [];
    } else if (line.trim().length > 0) {
      // 跳过Markdown特殊语法行
      if (!line.startsWith('```') && !line.startsWith('---')) {
        currentContent.push(line);
      }
    }

    currentIndex += line.length + 1;
  }

  // 保存最后一个章节
  if (currentChapter) {
    currentChapter.content = currentContent.join('\n');
    currentChapter.paragraphs = splitIntoParagraphs(
      currentChapter.content,
      currentChapter.title
    );
    currentChapter.endIndex = currentIndex;
    chapters.push(currentChapter);
  }

  return {
    title: documentTitle,
    chapters,
    totalLength: content.length,
    format: 'markdown',
    metadata: {
      parsedAt: new Date().toISOString(),
      encoding: RAG_CONFIG.document.encoding,
      originalSize: content.length
    }
  };
}

/**
 * 将文本分割为段落
 * @param content 文本内容
 * @param chapterTitle 所属章节标题
 */
export function splitIntoParagraphs(content: string, chapterTitle: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // 使用配置的段落分隔符
  const separatorPattern = new RegExp(
    RAG_CONFIG.chunking.paragraphSeparators.join('|'),
    'g'
  );

  const paragraphTexts = content.split(separatorPattern);
  let currentIndex = 0;

  paragraphTexts.forEach((text, index) => {
    const trimmedText = text.trim();
    if (trimmedText.length > 0) {
      paragraphs.push({
        content: trimmedText,
        chapterTitle,
        paragraphIndex: index,
        startIndex: currentIndex,
        endIndex: currentIndex + text.length
      });
    }
    currentIndex += text.length + 2; // +2 for paragraph separator
  });

  // 如果没有段落分隔，将整个内容作为一个段落
  if (paragraphs.length === 0 && content.trim().length > 0) {
    paragraphs.push({
      content: content.trim(),
      chapterTitle,
      paragraphIndex: 0,
      startIndex: 0,
      endIndex: content.length
    });
  }

  return paragraphs;
}

/**
 * 提取章节结构（仅标题和层级）
 * @param document 解析后的文档
 */
export function extractChapters(document: ParsedDocument): Array<{
  title: string;
  level: number;
  wordCount: number;
}> {
  return document.chapters.map(chapter => ({
    title: chapter.title,
    level: chapter.level,
    wordCount: chapter.content.length
  }));
}

/**
 * 验证文档
 * @param filePath 文件路径
 */
export async function validateDocument(filePath: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // 检查文件是否存在
    const stats = await fs.stat(filePath);

    // 检查文件大小
    if (stats.size > RAG_CONFIG.document.maxSize) {
      errors.push(
        `文件大小超过限制：${stats.size} > ${RAG_CONFIG.document.maxSize}`
      );
    }

    // 检查文件类型
    const ext = path.extname(filePath).toLowerCase();
    if (!RAG_CONFIG.document.supportedTypes.includes(ext)) {
      errors.push(
        `不支持的文件类型：${ext}，支持的类型：${RAG_CONFIG.document.supportedTypes.join(', ')}`
      );
    }

    // 尝试读取文件
    const content = await fs.readFile(filePath, RAG_CONFIG.document.encoding);

    // 检查内容是否为空
    if (content.trim().length === 0) {
      errors.push('文档内容为空');
    }

    // 检查编码（简单检测）
    if (content.includes('�')) {
      errors.push('文档可能存在编码问题');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error: any) {
    errors.push(`文件读取失败：${error.message}`);
    return {
      valid: false,
      errors
    };
  }
}

/**
 * 获取文档摘要
 * @param document 解析后的文档
 * @param maxLength 摘要最大长度
 */
export function getDocumentSummary(
  document: ParsedDocument,
  maxLength: number = 500
): string {
  let summary = '';

  // 优先使用第一个章节的内容
  if (document.chapters.length > 0) {
    const firstChapter = document.chapters[0];
    summary = firstChapter.content.substring(0, maxLength);
  }

  // 如果摘要太短，补充后续章节
  let chapterIndex = 1;
  while (summary.length < maxLength / 2 && chapterIndex < document.chapters.length) {
    const chapter = document.chapters[chapterIndex];
    const remainingLength = maxLength - summary.length;
    summary += '\n\n' + chapter.content.substring(0, remainingLength);
    chapterIndex++;
  }

  // 确保摘要在句子边界结束
  const lastSentenceEnd = Math.max(
    ...RAG_CONFIG.chunking.sentenceSeparators.map(sep =>
      summary.lastIndexOf(sep)
    )
  );

  if (lastSentenceEnd > maxLength / 2) {
    summary = summary.substring(0, lastSentenceEnd + 1);
  }

  return summary.trim();
}