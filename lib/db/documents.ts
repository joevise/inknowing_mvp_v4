/**
 * 文档表CRUD操作
 */

import { db, generateId, now, transaction } from './client';
import type { Document } from './schema';
import { statSync, existsSync } from 'fs';

export interface CreateDocumentInput {
  book_id: string;
  type: 'main' | 'supplement';
  title: string;
  file_path: string;
  file_size?: number;
  vectorized?: boolean;
}

export interface UpdateDocumentInput {
  title?: string;
  file_path?: string;
  file_size?: number;
  vectorized?: boolean;
}

/**
 * 创建新文档
 */
export function createDocument(input: CreateDocumentInput): Document {
  const id = generateId();
  const timestamp = now().toISOString();

  // 如果没有提供文件大小，尝试从文件系统获取
  let fileSize = input.file_size;
  if (fileSize === undefined && existsSync(input.file_path)) {
    try {
      const stats = statSync(input.file_path);
      fileSize = stats.size;
    } catch (error) {
      console.error('Failed to get file size:', error);
      fileSize = 0;
    }
  }

  const stmt = db().prepare(`
    INSERT INTO documents (
      id, book_id, type, title, file_path, file_size,
      vectorized, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.book_id,
    input.type,
    input.title,
    input.file_path,
    fileSize || 0,
    input.vectorized ? 1 : 0,
    timestamp,
    timestamp
  );

  return getDocumentById(id)!;
}

/**
 * 通过ID获取文档
 */
export function getDocumentById(id: string): Document | null {
  const stmt = db().prepare(`
    SELECT * FROM documents WHERE id = ?
  `);

  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    book_id: row.book_id,
    type: row.type,
    title: row.title,
    file_path: row.file_path,
    file_size: row.file_size,
    vectorized: !!row.vectorized,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 获取书籍的所有文档
 */
export function getDocumentsByBookId(bookId: string): Document[] {
  const stmt = db().prepare(`
    SELECT * FROM documents
    WHERE book_id = ?
    ORDER BY type ASC, created_at ASC
  `);

  const rows = stmt.all(bookId) as any[];

  return rows.map(row => ({
    id: row.id,
    book_id: row.book_id,
    type: row.type,
    title: row.title,
    file_path: row.file_path,
    file_size: row.file_size,
    vectorized: !!row.vectorized,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 获取书籍的主文档
 */
export function getMainDocumentByBookId(bookId: string): Document | null {
  const stmt = db().prepare(`
    SELECT * FROM documents
    WHERE book_id = ? AND type = 'main'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const row = stmt.get(bookId) as any;

  if (!row) return null;

  return {
    id: row.id,
    book_id: row.book_id,
    type: row.type,
    title: row.title,
    file_path: row.file_path,
    file_size: row.file_size,
    vectorized: !!row.vectorized,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * 获取书籍的补充文档
 */
export function getSupplementDocumentsByBookId(bookId: string): Document[] {
  const stmt = db().prepare(`
    SELECT * FROM documents
    WHERE book_id = ? AND type = 'supplement'
    ORDER BY created_at ASC
  `);

  const rows = stmt.all(bookId) as any[];

  return rows.map(row => ({
    id: row.id,
    book_id: row.book_id,
    type: row.type,
    title: row.title,
    file_path: row.file_path,
    file_size: row.file_size,
    vectorized: !!row.vectorized,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 更新文档
 */
export function updateDocument(
  id: string,
  input: UpdateDocumentInput
): Document | null {
  const document = getDocumentById(id);
  if (!document) {
    throw new Error('Document not found');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }

  if (input.file_path !== undefined) {
    updates.push('file_path = ?');
    values.push(input.file_path);

    // 更新文件大小
    if (existsSync(input.file_path)) {
      try {
        const stats = statSync(input.file_path);
        updates.push('file_size = ?');
        values.push(stats.size);
      } catch (error) {
        console.error('Failed to get file size:', error);
      }
    }
  } else if (input.file_size !== undefined) {
    updates.push('file_size = ?');
    values.push(input.file_size);
  }

  if (input.vectorized !== undefined) {
    updates.push('vectorized = ?');
    values.push(input.vectorized ? 1 : 0);
  }

  if (updates.length === 0) {
    return document;
  }

  updates.push('updated_at = ?');
  values.push(now().toISOString());
  values.push(id);

  const stmt = db().prepare(`
    UPDATE documents
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  return getDocumentById(id);
}

/**
 * 标记文档为已向量化
 */
export function markDocumentAsVectorized(id: string): boolean {
  const stmt = db().prepare(`
    UPDATE documents
    SET vectorized = 1, updated_at = ?
    WHERE id = ?
  `);

  const result = stmt.run(now().toISOString(), id);
  return result.changes > 0;
}

/**
 * 标记书籍的所有文档为已向量化
 */
export function markBookDocumentsAsVectorized(bookId: string): number {
  const stmt = db().prepare(`
    UPDATE documents
    SET vectorized = 1, updated_at = ?
    WHERE book_id = ?
  `);

  const result = stmt.run(now().toISOString(), bookId);
  return result.changes;
}

/**
 * 删除文档
 */
export function deleteDocument(id: string): boolean {
  const stmt = db().prepare(`
    DELETE FROM documents WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 删除书籍的所有文档
 */
export function deleteDocumentsByBookId(bookId: string): number {
  const stmt = db().prepare(`
    DELETE FROM documents WHERE book_id = ?
  `);

  const result = stmt.run(bookId);
  return result.changes;
}

/**
 * 获取需要向量化的文档
 */
export function getDocumentsToVectorize(): Document[] {
  const stmt = db().prepare(`
    SELECT * FROM documents
    WHERE vectorized = 0
    ORDER BY created_at ASC
  `);

  const rows = stmt.all() as any[];

  return rows.map(row => ({
    id: row.id,
    book_id: row.book_id,
    type: row.type,
    title: row.title,
    file_path: row.file_path,
    file_size: row.file_size,
    vectorized: false,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * 获取文档统计信息
 */
export function getDocumentStats(): {
  totalDocuments: number;
  mainDocuments: number;
  supplementDocuments: number;
  vectorizedDocuments: number;
  totalSize: number;
} {
  const totalStmt = db().prepare('SELECT COUNT(*) as count FROM documents');
  const totalRow = totalStmt.get() as any;

  const mainStmt = db().prepare(
    "SELECT COUNT(*) as count FROM documents WHERE type = 'main'"
  );
  const mainRow = mainStmt.get() as any;

  const supplementStmt = db().prepare(
    "SELECT COUNT(*) as count FROM documents WHERE type = 'supplement'"
  );
  const supplementRow = supplementStmt.get() as any;

  const vectorizedStmt = db().prepare(
    'SELECT COUNT(*) as count FROM documents WHERE vectorized = 1'
  );
  const vectorizedRow = vectorizedStmt.get() as any;

  const sizeStmt = db().prepare('SELECT SUM(file_size) as total FROM documents');
  const sizeRow = sizeStmt.get() as any;

  return {
    totalDocuments: totalRow.count,
    mainDocuments: mainRow.count,
    supplementDocuments: supplementRow.count,
    vectorizedDocuments: vectorizedRow.count,
    totalSize: sizeRow.total || 0,
  };
}

/**
 * 批量创建文档（用于测试）
 */
export function bulkCreateDocuments(documents: CreateDocumentInput[]): Document[] {
  return transaction(() => {
    const created: Document[] = [];

    for (const documentInput of documents) {
      const document = createDocument(documentInput);
      created.push(document);
    }

    return created;
  });
}

/**
 * 检查书籍是否有主文档
 */
export function bookHasMainDocument(bookId: string): boolean {
  const stmt = db().prepare(`
    SELECT COUNT(*) as count FROM documents
    WHERE book_id = ? AND type = 'main'
  `);

  const row = stmt.get(bookId) as any;
  return row.count > 0;
}

/**
 * 获取书籍的文档数量
 */
export function getBookDocumentCount(bookId: string): {
  main: number;
  supplement: number;
  total: number;
} {
  const mainStmt = db().prepare(`
    SELECT COUNT(*) as count FROM documents
    WHERE book_id = ? AND type = 'main'
  `);
  const mainRow = mainStmt.get(bookId) as any;

  const supplementStmt = db().prepare(`
    SELECT COUNT(*) as count FROM documents
    WHERE book_id = ? AND type = 'supplement'
  `);
  const supplementRow = supplementStmt.get(bookId) as any;

  return {
    main: mainRow.count,
    supplement: supplementRow.count,
    total: mainRow.count + supplementRow.count,
  };
}