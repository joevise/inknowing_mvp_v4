/**
 * 环境配置管理服务
 * 用于读写 .env.local 文件
 */

import fs from 'fs';
import path from 'path';

const ENV_FILE_PATH = path.join(process.cwd(), '.env.local');

interface EnvConfig {
  [key: string]: string;
}

/**
 * 读取 .env.local 文件
 */
export function readEnvFile(): EnvConfig {
  try {
    if (!fs.existsSync(ENV_FILE_PATH)) {
      return {};
    }

    const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
    const config: EnvConfig = {};

    // 解析环境变量
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();

      // 跳过空行和注释
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // 解析 KEY=VALUE
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        const value = trimmedLine.substring(equalIndex + 1).trim();
        config[key] = value;
      }
    }

    return config;
  } catch (error) {
    console.error('[EnvConfig] Error reading .env.local:', error);
    return {};
  }
}

/**
 * 写入 .env.local 文件
 */
export function writeEnvFile(config: EnvConfig): boolean {
  try {
    // 读取现有配置和注释
    let existingContent = '';
    let existingComments: string[] = [];

    if (fs.existsSync(ENV_FILE_PATH)) {
      existingContent = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
      const lines = existingContent.split('\n');

      // 保留注释行
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#')) {
          existingComments.push(line);
        }
      }
    }

    // 构建新的配置内容
    const lines: string[] = [];

    // 添加文件头注释
    lines.push('# InKnowing 环境配置');
    lines.push('# 此文件由系统自动生成和更新');
    lines.push('# 最后更新: ' + new Date().toISOString());
    lines.push('');

    // 添加配置项(按类别分组)

    // 管理员配置
    if (config.ADMIN_PASSWORD) {
      lines.push('# 管理员配置');
      lines.push(`ADMIN_PASSWORD=${config.ADMIN_PASSWORD}`);
      lines.push('');
    }

    // 通义千问配置
    lines.push('# 通义千问配置');
    if (config.QWEN_API_KEY) {
      lines.push(`QWEN_API_KEY=${config.QWEN_API_KEY}`);
    }
    if (config.QWEN_MODEL) {
      lines.push(`QWEN_MODEL=${config.QWEN_MODEL}`);
    }
    if (config.QWEN_BASE_URL) {
      lines.push(`QWEN_BASE_URL=${config.QWEN_BASE_URL}`);
    }
    lines.push('');

    // 向量化配置
    lines.push('# 向量化配置');
    if (config.QWEN_EMBEDDING_MODEL) {
      lines.push(`QWEN_EMBEDDING_MODEL=${config.QWEN_EMBEDDING_MODEL}`);
    }
    if (config.CHROMADB_URL) {
      lines.push(`CHROMADB_URL=${config.CHROMADB_URL}`);
    }
    lines.push('');

    // OpenAI兼容配置
    if (config.OPENAI_API_KEY || config.OPENAI_BASE_URL) {
      lines.push('# OpenAI兼容配置 (可选)');
      if (config.OPENAI_BASE_URL) {
        lines.push(`OPENAI_BASE_URL=${config.OPENAI_BASE_URL}`);
      }
      if (config.OPENAI_API_KEY) {
        lines.push(`OPENAI_API_KEY=${config.OPENAI_API_KEY}`);
      }
      lines.push('');
    }

    // 其他未分类的配置
    const handledKeys = new Set([
      'ADMIN_PASSWORD',
      'QWEN_API_KEY',
      'QWEN_MODEL',
      'QWEN_BASE_URL',
      'QWEN_EMBEDDING_MODEL',
      'CHROMADB_URL',
      'OPENAI_API_KEY',
      'OPENAI_BASE_URL'
    ]);

    const otherKeys = Object.keys(config).filter(key => !handledKeys.has(key));
    if (otherKeys.length > 0) {
      lines.push('# 其他配置');
      for (const key of otherKeys) {
        lines.push(`${key}=${config[key]}`);
      }
      lines.push('');
    }

    // 写入文件
    const newContent = lines.join('\n');
    fs.writeFileSync(ENV_FILE_PATH, newContent, 'utf-8');

    console.log('[EnvConfig] Successfully wrote .env.local');
    return true;
  } catch (error) {
    console.error('[EnvConfig] Error writing .env.local:', error);
    return false;
  }
}

/**
 * 更新特定的环境变量
 */
export function updateEnvVars(updates: EnvConfig): boolean {
  try {
    // 读取现有配置
    const existingConfig = readEnvFile();

    // 合并更新
    const newConfig = { ...existingConfig, ...updates };

    // 写入文件
    return writeEnvFile(newConfig);
  } catch (error) {
    console.error('[EnvConfig] Error updating env vars:', error);
    return false;
  }
}

/**
 * 删除特定的环境变量
 */
export function deleteEnvVars(keys: string[]): boolean {
  try {
    const existingConfig = readEnvFile();

    // 删除指定的键
    for (const key of keys) {
      delete existingConfig[key];
    }

    return writeEnvFile(existingConfig);
  } catch (error) {
    console.error('[EnvConfig] Error deleting env vars:', error);
    return false;
  }
}

/**
 * 备份当前配置
 */
export function backupEnvFile(): string | null {
  try {
    if (!fs.existsSync(ENV_FILE_PATH)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(process.cwd(), `.env.local.backup.${timestamp}`);

    fs.copyFileSync(ENV_FILE_PATH, backupPath);
    console.log('[EnvConfig] Backup created:', backupPath);

    return backupPath;
  } catch (error) {
    console.error('[EnvConfig] Error creating backup:', error);
    return null;
  }
}
