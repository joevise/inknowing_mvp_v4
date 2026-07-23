/**
 * 轻量级内存 Rate Limiter
 * 基于 Map + 固定窗口（每次请求检查并重置过期窗口）
 *
 * 适用场景：单实例部署的 API 限流
 * 注意：多实例部署需替换为 Redis 等共享存储
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * 定期清理过期条目，防止内存泄漏
 * 每 5 分钟清理一次
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * 检查是否允许请求
 * @param key 限流键（如 IP 地址或 userId）
 * @param maxRequests 窗口内最大请求数
 * @param windowMs 窗口大小（毫秒）
 * @returns { allowed: boolean; remaining: number }
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  cleanupExpired();

  const now = Date.now();
  const entry = store.get(key);

  // 没有记录或窗口已过期，创建新窗口
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // 窗口内已有记录，递增计数
  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * 重置某个 key 的限流（例如登录成功后清除失败计数）
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * 获取客户端 IP 地址
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
