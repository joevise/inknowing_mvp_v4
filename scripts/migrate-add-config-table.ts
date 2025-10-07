/**
 * Migration script to add config table
 * Run: npx ts-node scripts/migrate-add-config-table.ts
 */

import { db } from '../lib/db/client';

console.log('开始迁移: 添加config表...');

try {
  const database = db();

  // Create config table
  database.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create update trigger
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS update_config_timestamp
    AFTER UPDATE ON config
    FOR EACH ROW
    BEGIN
      UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;
  `);

  // Initialize with default values from environment variables if they exist
  const defaultConfigs = [
    { key: 'QWEN_API_KEY', value: process.env.QWEN_API_KEY || '' },
    { key: 'QWEN_MODEL', value: process.env.QWEN_MODEL || 'qwen-max' },
    { key: 'QWEN_BASE_URL', value: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { key: 'QWEN_EMBEDDING_MODEL', value: process.env.QWEN_EMBEDDING_MODEL || 'text-embedding-v3' },
    { key: 'CHROMADB_URL', value: process.env.CHROMADB_URL || 'http://localhost:8000' },
    { key: 'OPENAI_BASE_URL', value: process.env.OPENAI_BASE_URL || '' },
    { key: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY || '' },
  ];

  const stmt = database.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

  for (const config of defaultConfigs) {
    if (config.value) {
      stmt.run(config.key, config.value);
      console.log(`✓ 已初始化配置: ${config.key}`);
    }
  }

  console.log('✅ 迁移完成！config表已创建并初始化');
} catch (error) {
  console.error('❌ 迁移失败:', error);
  process.exit(1);
}
