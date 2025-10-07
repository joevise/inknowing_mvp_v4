/**
 * 角色提取模块
 * 从书籍中提取主要角色信息
 */

import { chat } from './chat';
import { CHARACTER_EXTRACTION_PROMPT } from './prompts';

export interface CharacterInfo {
  name: string;
  description: string;
  personality: string[];
  speakingStyle: string;
  backgroundStory?: string;
  keyQuotes?: string[];
  relationships?: string[];
}

export interface CharacterExtractionResult {
  characters: CharacterInfo[];
  bookTitle: string;
  extractionQuality: 'high' | 'medium' | 'low';
}

/**
 * 从书籍中提取角色信息
 */
export async function extractCharacters(
  bookTitle: string,
  author: string,
  description?: string,
  additionalContext?: string
): Promise<CharacterExtractionResult> {
  console.log('[Character Extraction] 开始提取角色:', {
    bookTitle,
    author,
    hasDescription: !!description,
    hasAdditionalContext: !!additionalContext
  });

  if (!bookTitle || !author) {
    throw new Error('书名和作者不能为空');
  }

  try {
    // 构建上下文信息
    let context = `书名：${bookTitle}\n作者：${author}`;
    if (description) {
      context += `\n简介：${description}`;
    }
    if (additionalContext) {
      context += `\n补充信息：${additionalContext}`;
    }

    // 构建提示词
    const messages = [
      {
        role: 'system' as const,
        content: CHARACTER_EXTRACTION_PROMPT
      },
      {
        role: 'user' as const,
        content: context
      }
    ];

    // 调用AI
    const response = await chat(messages, {
      temperature: 0.5, // 适中的创造性
      maxTokens: 2000
    });

    // 解析响应
    let result: CharacterExtractionResult;
    try {
      // 尝试提取JSON部分
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = {
          bookTitle,
          characters: parsed.characters || [],
          extractionQuality: parsed.extractionQuality || 'medium'
        };
      } else {
        throw new Error('响应中未找到JSON数据');
      }
    } catch (parseError) {
      console.error('[Character Extraction] JSON解析失败:', parseError);
      console.log('[Character Extraction] AI响应内容:', response.content);

      // 使用备用解析方法
      result = parseCharactersFromText(bookTitle, response.content);
    }

    // 验证和补充角色信息
    result = validateAndEnrichCharacters(result);

    console.log('[Character Extraction] 提取完成:', {
      bookTitle: result.bookTitle,
      characterCount: result.characters.length,
      quality: result.extractionQuality
    });

    return result;
  } catch (error) {
    console.error('[Character Extraction] 提取失败:', error);
    // 返回默认角色
    return createFallbackCharacters(bookTitle);
  }
}

/**
 * 从纯文本响应中解析角色信息（备用方法）
 */
function parseCharactersFromText(bookTitle: string, text: string): CharacterExtractionResult {
  console.log('[Character Extraction] 使用文本解析方法');

  const characters: CharacterInfo[] = [];

  // 尝试按角色分割文本
  const characterSections = text.split(/\d+\.|角色\d+|人物\d+/);

  for (const section of characterSections) {
    if (section.trim().length < 10) continue;

    const character: CharacterInfo = {
      name: '',
      description: '',
      personality: [],
      speakingStyle: ''
    };

    // 提取名字
    const nameMatch = section.match(/名字[：:]?\s*([^\n,，。]+)|姓名[：:]?\s*([^\n,，。]+)|([^\n,，。：:]{2,6})(?=[：:])/);
    if (nameMatch) {
      character.name = (nameMatch[1] || nameMatch[2] || nameMatch[3]).trim();
    }

    // 提取描述
    const descMatch = section.match(/描述[：:]?\s*([^\n]+)|简介[：:]?\s*([^\n]+)|介绍[：:]?\s*([^\n]+)/);
    if (descMatch) {
      character.description = (descMatch[1] || descMatch[2] || descMatch[3]).trim();
    }

    // 提取性格特征
    const personalityMatch = section.match(/性格[：:]?\s*([^\n]+)|特点[：:]?\s*([^\n]+)|特征[：:]?\s*([^\n]+)/);
    if (personalityMatch) {
      const personalityText = (personalityMatch[1] || personalityMatch[2] || personalityMatch[3]).trim();
      character.personality = personalityText.split(/[,，、]/g).map(p => p.trim()).filter(p => p.length > 0);
    }

    // 提取说话风格
    const styleMatch = section.match(/说话风格[：:]?\s*([^\n]+)|语言风格[：:]?\s*([^\n]+)|口吻[：:]?\s*([^\n]+)/);
    if (styleMatch) {
      character.speakingStyle = (styleMatch[1] || styleMatch[2] || styleMatch[3]).trim();
    }

    // 只添加有效的角色
    if (character.name && (character.description || character.personality.length > 0)) {
      characters.push(character);
    }
  }

  return {
    bookTitle,
    characters: characters.slice(0, 5), // 最多5个角色
    extractionQuality: characters.length > 0 ? 'low' : 'low'
  };
}

