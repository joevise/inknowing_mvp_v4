/**
 * 用户跨会话记忆 DAO 自测脚本
 * 真连 PostgreSQL，验证 CRUD 与注入逻辑。
 */

import { db } from '@/lib/db/client';
import {
  createUserMemory,
  getUserMemories,
  getTopMemoriesForInjection,
  touchMemoryAccess,
  deleteUserMemory,
  countUserMemories,
} from '@/lib/db/user-memories';
import { buildMemoryContextBlock } from '@/lib/services/user-memory-service';

const TEST_USER_ID = 'admin';
const TEST_PREFIX = 'verify-memory-test-';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`);
  }
}

async function cleanupTestMemories(): Promise<void> {
  const stmt = db().prepare(`
    DELETE FROM user_memories
    WHERE user_id = ? AND content LIKE ?
  `);
  await stmt.run(TEST_USER_ID, `${TEST_PREFIX}%`);
}

async function run(): Promise<void> {
  console.log('[verify-memory] start');

  // 清理历史测试数据
  await cleanupTestMemories();

  // 1) createUserMemory + getUserMemories
  const m1 = await createUserMemory({
    user_id: TEST_USER_ID,
    memory_type: 'preference',
    content: `${TEST_PREFIX}喜欢科幻小说`,
    importance: 0.8,
  });

  assert(m1.user_id === TEST_USER_ID, 'created memory user_id mismatch');
  assert(m1.content === `${TEST_PREFIX}喜欢科幻小说`, 'created memory content mismatch');
  assert(m1.importance === 0.8, 'created memory importance mismatch');

  const all = await getUserMemories(TEST_USER_ID, { limit: 100 });
  const found = all.find(m => m.id === m1.id);
  assert(!!found, 'getUserMemories should return created memory');

  // 2) getTopMemoriesForInjection 按 importance 排序
  const m2 = await createUserMemory({
    user_id: TEST_USER_ID,
    memory_type: 'interest',
    content: `${TEST_PREFIX}对心理学感兴趣`,
    importance: 0.95,
  });
  const m3 = await createUserMemory({
    user_id: TEST_USER_ID,
    memory_type: 'fact',
    content: `${TEST_PREFIX}住在上海`,
    importance: 0.7,
  });

  const top2 = await getTopMemoriesForInjection(TEST_USER_ID, null, 2);
  assert(top2.length === 2, 'top2 length should be 2');
  assert(top2[0].id === m2.id, 'top2[0] should be highest importance');
  assert(top2[1].id === m1.id, 'top2[1] should be second highest importance');

  // 3) touchMemoryAccess 后 access_count + 1
  const before = await getUserMemories(TEST_USER_ID, { limit: 100 });
  const beforeM1 = before.find(m => m.id === m1.id)!;
  const initialCount = beforeM1.access_count;

  await touchMemoryAccess(m1.id);

  const after = await getUserMemories(TEST_USER_ID, { limit: 100 });
  const afterM1 = after.find(m => m.id === m1.id)!;
  assert(afterM1.access_count === initialCount + 1, 'access_count should increment by 1');
  assert(afterM1.last_accessed_at !== null, 'last_accessed_at should be set');

  // 4) buildMemoryContextBlock 返回包含记忆内容的文本
  const block = await buildMemoryContextBlock(TEST_USER_ID);
  assert(block.includes('[关于这位用户你已知道的信息]'), 'block should contain header');
  assert(block.includes(m2.content), 'block should include top memory content');

  // 5) 清理测试数据
  await deleteUserMemory(m1.id);
  await deleteUserMemory(m2.id);
  await deleteUserMemory(m3.id);

  const remaining = await getUserMemories(TEST_USER_ID, { limit: 100 });
  assert(!remaining.some(m => m.content.startsWith(TEST_PREFIX)), 'test memories should be cleaned');

  const count = await countUserMemories(TEST_USER_ID);
  console.log(`[verify-memory] current memory count for ${TEST_USER_ID}: ${count}`);

  console.log('[verify-memory] all green');
  process.exit(0);
}

run().catch(error => {
  console.error('[verify-memory] failed:', error);
  process.exit(1);
});
