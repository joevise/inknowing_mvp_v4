/**
 * SQLite客户端初始化和连接管理
 */

import Database from 'better-sqlite3';
import path from 'path';
import { createTablesSQL, createTriggersSQL } from './schema';

// 数据库文件路径
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'inknowing.db');

// 确保数据目录存在
import { mkdirSync } from 'fs';
import { dirname } from 'path';

try {
  mkdirSync(dirname(dbPath), { recursive: true });
} catch (error) {
  // 目录可能已存在，忽略错误
}

// 创建数据库连接（单例模式）
class DatabaseClient {
  private static instance: Database.Database | null = null;

  /**
   * 获取数据库实例
   */
  static getInstance(): Database.Database {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new Database(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
      });

      // 启用外键约束
      DatabaseClient.instance.pragma('foreign_keys = ON');

      // 设置WAL模式以提高并发性能
      DatabaseClient.instance.pragma('journal_mode = WAL');

      // 初始化数据库表
      DatabaseClient.initialize();
    }
    return DatabaseClient.instance;
  }

  /**
   * 初始化数据库表和索引
   */
  private static initialize(): void {
    const db = DatabaseClient.instance!;

    try {
      // 使用事务确保原子性
      db.exec('BEGIN');

      // 创建所有表和索引
      db.exec(createTablesSQL);

      // 创建触发器
      db.exec(createTriggersSQL);

      // 创建虚拟admin用户（用于管理员session）
      const adminCheck = db.prepare('SELECT id FROM users WHERE id = ?').get('admin');
      if (!adminCheck) {
        const timestamp = new Date().toISOString();
        db.prepare(`
          INSERT INTO users (id, email, password_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run('admin', 'admin@system', '', timestamp, timestamp);
        console.log('Virtual admin user created');
      }

      db.exec('COMMIT');

      console.log('Database tables initialized successfully');
    } catch (error) {
      db.exec('ROLLBACK');
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  static close(): void {
    if (DatabaseClient.instance) {
      DatabaseClient.instance.close();
      DatabaseClient.instance = null;
    }
  }

  /**
   * 重置数据库（危险操作，仅用于测试）
   */
  static async reset(): Promise<void> {
    const db = DatabaseClient.getInstance();

    try {
      // 先删除所有表
      const dropSQL = `
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS conversations;
        DROP TABLE IF EXISTS documents;
        DROP TABLE IF EXISTS characters;
        DROP TABLE IF EXISTS books;
        DROP TABLE IF EXISTS users;
      `;

      db.exec('BEGIN');
      db.exec(dropSQL);
      db.exec('COMMIT');

      // 重新初始化
      DatabaseClient.initialize();

      console.log('Database reset successfully');
    } catch (error) {
      db.exec('ROLLBACK');
      console.error('Failed to reset database:', error);
      throw error;
    }
  }

  /**
   * 执行事务
   */
  static transaction<T>(fn: (db: Database.Database) => T): T {
    const db = DatabaseClient.getInstance();
    return db.transaction(fn)(db);
  }

  /**
   * 准备SQL语句（用于频繁执行的查询）
   */
  static prepare(sql: string): Database.Statement {
    const db = DatabaseClient.getInstance();
    return db.prepare(sql);
  }
}

// 导出数据库客户端
export const db = () => DatabaseClient.getInstance();
export const closeDb = DatabaseClient.close;
export const resetDb = DatabaseClient.reset;
export const transaction = DatabaseClient.transaction;
export const prepare = DatabaseClient.prepare;

// 默认导出
export default DatabaseClient;

// 辅助函数：生成UUID
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 辅助函数：获取当前时间戳
export function now(): Date {
  return new Date();
}

// 辅助函数：将JSON字符串解析为对象
export function parseJson<T = any>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// 辅助函数：将对象转换为JSON字符串
export function toJson(obj: any): string | null {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}