/**
 * 数据库种子数据
 * 用于初始化开发和测试环境
 */

import { createUser } from './users';
import { createBook } from './books';
import { createCharacter } from './characters';
import { createConversation } from './conversations';
import { createMessage } from './messages';
import { transaction, resetDb } from './client';

/**
 * 种子数据配置
 */
const seedData = {
  // 测试用户
  users: [
    {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    },
    {
      username: 'demo',
      email: 'demo@inknowing.com',
      password: 'demo123',
    },
  ],

  // 示例书籍
  books: [
    {
      title: '红楼梦',
      author: '曹雪芹',
      description: '中国古典小说的巅峰之作，描写了贾宝玉、林黛玉、薛宝钗等人的爱情悲剧，展现了封建大家族的兴衰。',
      category: '文学',
      tags: ['古典名著', '中国文学', '爱情'],
      ai_knowledge_level: 9,
      requires_document: false,
      conversation_strategy: 'ai_native' as const,
      status: 'published' as const,
      cover_url: '/images/books/hongloumeng.jpg',
    },
    {
      title: '百年孤独',
      author: '加西亚·马尔克斯',
      description: '魔幻现实主义代表作，讲述了布恩迪亚家族七代人的传奇故事。',
      category: '文学',
      tags: ['魔幻现实主义', '拉美文学', '经典'],
      ai_knowledge_level: 8,
      requires_document: false,
      conversation_strategy: 'ai_native' as const,
      status: 'published' as const,
      cover_url: '/images/books/bainiangudu.jpg',
    },
    {
      title: '三体',
      author: '刘慈欣',
      description: '中国科幻小说的里程碑作品，探讨了人类文明与外星文明的首次接触。',
      category: '科学',
      tags: ['科幻', '宇宙', '文明'],
      ai_knowledge_level: 9,
      requires_document: false,
      conversation_strategy: 'ai_native' as const,
      status: 'published' as const,
      cover_url: '/images/books/santi.jpg',
    },
    {
      title: '人类简史',
      author: '尤瓦尔·赫拉利',
      description: '从石器时代到21世纪，探讨人类如何成为地球的主宰。',
      category: '历史',
      tags: ['历史', '人类学', '社会'],
      ai_knowledge_level: 8,
      requires_document: false,
      conversation_strategy: 'ai_native' as const,
      status: 'published' as const,
      cover_url: '/images/books/renlei-jianshi.jpg',
    },
    {
      title: '思考，快与慢',
      author: '丹尼尔·卡尼曼',
      description: '诺贝尔经济学奖得主的心理学巨著，揭示人类思维的两种模式。',
      category: '心理',
      tags: ['心理学', '认知科学', '决策'],
      ai_knowledge_level: 8,
      requires_document: false,
      conversation_strategy: 'ai_native' as const,
      status: 'published' as const,
      cover_url: '/images/books/thinking.jpg',
    },
    {
      title: '原则',
      author: '瑞·达利欧',
      description: '桥水基金创始人的人生和工作原则，分享成功投资和管理的智慧。',
      category: '商业',
      tags: ['投资', '管理', '成功学'],
      ai_knowledge_level: 7,
      requires_document: false,
      conversation_strategy: 'ai_native' as const,
      status: 'published' as const,
      cover_url: '/images/books/principles.jpg',
    },
    {
      title: '道德经',
      author: '老子',
      description: '中国道家哲学的根本经典，阐述了"道"的哲学思想。',
      category: '哲学',
      tags: ['道家', '中国哲学', '经典'],
      ai_knowledge_level: 8,
      requires_document: false,
      conversation_strategy: 'ai_native' as const,
      status: 'published' as const,
      cover_url: '/images/books/daodejing.jpg',
    },
    {
      title: '小王子',
      author: '安托万·德·圣埃克苏佩里',
      description: '一个关于爱与责任的童话故事，适合所有年龄的读者。',
      category: '文学',
      tags: ['童话', '哲理', '经典'],
      ai_knowledge_level: 9,
      requires_document: false,
      conversation_strategy: 'ai_native' as const,
      status: 'published' as const,
      cover_url: '/images/books/xiaowangzi.jpg',
    },
  ],

  // 示例角色（红楼梦）
  honglouCharacters: [
    {
      name: '贾宝玉',
      description: '贾府的公子，性情温和，喜爱诗词，与林黛玉有着深厚的感情。',
      personality_traits: {
        性格: '温柔多情、叛逆不羁',
        爱好: '诗词歌赋、与姐妹们游玩',
        特点: '厌恶功名利禄，追求真性情',
      },
      speaking_style: '文雅风趣，常引经据典，说话温柔体贴',
      background_story: '贾府嫡孙，含玉而生，从小在女儿堆里长大',
      prompt_template: '你是贾宝玉，贾府的公子。你性情温和，喜爱诗词，常与姐妹们吟诗作对。你厌恶仕途经济，追求真性情。请以贾宝玉的身份和语气与用户对话。',
    },
    {
      name: '林黛玉',
      description: '寄居贾府的才女，聪慧敏感，诗才出众，与贾宝玉情投意合。',
      personality_traits: {
        性格: '聪慧敏感、多愁善感',
        才华: '诗词造诣极高',
        特点: '率真直言、不喜虚伪',
      },
      speaking_style: '言辞犀利却不失优雅，常有诗意，偶尔略带嘲讽',
      background_story: '林如海之女，母亲早逝，寄居贾府',
      prompt_template: '你是林黛玉，寄居在贾府的才女。你聪慧敏感，诗才出众，性格率真。请以林黛玉的身份和语气与用户对话，展现你的才华和独特个性。',
    },
    {
      name: '薛宝钗',
      description: '薛姨妈之女，端庄贤淑，才德兼备，深得贾母喜爱。',
      personality_traits: {
        性格: '端庄稳重、善解人意',
        才华: '博学多才、精通诗词',
        特点: '处事圆滑、深谋远虑',
      },
      speaking_style: '言语得体，温婉大方，善于劝导他人',
      background_story: '薛家千金，自幼受良好教育，知书达理',
      prompt_template: '你是薛宝钗，薛家的千金小姐。你端庄贤淑，才德兼备，处事圆融。请以薛宝钗的身份和语气与用户对话，展现你的涵养和智慧。',
    },
    {
      name: '王熙凤',
      description: '贾琏之妻，贾府的实际管家，精明能干，手段狠辣。',
      personality_traits: {
        性格: '精明能干、心机深重',
        能力: '善于理财、管理有方',
        特点: '笑里藏刀、权谋高手',
      },
      speaking_style: '言语爽利，常带笑意，善于察言观色',
      background_story: '王家女儿，嫁入贾府，掌管家务',
      prompt_template: '你是王熙凤，贾府的管家奶奶。你精明能干，善于管理，说话爽利风趣。请以王熙凤的身份和语气与用户对话。',
    },
  ],

  // 示例角色（三体）
  santiCharacters: [
    {
      name: '叶文洁',
      description: '物理学家，红岸基地工作，第一个与三体文明建立联系的地球人。',
      personality_traits: {
        性格: '理性冷静、内心复杂',
        经历: '文革受迫害、对人类失望',
        信念: '希望外星文明改造地球',
      },
      speaking_style: '语言简洁理性，带有科学家的严谨，偶尔流露悲观',
      background_story: '天体物理学家，因文革遭遇悲剧，在红岸基地工作时接触到外星文明',
      prompt_template: '你是叶文洁，一位经历过人类黑暗面的物理学家。你理性而悲观，对人类文明持批判态度。请以叶文洁的身份与用户对话。',
    },
    {
      name: '罗辑',
      description: '社会学教授，后成为面壁者，创立黑暗森林理论。',
      personality_traits: {
        性格: '玩世不恭、后期沉稳睿智',
        能力: '逻辑思维强、洞察力敏锐',
        转变: '从逃避到担当的成长',
      },
      speaking_style: '早期轻松幽默，后期深沉哲理，善于类比说明',
      background_story: '普通社会学教授，被选为面壁者后承担拯救人类的重任',
      prompt_template: '你是罗辑，面壁者之一，黑暗森林理论的创立者。你睿智深沉，善于从宇宙社会学角度思考问题。请以罗辑的身份与用户对话。',
    },
  ],
};

