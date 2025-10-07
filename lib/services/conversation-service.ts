/**
 * 对话生成核心模块
 * 处理对话创建、消息发送、回答生成等核心功能
 */

import { chat, streamChat, ChatMessage } from '@/lib/ai/chat';
import { ConversationRouter, ResponseStrategy } from './conversation-router';
import { RAGConversation } from './rag-conversation';
import {
  createConversation,
  getConversationById,
  touchConversation,
  userOwnsConversation,
} from '@/lib/db/conversations';
import {
  saveUserMessage,
  saveAIResponse,
  getConversationContext,
} from '@/lib/db/messages';
import { getBookById } from '@/lib/db/books';
import { getCharacterById } from '@/lib/db/characters';
import {
  buildBookChatPrompt,
  buildCharacterChatPrompt,
} from '@/lib/ai/prompts';
import type { Conversation, Message, Book, Character } from '@/lib/db/schema';

// 对话创建参数
export interface CreateConversationParams {
  userId: string;
  bookId: string;
  characterId?: string;
  type: 'book' | 'character';
  title?: string;
}

// 消息发送参数
export interface SendMessageParams {
  conversationId: string;
  userId: string;
  content: string;
  streamCallback?: (chunk: string) => void;
}

// 消息响应
export interface MessageResponse {
  message: {
    userMessage: Message;
    assistantMessage: Message;
  };
  strategy: ResponseStrategy;
  sources?: Array<{
    doc_id: string;
    chunk_index: number;
    relevance_score: number;
    content_preview: string;
  }>;
  queryType?: string;
  responseTime: number;
}

export class ConversationService {
  private router: ConversationRouter;
  private ragConversation: RAGConversation;

  constructor() {
    this.router = new ConversationRouter();
    this.ragConversation = new RAGConversation();
  }

  /**
   * 创建新对话
   */
  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    // 验证书籍存在
    const book = getBookById(params.bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    // 如果是角色对话，验证角色存在
    if (params.type === 'character' && params.characterId) {
      const character = getCharacterById(params.characterId);
      if (!character) {
        throw new Error('Character not found');
      }
    }

    // 生成对话标题
    let title = params.title;
    if (!title) {
      if (params.type === 'character' && params.characterId) {
        const character = getCharacterById(params.characterId);
        title = `与${character?.name}的对话`;
      } else {
        title = `关于《${book.title}》的讨论`;
      }
    }

    // 创建对话
    const conversation = createConversation({
      user_id: params.userId,
      book_id: params.bookId,
      character_id: params.characterId || null,
      type: params.type,
      title,
    });

    return conversation;
  }

  /**
   * 发送消息（主函数）
   */
  async sendMessage(params: SendMessageParams): Promise<MessageResponse> {
    const startTime = Date.now();

    // 验证权限
    if (!userOwnsConversation(params.userId, params.conversationId)) {
      throw new Error('Unauthorized: User does not own this conversation');
    }

    // 获取对话信息
    const conversation = getConversationById(params.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // 保存用户消息
    const userMessage = saveUserMessage(params.conversationId, params.content);

    // 获取书籍信息
    const book = getBookById(conversation.book_id);
    if (!book) {
      throw new Error('Book not found');
    }

    // 检查是否有文档
    const hasDocuments = await this.ragConversation.hasDocuments(book.id);

    // 路由决策
    const routingDecision = await this.router.routeConversation(
      params.content,
      {
        aiKnowledgeLevel: book.ai_knowledge_level,
        conversationStrategy: book.conversation_strategy,
        hasDocuments,
      },
      {
        previousMessages: getConversationContext(params.conversationId, 10),
      }
    );

    console.log('Routing decision:', routingDecision);

    // 根据策略生成回答
    let response: string;
    let sources: any[] | undefined;

    switch (routingDecision.strategy) {
      case ResponseStrategy.RAG:
        const ragResult = await this.generateRAGResponse(
          params.content,
          conversation,
          book,
          params.streamCallback
        );
        response = ragResult.response;
        sources = ragResult.sources;
        break;

      case ResponseStrategy.HYBRID:
        const hybridResult = await this.generateHybridResponse(
          params.content,
          conversation,
          book,
          params.streamCallback
        );
        response = hybridResult.response;
        sources = hybridResult.sources;
        break;

      case ResponseStrategy.AI_NATIVE:
      default:
        response = await this.generateAINativeResponse(
          params.content,
          conversation,
          book,
          params.streamCallback
        );
        break;
    }

    // 保存AI回复
    const metadata: any = {
      strategy: routingDecision.strategy,
      query_type: routingDecision.queryType,
      response_time: Date.now() - startTime,
    };

    if (sources) {
      metadata.sources = sources;
    }

    const aiMessage = saveAIResponse(params.conversationId, response, metadata);

    // 更新对话活动时间
    touchConversation(params.conversationId);

    return {
      message: {
        userMessage,
        assistantMessage: aiMessage,
      },
      strategy: routingDecision.strategy,
      sources,
      queryType: routingDecision.queryType,
      responseTime: Date.now() - startTime,
    };
  }

  /**
   * 生成AI原生回答
   */
  async generateAINativeResponse(
    query: string,
    conversation: Conversation,
    book: Book,
    streamCallback?: (chunk: string) => void
  ): Promise<string> {
    // 获取对话上下文
    const context = getConversationContext(conversation.id, 10);

    let systemPrompt: string;
    let messages = [...context];

    if (conversation.type === 'character' && conversation.character_id) {
      // 角色对话
      const character = getCharacterById(conversation.character_id);
      if (!character) {
        throw new Error('Character not found');
      }

      systemPrompt = buildCharacterChatPrompt({
        bookTitle: book.title,
        characterName: character.name,
        description: character.description,
        personality: character.personality_traits
          ? Object.values(character.personality_traits as any)
          : [],
        speakingStyle: character.speaking_style,
        backgroundStory: character.background_story,
      });
    } else {
      // 书籍对话
      systemPrompt = buildBookChatPrompt({
        bookTitle: book.title,
        author: book.author,
        description: book.description,
      });
    }

    // 添加系统提示词到消息开头
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: query }
    ];

