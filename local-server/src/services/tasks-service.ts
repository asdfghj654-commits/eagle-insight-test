/**
 * Tasks Service — Eagle Insight Local MVP
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { auditService } from './audit-service';
import { findingsService } from './findings-service';

export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'deferred' | 'rejected';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskOutcomeType = 'fixed' | 'replaced' | 'nff' | 'deferred' | 'rejected';

export interface Task {
  id: string;
  title: string;
  findingId?: string;
  assignedTo?: string;
  assignedRole?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  notes?: string;
  outcome?: string;
  outcomeType?: TaskOutcomeType;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskParams {
  title: string;
  findingId?: string;
  assignedTo?: string;
  assignedRole?: string;
  priority?: TaskPriority;
  dueDate?: string;
  notes?: string;
  createdBy?: string;
}

export const tasksService = {
  create(params: CreateTaskParams, actorId?: string, actorRole?: string): Task {
    const id = uuidv4();
    const now = new Date().toISOString();

    getDb().prepare(`
      INSERT INTO tasks
        (id, title, finding_id, assigned_to, assigned_role, priority,
         status, due_date, notes, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
    `).run(
      id,
      params.title,
      params.findingId ?? null,
      params.assignedTo ?? null,
      params.assignedRole ?? null,
      params.priority ?? 'medium',
      params.dueDate ?? null,
      params.notes ?? null,
      params.createdBy ?? actorId ?? null,
      now,
      now,
    );

    // Link task to finding
    if (params.findingId) {
      findingsService.addTaskId(params.findingId, id);
    }

    auditService.write({
      actorId,
      actorRole,
      action: 'task.created',
      entityType: 'task',
      entityId: id,
      newValue: { title: params.title, findingId: params.findingId, priority: params.priority },
      relatedFinding: params.findingId,
      relatedTask: id,
    });

    return this.getById(id)!;
  },

  getById(id: string): Task | null {
    const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    return row ? rowToTask(row) : null;
  },

  list(opts: {
    findingId?: string;
    assignedTo?: string;
    status?: TaskStatus | TaskStatus[];
    limit?: number;
    offset?: number;
  } = {}): Task[] {
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (opts.findingId)  { conditions.push('finding_id = ?');  bindings.push(opts.findingId); }
    if (opts.assignedTo) { conditions.push('assigned_to = ?'); bindings.push(opts.assignedTo); }
    if (opts.status) {
      const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
      conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
      bindings.push(...statuses);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts.limit ?? 200;
    const offset = opts.offset ?? 0;

    const rows = getDb().prepare(
      `SELECT * FROM tasks ${where} ORDER BY
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        created_at DESC
      LIMIT ? OFFSET ?`
    ).all(...bindings, limit, offset) as any[];

    return rows.map(rowToTask);
  },

  updateStatus(
    id: string,
    newStatus: TaskStatus,
    actorId: string,
    actorRole: string,
    note?: string,
  ): Task | null {
    const existing = this.getById(id);
    if (!existing) return null;

    getDb().prepare(`
      UPDATE tasks SET status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newStatus, note ?? existing.notes ?? null, id);

    auditService.write({
      actorId,
      actorRole,
      action: 'task.status_changed',
      entityType: 'task',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: newStatus },
      note,
      relatedFinding: existing.findingId,
      relatedTask: id,
    });

    return this.getById(id);
  },

  complete(
    id: string,
    actorId: string,
    actorRole: string,
    outcome: string,
    outcomeType: TaskOutcomeType,
  ): Task | null {
    const existing = this.getById(id);
    if (!existing) return null;

    getDb().prepare(`
      UPDATE tasks
      SET status = 'completed', outcome = ?, outcome_type = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(outcome, outcomeType, id);

    auditService.write({
      actorId,
      actorRole,
      action: 'task.completed',
      entityType: 'task',
      entityId: id,
      newValue: { outcome, outcomeType },
      relatedFinding: existing.findingId,
      relatedTask: id,
    });

    return this.getById(id);
  },
};

function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    findingId: row.finding_id,
    assignedTo: row.assigned_to,
    assignedRole: row.assigned_role,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    dueDate: row.due_date,
    notes: row.notes,
    outcome: row.outcome,
    outcomeType: row.outcome_type as TaskOutcomeType | undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
