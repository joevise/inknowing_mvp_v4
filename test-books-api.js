/**
 * 书籍管理系统API测试脚本
 * 测试Phase 5的所有功能
 */

const API_BASE = 'http://localhost:3000/api';

// 管理员session（需要先登录）
let adminSession = '';

/**
 * 测试管理员登录
 */
async function testAdminLogin() {
  console.log('\n=== 测试管理员登录 ===');

  const response = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: process.env.ADMIN_PASSWORD || 'admin123'
    })
  });

  const data = await response.json();

  if (response.ok) {
    adminSession = data.admin_session;
    console.log('✅ 管理员登录成功');
    console.log('Session:', adminSession);
  } else {
    console.error('❌ 管理员登录失败:', data);
  }
}

/**
 * 测试AI识别书籍
 */
async function testRecognizeBook(bookTitle = '三体') {
  console.log(`\n=== 测试AI识别书籍: ${bookTitle} ===`);

  const response = await fetch(`${API_BASE}/admin/books/recognize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_session=${adminSession}`
    },
    body: JSON.stringify({ title: bookTitle })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 书籍识别成功:');
    console.log('- 书名:', data.book_info.title);
    console.log('- 作者:', data.book_info.author);
    console.log('- 分类:', data.book_info.category);
    console.log('- AI了解程度:', data.ai_score);
    console.log('- 需要文档:', data.requires_document ? '是' : '否');
    console.log('- 标签:', data.book_info.tags.join(', '));
    return data;
  } else {
    console.error('❌ 书籍识别失败:', data);
    return null;
  }
}

/**
 * 测试创建书籍
 */
