import { db, generateId, now } from './client';
import type { CopyrightReport } from './schema';

export type CopyrightReportStatus = CopyrightReport['status'];

export interface CreateCopyrightReportInput {
  work_title: string;
  rights_holder?: string | null;
  contact_info: string;
  proof_description: string;
  infringing_content: string;
}

function parseRow(row: any): CopyrightReport {
  return {
    id: row.id,
    work_title: row.work_title,
    rights_holder: row.rights_holder ?? null,
    contact_info: row.contact_info,
    proof_description: row.proof_description,
    infringing_content: row.infringing_content,
    status: row.status,
    admin_note: row.admin_note ?? null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export async function createCopyrightReport(input: CreateCopyrightReportInput): Promise<CopyrightReport> {
  const id = generateId();
  const ts = now().toISOString();

  await db()
    .prepare(
      `INSERT INTO copyright_reports (
        id,
        work_title,
        rights_holder,
        contact_info,
        proof_description,
        infringing_content,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    )
    .run(
      id,
      input.work_title,
      input.rights_holder?.trim() || null,
      input.contact_info,
      input.proof_description,
      input.infringing_content,
      ts,
      ts
    );

  const created = await getCopyrightReportById(id);
  if (!created) {
    throw new Error('Failed to create copyright report');
  }
  return created;
}

export async function listCopyrightReports(): Promise<CopyrightReport[]> {
  const rows = await db()
    .prepare('SELECT * FROM copyright_reports ORDER BY created_at DESC')
    .all() as any[];
  return rows.map(parseRow);
}

export async function getCopyrightReportById(id: string): Promise<CopyrightReport | null> {
  const row = await db()
    .prepare('SELECT * FROM copyright_reports WHERE id = ?')
    .get(id) as any;
  if (!row) return null;
  return parseRow(row);
}

export async function updateCopyrightReportStatus(
  id: string,
  status: CopyrightReportStatus,
  adminNote?: string | null
): Promise<CopyrightReport | null> {
  const ts = now().toISOString();

  if (adminNote !== undefined) {
    await db()
      .prepare(
        `UPDATE copyright_reports
            SET status = ?, admin_note = ?, updated_at = ?
          WHERE id = ?`
      )
      .run(status, adminNote?.trim() || null, ts, id);
  } else {
    await db()
      .prepare(
        `UPDATE copyright_reports
            SET status = ?, updated_at = ?
          WHERE id = ?`
      )
      .run(status, ts, id);
  }

  return getCopyrightReportById(id);
}