/**
 * 验证和补充角色信息
 */
function validateAndEnrichCharacters(result: CharacterExtractionResult): CharacterExtractionResult {
  const validated: CharacterExtractionResult = {
    bookTitle: result.bookTitle,
    characters: [],
    extractionQuality: result.extractionQuality || 'medium'
  };

  // 处理每个角色
  for (const char of result.characters) {
    const enriched: CharacterInfo = {
      name: char.name || '未命名角色',
      description: char.description || '暂无描述',
      personality: Array.isArray(char.personality) ? char.personality : [],
      speakingStyle: char.speakingStyle || '普通',
      backgroundStory: char.backgroundStory,
      keyQuotes: Array.isArray(char.keyQuotes) ? char.keyQuotes : [],
      relationships: Array.isArray(char.relationships) ? char.relationships : []
    };

    // 确保有基本的性格特征
    if (enriched.personality.length === 0) {
      enriched.personality = ['待补充'];
    }

    // 补充说话风格
    if (enriched.speakingStyle === '普通' || !enriched.speakingStyle) {
      // 根据性格特征推断说话风格
      if (enriched.personality.includes('智慧') || enriched.personality.includes('睿智')) {
        enriched.speakingStyle = '深思熟虑，富有哲理';
      } else if (enriched.personality.includes('勇敢') || enriched.personality.includes('豪爽')) {
        enriched.speakingStyle = '直率坦诚，充满力量';
      } else if (enriched.personality.includes('温柔') || enriched.personality.includes('善良')) {
        enriched.speakingStyle = '温和亲切，体贴入微';
      } else {
        enriched.speakingStyle = '自然流畅';
      }
    }

    validated.characters.push(enriched);
  }

  // 限制角色数量（2-5个）
  if (validated.characters.length > 5) {
    validated.characters = validated.characters.slice(0, 5);
  } else if (validated.characters.length === 0) {
    // 如果没有提取到任何角色，添加一个默认角色
    validated.characters.push({
      name: '书中智者',
      description: '书中的智慧化身，能够解答关于本书的所有问题',
      personality: ['博学', '睿智', '耐心'],
      speakingStyle: '深邃而富有哲理，循循善诱',
      backgroundStory: '熟读本书的每一页，理解作者的每一个思想'
    });
    validated.extractionQuality = 'low';
  }

  // 评估提取质量
  if (validated.characters.length >= 3 &&
      validated.characters.every(c => c.description.length > 10 && c.personality.length > 1)) {
    validated.extractionQuality = 'high';
  } else if (validated.characters.length >= 2) {
    validated.extractionQuality = 'medium';
  } else {
    validated.extractionQuality = 'low';
  }

  return validated;
}

/**
 * 创建后备角色（当提取失败时）
 */
