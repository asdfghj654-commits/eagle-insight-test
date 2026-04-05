/**
 * Audit Service — Eagle Insight Local MVP
 *
 * Every meaningful state change must produce an audit entry.
 * Entries are immutable once written.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';

export interface AuditEntry {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
  approvalRequired?: boolean;
  relatedFinding?: string;
  relatedTask?: string;
  relatedRule?: string;
  timestamp: string;
}

export interface WriteAuditParams {
  actorId?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
  approvalRequired?: boolean;
  relatedFinding?: string;
  relatedTask?: string;
  relatedRule?: string;
}

export const auditService = {
  write(params: WriteAuditParams): string {
    const id = uuidv4();
    getDb().prepare(`
      INSERT INTO audit_log
        (id, actor_id, actor_role, action, entity_type, entity_id,
         old_value, new_value, note, approval_required,
         related_finding, related_task, related_rule, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      params.actorId ?? null,
      params.actorRole ?? null,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.oldValue != null ? JSON.stringify(params.oldValue) : null,
      params.newValue != null ? JSON.stringify(params.newValue) : null,
      params.note ?? null,
      params.approvalRequired ? 1 : 0,
      params.relatedFinding ?? null,
      params.relatedTask ?? null,
      params.relatedRule ?? null,
    );
    return id;
  },

  query(opts: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    relatedFinding?: string;
    limit?: number;
    offset?: number;
  }): AuditEntry[] {
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (opts.entityType) { conditions.push('entity_type = ?'); bindings.push(opts.entityType); }
    if (opts.entityId)   { conditions.push('entity_id = ?');   bindings.push(opts.entityId); }
    if (opts.actorId)    { conditions.push('actor_id = ?');     bindings.push(opts.actorId); }
    if (opts.relatedFinding) {
      conditions.push('related_finding = ?');
      bindings.push(opts.relatedFinding);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;

    const rows = getDb().prepare(
      `SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    ).all(...bindings, limit, offset) as any[];

    return rows.map(rowToEntry);
  },

  getAll(limit = 200, offset = 0): AuditEntry[] {
    const rows = getDb().prepare(
      'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    ).all(limit, offset) as any[];
    return rows.map(rowToEntry);
  },
};

function rowToEntry(row: any): AuditEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldValue: row.old_value ? JSON.parse(row.old_value) : undefined,
    newValue: row.new_value ? JSON.parse(row.new_value) : undefined,
    note: row.note,
    approvalRequired: row.approval_required === 1,
    relatedFinding: row.related_finding,
    relatedTask: row.related_task,
    relatedRule: row.related_rule,
    timestamp: row.timestamp,
  };
}