/**
 * 执行数据库种子
 */
export async function seed(options?: { reset?: boolean }) {
  console.log('🌱 Starting database seeding...');

  if (options?.reset) {
    console.log('♻️  Resetting database...');
    await resetDb();
  }

  try {
    // 创建用户
    console.log('👤 Creating users...');
    const users: any[] = [];
    for (const userData of seedData.users) {
      const user = await createUser(userData);
      users.push(user);
      console.log(`  ✓ Created user: ${userData.email}`);
    }

    // 创建书籍
    console.log('📚 Creating books...');
    const books: any[] = [];
    for (const bookData of seedData.books) {
      const book = await createBook(bookData);
      books.push(book);
      console.log(`  ✓ Created book: ${bookData.title}`);
    }

    // 创建红楼梦角色
    console.log('🎭 Creating characters for 红楼梦...');
    const honglouBook = books.find(b => b.title === '红楼梦');
    if (honglouBook) {
      for (const charData of seedData.honglouCharacters) {
        await createCharacter({
          ...charData,
          book_id: honglouBook.id,
        });
        console.log(`  ✓ Created character: ${charData.name}`);
      }
    }

    // 创建三体角色
    console.log('🎭 Creating characters for 三体...');
    const santiBook = books.find(b => b.title === '三体');
    if (santiBook) {
      for (const charData of seedData.santiCharacters) {
        await createCharacter({
          ...charData,
          book_id: santiBook.id,
        });
        console.log(`  ✓ Created character: ${charData.name}`);
      }
    }

    // 创建示例对话
    console.log('💬 Creating sample conversations...');
    const testUser = users[0];
    if (honglouBook && testUser) {
      const conversation = await createConversation({
        user_id: testUser.id,
        book_id: honglouBook.id,
        type: 'book',
        title: '初读红楼梦',
      });

      // 添加示例消息
      await createMessage({
        conversation_id: conversation.id,
        role: 'user',
        content: '请介绍一下红楼梦这本书的主要内容。',
      });

      await createMessage({
        conversation_id: conversation.id,
        role: 'assistant',
        content: '《红楼梦》是中国古典文学的巅峰之作，主要讲述了贾、史、王、薛四大家族的兴衰史，以贾宝玉、林黛玉、薛宝钗的爱情婚姻悲剧为主线，展现了封建社会末期的社会百态。小说通过对贾府日常生活的细致描绘，塑造了众多性格鲜明的人物形象，深刻揭示了封建社会的种种矛盾和人性的复杂。',
        metadata: {
          routing_strategy: 'ai_native',
        },
      });

      console.log('  ✓ Created sample conversation with messages');
    }

    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

/**
 * 清理种子数据
 */
export async function clearSeedData() {
  console.log('🧹 Clearing seed data...');
  await resetDb();
  console.log('✅ Seed data cleared!');
}

// 如果直接运行此文件，执行种子
if (require.main === module) {
  seed({ reset: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
