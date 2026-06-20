/**
 * 承重墙验证:直接打 PG 容器,验证 client.ts 适配层 + schema 引导 + 事务。
 * 用 tsx 运行。成功标准:建表→插入→查询→事务回滚 全部符合预期。
 */
import { db, transaction, generateId, closeDb, resetDb } from '../lib/db/client';

async function main() {
  console.log('== 1. reset + bootstrap schema ==');
  await resetDb();

  console.log('== 2. 验证所有表存在 ==');
  const tables = await db()
    .prepare(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    )
    .all<{ table_name: string }>();
  const names = tables.map((t) => t.table_name);
  console.log('   tables:', names.join(', '));
  const expect = [
    'books', 'characters', 'config', 'conversations', 'documents',
    'favorites', 'messages', 'sessions', 'user_book_requests',
    'user_memories', 'users',
  ];
  const missing = expect.filter((t) => !names.includes(t));
  if (missing.length) throw new Error('缺表: ' + missing.join(','));
  console.log('   ✓ 11 张表齐全(含 user_memories)');

  console.log('== 3. admin 虚拟用户存在 ==');
  const admin = await db().prepare('SELECT id FROM users WHERE id = ?').get('admin');
  if (!admin) throw new Error('admin 用户缺失');
  console.log('   ✓ admin ok');

  console.log('== 4. 占位符 ?->$N + run().changes ==');
  const uid = generateId();
  const ts = new Date().toISOString();
  const ins = await db()
    .prepare(
      `INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(uid, 'tester', `t_${uid}@x.com`, 'h', ts, ts);
  if (ins.changes !== 1) throw new Error('changes 应为1, got ' + ins.changes);
  const got = await db().prepare('SELECT username FROM users WHERE id = ?').get<{ username: string }>(uid);
  if (got?.username !== 'tester') throw new Error('回读失败');
  console.log('   ✓ insert changes=1, 回读 username=tester');

  console.log('== 5. updated_at 触发器 ==');
  const before = await db().prepare('SELECT updated_at FROM users WHERE id = ?').get<{ updated_at: Date }>(uid);
  await new Promise((r) => setTimeout(r, 50));
  await db().prepare('UPDATE users SET username = ? WHERE id = ?').run('tester2', uid);
  const after = await db().prepare('SELECT updated_at FROM users WHERE id = ?').get<{ updated_at: Date }>(uid);
  if (!(new Date(after!.updated_at) > new Date(before!.updated_at)))
    throw new Error('updated_at 触发器未生效');
  console.log('   ✓ updated_at 自动刷新');

  console.log('== 6. 事务提交 + 回滚 ==');
  const mid = generateId();
  await transaction(async (tx) => {
    await tx.prepare(
      `INSERT INTO user_memories (id, user_id, memory_type, content) VALUES (?, ?, ?, ?)`
    ).run(mid, uid, 'fact', '用户喜欢科幻');
  });
  const m = await db().prepare('SELECT content FROM user_memories WHERE id = ?').get<{ content: string }>(mid);
  if (m?.content !== '用户喜欢科幻') throw new Error('事务提交未持久化');
  console.log('   ✓ 事务提交持久化');

  const rbId = generateId();
  try {
    await transaction(async (tx) => {
      await tx.prepare(
        `INSERT INTO user_memories (id, user_id, memory_type, content) VALUES (?, ?, ?, ?)`
      ).run(rbId, uid, 'fact', '应被回滚');
      throw new Error('故意失败触发回滚');
    });
  } catch {
    /* expected */
  }
  const rb = await db().prepare('SELECT id FROM user_memories WHERE id = ?').get(rbId);
  if (rb) throw new Error('回滚失败:脏数据残留');
  console.log('   ✓ 事务回滚干净');

  console.log('== 7. 清理 ==');
  await db().prepare('DELETE FROM users WHERE id = ?').run(uid);

  console.log('\n✅✅ 承重墙全部验证通过 — 适配层可承载数据层迁移');
  await closeDb();
}

main().catch((e) => {
  console.error('\n❌ 验证失败:', e);
  process.exit(1);
});
