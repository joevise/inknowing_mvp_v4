/**
 * 意图识别模块
 * 识别用户输入的意图并进行智能路由
 */

import { chat } from './chat';
import { INTENT_RECOGNITION_PROMPT } from './prompts';

export type IntentType =
  | 'search_book'        // 搜索书籍
  | 'chat_with_book'     // 与书籍内容对话
  | 'chat_with_character'// 与角色对话
  | 'view_history'       // 查看历史记录
  | 'general_chat'       // 普通对话
  | 'ask_recommendation' // 请求推荐
  | 'navigate'           // 导航到特定页面
  | 'unclear';           // 意图不明确

export interface RecognizedIntent {
  type: IntentType;
  confidence: number; // 0-1之间的置信度
  entities: {
    bookTitle?: string;
    characterName?: string;
    topic?: string;
    action?: string;
    [key: string]: any;
  };
  suggestions: string[]; // 推荐的回复或操作
  originalInput: string;
}

export interface IntentContext {
  currentPage?: string;
  currentBook?: string;
  recentBooks?: string[];
  userHistory?: string[];
}

/**
 * 识别用户输入意图
 */
export async function recognizeIntent(
  userInput: string,
  context?: IntentContext
): Promise<RecognizedIntent> {
  console.log('[Intent Recognition] 开始识别意图:', {
    input: userInput,
    hasContext: !!context
  });

  if (!userInput || userInput.trim().length === 0) {
    return {
      type: 'unclear',
      confidence: 1,
      entities: {},
      suggestions: ['请输入您想了解的内容'],
      originalInput: userInput
    };
  }

  // 快速规则匹配（提高响应速度）
  const quickMatch = quickIntentMatching(userInput);
  if (quickMatch && quickMatch.confidence > 0.8) {
    console.log('[Intent Recognition] 快速匹配成功:', quickMatch.type);
    return { ...quickMatch, originalInput: userInput };
  }

  try {
    // 构建上下文信息
    let contextInfo = '';
    if (context) {
      if (context.currentPage) {
        contextInfo += `当前页面：${context.currentPage}\n`;
      }
      if (context.currentBook) {
        contextInfo += `当前书籍：${context.currentBook}\n`;
      }
      if (context.recentBooks && context.recentBooks.length > 0) {
        contextInfo += `最近浏览：${context.recentBooks.join(', ')}\n`;
      }
    }

    // 构建提示词
    const messages = [
      {
        role: 'system' as const,
        content: INTENT_RECOGNITION_PROMPT
      },
      {
        role: 'user' as const,
        content: contextInfo ? `${contextInfo}\n用户输入：${userInput}` : userInput
      }
    ];

    // 调用AI
    const response = await chat(messages, {
      temperature: 0.3,
      maxTokens: 500
    });

    // 解析响应
    let intent: RecognizedIntent;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        intent = {
          type: parsed.type || 'unclear',
          confidence: parsed.confidence || 0.5,
          entities: parsed.entities || {},
          suggestions: parsed.suggestions || [],
          originalInput: userInput
        };
      } else {
        throw new Error('响应中未找到JSON数据');
      }
    } catch (parseError) {
      console.error('[Intent Recognition] JSON解析失败:', parseError);
      // 使用备用方法
      intent = parseIntentFromText(userInput, response.content);
    }

    // 验证和增强意图
    intent = validateAndEnhanceIntent(intent, context);

    console.log('[Intent Recognition] 识别完成:', {
      type: intent.type,
      confidence: intent.confidence,
      entitiesCount: Object.keys(intent.entities).length
    });

    return intent;
  } catch (error) {
    console.error('[Intent Recognition] 识别失败:', error);
    // 返回基础意图
    return {
      type: 'general_chat',
      confidence: 0.3,
      entities: {},
      suggestions: ['让我来帮您解答'],
      originalInput: userInput
    };
  }
}

/**
 * 快速规则匹配
 */
