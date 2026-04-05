"use strict";
/**
 * Tasks Service — Eagle Insight Local MVP
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../database/db");
const audit_service_1 = require("./audit-service");
const findings_service_1 = require("./findings-service");
exports.tasksService = {
    create(params, actorId, actorRole) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        (0, db_1.getDb)().prepare(`
      INSERT INTO tasks
        (id, title, finding_id, assigned_to, assigned_role, priority,
         status, due_date, notes, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
    `).run(id, params.title, params.findingId ?? null, params.assignedTo ?? null, params.assignedRole ?? null, params.priority ?? 'medium', params.dueDate ?? null, params.notes ?? null, params.createdBy ?? actorId ?? null, now, now);
        // Link task to finding
        if (params.findingId) {
            findings_service_1.findingsService.addTaskId(params.findingId, id);
        }
        audit_service_1.auditService.write({
            actorId,
            actorRole,
            action: 'task.created',
            entityType: 'task',
            entityId: id,
            newValue: { title: params.title, findingId: params.findingId, priority: params.priority },
            relatedFinding: params.findingId,
            relatedTask: id,
        });
        return this.getById(id);
    },
    getById(id) {
        const row = (0, db_1.getDb)().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        return row ? rowToTask(row) : null;
    },
    list(opts = {}) {
        const conditions = [];
        const bindings = [];
        if (opts.findingId) {
            conditions.push('finding_id = ?');
            bindings.push(opts.findingId);
        }
        if (opts.assignedTo) {
            conditions.push('assigned_to = ?');
            bindings.push(opts.assignedTo);
        }
        if (opts.status) {
            const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
            conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
            bindings.push(...statuses);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = opts.limit ?? 200;
        const offset = opts.offset ?? 0;
        const rows = (0, db_1.getDb)().prepare(`SELECT * FROM tasks ${where} ORDER BY
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        created_at DESC
      LIMIT ? OFFSET ?`).all(...bindings, limit, offset);
        return rows.map(rowToTask);
    },
    updateStatus(id, newStatus, actorId, actorRole, note) {
        const existing = this.getById(id);
        if (!existing)
            return null;
        (0, db_1.getDb)().prepare(`
      UPDATE tasks SET status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newStatus, note ?? existing.notes ?? null, id);
        audit_service_1.auditService.write({
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
    complete(id, actorId, actorRole, outcome, outcomeType) {
        const existing = this.getById(id);
        if (!existing)
            return null;
        (0, db_1.getDb)().prepare(`
      UPDATE tasks
      SET status = 'completed', outcome = ?, outcome_type = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(outcome, outcomeType, id);
        audit_service_1.auditService.write({
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
function rowToTask(row) {
    return {
        id: row.id,
        title: row.title,
        findingId: row.finding_id,
        assignedTo: row.assigned_to,
        assignedRole: row.assigned_role,
        priority: row.priority,
        status: row.status,
        dueDate: row.due_date,
        notes: row.notes,
        outcome: row.outcome,
        outcomeType: row.outcome_type,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
//# sourceMappingURL=tasks-service.js.map