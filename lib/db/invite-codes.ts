/**
 * 邀请码 CRUD
 * 生产前白名单注册使用。管理员在后台生成,发给受邀用户。
 *
 * 码字符集:
 *   - 大写字母 + 数字
 *   - 排除易混淆字符: 0/O/I/L/1(便于人工誊写与肉眼辨识)
 */

import { db, generateId, now, transaction } from './client';
import type { InviteCode } from './schema';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/**
 * 生成 8 位随机码(剔除 0/O/I/L/1)
 */
function generateRandomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return out;
}

/**
 * 生成不与已存在码冲突的邀请码
 * 极端情况下重试(冲突概率 1 / 32^8 ≈ 1.6e-13,可忽略不计,加一层保险)
 */
async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRandomCode();
    const existing = await db()
      .prepare('SELECT 1 FROM invite_codes WHERE code = ? LIMIT 1')
      .get(candidate);
    if (!existing) return candidate;
  }
  // 极端兜底:加时间戳后缀再 hash
  return generateRandomCode() + Date.now().toString(36).slice(-2).toUpperCase();
}

function parseRow(row: any): InviteCode {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    created_at: new Date(row.created_at),
    used_by: row.used_by ?? null,
    used_at: row.used_at ? new Date(row.used_at) : null,
    note: row.note ?? null,
  };
}

/**
 * 创建一条邀请码
 */
export async function createInviteCode(note?: string): Promise<InviteCode> {
  const id = generateId();
  const code = await generateUniqueCode();
  const ts = now().toISOString();

  await db()
    .prepare(
      `INSERT INTO invite_codes (id, code, status, created_at, note)
       VALUES (?, ?, 'active', ?, ?)`
    )
    .run(id, code, ts, note ?? null);

  const created = await getInviteCodeById(id);
  if (!created) {
    throw new Error('Failed to create invite code');
  }
  return created;
}

/**
 * 通过 ID 获取
 */
export async function getInviteCodeById(id: string): Promise<InviteCode | null> {
  const row = await db()
    .prepare('SELECT * FROM invite_codes WHERE id = ?')
    .get(id) as any;
  if (!row) return null;
  return parseRow(row);
}

/**
 * 通过 code 获取
 */
export async function getInviteCodeByCode(code: string): Promise<InviteCode | null> {
  const row = await db()
    .prepare('SELECT * FROM invite_codes WHERE code = ?')
    .get(code) as any;
  if (!row) return null;
  return parseRow(row);
}

/**
 * 全量列表(后台用)
 * 按创建时间倒序
 */
export async function listInviteCodes(): Promise<InviteCode[]> {
  const rows = await db()
    .prepare('SELECT * FROM invite_codes ORDER BY created_at DESC')
    .all() as any[];
  return rows.map(parseRow);
}

/**
 * 按状态过滤列表(后台导出/筛选用)
 * status = 'all' 时退化为全量列表
 */
export async function listInviteCodesByStatus(
  status: 'all' | InviteCode['status']
): Promise<InviteCode[]> {
  if (status === 'all') return listInviteCodes();
  const rows = await db()
    .prepare(
      'SELECT * FROM invite_codes WHERE status = ? ORDER BY created_at DESC'
    )
    .all(status) as any[];
  return rows.map(parseRow);
}

/**
 * 批量生成邀请码
 * - count 上限 200,超过抛错
 * - 每个码的 note = `${notePrefix}-${序号}`,序号从 1 开始 padStart 2 位(01, 02, ... 99;超出自然扩展为 3 位)
 */
export async function batchCreateInviteCodes(
  count: number,
  notePrefix: string
): Promise<InviteCode[]> {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count 必须为正整数');
  }
  if (count > 200) {
    throw new Error('单次批量最多生成 200 个邀请码');
  }
  const prefix = (notePrefix ?? '').trim().slice(0, 200);
  const codes: InviteCode[] = [];
  for (let i = 1; i <= count; i++) {
    const note = `${prefix}-${String(i).padStart(2, '0')}`;
    const c = await createInviteCode(note);
    codes.push(c);
  }
  return codes;
}

/**
 * 删除邀请码
 */
export async function deleteInviteCode(id: string): Promise<boolean> {
  const r = await db().prepare('DELETE FROM invite_codes WHERE id = ?').run(id);
  return r.changes > 0;
}

/**
 * 停用邀请码(active -> disabled)
 * 若已被使用则跳过
 */
export async function disableInviteCode(id: string): Promise<InviteCode | null> {
  const existing = await getInviteCodeById(id);
  if (!existing) return null;
  if (existing.status !== 'active') return existing;

  await db()
    .prepare("UPDATE invite_codes SET status = 'disabled' WHERE id = ?")
    .run(id);

  return (await getInviteCodeById(id))!;
}

/**
 * 校验邀请码是否可用(存在 + active)
 * 返回记录或 null
 */
export async function validateInviteCode(code: string): Promise<InviteCode | null> {
  if (!code || typeof code !== 'string') return null;
  const normalized = code.trim().toUpperCase();
  const record = await getInviteCodeByCode(normalized);
  if (!record) return null;
  if (record.status !== 'active') return null;
  return record;
}

/**
 * 标记邀请码为已使用(在用户创建成功之后调用)
 * 通过 status='active' 条件防止并发下重复标记
 */
export async function markInviteCodeUsed(
  code: string,
  userId: string
): Promise<boolean> {
  const ts = now().toISOString();
  const r = await db()
    .prepare(
      `UPDATE invite_codes
         SET status = 'used',
             used_by = ?,
             used_at = ?
       WHERE code = ? AND status = 'active'`
    )
    .run(userId, ts, code.trim().toUpperCase());
  return r.changes > 0;
}

/**
 * 在事务内同时校验并标记为已使用(原子化,防并发)
 * 返回是否成功
 */
export async function consumeInviteCode(
  code: string,
  userId: string
): Promise<{ ok: boolean; reason?: 'not_found' | 'already_used' | 'disabled' }> {
  const normalized = code.trim().toUpperCase();
  return await transaction(async () => {
    const record = await getInviteCodeByCode(normalized);
    if (!record) return { ok: false, reason: 'not_found' as const };
    if (record.status === 'used') return { ok: false, reason: 'already_used' as const };
    if (record.status === 'disabled') return { ok: false, reason: 'disabled' as const };

    const ts = now().toISOString();
    await db()
      .prepare(
        `UPDATE invite_codes
            SET status = 'used',
                used_by = ?,
                used_at = ?
          WHERE id = ? AND status = 'active'`
      )
      .run(userId, ts, record.id);

    return { ok: true };
  });
}