function quickIntentMatching(input: string): Omit<RecognizedIntent, 'originalInput'> | null {
  const lowerInput = input.toLowerCase();

  // 搜索书籍意图
  if (lowerInput.includes('找') || lowerInput.includes('搜索') ||
      lowerInput.includes('有没有') || lowerInput.includes('推荐')) {
    const bookPatterns = ['书', '小说', '著作', '作品'];
    if (bookPatterns.some(p => lowerInput.includes(p))) {
      return {
        type: 'search_book',
        confidence: 0.9,
        entities: { action: 'search' },
        suggestions: ['让我为您搜索相关书籍']
      };
    }
  }

  // 与角色对话意图
  if ((lowerInput.includes('和') || lowerInput.includes('与') || lowerInput.includes('跟')) &&
      (lowerInput.includes('聊') || lowerInput.includes('对话') || lowerInput.includes('说话'))) {
    // 尝试提取角色名
    const characterMatch = input.match(/[和与跟](.{1,10})[聊对说]/);
    if (characterMatch) {
      return {
        type: 'chat_with_character',
        confidence: 0.85,
        entities: { characterName: characterMatch[1].trim() },
        suggestions: [`开始与${characterMatch[1]}对话`]
      };
    }
  }

  // 查看历史记录
  if (lowerInput.includes('历史') || lowerInput.includes('记录') ||
      lowerInput.includes('之前') || lowerInput.includes('最近')) {
    return {
      type: 'view_history',
      confidence: 0.85,
      entities: { action: 'view_history' },
      suggestions: ['查看您的对话历史']
    };
  }

  // 请求推荐
  if (lowerInput.includes('推荐') || lowerInput.includes('建议') ||
      lowerInput.includes('有什么好')) {
    return {
      type: 'ask_recommendation',
      confidence: 0.8,
      entities: {},
      suggestions: ['为您推荐优质内容']
    };
  }

  // 书籍内容询问（包含书名）
  const bookTitles = ['红楼梦', '西游记', '水浒传', '三国演义', '百年孤独',
                      '活着', '围城', '平凡的世界', '白夜行', '解忧杂货店'];
  for (const title of bookTitles) {
    if (lowerInput.includes(title.toLowerCase())) {
      return {
        type: 'chat_with_book',
        confidence: 0.8,
        entities: { bookTitle: title },
        suggestions: [`关于《${title}》的问题`]
      };
    }
  }

  return null;
}

/**
 * 从文本响应中解析意图（备用方法）
 */
function parseIntentFromText(userInput: string, text: string): RecognizedIntent {
  const intent: RecognizedIntent = {
    type: 'general_chat',
    confidence: 0.5,
    entities: {},
    suggestions: [],
    originalInput: userInput
  };

  // 尝试识别意图类型
  const typePatterns: Record<IntentType, string[]> = {
    'search_book': ['搜索', '查找', '寻找', '书籍'],
    'chat_with_book': ['书籍对话', '内容对话', '讨论书'],
    'chat_with_character': ['角色对话', '人物对话', '角色交流'],
    'view_history': ['历史', '记录', '之前的'],
    'general_chat': ['闲聊', '普通对话', '一般对话'],
    'ask_recommendation': ['推荐', '建议', '介绍'],
    'navigate': ['导航', '跳转', '前往'],
    'unclear': ['不明确', '不清楚', '模糊']
  };

  for (const [type, patterns] of Object.entries(typePatterns)) {
    if (patterns.some(p => text.includes(p))) {
      intent.type = type as IntentType;
      break;
    }
  }

  // 尝试提取实体
  const bookMatch = text.match(/《([^》]+)》/);
  if (bookMatch) {
    intent.entities.bookTitle = bookMatch[1];
  }

  const topicMatch = text.match(/主题[：:]?\s*([^\n,，。]+)/);
  if (topicMatch) {
    intent.entities.topic = topicMatch[1].trim();
  }

  return intent;
}

/**
 * 验证和增强意图
 */