    // 调用AI生成回答
    if (streamCallback) {
      // 流式生成
      const stream = streamChat(chatMessages);

      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
        streamCallback(chunk);
      }

      return fullResponse;
    } else {
      // 非流式生成
      const result = await chat(chatMessages);
      return result.content;
    }
  }

  /**
   * 生成RAG增强回答
   */
  async generateRAGResponse(
    query: string,
    conversation: Conversation,
    book: Book,
    streamCallback?: (chunk: string) => void
  ): Promise<{ response: string; sources: any[] }> {
    // 获取对话上下文
    const context = getConversationContext(conversation.id, 10);

    // 检索相关内容
    const retrievalResult = await this.ragConversation.retrieveContext(
      query,
      book.id,
      5
    );

    if (!retrievalResult.documents || retrievalResult.documents.length === 0) {
      console.log('No relevant documents found, falling back to AI native');
      // 无检索结果，回退到AI原生
      const response = await this.generateAINativeResponse(
        query,
        conversation,
        book,
        streamCallback
      );
      return { response, sources: [] };
    }

    // 构建RAG提示词
    let systemPrompt: string;

    if (conversation.type === 'character' && conversation.character_id) {
      // 角色对话 + RAG
      const character = getCharacterById(conversation.character_id);
      if (!character) {
        throw new Error('Character not found');
      }

      systemPrompt = this.ragConversation.buildRAGPrompt({
        bookTitle: book.title,
        author: book.author,
        description: book.description,
        characterMode: true,
        characterName: character.name,
        characterDescription: character.description,
        retrievedContent: retrievalResult.documents,
      });
    } else {
      // 书籍对话 + RAG
      systemPrompt = this.ragConversation.buildRAGPrompt({
        bookTitle: book.title,
        author: book.author,
        description: book.description,
        retrievedContent: retrievalResult.documents,
      });
    }

    // 准备消息
    const messages = [
      ...context,
      { role: 'user' as const, content: query },
    ];

    // 调用AI生成回答
    let response: string;
    if (streamCallback) {
      const stream = await this.aiClient.streamChat(messages, { systemPrompt });
      response = '';
      for await (const chunk of stream) {
        response += chunk;
        streamCallback(chunk);
      }
    } else {
      response = await this.aiClient.chat(messages, { systemPrompt });
    }

    // 添加来源标注
    response = this.ragConversation.addSourceAnnotation(response, retrievalResult.documents);

    return {
      response,
      sources: retrievalResult.documents.map((doc, index) => ({
        doc_id: doc.id || `doc_${index}`,
        chunk_index: index,
        relevance_score: doc.score || 0,
        content_preview: doc.content.substring(0, 100) + '...',
      })),
    };
  }

  /**
   * 生成混合模式回答
   */
  async generateHybridResponse(
    query: string,
    conversation: Conversation,
    book: Book,
    streamCallback?: (chunk: string) => void
  ): Promise<{ response: string; sources?: any[] }> {
    // 获取对话上下文
    const context = getConversationContext(conversation.id, 10);

    // 尝试检索相关内容
    let retrievalResult: any = { documents: [] };
    try {
      retrievalResult = await this.ragConversation.retrieveContext(
        query,
        book.id,
        3 // 混合模式检索较少的文档
      );
    } catch (error) {
      console.log('RAG retrieval failed in hybrid mode:', error);
    }

    // 构建混合提示词
    let systemPrompt: string;

    if (conversation.type === 'character' && conversation.character_id) {
      // 角色对话
      const character = getCharacterById(conversation.character_id);
      if (!character) {
        throw new Error('Character not found');
      }

      systemPrompt = buildCharacterChatPrompt({
        bookTitle: book.title,
        characterName: character.name,
        description: character.description,
        personality: character.personality_traits
          ? Object.values(character.personality_traits as any)
          : [],
        speakingStyle: character.speaking_style,
        backgroundStory: character.background_story,
      });
    } else {
      // 书籍对话
      systemPrompt = buildBookChatPrompt({
        bookTitle: book.title,
        author: book.author,
        description: book.description,
        ragContext: retrievalResult.documents.length > 0
          ? this.formatRetrievedContent(retrievalResult.documents)
          : undefined,
      });
    }

    // 如果有检索内容，在提示词中添加
    if (retrievalResult.documents.length > 0) {
      systemPrompt += '\n\n参考内容（可选择性使用）：\n';
      systemPrompt += this.formatRetrievedContent(retrievalResult.documents);
      systemPrompt += '\n\n请综合你的知识和参考内容，提供全面的回答。';
    }

    // 准备消息
    const messages = [
      ...context,
      { role: 'user' as const, content: query },
    ];

    // 调用AI生成回答
    let response: string;
    if (streamCallback) {
      const stream = await this.aiClient.streamChat(messages, { systemPrompt });
      response = '';
      for await (const chunk of stream) {
        response += chunk;
        streamCallback(chunk);
      }
    } else {
      response = await this.aiClient.chat(messages, { systemPrompt });
    }

    // 如果有检索内容，轻量标注
    if (retrievalResult.documents.length > 0) {
      response += '\n\n*部分内容参考了书籍原文*';
    }

    return {
      response,
      sources: retrievalResult.documents.length > 0
        ? retrievalResult.documents.map((doc: any, index: number) => ({
            doc_id: doc.id || `doc_${index}`,
            chunk_index: index,
            relevance_score: doc.score || 0,
            content_preview: doc.content.substring(0, 100) + '...',
          }))
        : undefined,
    };
  }

  /**
   * 流式响应（SSE）
   */
  async *streamResponse(
    conversationId: string,
    userId: string,
    content: string
  ): AsyncGenerator<{
    type: 'chunk' | 'done' | 'error';
    data: string;
    metadata?: any;
  }> {
    try {
      let fullResponse = '';
      const metadata: any = {};

      // 发送消息并获取流式响应
      const responsePromise = this.sendMessage({
        conversationId,
        userId,
        content,
        streamCallback: (chunk) => {
          fullResponse += chunk;
        },
      });

      // 等待路由决策
      const startTime = Date.now();

      // 获取对话和书籍信息
      const conversation = getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const book = getBookById(conversation.book_id);
      if (!book) {
        throw new Error('Book not found');
      }

      // 执行路由决策
      const hasDocuments = await this.ragConversation.hasDocuments(book.id);
      const routingDecision = await this.router.routeConversation(
        content,
        {
          aiKnowledgeLevel: book.ai_knowledge_level,
          conversationStrategy: book.conversation_strategy,
          hasDocuments,
        }
      );

      // 发送元数据
      yield {
        type: 'chunk',
        data: '',
        metadata: {
          strategy: routingDecision.strategy,
          queryType: routingDecision.queryType,
        },
      };

      // 创建流式生成器
      const contextMessages = getConversationContext(conversationId, 10);

      let systemPrompt = buildBookChatPrompt({
        bookTitle: book.title,
        author: book.author,
        description: book.description,
      });

      // 如果需要RAG，先检索
      if (routingDecision.strategy === ResponseStrategy.RAG ||
          routingDecision.strategy === ResponseStrategy.HYBRID) {
        const retrievalResult = await this.ragConversation.retrieveContext(
          content,
          book.id,
          5
        );
        if (retrievalResult.documents.length > 0) {
          systemPrompt += '\n\n检索到的相关内容：\n';
          systemPrompt += this.formatRetrievedContent(retrievalResult.documents);
          metadata.sources = retrievalResult.documents;
        }
      }

      // 准备完整消息
      const chatMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
        { role: 'user', content },
      ];

      // 流式生成
      const stream = streamChat(chatMessages);

      for await (const chunk of stream) {
        yield {
          type: 'chunk',
          data: chunk,
        };
      }

      // 完成
      yield {
        type: 'done',
        data: '',
        metadata: {
          ...metadata,
          responseTime: Date.now() - startTime,
        },
      };

    } catch (error) {
      yield {
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 格式化检索内容
   */
  private formatRetrievedContent(documents: any[]): string {
    return documents
      .map((doc, index) => `[段落 ${index + 1}]\n${doc.content}`)
      .join('\n\n');
  }

  /**
   * 验证对话访问权限
   */
  async validateAccess(userId: string, conversationId: string): Promise<boolean> {
    return userOwnsConversation(userId, conversationId);
  }
}