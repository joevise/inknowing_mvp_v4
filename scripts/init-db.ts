#!/usr/bin/env tsx
/**
 * 数据库初始化脚本
 * 用法:
 *   npm run db:init          - 初始化数据库
 *   npm run db:init -- --seed - 初始化并添加种子数据
 *   npm run db:init -- --reset - 重置数据库（删除所有数据）
 */

import { db, closeDb, resetDb } from '../lib/db/client';
import { seed } from '../lib/db/seed';
import {
  getUserStats,
  getBookStats,
  getCharacterStats,
  getDocumentStats,
  getConversationStats,
  getMessageStats,
  getSessionStats
} from '../lib/db';

// 解析命令行参数
const args = process.argv.slice(2);
const shouldSeed = args.includes('--seed');
const shouldReset = args.includes('--reset');
const showStats = args.includes('--stats');

/**
 * 显示数据库统计信息
 */
async function displayStats() {
  console.log('\n📊 Database Statistics:');
  console.log('=' . repeat(50));

  try {
    // 用户统计
    const userStats = await getUserStats();
    console.log('\n👤 Users:');
    console.log(`  Total users: ${userStats.totalUsers}`);
    console.log(`  Today's registrations: ${userStats.todayRegistrations}`);
    console.log(`  Active users: ${userStats.activeUsers}`);

    // 书籍统计
    const bookStats = await getBookStats();
    console.log('\n📚 Books:');
    console.log(`  Total books: ${bookStats.totalBooks}`);
    console.log(`  Published: ${bookStats.publishedBooks}`);
    console.log(`  Drafts: ${bookStats.draftBooks}`);
    if (Object.keys(bookStats.categoryCounts).length > 0) {
      console.log('  Categories:');
      for (const [category, count] of Object.entries(bookStats.categoryCounts)) {
        console.log(`    ${category}: ${count}`);
      }
    }

    // 角色统计
    const charStats = await getCharacterStats();
    console.log('\n🎭 Characters:');
    console.log(`  Total characters: ${charStats.totalCharacters}`);
    console.log(`  Average per book: ${charStats.averagePerBook}`);
    if (charStats.mostPopular.length > 0) {
      console.log('  Most popular:');
      for (const char of charStats.mostPopular.slice(0, 3)) {
        console.log(`    ${char.name} (${char.book_title}): ${char.conversations} conversations`);
      }
    }

    // 文档统计
    const docStats = await getDocumentStats();
    console.log('\n📄 Documents:');
    console.log(`  Total documents: ${docStats.totalDocuments}`);
    console.log(`  Main documents: ${docStats.mainDocuments}`);
    console.log(`  Supplement documents: ${docStats.supplementDocuments}`);
    console.log(`  Vectorized: ${docStats.vectorizedDocuments}`);
    console.log(`  Total size: ${(docStats.totalSize / 1024 / 1024).toFixed(2)} MB`);

    // 对话统计
    const convStats = await getConversationStats();
    console.log('\n💬 Conversations:');
    console.log(`  Total conversations: ${convStats.totalConversations}`);
    console.log(`  Book conversations: ${convStats.bookConversations}`);
    console.log(`  Character conversations: ${convStats.characterConversations}`);
    console.log(`  Active today: ${convStats.activeToday}`);
    console.log(`  Average messages: ${convStats.averageMessages}`);

    // 消息统计
    const msgStats = await getMessageStats();
    console.log('\n✉️  Messages:');
    console.log(`  Total messages: ${msgStats.totalMessages}`);
    console.log(`  User messages: ${msgStats.userMessages}`);
    console.log(`  Assistant messages: ${msgStats.assistantMessages}`);
    console.log(`  Average length: ${msgStats.averageLength} characters`);
    console.log(`  RAG-enhanced: ${msgStats.ragMessages}`);

    // 会话统计
    const sessionStats = await getSessionStats();
    console.log('\n🔐 Sessions:');
    console.log(`  Total sessions: ${sessionStats.totalSessions}`);
    console.log(`  Active sessions: ${sessionStats.activeSessions}`);
    console.log(`  Expired sessions: ${sessionStats.expiredSessions}`);
    console.log(`  Unique users: ${sessionStats.uniqueUsers}`);

    console.log('\n' + '=' . repeat(50));
  } catch (error) {
    console.error('Error fetching statistics:', error);
  }
}

/**
 * 测试数据库连接
 */
async function testConnection() {
  console.log('🔍 Testing database connection...');

  try {
    const database = db();
    const result = await database.prepare('SELECT 1 as test').get() as any;

    if (result && result.test === 1) {
      console.log('✅ Database connection successful!');
      return true;
    } else {
      console.error('❌ Database connection test failed: unexpected result');
      return false;
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * 验证表结构
 */
async function verifyTables() {
  console.log('\n🔍 Verifying table structure...');

  const expectedTables = [
    'users',
    'books',
    'characters',
    'documents',
    'conversations',
    'messages',
    'sessions'
  ];

  try {
    const database = db();

    for (const tableName of expectedTables) {
      const result = await database.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
      `).get(tableName) as any;

      if (result) {
        console.log(`  ✓ Table '${tableName}' exists`);
      } else {
        console.error(`  ✗ Table '${tableName}' not found`);
        return false;
      }
    }

    console.log('✅ All tables verified successfully!');
    return true;
  } catch (error) {
    console.error('❌ Table verification failed:', error);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 InKnowing Database Initialization');
  console.log('=' . repeat(50));

  try {
    // 重置数据库（如果需要）
    if (shouldReset) {
      console.log('\n⚠️  RESETTING DATABASE - All data will be lost!');
      await resetDb();
      console.log('✅ Database reset completed');
    }

    // 测试连接
    if (!await testConnection()) {
      process.exit(1);
    }

    // 验证表结构
    if (!await verifyTables()) {
      console.log('\n🔨 Creating database tables...');
      // 表会在第一次访问时自动创建
      db();

      // 再次验证
      if (!await verifyTables()) {
        console.error('❌ Failed to create tables');
        process.exit(1);
      }
    }

    // 添加种子数据（如果需要）
    if (shouldSeed) {
      console.log('\n🌱 Adding seed data...');
      await seed({ reset: false });
    }

    // 显示统计信息
    if (showStats || shouldSeed) {
      await displayStats();
    }

    console.log('\n✅ Database initialization completed successfully!');
    console.log('\nYou can now:');
    console.log('  - Run the application: npm run dev');
    console.log('  - View stats: npm run db:init -- --stats');
    console.log('  - Add seed data: npm run db:init -- --seed');
    console.log('  - Reset database: npm run db:init -- --reset');

  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await closeDb();
  }
}

// 运行主函数
main().catch(console.error);
