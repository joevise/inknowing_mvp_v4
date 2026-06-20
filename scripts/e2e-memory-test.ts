/**
 * 端到端测试:注册→登录→选书→对话→记忆抽取→跨会话记忆注入
 * 全程真实 HTTP 打 PG 模式的生产 server(127.0.0.1:3100)
 */
const BASE = 'http://127.0.0.1:3100';
const ts = Date.now();
const TEST = {
  username: `e2e_${ts}`,
  email: `e2e_${ts}@test.local`,
  password: 'Test1234!abc',
};

let cookie = '';

async function call(method: string, path: string, body?: any) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0]; // 抓 token cookie
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text: text.slice(0, 300) };
}

async function main() {
  console.log('=== E2E: 注册→登录→对话→跨会话记忆 ===\n');

  // 1) 注册
  const reg = await call('POST', '/api/auth/register', TEST);
  console.log(`1) 注册 ${TEST.email} → HTTP ${reg.status}`);
  if (reg.status !== 200 && reg.status !== 201) { console.log('   响应:', reg.text); throw new Error('注册失败'); }

  // 2) 登录(注册可能已自动登录,但显式登录验证 login 路径)
  const login = await call('POST', '/api/auth/login', { email: TEST.email, password: TEST.password });
  console.log(`2) 登录 → HTTP ${login.status}  cookie=${cookie ? '已获取' : '无'}`);
  if (login.status !== 200) { console.log('   响应:', login.text); throw new Error('登录失败'); }
  const userId = login.json?.user?.id || login.json?.id;
  console.log(`   userId=${userId}`);

  // 3) 取一本书
  const books = await call('GET', '/api/books?limit=1');
  const book = books.json?.books?.[0];
  console.log(`3) 取书 → HTTP ${books.status}  book=${book?.title} (id=${book?.id})`);
  if (!book) throw new Error('无书可测');

  // 4) 创建对话(book 模式)
  const conv1 = await call('POST', '/api/conversations', { bookId: book.id, type: 'book' });
  console.log(`4) 建对话#1 → HTTP ${conv1.status}`);
  const conv1Id = conv1.json?.id || conv1.json?.conversation?.id;
  console.log(`   conv1Id=${conv1Id}`);
  if (!conv1Id) { console.log('   响应:', conv1.text); throw new Error('建对话失败'); }

  // 5) 发一条带"可记忆信息"的消息,触发 LLM + 记忆抽取
  const msg1 = '你好,我特别喜欢科幻小说,尤其是阿西莫夫的作品。我是一名程序员,平时喜欢简短直接的回答。';
  console.log(`5) 发消息#1(含可记忆信息): "${msg1.slice(0, 30)}..."`);
  const send1 = await call('POST', `/api/conversations/${conv1Id}/messages`, { content: msg1 });
  const aiReply = send1.json?.message?.assistantMessage?.content || '';
  console.log(`   → HTTP ${send1.status}  AI回复长度=${aiReply.length}  预览="${aiReply.slice(0, 40)}"`);
  if (send1.status !== 200 && send1.status !== 201) { console.log('   响应:', send1.text); throw new Error('发消息失败'); }

  // 6) 等记忆异步抽取(fire-and-forget + LLM 调用,给足时间)
  console.log('6) 等待记忆异步抽取(15s)...');
  await new Promise(r => setTimeout(r, 15000));

  // 7) 直查 PG:记忆是否写入
  const { Pool } = await import('pg');
  const pg = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const mem = await pg.query(
    `SELECT memory_type, content, importance FROM user_memories WHERE user_id=$1 ORDER BY importance DESC`,
    [userId]
  );
  console.log(`7) PG user_memories 中该用户记忆数: ${mem.rows.length}`);
  for (const m of mem.rows) {
    console.log(`   - [${m.memory_type}|${m.importance}] ${m.content}`);
  }
  const memOk = mem.rows.length > 0;

  // 8) 开新对话#2(同用户,换另一本书),验证记忆注入
  const books2 = await call('GET', '/api/books?limit=5');
  const book2 = books2.json?.books?.find((b: any) => b.id !== book.id) || book;
  const conv2 = await call('POST', '/api/conversations', { bookId: book2.id, type: 'book' });
  const conv2Id = conv2.json?.id || conv2.json?.conversation?.id;
  console.log(`8) 建对话#2(换书 ${book2.title}) → conv2Id=${conv2Id}`);

  // 9) 发消息#2,问"你还记得我喜欢什么吗",看 AI 能否引用跨会话记忆
  const msg2 = '你还记得我喜欢什么类型的书、我的职业是什么吗?';
  const send2 = await call('POST', `/api/conversations/${conv2Id}/messages`, { content: msg2 });
  const aiReply2 = send2.json?.message?.assistantMessage?.content || '';
  console.log(`9) 发消息#2"${msg2}" → HTTP ${send2.status}`);
  console.log(`   AI回复: ${aiReply2.slice(0, 200)}`);
  // 判断 AI 回复是否体现了记忆(提到科幻/程序员/阿西莫夫之一)
  const recalled = /科幻|程序员|阿西莫夫|简短/.test(aiReply2);
  console.log(`   → 跨会话记忆${recalled ? '✅命中(AI回复引用了上轮记忆)' : '⚠️未明显命中(需人工看上面回复)'}`);

  await pg.end();
  return { userId, conv1Id, conv2Id, memCount: mem.rows.length, memOk, recalled };
}

main().then(r => {
  console.log('\n=== E2E 完成 ===');
  console.log(JSON.stringify(r));
  console.log(r.memOk ? 'E2E_MEMORY_WRITTEN_OK' : 'E2E_MEMORY_EMPTY_FAIL');
  console.log(r.recalled ? 'E2E_RECALL_OK' : 'E2E_RECALL_UNCLEAR');
}).catch(e => {
  console.error('\nE2E 失败:', e.message);
  process.exit(1);
});
