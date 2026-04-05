"use strict";
/**
 * Findings Service — Eagle Insight Local MVP
 *
 * Findings are the core domain object.
 * Every finding must be backed by real rule execution or explicit manual entry.
 * No fabricated findings — empty is better than fake.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findingsService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../database/db");
const audit_service_1 = require("./audit-service");
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
exports.findingsService = {
    create(params, actorId, actorRole) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        (0, db_1.getDb)().prepare(`
      INSERT INTO findings
        (id, title, title_he, summary, summary_he, severity, classification,
         source_type, aircraft_id, flight_id, dossier_id, rule_id,
         evidence_refs, status, generated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
    `).run(id, params.title, params.titleHe ?? null, params.summary ?? null, params.summaryHe ?? null, params.severity, params.classification ?? null, params.sourceType ?? 'measured', params.aircraftId ?? null, params.flightId ?? null, params.dossierId ?? null, params.ruleId ?? null, JSON.stringify(params.evidenceRefs ?? []), params.generatedBy ?? null, now, now);
        audit_service_1.auditService.write({
            actorId,
            actorRole,
            action: 'finding.created',
            entityType: 'finding',
            entityId: id,
            newValue: { title: params.title, severity: params.severity, ruleId: params.ruleId },
            relatedFinding: id,
        });
        return this.getById(id);
    },
    getById(id) {
        const row = (0, db_1.getDb)().prepare('SELECT * FROM findings WHERE id = ?').get(id);
        return row ? rowToFinding(row) : null;
    },
    list(opts = {}) {
        const conditions = [];
        const bindings = [];
        if (opts.status) {
            const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
            conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
            bindings.push(...statuses);
        }
        if (opts.severity) {
            const severities = Array.isArray(opts.severity) ? opts.severity : [opts.severity];
            conditions.push(`severity IN (${severities.map(() => '?').join(',')})`);
            bindings.push(...severities);
        }
        if (opts.aircraftId) {
            conditions.push('aircraft_id = ?');
            bindings.push(opts.aircraftId);
        }
        if (opts.flightId) {
            conditions.push('flight_id = ?');
            bindings.push(opts.flightId);
        }
        if (opts.dossierId) {
            conditions.push('dossier_id = ?');
            bindings.push(opts.dossierId);
        }
        if (opts.assignedTo) {
            conditions.push('assigned_to = ?');
            bindings.push(opts.assignedTo);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = opts.limit ?? 200;
        const offset = opts.offset ?? 0;
        const rows = (0, db_1.getDb)().prepare(`SELECT * FROM findings ${where} ORDER BY
        CASE severity WHEN 'S1' THEN 1 WHEN 'S2' THEN 2 WHEN 'S3' THEN 3 ELSE 4 END,
        created_at DESC
      LIMIT ? OFFSET ?`).all(...bindings, limit, offset);
        return rows.map(rowToFinding);
    },
    updateStatus(id, newStatus, actorId, actorRole, note) {
        const existing = this.getById(id);
        if (!existing)
            return null;
        (0, db_1.getDb)().prepare(`
      UPDATE findings SET status = ?, review_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, note ?? existing.reviewNotes ?? null, id);
        audit_service_1.auditService.write({
            actorId,
            actorRole,
            action: 'finding.status_changed',
            entityType: 'finding',
            entityId: id,
            oldValue: { status: existing.status },
            newValue: { status: newStatus },
            note,
            relatedFinding: id,
        });
        return this.getById(id);
    },
    assign(id, assigneeId, actorId, actorRole) {
        const existing = this.getById(id);
        if (!existing)
            return null;
        (0, db_1.getDb)().prepare(`
      UPDATE findings SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?
    `).run(assigneeId, id);
        audit_service_1.auditService.write({
            actorId,
            actorRole,
            action: 'finding.assigned',
            entityType: 'finding',
            entityId: id,
            oldValue: { assignedTo: existing.assignedTo },
            newValue: { assignedTo: assigneeId },
            relatedFinding: id,
        });
        return this.getById(id);
    },
    addTaskId(findingId, taskId) {
        const row = (0, db_1.getDb)().prepare('SELECT task_ids FROM findings WHERE id = ?').get(findingId);
        if (!row)
            return;
        const ids = JSON.parse(row.task_ids || '[]');
        if (!ids.includes(taskId)) {
            ids.push(taskId);
            (0, db_1.getDb)().prepare('UPDATE findings SET task_ids = ?, updated_at = datetime("now") WHERE id = ?').run(JSON.stringify(ids), findingId);
        }
    },
    getStats() {
        const db = (0, db_1.getDb)();
        const total = db.prepare('SELECT COUNT(*) as c FROM findings').get().c;
        const open = db.prepare("SELECT COUNT(*) as c FROM findings WHERE status NOT IN ('resolved','rejected','closed')").get().c;
        const statusRows = db.prepare('SELECT status, COUNT(*) as c FROM findings GROUP BY status').all();
        const byStatus = {};
        statusRows.forEach((r) => { byStatus[r.status] = r.c; });
        const sevRows = db.prepare('SELECT severity, COUNT(*) as c FROM findings GROUP BY severity').all();
        const bySeverity = {};
        sevRows.forEach((r) => { bySeverity[r.severity] = r.c; });
        return { total, byStatus, bySeverity, open };
    },
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rowToFinding(row) {
    return {
        id: row.id,
        title: row.title,
        titleHe: row.title_he,
        summary: row.summary,
        summaryHe: row.summary_he,
        severity: row.severity,
        classification: row.classification,
        sourceType: row.source_type,
        aircraftId: row.aircraft_id,
        flightId: row.flight_id,
        dossierId: row.dossier_id,
        ruleId: row.rule_id,
        evidenceRefs: JSON.parse(row.evidence_refs || '[]'),
        status: row.status,
        assignedTo: row.assigned_to,
        generatedBy: row.generated_by,
        reviewNotes: row.review_notes,
        escalationInfo: row.escalation_info,
        taskIds: JSON.parse(row.task_ids || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
//# sourceMappingURL=findings-service.js.map