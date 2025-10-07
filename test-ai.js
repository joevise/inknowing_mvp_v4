/**
 * AI功能测试脚本
 * 用于验证所有AI模块是否正常工作
 */

const API_BASE = 'http://localhost:3000/api/ai/test';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAPI(testName, method = 'POST', data = null) {
  log(`\n测试: ${testName}`, 'cyan');
  log('─'.repeat(50));

  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(API_BASE, options);
    const result = await response.json();

    if (result.success) {
      log('✓ 测试通过', 'green');
      console.log('响应:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
      return true;
    } else {
      log('✗ 测试失败', 'red');
      console.log('错误:', result.error);
      return false;
    }
  } catch (error) {
    log('✗ 请求失败', 'red');
    console.log('错误:', error.message);
    return false;
  }
}

async function testStreamAPI() {
  log('\n测试: 流式对话', 'cyan');
  log('─'.repeat(50));

  try {
    const response = await fetch(API_BASE, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: '用50字介绍一下《红楼梦》'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    log('流式响应:', 'yellow');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            log('\n✓ 流式测试完成', 'green');
          } else {
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                process.stdout.write(parsed.content);
                fullContent += parsed.content;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    console.log('\n完整内容长度:', fullContent.length);
    return true;
  } catch (error) {
    log('✗ 流式测试失败', 'red');
    console.log('错误:', error.message);
    return false;
  }
}

async function runAllTests() {
  log('\n' + '='.repeat(50), 'bold');
  log('AI功能测试套件', 'bold');
  log('='.repeat(50), 'bold');

  const tests = [
    // 1. 基础连接测试
    {
      name: '基础连接',
      method: 'GET'
    },

    // 2. 连接验证
    {
      name: 'AI服务连接',
      method: 'POST',
      data: { test: 'connection' }
    },

    // 3. 普通对话
    {
      name: '普通对话',
      method: 'POST',
      data: {
        test: 'chat',
        data: { content: '你好，请简单介绍一下你自己' }
      }
    },

    // 4. 文本向量化
    {
      name: '文本向量化',
      method: 'POST',
      data: {
        test: 'embedding',
        data: { text: '这是一个测试文本' }
      }
    },

    // 5. 书籍识别
    {
      name: '书籍识别 - 红楼梦',
      method: 'POST',
      data: {
        test: 'book',
        data: { title: '红楼梦' }
      }
    },

    // 6. 角色提取
    {
      name: '角色提取',
      method: 'POST',
      data: {
        test: 'character',
        data: {
          book: {
            title: '西游记',
            author: '吴承恩',
            description: '讲述孙悟空、猪八戒、沙僧保护唐僧西天取经的故事'
          }
        }
      }
    },

    // 7. 意图识别
    {
      name: '意图识别',
      method: 'POST',
      data: {
        test: 'intent',
        data: { input: '我想了解三国演义这本书' }
      }
    },

    // 8. 批量向量化
    {
      name: '批量向量化',
      method: 'POST',
      data: {
        test: 'batch-embedding',
        data: {
          texts: ['第一段文本', '第二段文本', '第三段文本']
        }
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  // 运行所有测试
  for (const test of tests) {
    const success = await testAPI(test.name, test.method, test.data);
    if (success) passed++;
    else failed++;

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 测试流式响应
  const streamSuccess = await testStreamAPI();
  if (streamSuccess) passed++;
  else failed++;

  // 完整测试套件
  log('\n运行完整测试套件...', 'yellow');
  const fullTestSuccess = await testAPI('完整测试套件', 'POST', {
    test: 'full-test'
  });
  if (fullTestSuccess) passed++;
  else failed++;

  // 总结
  log('\n' + '='.repeat(50), 'bold');
  log('测试总结', 'bold');
  log('='.repeat(50), 'bold');
  log(`总测试数: ${passed + failed}`, 'cyan');
  log(`✓ 通过: ${passed}`, 'green');
  log(`✗ 失败: ${failed}`, 'red');

  if (failed === 0) {
    log('\n🎉 所有测试通过！AI服务工作正常', 'green');
  } else {
    log('\n⚠️ 部分测试失败，请检查配置和日志', 'red');
  }
}

// 检查服务是否运行
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 主函数
async function main() {
  log('检查服务状态...', 'yellow');

  const serverRunning = await checkServer();
  if (!serverRunning) {
    log('错误: Next.js服务未运行', 'red');
    log('请先运行: npm run dev', 'yellow');
    process.exit(1);
  }

  log('服务运行正常，开始测试...', 'green');
  await runAllTests();
}

// 运行测试
main().catch(console.error);