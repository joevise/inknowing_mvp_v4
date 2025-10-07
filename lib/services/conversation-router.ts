/**
 * 对话路由决策引擎
 * 负责分析问题类型并选择最佳回答策略
 */

// 问题类型枚举
export enum QueryType {
  OVERVIEW = 'overview',        // 概括性问题
  DETAIL = 'detail',           // 细节性问题
  APPLICATION = 'application',  // 应用性问题
  COMPARISON = 'comparison',   // 对比性问题
  GENERAL = 'general'          // 一般性问题
}

// 回答策略枚举
export enum ResponseStrategy {
  AI_NATIVE = 'ai_native',    // AI原生知识
  RAG = 'rag',                // RAG检索
  HYBRID = 'hybrid'           // 混合模式
}

// 路由决策结果
export interface RoutingDecision {
  queryType: QueryType;
  strategy: ResponseStrategy;
  confidence: number;
  reasoning: string;
  suggestedPromptEnhancement?: string;
}

// 问题分析结果
export interface QueryAnalysis {
  type: QueryType;
  keywords: string[];
  requiresSpecificInfo: boolean;
  requiresContext: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

export class ConversationRouter {
  /**
   * 分析问题类型
   */
  async analyzeQueryType(query: string): Promise<QueryAnalysis> {
    // 关键词映射
    const patterns = {
      overview: [
        '主要讲', '主要内容', '概括', '总结', '大概',
        '介绍一下', '是关于什么', '核心思想', '中心思想',
        '主题', '讲的是什么', '这本书'
      ],
      detail: [
        '第.*章', '具体', '详细', '段落', '原文',
        '引用', '某个部分', '某一节', '特定', '精确',
        '准确地说', '书中提到', '作者说'
      ],
      application: [
        '如何', '怎么', '应用', '实践', '使用',
        '运用', '实施', '落地', '操作', '步骤',
        '方法', '技巧', '建议'
      ],
      comparison: [
        '对比', '比较', '区别', '相同', '不同',
        '其他书', '类似', '相似', '差异', '优劣',
        '更好', '为什么选择'
      ]
    };

    // 简单关键词匹配
    let queryType = QueryType.GENERAL;
    let matchedKeywords: string[] = [];

    const lowerQuery = query.toLowerCase();

    // 检查各类型的关键词
    for (const [type, keywords] of Object.entries(patterns)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          matchedKeywords.push(keyword);
          queryType = type as QueryType;
          break;
        }
      }
      if (matchedKeywords.length > 0) break;
    }

    // 判断是否需要特定信息
    const requiresSpecificInfo = queryType === QueryType.DETAIL ||
                                lowerQuery.includes('具体') ||
                                lowerQuery.includes('原文');

    // 判断是否需要上下文
    const requiresContext = queryType === QueryType.DETAIL ||
                          queryType === QueryType.APPLICATION;

    // 判断复杂度
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (query.length > 50 || matchedKeywords.length > 2) {
      complexity = 'complex';
    } else if (requiresSpecificInfo || requiresContext) {
      complexity = 'moderate';
    }

