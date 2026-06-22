// @ts-nocheck
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
  updateConversation,
  userOwnsConversation,
} from '@/lib/db/conversations';
import {
  saveUserMessage,
  saveAIResponse,
  getConversationContext,
  getMessagesByConversationId,
} from '@/lib/db/messages';
import { getBookById } from '@/lib/db/books';
import { getCharacterById } from '@/lib/db/characters';
import {
  buildBookChatPrompt,
  buildCharacterChatPrompt,
} from '@/lib/ai/prompts';
import type { Conversation, Message, Book, Character } from '@/lib/db/schema';
import {
  buildMemoryContextBlock,
  extractAndStoreMemories,
} from './user-memory-service';

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
    const book = await getBookById(params.bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    // 如果是角色对话，验证角色存在
    if (params.type === 'character' && params.characterId) {
      const character = await getCharacterById(params.characterId);
      if (!character) {
        throw new Error('Character not found');
      }
    }

    // 创建对话
    const conversation = await createConversation({
      user_id: params.userId,
      book_id: params.bookId,
      character_id: params.characterId || null,
      type: params.type,
      title: params.title,
    });

    return conversation;
  }

  /**
   * 发送消息（主函数）
   */
  async sendMessage(params: SendMessageParams): Promise<MessageResponse> {
    const startTime = Date.now();

    // 验证权限
    if (!(await userOwnsConversation(params.userId, params.conversationId))) {
      throw new Error('Unauthorized: User does not own this conversation');
    }

    // 获取对话信息
    const conversation = await getConversationById(params.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // 保存用户消息
    const userMessage = await saveUserMessage(params.conversationId, params.content);

    // 获取书籍信息
    const book = await getBookById(conversation.book_id);
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
        previousMessages: await getConversationContext(params.conversationId, 10),
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

    // 获取头像信息
    let cover_url: string | undefined;
    let character_name: string | undefined;
    let book_title = book.title;

    if (conversation.type === 'character' && conversation.character_id) {
      const character = await getCharacterById(conversation.character_id);
      if (character) {
        cover_url = (character as any).avatar_url || undefined;
        character_name = character.name;
      }
    } else {
      cover_url = book.cover_url || undefined;
    }

    // 保存AI回复（包含头像信息）
    const metadata: any = {
      strategy: routingDecision.strategy,
      query_type: routingDecision.queryType,
      response_time: Date.now() - startTime,
      cover_url,
      character_name,
      book_title,
    };

    if (sources) {
      metadata.sources = sources;
    }

    const aiMessage = await saveAIResponse(params.conversationId, response, metadata);

    // 更新对话活动时间
    await touchConversation(params.conversationId);

    // 第一轮完整问答后，若标题为空则自动生成标题
    await this.maybeGenerateTitle(conversation);

    // 异步抽取并存储用户记忆，不阻塞用户拿到回复
    void extractAndStoreMemories({
      userId: params.userId,
      conversationId: params.conversationId,
      bookId: conversation.book_id,
      userMessage: params.content,
      aiResponse: response,
    }).catch(e => console.error('[memory] extract failed', e));

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
    const context = await getConversationContext(conversation.id, 10);

    let systemPrompt: string;
    let messages = [...context];

    if (conversation.type === 'character' && conversation.character_id) {
      // 角色对话
      const character = await getCharacterById(conversation.character_id);
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

    // 注入跨会话用户记忆
    const memoryBlock = await buildMemoryContextBlock(conversation.user_id);
    systemPrompt = systemPrompt + memoryBlock;

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
    const context = await getConversationContext(conversation.id, 10);

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
      const character = await getCharacterById(conversation.character_id);
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

    // 注入跨会话用户记忆
    const memoryBlock = await buildMemoryContextBlock(conversation.user_id);
    systemPrompt = systemPrompt + memoryBlock;

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
    const context = await getConversationContext(conversation.id, 10);

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
      const character = await getCharacterById(conversation.character_id);
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

    // 注入跨会话用户记忆
    const memoryBlock = await buildMemoryContextBlock(conversation.user_id);
    systemPrompt = systemPrompt + memoryBlock;

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
      // 获取对话和书籍信息
      const conversation = await getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const book = await getBookById(conversation.book_id);
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

      // 获取头像信息
      let cover_url: string | undefined;
      let character_name: string | undefined;
      let book_title = book.title;

      if (conversation.type === 'character' && conversation.character_id) {
        const character = await getCharacterById(conversation.character_id);
        if (character) {
          cover_url = (character as any).avatar_url || undefined;
          character_name = character.name;
        }
      } else {
        cover_url = book.cover_url || undefined;
      }

      // 发送元数据（包含头像信息）
      yield {
        type: 'chunk',
        data: '',
        metadata: {
          strategy: routingDecision.strategy,
          queryType: routingDecision.queryType,
          cover_url,
          character_name,
          book_title,
        },
      };

      // 使用队列/泵模式桥接 sendMessage 的同步 streamCallback 与 async generator
      const chunks: string[] = [];
      let notify: (() => void) | null = null;
      let finished = false;
      let sendError: Error | null = null;

      const responsePromise = this.sendMessage({
        conversationId,
        userId,
        content,
        streamCallback: (chunk) => {
          chunks.push(chunk);
          if (notify) {
            notify();
            notify = null;
          }
        },
      });

      responsePromise.then(
        () => {
          finished = true;
          if (notify) {
            notify();
            notify = null;
          }
        },
        (err) => {
          sendError = err instanceof Error ? err : new Error(String(err));
          finished = true;
          if (notify) {
            notify();
            notify = null;
          }
        }
      );

      while (!finished || chunks.length > 0) {
        if (chunks.length > 0) {
          const chunk = chunks.shift()!;
          yield {
            type: 'chunk',
            data: chunk,
          };
        } else {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
        }
      }

      if (sendError) {
        throw sendError;
      }

      const result = await responsePromise;

      // 完成
      yield {
        type: 'done',
        data: '',
        metadata: {
          strategy: result.strategy,
          queryType: result.queryType,
          sources: result.sources,
          responseTime: result.responseTime,
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
   * 第一轮完整问答后自动生成标题
   */
  private async maybeGenerateTitle(conversation: Conversation): Promise<void> {
    if (conversation.title) return;

    try {
      const messages = await getMessagesByConversationId(conversation.id);

      // 仅当存在且仅存在一条用户消息和一条AI回复时生成标题
      if (messages.length !== 2) return;

      const firstUser = messages.find(m => m.role === 'user');
      const firstAssistant = messages.find(m => m.role === 'assistant');
      if (!firstUser || !firstAssistant) return;

      let title: string;
      try {
        const result = await chat([
          {
            role: 'system',
            content: '你是一个对话标题生成器，根据用户的第一句话和AI回复，生成一个不超过15字的简洁中文标题，只输出标题本身，不要引号不要标点。',
          },
          {
            role: 'user',
            content: `用户：${firstUser.content}\nAI：${firstAssistant.content.slice(0, 100)}`,
          },
        ], { temperature: 0.3, maxTokens: 30 });

        title = result.content
          .trim()
          .replace(/^["'「『【】\s]+|["'」』】\s]+$/g, '')
          .slice(0, 15);

        if (!title) {
          throw new Error('AI generated empty title');
        }
      } catch (err) {
        console.error('[Title] AI生成标题失败，使用fallback:', err);
        title = firstUser.content.trim().slice(0, 15);
      }

      await updateConversation(conversation.id, { title });
    } catch (err) {
      console.error('[Title] 自动生成标题流程失败:', err);
    }
  }

  /**
   * 验证对话访问权限
   */
  async validateAccess(userId: string, conversationId: string): Promise<boolean> {
    return await userOwnsConversation(userId, conversationId);
  }
}