function createFallbackCharacters(bookTitle: string): CharacterExtractionResult {
  console.log('[Character Extraction] 使用后备角色');

  return {
    bookTitle,
    characters: [
      {
        name: '主角',
        description: '书中的主要人物',
        personality: ['待定'],
        speakingStyle: '符合角色设定',
        backgroundStory: '贯穿全书的核心人物'
      },
      {
        name: '智者',
        description: '书中的智慧化身',
        personality: ['睿智', '博学'],
        speakingStyle: '深思熟虑，富有哲理',
        backgroundStory: '为主角提供指引和智慧'
      }
    ],
    extractionQuality: 'low'
  };
}

/**
 * 为特定类型的书籍生成预设角色
 */
export function generatePresetCharacters(bookCategory: string, bookTitle: string): CharacterInfo[] {
  const presets: Record<string, CharacterInfo[]> = {
    '商业': [
      {
        name: '企业家导师',
        description: '成功的企业家，有丰富的创业和管理经验',
        personality: ['睿智', '务实', '远见'],
        speakingStyle: '条理清晰，案例丰富，直击要点',
        backgroundStory: '创办多家成功企业，精通商业之道'
      },
      {
        name: '职场精英',
        description: '在职场打拼多年的专业人士',
        personality: ['专业', '高效', '目标导向'],
        speakingStyle: '专业严谨，注重实效',
        backgroundStory: '从基层做起，一步步成长为行业专家'
      }
    ],
    '文学': [
      {
        name: '文学评论家',
        description: '深谙文学之美的评论家',
        personality: ['敏感', '深刻', '富有想象力'],
        speakingStyle: '优美流畅，富有诗意',
        backgroundStory: '一生致力于文学研究和评论'
      },
      {
        name: '故事讲述者',
        description: '善于讲述故事的叙述者',
        personality: ['生动', '感性', '引人入胜'],
        speakingStyle: '娓娓道来，引人入胜',
        backgroundStory: '游历四方，收集和讲述各种故事'
      }
    ],
    '心理': [
      {
        name: '心理咨询师',
        description: '专业的心理健康顾问',
        personality: ['empathetic', '耐心', '洞察力强'],
        speakingStyle: '温和亲切，循循善诱',
        backgroundStory: '帮助无数人走出心理困境'
      },
      {
        name: '自我成长导师',
        description: '专注于个人成长的引导者',
        personality: ['激励', '积极', '充满智慧'],
        speakingStyle: '充满正能量，激发潜能',
        backgroundStory: '通过自身经历启发他人成长'
      }
    ],
    '科学': [
      {
        name: '科学探索者',
        description: '充满好奇心的科学研究者',
        personality: ['理性', '严谨', '好奇'],
        speakingStyle: '逻辑清晰，实事求是',
        backgroundStory: '在科学领域不断探索和发现'
      },
      {
        name: '知识传播者',
        description: '善于将复杂科学简单化的教育者',
        personality: ['通俗易懂', '生动', '耐心'],
        speakingStyle: '深入浅出，妙趣横生',
        backgroundStory: '致力于科学普及和教育'
      }
    ],
    '哲学': [
      {
        name: '哲学家',
        description: '深入思考人生和世界本质的思想家',
        personality: ['深邃', '理性', '批判性思维'],
        speakingStyle: '思辨深刻，启发思考',
        backgroundStory: '终身追求智慧和真理'
      },
      {
        name: '智慧长者',
        description: '经历丰富的人生导师',
        personality: ['睿智', '平和', '包容'],
        speakingStyle: '语重心长，充满哲理',
        backgroundStory: '阅历丰富，洞察人生'
      }
    ]
  };

  const categoryCharacters = presets[bookCategory] || presets['文学'];

  // 为角色添加书籍特定信息
  return categoryCharacters.map(char => ({
    ...char,
    description: `${char.description}，精通《${bookTitle}》的内容`,
    backgroundStory: `${char.backgroundStory}，对《${bookTitle}》有独到见解`
  }));
}