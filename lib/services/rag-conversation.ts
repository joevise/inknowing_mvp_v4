/**
 * RAG增强对话模块
 * 负责检索上下文、构建RAG提示词、生成基于上下文的回答
 */

import {
  searchRelevantChunks,
  searchByText,
  formatContext,
  type RetrievalResult,
} from '@/lib/rag/retriever';
import { collectionExists } from '@/lib/rag/chroma-client';
import { getDocumentsByBookId } from '@/lib/db/documents';

// RAG上下文
export interface RAGContext {
  documents: Array<{
    id: string;
    content: string;
    score: number;
    metadata?: any;
  }>;
  totalResults: number;
  searchTime: number;
}

// RAG提示词参数
export interface RAGPromptParams {
  bookTitle: string;
  author: string;
  description: string;
  retrievedContent: Array<{ content: string; score?: number }>;
  characterMode?: boolean;
  characterName?: string;
  characterDescription?: string;
  // 角色沉浸质量提升(2026-07):4 个新锚点字段
  // 与 CHARACTER_CHAT_PROMPT 保持同构;允许 string(JSON)/数组/null
  characterKeyQuotes?: string[] | string | null;
  characterRelationships?: string[] | string | null;
  characterKeyEvents?: string[] | string | null;
  characterKnowledgeBoundary?: string | null;
}

