/**
 * AI服务测试接口
 * 用于测试各个AI功能模块
 */

import { NextRequest, NextResponse } from 'next/server';
import { testConnection } from '@/lib/ai/client';
import { chat, streamChat, createChatStream } from '@/lib/ai/chat';
import { generateEmbedding, generateBatchEmbeddings } from '@/lib/ai/embedding';
import { recognizeBook } from '@/lib/ai/book-recognition';
import { extractCharacters } from '@/lib/ai/character-extraction';
import { recognizeIntent } from '@/lib/ai/intent-recognition';

export async function GET(request: NextRequest) {
  console.log('[AI Test] GET请求 - 执行基础测试');

  try {
    // 测试连接
    const connectionTest = await testConnection();

    return NextResponse.json({
      success: true,
      message: 'AI服务测试接口',
      connection: connectionTest,
      availableTests: [
        'connection - 测试AI服务连接',
        'chat - 测试对话功能',
        'stream - 测试流式对话',
        'embedding - 测试向量化',
        'book - 测试书籍识别',
        'character - 测试角色提取',
        'intent - 测试意图识别'
      ]
    });
  } catch (error) {
    console.error('[AI Test] 测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[AI Test] POST请求 - 执行特定测试');

  try {
    const body = await request.json();
    const { test, data } = body;

    console.log('[AI Test] 测试类型:', test);
    console.log('[AI Test] 测试数据:', data);

    let result: any;

    switch (test) {
      case 'connection':
        // 测试连接
        result = await testConnection();
        break;

      case 'chat':
        // 测试普通对话
        const chatMessages = data?.messages || [
          { role: 'system', content: '你是一个友好的助手' },
          { role: 'user', content: data?.content || '你好，请介绍一下你自己' }
        ];
        result = await chat(chatMessages);
        break;

      case 'stream':
        // 测试流式对话
        const streamMessages = data?.messages || [
          { role: 'system', content: '你是一个友好的助手' },
          { role: 'user', content: data?.content || '请用100字介绍一下人工智能' }
        ];

        // 收集流式响应
        let streamContent = '';
        let chunkCount = 0;
        const startTime = Date.now();

        for await (const chunk of streamChat(streamMessages)) {
          streamContent += chunk;
          chunkCount++;
        }

        result = {
          content: streamContent,
          chunkCount,
          duration: Date.now() - startTime,
          avgChunkSize: Math.round(streamContent.length / chunkCount)
        };
        break;

      case 'embedding':
        // 测试向量化
        const text = data?.text || '这是一个测试文本，用于生成向量';
        const embeddingResult = await generateEmbedding(text);
        result = {
          text: embeddingResult.text,
          dimensions: embeddingResult.dimensions,
          vectorSample: embeddingResult.embedding.slice(0, 10), // 只返回前10个值作为示例
          vectorLength: embeddingResult.embedding.length
        };
        break;

      case 'batch-embedding':
        // 测试批量向量化
        const texts = data?.texts || [
          '第一个测试文本',
          '第二个测试文本',
          '第三个测试文本'
        ];
        const batchResult = await generateBatchEmbeddings(texts);
        result = {
          count: batchResult.embeddings.length,
          totalTokens: batchResult.totalTokens,
          embeddings: batchResult.embeddings.map(e => ({
            text: e.text,
            dimensions: e.dimensions
          }))
        };
        break;

      case 'book':
        // 测试书籍识别
        const bookTitle = data?.title || '红楼梦';
        const bookInfo = await recognizeBook(bookTitle);
        result = bookInfo;
        break;

      case 'character':
        // 测试角色提取
        const book = data?.book || {
          title: '红楼梦',
          author: '曹雪芹',
          description: '中国古代四大名著之一，描写贾宝玉、林黛玉、薛宝钗等人的爱情故事和贾府的兴衰。'
        };
        const characters = await extractCharacters(
          book.title,
          book.author,
          book.description
        );
        result = characters;
        break;

      case 'intent':
        // 测试意图识别
        const userInput = data?.input || '我想了解红楼梦这本书';
        const context = data?.context;
        const intent = await recognizeIntent(userInput, context);
        result = intent;
        break;

      case 'full-test':
        // 完整测试套件
        console.log('[AI Test] 执行完整测试套件');

        const tests = [];

        // 1. 连接测试
        tests.push({
          name: 'connection',
          result: await testConnection().catch(e => ({ success: false, error: e.message }))
        });

        // 2. 对话测试
        tests.push({
          name: 'chat',
          result: await chat([
            { role: 'user', content: '说"测试成功"' }
          ]).then(r => ({ success: true, content: r.content }))
            .catch(e => ({ success: false, error: e.message }))
        });

        // 3. 向量化测试
        tests.push({
          name: 'embedding',
          result: await generateEmbedding('测试文本')
            .then(r => ({ success: true, dimensions: r.dimensions }))
            .catch(e => ({ success: false, error: e.message }))
        });

        // 4. 书籍识别测试
        tests.push({
          name: 'book-recognition',
          result: await recognizeBook('三国演义')
            .then(r => ({ success: true, title: r.title, score: r.aiKnowledgeScore }))
            .catch(e => ({ success: false, error: e.message }))
        });

        // 5. 意图识别测试
        tests.push({
          name: 'intent-recognition',
          result: await recognizeIntent('我想看书')
            .then(r => ({ success: true, type: r.type, confidence: r.confidence }))
            .catch(e => ({ success: false, error: e.message }))
        });

        result = {
          timestamp: new Date().toISOString(),
          tests,
          summary: {
            total: tests.length,
            passed: tests.filter(t => t.result.success).length,
            failed: tests.filter(t => !t.result.success).length
          }
        };
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `未知的测试类型: ${test}`
          },
          { status: 400 }
        );
    }

    console.log('[AI Test] 测试完成');
    return NextResponse.json({
      success: true,
      test,
      result
    });

  } catch (error) {
    console.error('[AI Test] 测试出错:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// 测试流式响应
export async function PUT(request: NextRequest) {
  console.log('[AI Test] PUT请求 - 测试流式响应');

  try {
    const body = await request.json();
    const messages = body.messages || [
      { role: 'system', content: '你是一个友好的助手' },
      { role: 'user', content: body.content || '请详细介绍一下人工智能的发展历史' }
    ];

    const stream = await createChatStream(messages);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[AI Test] 流式测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}