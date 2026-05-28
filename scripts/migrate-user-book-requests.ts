/**
 * Migration script to add user_book_requests table
 * Run: npx ts-node scripts/migrate-user-book-requests.ts
 */

import { db } from '../lib/db/client';

console.log('[BookRequest] 开始迁移: 添加user_book_requests表...');

try {
  const database = db();

  database.exec(`
    CREATE TABLE IF NOT EXISTS user_book_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      status TEXT CHECK (status IN ('pending', 'processing', 'created', 'wishlist', 'rejected', 'failed')) DEFAULT 'pending',
      book_id TEXT,
      ai_confidence REAL,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
    );
  `);

  console.log('[BookRequest] ✓ user_book_requests表已创建');

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_book_requests_user_id ON user_book_requests(user_id);
  `);
  console.log('[BookRequest] ✓ user_id索引已创建');

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_book_requests_status ON user_book_requests(status);
  `);
  console.log('[BookRequest] ✓ status索引已创建');

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_book_requests_book_id ON user_book_requests(book_id);
  `);
  console.log('[BookRequest] ✓ book_id索引已创建');

  database.exec(`
    CREATE TRIGGER IF NOT EXISTS update_user_book_requests_timestamp
    AFTER UPDATE ON user_book_requests
    FOR EACH ROW
    BEGIN
      UPDATE user_book_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
  console.log('[BookRequest] ✓ updated_at触发器已创建');

  console.log('[BookRequest] ✅ 迁移完成！user_book_requests表已创建');
} catch (error) {
  console.error('[BookRequest] ❌ 迁移失败:', error);
  process.exit(1);
}