async function testCreateBook(bookInfo) {
  console.log('\n=== 测试创建书籍 ===');

  const response = await fetch(`${API_BASE}/admin/books`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_session=${adminSession}`
    },
    body: JSON.stringify({
      title: bookInfo?.book_info?.title || '测试书籍',
      author: bookInfo?.book_info?.author || '测试作者',
      description: bookInfo?.book_info?.description || '这是一本测试书籍',
      category: bookInfo?.book_info?.category || '文学',
      tags: bookInfo?.book_info?.tags || ['#测试'],
      ai_score: bookInfo?.ai_score || 5,
      conversation_strategy: 'hybrid'
    })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 书籍创建成功:');
    console.log('- ID:', data.id);
    console.log('- 书名:', data.title);
    console.log('- 状态:', data.status);
    return data.id;
  } else {
    console.error('❌ 书籍创建失败:', data);
    return null;
  }
}

/**
 * 测试获取书籍列表
 */
async function testGetAdminBooks() {
  console.log('\n=== 测试获取管理员书籍列表 ===');

  const response = await fetch(`${API_BASE}/admin/books`, {
    headers: {
      'Cookie': `admin_session=${adminSession}`
    }
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 获取书籍列表成功:');
    console.log('- 总数:', data.total);
    console.log('- 当前页数量:', data.books.length);
    if (data.books.length > 0) {
      console.log('- 第一本书:', data.books[0].title);
    }
  } else {
    console.error('❌ 获取书籍列表失败:', data);
  }
}

/**
 * 测试更新书籍状态
 */
async function testUpdateBookStatus(bookId) {
  console.log('\n=== 测试更新书籍状态 ===');

  if (!bookId) {
    console.log('⚠️ 没有书籍ID，跳过测试');
    return;
  }

  const response = await fetch(`${API_BASE}/admin/books/${bookId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_session=${adminSession}`
    },
    body: JSON.stringify({ status: 'online' })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 书籍状态更新成功:');
    console.log('- 新状态:', data.book.status);
  } else {
    console.error('❌ 书籍状态更新失败:', data);
  }
}

/**
 * 测试前台获取书籍列表
 */
async function testGetPublicBooks() {
  console.log('\n=== 测试前台书籍列表 ===');

  const response = await fetch(`${API_BASE}/books`);
  const data = await response.json();

  if (response.ok) {
    console.log('✅ 获取公开书籍列表成功:');
    console.log('- 总数:', data.total);
    console.log('- 当前页数量:', data.books.length);
    if (data.books.length > 0) {
      console.log('- 第一本书:', data.books[0].title);
    }
  } else {
    console.error('❌ 获取公开书籍列表失败:', data);
  }
}

/**
 * 测试书籍详情
 */
async function testGetBookDetail(bookId) {
  console.log('\n=== 测试获取书籍详情 ===');

  if (!bookId) {
    console.log('⚠️ 没有书籍ID，跳过测试');
    return;
  }

  const response = await fetch(`${API_BASE}/books/${bookId}`);
  const data = await response.json();

  if (response.ok) {
    console.log('✅ 获取书籍详情成功:');
    console.log('- 书名:', data.title);
    console.log('- 作者:', data.author);
    console.log('- 分类:', data.category);
    console.log('- 角色数量:', data.character_count);
    console.log('- 推荐书籍数量:', data.recommendations?.length || 0);
  } else {
    console.error('❌ 获取书籍详情失败:', data);
  }
}

/**
 * 测试智能搜索
 */
async function testSearch(query = '三体') {
  console.log(`\n=== 测试智能搜索: ${query} ===`);

  const response = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}`);
  const data = await response.json();

  if (response.ok) {
    console.log('✅ 搜索成功:');
    console.log('- 找到书籍:', data.total.books);
    console.log('- 找到角色:', data.total.characters);
    console.log('- 搜索建议:', data.suggestions.join(', '));
    if (data.books.length > 0) {
      console.log('- 第一本书:', data.books[0].title);
    }
  } else {
    console.error('❌ 搜索失败:', data);
  }
}

/**
 * 测试获取分类
 */
async function testGetCategories() {
  console.log('\n=== 测试获取分类 ===');

  const response = await fetch(`${API_BASE}/admin/categories`, {
    headers: {
      'Cookie': `admin_session=${adminSession}`
    }
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 获取分类成功:');
    console.log('- 分类总数:', data.total);
    data.categories.forEach(cat => {
      console.log(`  - ${cat.name}: ${cat.count}本书`);
    });
  } else {
    console.error('❌ 获取分类失败:', data);
  }
}

/**
 * 测试获取标签
 */
async function testGetTags() {
  console.log('\n=== 测试获取标签 ===');

  const response = await fetch(`${API_BASE}/admin/tags`, {
    headers: {
      'Cookie': `admin_session=${adminSession}`
    }
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 获取标签成功:');
    console.log('- 标签总数:', data.total);
    console.log('- 预设标签:', data.preset_count);
    console.log('- 自定义标签:', data.custom_count);
    if (data.tags.length > 0) {
      console.log('- 前5个标签:', data.tags.slice(0, 5).map(t => t.name).join(', '));
    }
  } else {
    console.error('❌ 获取标签失败:', data);
  }
}

/**
 * 测试创建自定义标签
 */
async function testCreateTag(tagName = '测试标签') {
  console.log(`\n=== 测试创建标签: ${tagName} ===`);

  const response = await fetch(`${API_BASE}/admin/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_session=${adminSession}`
    },
    body: JSON.stringify({ name: tagName })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 标签创建成功:');
    console.log('- 标签名:', data.tag.name);
    console.log('- 类型:', data.tag.type);
  } else {
    console.error('❌ 标签创建失败:', data);
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 开始测试书籍管理系统 API...\n');
  console.log('API基础URL:', API_BASE);

  try {
    // 1. 管理员登录
    await testAdminLogin();

    if (!adminSession) {
      console.error('\n❌ 管理员登录失败，无法继续测试');
      return;
    }

    // 2. AI识别书籍
    const recognizedBook = await testRecognizeBook('三体');

    // 3. 创建书籍
    let bookId = await testCreateBook(recognizedBook);

    // 4. 获取管理员书籍列表
    await testGetAdminBooks();

    // 5. 更新书籍状态（上架）
    await testUpdateBookStatus(bookId);

    // 6. 前台获取书籍列表
    await testGetPublicBooks();

    // 7. 获取书籍详情
    await testGetBookDetail(bookId);

    // 8. 智能搜索
    await testSearch('三体');

    // 9. 获取分类
    await testGetCategories();

    // 10. 获取标签
    await testGetTags();

    // 11. 创建自定义标签
    await testCreateTag('#科幻经典');

    console.log('\n✅ 所有测试完成！');
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
runAllTests();