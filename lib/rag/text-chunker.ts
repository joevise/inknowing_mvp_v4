/**
 * 文本分块器
 * 负责将文档智能分块，保持语义完整性
 */

import { RAG_CONFIG } from './config';
import { ParsedDocument, Chapter, Paragraph } from './document-parser';

// 文本块定义
export interface TextChunk {
  id: string;
  content: string;
  metadata: {
    bookId: string;
    docId: string;
    docType: 'main' | 'supplement';
    chunkIndex: number;
    totalChunks?: number;
    chapter?: string;
    chapterLevel?: number;
    paragraphIndices?: number[];
    startPosition: number;
    endPosition: number;
    wordCount: number;
    overlap?: {
      previous: boolean;
      next: boolean;
    };
  };
}

// 分块选项
export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  preserveParagraphs?: boolean;
  preserveSentences?: boolean;
  includeChapterTitle?: boolean;
}

/**
 * 对文档进行智能分块
 * @param document 解析后的文档
 * @param bookId 书籍ID
 * @param docId 文档ID
 * @param docType 文档类型
 * @param options 分块选项
 */
export function chunkDocument(
  document: ParsedDocument,
  bookId: string,
  docId: string,
  docType: 'main' | 'supplement',
  options: ChunkingOptions = {}
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const {
    chunkSize = RAG_CONFIG.chunking.chunkSize,
    chunkOverlap = RAG_CONFIG.chunking.chunkOverlap,
    preserveParagraphs = RAG_CONFIG.chunking.preserveParagraphs,
    preserveSentences = RAG_CONFIG.chunking.preserveSentences,
    includeChapterTitle = true
  } = options;

  let globalChunkIndex = 0;

  // 按章节处理
  for (const chapter of document.chapters) {
    const chapterChunks = chunkChapter(
      chapter,
      chunkSize,
      chunkOverlap,
      preserveParagraphs,
      preserveSentences,
      includeChapterTitle
    );

    // 添加元数据并生成ID
    for (const chunk of chapterChunks) {
      const chunkId = `${docId}_chunk_${globalChunkIndex}`;

      chunks.push({
        id: chunkId,
        content: chunk.content,
        metadata: {
          bookId,
          docId,
          docType,
          chunkIndex: globalChunkIndex,
          chapter: chapter.title,
          chapterLevel: chapter.level,
          paragraphIndices: chunk.paragraphIndices,
          startPosition: chunk.startPosition,
          endPosition: chunk.endPosition,
          wordCount: chunk.content.length,
          overlap: chunk.overlap
        }
      });

      globalChunkIndex++;
    }
  }

  // 更新总块数
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });

  return chunks;
}

/**
 * 对单个章节进行分块
 */
function chunkChapter(
  chapter: Chapter,
  chunkSize: number,
  chunkOverlap: number,
  preserveParagraphs: boolean,
  preserveSentences: boolean,
  includeChapterTitle: boolean
): Array<{
  content: string;
  paragraphIndices: number[];
  startPosition: number;
  endPosition: number;
  overlap?: { previous: boolean; next: boolean };
}> {
  const chunks: Array<{
    content: string;
    paragraphIndices: number[];
    startPosition: number;
    endPosition: number;
    overlap?: { previous: boolean; next: boolean };
  }> = [];

  // 如果章节内容很短，作为一个块
  if (chapter.content.length <= chunkSize) {
    const content = includeChapterTitle
      ? `【${chapter.title}】\n\n${chapter.content}`
      : chapter.content;

    chunks.push({
      content,
      paragraphIndices: chapter.paragraphs.map((_, i) => i),
      startPosition: chapter.startIndex,
      endPosition: chapter.endIndex
    });
    return chunks;
  }

  // 如果保持段落完整性，按段落分块
  if (preserveParagraphs && chapter.paragraphs.length > 0) {
    return chunkByParagraphs(
      chapter,
      chunkSize,
      chunkOverlap,
      includeChapterTitle
    );
  }

  // 否则按固定大小分块
  return chunkBySize(
    chapter,
    chunkSize,
    chunkOverlap,
    preserveSentences,
    includeChapterTitle
  );
}

/**
 * 按段落边界分块
 */