function validateAndEnhanceIntent(
  intent: RecognizedIntent,
  context?: IntentContext
): RecognizedIntent {
  // 确保置信度在合理范围
  intent.confidence = Math.min(1, Math.max(0, intent.confidence));

  // 根据上下文增强意图
  if (context) {
    // 如果在书籍页面，普通问题可能是关于当前书籍的
    if (context.currentBook && intent.type === 'general_chat') {
      if (intent.confidence < 0.6) {
        intent.type = 'chat_with_book';
        intent.entities.bookTitle = context.currentBook;
        intent.suggestions.push(`关于《${context.currentBook}》的问题`);
      }
    }

    // 如果最近浏览过书籍，可能在询问相关内容
    if (context.recentBooks && context.recentBooks.length > 0) {
      if (!intent.entities.bookTitle && intent.type === 'chat_with_book') {
        intent.entities.possibleBooks = context.recentBooks;
        intent.suggestions.push('可能与您最近浏览的书籍相关');
      }
    }
  }

  // 确保有建议
  if (intent.suggestions.length === 0) {
    switch (intent.type) {
      case 'search_book':
        intent.suggestions = ['为您搜索相关书籍', '展示推荐书单'];
        break;
      case 'chat_with_book':
        intent.suggestions = ['开始书籍对话', '深入探讨内容'];
        break;
      case 'chat_with_character':
        intent.suggestions = ['进入角色对话模式', '选择对话角色'];
        break;
      case 'view_history':
        intent.suggestions = ['查看对话历史', '继续之前的对话'];
        break;
      case 'ask_recommendation':
        intent.suggestions = ['推荐热门书籍', '根据您的喜好推荐'];
        break;
      case 'navigate':
        intent.suggestions = ['前往目标页面', '导航到相关内容'];
        break;
      case 'general_chat':
        intent.suggestions = ['让我来帮助您', '请告诉我更多信息'];
        break;
      default:
        intent.suggestions = ['请提供更多信息', '让我理解您的需求'];
    }
  }

  return intent;
}

/**
 * 批量识别意图
 */
export async function recognizeIntents(
  inputs: string[],
  context?: IntentContext
): Promise<RecognizedIntent[]> {
  console.log('[Intent Recognition] 批量识别意图:', {
    count: inputs.length
  });

  const results: RecognizedIntent[] = [];

  for (const input of inputs) {
    try {
      const intent = await recognizeIntent(input, context);
      results.push(intent);
    } catch (error) {
      console.error('[Intent Recognition] 单个意图识别失败:', error);
      results.push({
        type: 'unclear',
        confidence: 0,
        entities: {},
        suggestions: ['无法识别意图'],
        originalInput: input
      });
    }
  }

  return results;
}

/**
 * 根据意图生成响应建议
 */
export function generateResponseSuggestion(intent: RecognizedIntent): string {
  switch (intent.type) {
    case 'search_book':
      if (intent.entities.topic) {
        return `正在为您搜索关于"${intent.entities.topic}"的书籍...`;
      }
      return '正在为您搜索相关书籍...';

    case 'chat_with_book':
      if (intent.entities.bookTitle) {
        return `让我们开始探讨《${intent.entities.bookTitle}》的内容`;
      }
      return '请告诉我您想了解哪本书的内容';

    case 'chat_with_character':
      if (intent.entities.characterName) {
        return `正在连接${intent.entities.characterName}，准备开始对话...`;
      }
      return '请选择您想对话的角色';

    case 'view_history':
      return '正在加载您的对话历史...';

    case 'ask_recommendation':
      return '让我为您推荐一些优质内容';

    case 'navigate':
      if (intent.entities.target) {
        return `正在前往${intent.entities.target}...`;
      }
      return '请告诉我您想去哪里';

    case 'general_chat':
      return '有什么我可以帮助您的吗？';

    default:
      return '请提供更多信息，让我更好地理解您的需求';
  }
}