export class RAGConversation {
  /**
   * 检索相关上下文
   */
  async retrieveContext(
    query: string,
    bookId: string,
    topK: number = 5
  ): Promise<RAGContext> {
    const startTime = Date.now();

    try {
      // 检查是否有向量化的文档
      const hasCollection = await collectionExists(bookId);
      if (!hasCollection) {
        console.log('No vectorized documents for book:', bookId);
        return {
          documents: [],
          totalResults: 0,
          searchTime: Date.now() - startTime,
        };
      }

      // 执行检索
      const results = await searchRelevantChunks(bookId, query, {
        topK,
        minSimilarity: 0.5,
        docType: 'all',
        includeMetadata: true,
        rerank: true,
      });

      // 转换格式
      const documents = results.map(result => ({
        id: result.id,
        content: result.content,
        score: result.similarity,
        metadata: result.metadata,
      }));

      return {
        documents,
        totalResults: documents.length,
        searchTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('RAG retrieval error:', error);
      return {
        documents: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 构建RAG提示词
   */
  buildRAGPrompt(params: RAGPromptParams): string {
    const {
      bookTitle,
      author,
      description,
      retrievedContent,
      characterMode,
      characterName,
      characterDescription,
      characterKeyQuotes,
      characterRelationships,
      characterKeyEvents,
      characterKnowledgeBoundary,
    } = params;

    let prompt = '';

    if (characterMode && characterName) {
      // 角色模式的RAG提示词(2026-07 重写:加厚身份锁死 + 反幻觉 + 出戏拦截)
      const quotesBlock = formatListBlock(characterKeyQuotes, '暂无经典语录', q => `"${q}"`);
      const relationshipsBlock = formatListBlock(characterRelationships, '暂无其他角色关系记录', r => `- ${r}`);
      const eventsBlock = formatListBlock(characterKeyEvents, '暂无关键情节记录', e => `- ${e}`);
      const boundary = (characterKnowledgeBoundary ?? '').toString().trim()
        || '认知范围依书中所属情节而定,不知道书中未交代之事';

      prompt = `你现在扮演《${bookTitle}》中的${characterName}。

【身份锁死】
你是且只是 ${characterName},绝不可自称或混淆为其他角色。
即使用户提到其他角色,你也只以 ${characterName} 的视角和关系来回应。

【角色设定】
- 身份:${characterDescription || '书中角色'}
- 你必须完全以${characterName}的身份和视角回答
- 保持角色的性格特征和说话风格

【说话风格锚定】
你的说话风格必须严格模仿以下经典语录(语气、用词、句式、节奏):
${quotesBlock}

【关系锚点】
你与书中其他角色的关系如下,回应中保持这些关系张力:
${relationshipsBlock}

【关键事件锚点】
以下是该角色经历的关键情节,谈论相关话题时请只基于这些内容:
${eventsBlock}

【知识边界】
你的认知范围:
${boundary}

【反幻觉纪律】
1. 谈论书中情节时,只基于你确知的内容(见上方关键事件)。
2. 记不清的细节以角色口吻含糊带过(如"那都是陈年旧事了"、"记不清了")。
3. 绝不编造具体情节、人名、地名、时间点。
4. 检索到的内容优先用,但仍需保持角色口吻——不要直接复述检索段落。

【出戏拦截】
- 用户问现代/书外话题时,不要变成通用助手列 1234。
- 用 ${characterName} 的思维方式和价值观来回应。
- 可以类比书中你熟悉的事物,保持角色身份。

【格式约束】
你是一个人在说话,不是在写报告。
不用列表、不用 markdown 标题、不用编号。
用自然对话的段落,口语化、有温度。

书籍背景:
《${bookTitle}》由${author}所著。${description}

以下是从书中检索到的相关内容,请基于这些内容和你对角色的理解来回答:

${this.formatRetrievedContent(retrievedContent)}

重要提醒:
1. 保持角色身份,使用第一人称
2. 不要透露自己是AI或提及检索过程`;
    } else {
      // 书籍对话模式的RAG提示词
      prompt = `你是《${bookTitle}》的专业导读者，作者是${author}。

书籍简介：
${description}

你的职责：
1. 基于检索到的书籍内容提供准确的回答
2. 优先使用检索到的具体内容
3. 可以适当补充和扩展，但不要偏离原文太远
4. 如果检索内容不相关，诚实告知并提供你的理解

以下是从书中检索到的相关段落：

${this.formatRetrievedContent(retrievedContent)}

请基于以上内容，准确、深入地回答用户的问题。如果某个段落特别相关，可以引用或改写其中的内容。`;
    }

    return prompt;
  }

  /**
   * 格式化检索到的内容
   */
  private formatRetrievedContent(
    content: Array<{ content: string; score?: number }>
  ): string {
    if (content.length === 0) {
      return '（未检索到相关内容）';
    }

    return content
      .map((doc, index) => {
        const relevance = doc.score
          ? `[相关度: ${(doc.score * 100).toFixed(1)}%]`
          : '';
        return `【段落 ${index + 1}】${relevance}
${doc.content}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * 生成基于上下文的回答
   */
  async generateWithContext(
    query: string,
    context: RAGContext,
    systemPrompt: string,
    aiClient: any
  ): Promise<string> {
    // 如果没有检索到内容，添加提示
    if (context.documents.length === 0) {
      systemPrompt += '\n\n注意：未能检索到相关内容，请基于你的知识回答。';
    }

    // 构建消息
    const messages = [
      {
        role: 'user' as const,
        content: query,
      },
    ];

    // 调用AI生成
    const response = await aiClient.chat(messages, {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 2000,
    });

    return response;
  }

  /**
   * 添加来源标注
   */
  addSourceAnnotation(
    response: string,
    sources: Array<{ content: string; score?: number; metadata?: any }>
  ): string {
    if (!sources || sources.length === 0) {
      return response;
    }

    // 轻量级标注：在回答末尾添加来源信息
    let annotatedResponse = response;

    // 检查是否已经包含来源标注
    if (!response.includes('参考来源') && !response.includes('*参考')) {
      // 只在有高相关度的来源时添加标注
      const highQualitySources = sources.filter(
        s => (s.score || 0) > 0.7
      );

      if (highQualitySources.length > 0) {
        annotatedResponse += '\n\n';
        annotatedResponse += `*参考自书中相关章节（${highQualitySources.length}处）*`;
      }
    }

    return annotatedResponse;
  }

  /**
   * 检查书籍是否有文档
   */
  async hasDocuments(bookId: string): Promise<boolean> {
    try {
      // 检查数据库中是否有文档
      const documents = await getDocumentsByBookId(bookId);
      if (!documents || documents.length === 0) {
        return false;
      }

      // 检查是否有向量化的文档
      const hasVectorized = documents.some(doc => doc.vectorized);
      if (!hasVectorized) {
        return false;
      }

      // 检查ChromaDB中是否有集合
      const hasCollection = await collectionExists(bookId);
      return hasCollection;
    } catch (error) {
      console.error('Error checking documents:', error);
      return false;
    }
  }

  /**
   * 评估检索质量
   */
  evaluateRetrievalQuality(context: RAGContext): {
    quality: 'high' | 'medium' | 'low';
    confidence: number;
    suggestions: string[];
  } {
    const suggestions = [];
    let quality: 'high' | 'medium' | 'low' = 'low';
    let confidence = 0;

    if (context.documents.length === 0) {
      suggestions.push('未检索到相关内容，考虑改进查询或使用AI原生模式');
      return { quality: 'low', confidence: 0, suggestions };
    }

    // 计算平均相关度
    const avgScore = context.documents.reduce((sum, doc) => sum + (doc.score || 0), 0) /
                    context.documents.length;

    // 评估质量
    if (avgScore > 0.8 && context.documents.length >= 3) {
      quality = 'high';
      confidence = 0.9;
    } else if (avgScore > 0.6 && context.documents.length >= 2) {
      quality = 'medium';
      confidence = 0.7;
      suggestions.push('检索结果质量中等，可以结合AI知识补充');
    } else {
      quality = 'low';
      confidence = 0.4;
      suggestions.push('检索结果相关度较低，建议使用混合模式');
    }

    // 检查结果多样性
    const uniqueChapters = new Set(
      context.documents.map(d => d.metadata?.chapter).filter(Boolean)
    );
    if (uniqueChapters.size === 1 && context.documents.length > 3) {
      suggestions.push('结果集中在单一章节，可能需要更广泛的检索');
    }

    return { quality, confidence, suggestions };
  }

  /**
   * 优化查询以改进检索
   */
  async optimizeQuery(
    originalQuery: string,
    bookContext?: { title: string; genre?: string }
  ): Promise<string> {
    // 简单的查询优化
    let optimizedQuery = originalQuery;

    // 去除过于通用的词
    const stopWords = ['请问', '能否', '可以', '告诉我', '我想知道'];
    stopWords.forEach(word => {
      optimizedQuery = optimizedQuery.replace(word, '');
    });

    // 提取关键概念
    if (bookContext) {
      // 如果是特定类型的书籍，添加领域关键词
      if (bookContext.genre === '技术') {
        // 技术书籍可能需要更精确的术语
        optimizedQuery = this.addTechnicalTerms(optimizedQuery);
      } else if (bookContext.genre === '文学') {
        // 文学作品可能需要角色名或情节关键词
        optimizedQuery = this.addLiteraryContext(optimizedQuery);
      }
    }

    return optimizedQuery.trim();
  }

  /**
   * 添加技术术语（辅助函数）
   */
  private addTechnicalTerms(query: string): string {
    // 简单的技术术语识别和增强
    const technicalPatterns = {
      '如何实现': '实现 方法 代码',
      '什么是': '定义 概念 原理',
      '为什么': '原因 原理 机制',
    };

    for (const [pattern, terms] of Object.entries(technicalPatterns)) {
      if (query.includes(pattern)) {
        return query + ' ' + terms;
      }
    }

    return query;
  }

  /**
   * 添加文学语境（辅助函数）
   */
  private addLiteraryContext(query: string): string {
    // 简单的文学要素识别
    const literaryPatterns = {
      '人物': '角色 性格 特征',
      '情节': '故事 发展 冲突',
      '主题': '思想 寓意 象征',
    };

    for (const [pattern, terms] of Object.entries(literaryPatterns)) {
      if (query.includes(pattern)) {
        return query + ' ' + terms;
      }
    }

    return query;
  }

  /**
   * 生成检索摘要
   */
  generateRetrievalSummary(context: RAGContext): string {
    if (context.documents.length === 0) {
      return '未找到相关内容';
    }

    const avgScore = context.documents.reduce((sum, doc) => sum + (doc.score || 0), 0) /
                    context.documents.length;

    const chapters = new Set(
      context.documents.map(d => d.metadata?.chapter).filter(Boolean)
    );

    return `检索到${context.documents.length}个相关段落，` +
           `平均相关度${(avgScore * 100).toFixed(1)}%，` +
           `涵盖${chapters.size || 1}个章节，` +
           `用时${context.searchTime}ms`;
  }
}

/**
 * 把 string(已序列化 JSON)/数组/null 统一规整为字符串数组,
 * 拼接成"每行一项"的展示块。空值时回退到占位符。
 *
 * 与 lib/ai/prompts.ts 的同名实现语义一致;放本文件避免循环依赖。
 */
function formatListBlock(
  v: string[] | string | null | undefined,
  emptyHint: string,
  lineFn: (item: string) => string
): string {
  if (v == null) return emptyHint;
  let items: string[] = [];
  if (Array.isArray(v)) {
    items = v.map(s => String(s)).filter(s => s.trim() !== '');
  } else if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return emptyHint;
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) items = parsed.map(x => String(x)).filter(x => x.trim() !== '');
      } catch {
        /* fallthrough */
      }
    }
    if (items.length === 0) {
      items = s.split(/[\n\r;；。]+/).map(x => x.trim()).filter(x => x.length > 0);
    }
  }
  if (items.length === 0) return emptyHint;
  return items.map(lineFn).join('\n');
}