function chunkByParagraphs(
  chapter: Chapter,
  chunkSize: number,
  chunkOverlap: number,
  includeChapterTitle: boolean
): Array<{
  content: string;
  paragraphIndices: number[];
  startPosition: number;
  endPosition: number;
  overlap?: { previous: boolean; next: boolean };
}> {
  const chunks: Array<{
    content: string;
    paragraphIndices: number[];
    startPosition: number;
    endPosition: number;
    overlap?: { previous: boolean; next: boolean };
  }> = [];

  let currentChunkContent: string[] = [];
  let currentParagraphIndices: number[] = [];
  let currentLength = 0;
  let startPosition = chapter.startIndex;

  // 如果需要包含章节标题
  const chapterPrefix = includeChapterTitle ? `【${chapter.title}】\n\n` : '';
  let isFirstChunk = true;

  for (let i = 0; i < chapter.paragraphs.length; i++) {
    const paragraph = chapter.paragraphs[i];
    const paragraphContent = paragraph.content;

    // 检查添加该段落是否会超出块大小
    const potentialLength = currentLength + paragraphContent.length +
                          (isFirstChunk ? chapterPrefix.length : 0);

    if (potentialLength > chunkSize && currentChunkContent.length > 0) {
      // 创建新块
      const content = (isFirstChunk ? chapterPrefix : '') +
                     currentChunkContent.join('\n\n');

      chunks.push({
        content,
        paragraphIndices: [...currentParagraphIndices],
        startPosition,
        endPosition: paragraph.startIndex - 1,
        overlap: {
          previous: chunks.length > 0,
          next: true
        }
      });

      // 处理重叠
      if (chunkOverlap > 0 && currentChunkContent.length > 0) {
        // 保留最后一个段落作为重叠
        const overlapContent = currentChunkContent[currentChunkContent.length - 1];
        currentChunkContent = [overlapContent, paragraphContent];
        currentParagraphIndices = [
          currentParagraphIndices[currentParagraphIndices.length - 1],
          i
        ];
        currentLength = overlapContent.length + paragraphContent.length;
      } else {
        // 重新开始
        currentChunkContent = [paragraphContent];
        currentParagraphIndices = [i];
        currentLength = paragraphContent.length;
      }

      startPosition = paragraph.startIndex;
      isFirstChunk = false;
    } else {
      // 添加到当前块
      currentChunkContent.push(paragraphContent);
      currentParagraphIndices.push(i);
      currentLength += paragraphContent.length;
    }
  }

  // 处理最后一个块
  if (currentChunkContent.length > 0) {
    const content = (isFirstChunk ? chapterPrefix : '') +
                   currentChunkContent.join('\n\n');

    chunks.push({
      content,
      paragraphIndices: currentParagraphIndices,
      startPosition,
      endPosition: chapter.endIndex,
      overlap: {
        previous: chunks.length > 0,
        next: false
      }
    });
  }

  return chunks;
}

/**
 * 按固定大小分块
 */
function chunkBySize(
  chapter: Chapter,
  chunkSize: number,
  chunkOverlap: number,
  preserveSentences: boolean,
  includeChapterTitle: boolean
): Array<{
  content: string;
  paragraphIndices: number[];
  startPosition: number;
  endPosition: number;
  overlap?: { previous: boolean; next: boolean };
}> {
  const chunks: Array<{
    content: string;
    paragraphIndices: number[];
    startPosition: number;
    endPosition: number;
    overlap?: { previous: boolean; next: boolean };
  }> = [];

  const fullContent = includeChapterTitle
    ? `【${chapter.title}】\n\n${chapter.content}`
    : chapter.content;

  let currentPosition = 0;
  const contentLength = fullContent.length;

  while (currentPosition < contentLength) {
    let chunkEnd = Math.min(currentPosition + chunkSize, contentLength);

    // 如果保持句子完整性，找到最近的句子边界
    if (preserveSentences && chunkEnd < contentLength) {
      chunkEnd = findSentenceBoundary(fullContent, chunkEnd, chunkSize);
    }

    const chunkContent = fullContent.substring(currentPosition, chunkEnd);

    // 计算段落索引
    const paragraphIndices = calculateParagraphIndices(
      chapter,
      currentPosition,
      chunkEnd
    );

    chunks.push({
      content: chunkContent,
      paragraphIndices,
      startPosition: chapter.startIndex + currentPosition,
      endPosition: chapter.startIndex + chunkEnd,
      overlap: {
        previous: currentPosition > 0,
        next: chunkEnd < contentLength
      }
    });

    // 移动到下一个位置（考虑重叠）
    currentPosition = chunkEnd - chunkOverlap;

    // 确保至少前进一些，避免无限循环
    if (currentPosition <= chunks[chunks.length - 1].startPosition) {
      currentPosition = chunkEnd;
    }
  }

  return chunks;
}

/**
 * 找到最近的句子边界
 */