    return {
      type: queryType,
      keywords: matchedKeywords,
      requiresSpecificInfo,
      requiresContext,
      complexity
    };
  }

  /**
   * 选择回答策略
   */
  selectStrategy(
    queryAnalysis: QueryAnalysis,
    bookConfig: {
      aiKnowledgeLevel: number;
      conversationStrategy: 'ai_native' | 'rag_only' | 'hybrid';
      hasDocuments: boolean;
    }
  ): ResponseStrategy {
    const { type, requiresSpecificInfo, requiresContext, complexity } = queryAnalysis;
    const { aiKnowledgeLevel, conversationStrategy, hasDocuments } = bookConfig;

    // 如果书籍配置了特定策略，优先遵守
    if (conversationStrategy === 'rag_only' && hasDocuments) {
      return ResponseStrategy.RAG;
    }
    if (conversationStrategy === 'ai_native') {
      return ResponseStrategy.AI_NATIVE;
    }

    // 智能策略选择
    // 1. 细节性问题且有文档 -> RAG
    if (type === QueryType.DETAIL && hasDocuments) {
      return ResponseStrategy.RAG;
    }

    // 2. 概括性问题且AI了解程度高 -> AI原生
    if (type === QueryType.OVERVIEW && aiKnowledgeLevel >= 8) {
      return ResponseStrategy.AI_NATIVE;
    }

    // 3. 应用性问题 -> 混合模式（结合原理和实例）
    if (type === QueryType.APPLICATION) {
      return hasDocuments ? ResponseStrategy.HYBRID : ResponseStrategy.AI_NATIVE;
    }

    // 4. 对比性问题 -> AI原生（需要更广泛的知识）
    if (type === QueryType.COMPARISON) {
      return ResponseStrategy.AI_NATIVE;
    }

    // 5. 复杂问题且有文档 -> 混合模式
    if (complexity === 'complex' && hasDocuments) {
      return ResponseStrategy.HYBRID;
    }

    // 6. 默认策略
    if (hasDocuments && requiresSpecificInfo) {
      return ResponseStrategy.RAG;
    }
    if (aiKnowledgeLevel >= 7) {
      return ResponseStrategy.AI_NATIVE;
    }

    // 7. 最终后备
    return hasDocuments ? ResponseStrategy.HYBRID : ResponseStrategy.AI_NATIVE;
  }

  /**
   * 路由决策主函数
   */
  async routeConversation(
    query: string,
    bookConfig: {
      aiKnowledgeLevel: number;
      conversationStrategy: 'ai_native' | 'rag_only' | 'hybrid';
      hasDocuments: boolean;
    },
    conversationContext?: {
      previousMessages?: Array<{ role: string; content: string }>;
      currentTopic?: string;
    }
  ): Promise<RoutingDecision> {
    // 1. 分析问题类型
    const queryAnalysis = await this.analyzeQueryType(query);

    // 2. 选择策略
    const strategy = this.selectStrategy(queryAnalysis, bookConfig);

    // 3. 计算置信度
    let confidence = 0.7; // 基础置信度

    // 根据AI了解程度调整置信度
    if (strategy === ResponseStrategy.AI_NATIVE) {
      confidence = Math.min(0.9, 0.5 + bookConfig.aiKnowledgeLevel * 0.05);
    }

    // 有文档支持提高置信度
    if (strategy === ResponseStrategy.RAG && bookConfig.hasDocuments) {
      confidence = 0.85;
    }

    // 混合模式置信度最高
    if (strategy === ResponseStrategy.HYBRID) {
      confidence = 0.9;
    }

    // 4. 生成推理说明
    const reasoning = this.generateReasoning(queryAnalysis, strategy, bookConfig);

    // 5. 生成提示词增强建议
    const suggestedPromptEnhancement = this.generatePromptEnhancement(
      queryAnalysis,
      strategy
    );

    return {
      queryType: queryAnalysis.type,
      strategy,
      confidence,
      reasoning,
      suggestedPromptEnhancement
    };
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(
    analysis: QueryAnalysis,
    strategy: ResponseStrategy,
    bookConfig: any
  ): string {
    const reasons = [];

    if (analysis.type === QueryType.DETAIL) {
      reasons.push('问题涉及具体细节');
    }
    if (analysis.type === QueryType.OVERVIEW) {
      reasons.push('问题需要概括性回答');
    }
    if (analysis.requiresSpecificInfo) {
      reasons.push('需要精确信息');
    }
    if (bookConfig.aiKnowledgeLevel >= 8) {
      reasons.push(`AI对该书了解程度高(${bookConfig.aiKnowledgeLevel}/10)`);
    }
    if (bookConfig.hasDocuments) {
      reasons.push('有文档支持精确检索');
    }

    const strategyReason = {
      [ResponseStrategy.AI_NATIVE]: '使用AI原生知识快速回答',
      [ResponseStrategy.RAG]: '使用文档检索提供精确内容',
      [ResponseStrategy.HYBRID]: '结合AI知识和文档内容综合回答'
    };

    reasons.push(strategyReason[strategy]);

    return reasons.join('；');
  }

  /**
   * 生成提示词增强建议
   */
  private generatePromptEnhancement(
    analysis: QueryAnalysis,
    strategy: ResponseStrategy
  ): string {
    const enhancements = [];

    if (analysis.type === QueryType.OVERVIEW) {
      enhancements.push('请提供简洁的概括，突出核心观点');
    }
    if (analysis.type === QueryType.DETAIL) {
      enhancements.push('请提供具体的细节和例子');
    }
    if (analysis.type === QueryType.APPLICATION) {
      enhancements.push('请结合实际场景，提供可操作的建议');
    }
    if (analysis.type === QueryType.COMPARISON) {
      enhancements.push('请进行多角度对比，突出差异和特点');
    }

    if (strategy === ResponseStrategy.RAG) {
      enhancements.push('优先使用检索到的内容，保证准确性');
    }
    if (strategy === ResponseStrategy.HYBRID) {
      enhancements.push('结合检索内容和背景知识，提供全面的回答');
    }

    return enhancements.join('。');
  }

  /**
   * 评估路由决策质量
   */
  async evaluateDecision(
    decision: RoutingDecision,
    actualResponse: string,
    userFeedback?: 'positive' | 'negative'
  ): Promise<{
    qualityScore: number;
    suggestions: string[];
  }> {
    let qualityScore = decision.confidence;
    const suggestions = [];

    // 根据响应长度调整
    if (actualResponse.length < 100 && decision.queryType === QueryType.DETAIL) {
      qualityScore -= 0.1;
      suggestions.push('细节问题的回答可能过于简短');
    }

    if (actualResponse.length > 1000 && decision.queryType === QueryType.OVERVIEW) {
      qualityScore -= 0.1;
      suggestions.push('概括性问题的回答可能过于冗长');
    }

    // 用户反馈调整
    if (userFeedback === 'negative') {
      qualityScore *= 0.7;
      suggestions.push('考虑调整策略或增强提示词');
    }
    if (userFeedback === 'positive') {
      qualityScore = Math.min(1.0, qualityScore * 1.1);
    }

    return {
      qualityScore: Math.max(0, Math.min(1, qualityScore)),
      suggestions
    };
  }
}