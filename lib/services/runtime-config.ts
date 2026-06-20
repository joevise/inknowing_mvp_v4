/**
 * Runtime Configuration Service
 * Provides in-memory cache for configuration with immediate updates
 * No restart required when configuration changes
 */

import { db } from '../db/client';

interface ConfigCache {
  [key: string]: string;
}

class RuntimeConfigService {
  private cache: ConfigCache = {};
  private initialized = false;

  /**
   * Initialize cache from database and environment variables
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const database = db();
      const configs = (await database.prepare('SELECT key, value FROM config').all()) as Array<{ key: string; value: string }>;

      for (const config of configs) {
        this.cache[config.key] = config.value;
      }

      // Fallback to environment variables if not in database
      const envKeys = [
        'QWEN_API_KEY',
        'QWEN_MODEL',
        'QWEN_BASE_URL',
        'QWEN_EMBEDDING_MODEL',
        'CHROMADB_URL',
        'OPENAI_BASE_URL',
        'OPENAI_API_KEY',
      ];

      for (const key of envKeys) {
        if (!this.cache[key] && process.env[key]) {
          this.cache[key] = process.env[key]!;
        }
      }

      this.initialized = true;
      console.log('[RuntimeConfig] Configuration cache initialized');
    } catch (error) {
      console.error('[RuntimeConfig] Error initializing cache:', error);
      // If database fails, use environment variables
      this.cache = {
        QWEN_API_KEY: process.env.QWEN_API_KEY || '',
        QWEN_MODEL: process.env.QWEN_MODEL || 'qwen-max',
        QWEN_BASE_URL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        QWEN_EMBEDDING_MODEL: process.env.QWEN_EMBEDDING_MODEL || 'text-embedding-v3',
        CHROMADB_URL: process.env.CHROMADB_URL || 'http://localhost:8000',
        OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      };
      this.initialized = true;
    }
  }

  /**
   * Get configuration value
   */
  async get(key: string): Promise<string | undefined> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.cache[key];
  }

  /**
   * Get all configuration
   */
  async getAll(): Promise<ConfigCache> {
    if (!this.initialized) {
      await this.initialize();
    }
    return { ...this.cache };
  }

  /**
   * Set configuration value (updates both cache and database)
   */
  async set(key: string, value: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const database = db();
      await database.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);

      // Update cache immediately
      this.cache[key] = value;

      console.log(`[RuntimeConfig] Configuration updated: ${key}`);
      return true;
    } catch (error) {
      console.error(`[RuntimeConfig] Error setting config ${key}:`, error);
      return false;
    }
  }

  /**
   * Set multiple configuration values
   */
  async setMany(configs: Record<string, string>): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const database = db();
      const stmt = database.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

      for (const [key, value] of Object.entries(configs)) {
        await stmt.run(key, value);
        // Update cache immediately
        this.cache[key] = value;
      }

      console.log(`[RuntimeConfig] Multiple configurations updated:`, Object.keys(configs));
      return true;
    } catch (error) {
      console.error('[RuntimeConfig] Error setting multiple configs:', error);
      return false;
    }
  }

  /**
   * Reload configuration from database
   */
  async reload(): Promise<void> {
    this.initialized = false;
    await this.initialize();
    console.log('[RuntimeConfig] Configuration reloaded from database');
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.cache = {};
    this.initialized = false;
  }
}

// Singleton instance
const runtimeConfig = new RuntimeConfigService();

export default runtimeConfig;

// Convenience methods
export async function getConfig(key: string): Promise<string | undefined> {
  return await runtimeConfig.get(key);
}

export async function getAllConfig(): Promise<ConfigCache> {
  return await runtimeConfig.getAll();
}

export async function setConfig(key: string, value: string): Promise<boolean> {
  return await runtimeConfig.set(key, value);
}

export async function setManyConfig(configs: Record<string, string>): Promise<boolean> {
  return await runtimeConfig.setMany(configs);
}

export async function reloadConfig(): Promise<void> {
  await runtimeConfig.reload();
}