function findSentenceBoundary(
  text: string,
  preferredEnd: number,
  maxChunkSize: number
): number {
  const sentenceSeparators = RAG_CONFIG.chunking.sentenceSeparators;

  // 向后查找句子结束
  let nearestEnd = preferredEnd;
  let minDistance = maxChunkSize;

  for (const separator of sentenceSeparators) {
    // 向前查找
    let backwardPos = text.lastIndexOf(separator, preferredEnd);
    if (backwardPos > preferredEnd - maxChunkSize / 4 && backwardPos > 0) {
      const distance = preferredEnd - backwardPos;
      if (distance < minDistance) {
        nearestEnd = backwardPos + separator.length;
        minDistance = distance;
      }
    }

    // 向后查找（但不要太远）
    let forwardPos = text.indexOf(separator, preferredEnd);
    if (forwardPos > 0 && forwardPos < preferredEnd + maxChunkSize / 4) {
      const distance = forwardPos - preferredEnd;
      if (distance < minDistance) {
        nearestEnd = forwardPos + separator.length;
        minDistance = distance;
      }
    }
  }

  return nearestEnd;
}

/**
 * 计算块包含的段落索引
 */
function calculateParagraphIndices(
  chapter: Chapter,
  startPos: number,
  endPos: number
): number[] {
  const indices: number[] = [];

  for (let i = 0; i < chapter.paragraphs.length; i++) {
    const paragraph = chapter.paragraphs[i];

    // 检查段落是否与块有重叠
    if (
      (paragraph.startIndex >= startPos && paragraph.startIndex < endPos) ||
      (paragraph.endIndex > startPos && paragraph.endIndex <= endPos) ||
      (paragraph.startIndex <= startPos && paragraph.endIndex >= endPos)
    ) {
      indices.push(i);
    }
  }

  return indices;
}

/**
 * 对纯文本进行分块（不依赖文档结构）
 * @param text 文本内容
 * @param options 分块选项
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): string[] {
  const {
    chunkSize = RAG_CONFIG.chunking.chunkSize,
    chunkOverlap = RAG_CONFIG.chunking.chunkOverlap,
    preserveSentences = RAG_CONFIG.chunking.preserveSentences
  } = options;

  const chunks: string[] = [];
  let currentPosition = 0;
  const textLength = text.length;

  while (currentPosition < textLength) {
    let chunkEnd = Math.min(currentPosition + chunkSize, textLength);

    // 保持句子完整性
    if (preserveSentences && chunkEnd < textLength) {
      chunkEnd = findSentenceBoundary(text, chunkEnd, chunkSize);
    }

    const chunk = text.substring(currentPosition, chunkEnd).trim();
    if (chunk.length >= RAG_CONFIG.chunking.minChunkSize) {
      chunks.push(chunk);
    }

    // 移动位置（考虑重叠）
    currentPosition = Math.max(
      currentPosition + 1,
      chunkEnd - chunkOverlap
    );
  }

  return chunks;
}

/**
 * 估算文本将产生的块数
 * @param textLength 文本长度
 * @param chunkSize 块大小
 * @param chunkOverlap 重叠大小
 */
export function estimateChunkCount(
  textLength: number,
  chunkSize: number = RAG_CONFIG.chunking.chunkSize,
  chunkOverlap: number = RAG_CONFIG.chunking.chunkOverlap
): number {
  if (textLength <= chunkSize) {
    return 1;
  }

  const effectiveChunkSize = chunkSize - chunkOverlap;
  return Math.ceil((textLength - chunkOverlap) / effectiveChunkSize);
}

/**
 * 验证分块结果
 * @param chunks 分块数组
 */
export function validateChunks(chunks: TextChunk[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // 检查是否有空块
  const emptyChunks = chunks.filter(c => c.content.trim().length === 0);
  if (emptyChunks.length > 0) {
    issues.push(`发现${emptyChunks.length}个空块`);
  }

  // 检查是否有过小的块
  const tooSmallChunks = chunks.filter(
    c => c.content.length < RAG_CONFIG.chunking.minChunkSize
  );
  if (tooSmallChunks.length > 0) {
    issues.push(
      `发现${tooSmallChunks.length}个过小的块（小于${RAG_CONFIG.chunking.minChunkSize}字符）`
    );
  }

  // 检查索引连续性
  const indices = chunks.map(c => c.metadata.chunkIndex).sort((a, b) => a - b);
  for (let i = 0; i < indices.length - 1; i++) {
    if (indices[i + 1] - indices[i] !== 1) {
      issues.push(`块索引不连续：${indices[i]} -> ${indices[i + 1]}`);
    }
  }

  // 检查ID唯一性
  const ids = chunks.map(c => c.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    issues.push(`存在重复的块ID`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}