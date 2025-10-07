/**
 * 密码处理模块
 * 负责密码的加密和验证
 * 使用bcrypt进行密码哈希
 */

import bcrypt from 'bcryptjs';

/**
 * 密码加密
 * @param password 原始密码
 * @returns 加密后的密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  // 使用10轮salt加密，这是一个安全性和性能的平衡点
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  console.log('[Password] Password hashed successfully');
  return hashedPassword;
}

/**
 * 密码验证
 * @param password 原始密码
 * @param hashedPassword 存储的密码哈希
 * @returns 密码是否匹配
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    console.log('[Password] Password verification:', isMatch ? 'success' : 'failed');
    return isMatch;
  } catch (error) {
    console.error('[Password] Error verifying password:', error);
    return false;
  }
}

/**
 * 验证密码强度
 * @param password 待验证的密码
 * @returns 密码是否符合要求
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (!password) {
    return { valid: false, message: '密码不能为空' };
  }

  if (password.length < 6) {
    return { valid: false, message: '密码至少需要6个字符' };
  }

  // MVP阶段，只需要基本的长度检查
  // 后续可以添加更多规则：大小写、数字、特殊字符等

  return { valid: true };
}