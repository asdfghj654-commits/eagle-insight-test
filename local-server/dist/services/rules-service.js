"use strict";
/**
 * Rules Service — Eagle Insight Local MVP
 *
 * Rules are persisted in SQLite.
 * Baseline rules are seeded on startup (see db.ts migrations).
 * Engineer rules are created/modified via the API with approval workflow.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rulesService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../database/db");
const audit_service_1 = require("./audit-service");
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
exports.rulesService = {
    create(params, actorId, actorRole) {
        const id = (0, uuid_1.v4)();
        const ruleId = params.ruleId || `RULE_${Date.now()}`;
        const now = new Date().toISOString();
        const initialVersion = {
            version: 1,
            changedAt: now,
            changedBy: actorId ?? 'system',
            changeType: 'created',
            changeDescription: 'Initial creation',
        };
        (0, db_1.getDb)().prepare(`
      INSERT INTO rules
        (id, rule_id, type, system, system_he, parameter, threshold_type, threshold_value,
         unit, context, reference_doc, clause, name, description, severity, severity_s,
         status, version, version_history, created_by, approval_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, 'pending', ?, ?)
    `).run(id, ruleId, params.type ?? 'engineer', params.system ?? null, params.systemHe ?? null, params.parameter, params.thresholdType, JSON.stringify(params.thresholdValue), params.unit ?? null, params.context ?? 'all', params.referenceDoc ?? null, params.clause ?? null, params.name ?? null, params.description ?? null, params.severity, params.severityS, JSON.stringify([initialVersion]), params.createdBy ?? actorId ?? null, now, now);
        audit_service_1.auditService.write({
            actorId,
            actorRole,
            action: 'rule.created',
            entityType: 'rule',
            entityId: id,
            newValue: { ruleId, parameter: params.parameter, severityS: params.severityS },
            relatedRule: ruleId,
            approvalRequired: true,
        });
        return this.getById(id);
    },
    getById(id) {
        const row = (0, db_1.getDb)().prepare('SELECT * FROM rules WHERE id = ?').get(id);
        return row ? rowToRule(row) : null;
    },
    getByRuleId(ruleId) {
        const row = (0, db_1.getDb)().prepare('SELECT * FROM rules WHERE rule_id = ?').get(ruleId);
        return row ? rowToRule(row) : null;
    },
    list(opts = {}) {
        const conditions = [];
        const bindings = [];
        if (opts.type) {
            conditions.push('type = ?');
            bindings.push(opts.type);
        }
        if (opts.system) {
            conditions.push('system = ?');
            bindings.push(opts.system);
        }
        if (opts.status) {
            const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
            conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
            bindings.push(...statuses);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const rows = (0, db_1.getDb)().prepare(`SELECT * FROM rules ${where} ORDER BY type ASC, created_at DESC`).all(...bindings);
        return rows.map(rowToRule);
    },
    listActive() {
        return this.list({ status: 'active' });
    },
    approve(id, approvedBy, approverRole) {
        const existing = this.getById(id);
        if (!existing)
            return null;
        const history = [...existing.versionHistory];
        const last = history[history.length - 1];
        if (last) {
            last.approvedBy = approvedBy;
            last.approvedAt = new Date().toISOString();
        }
        (0, db_1.getDb)().prepare(`
      UPDATE rules
      SET status = 'active', approved_by = ?, approval_status = 'approved',
          version_history = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(approvedBy, JSON.stringify(history), id);
        audit_service_1.auditService.write({
            actorId: approvedBy,
            actorRole: approverRole,
            action: 'rule.approved',
            entityType: 'rule',
            entityId: id,
            newValue: { status: 'active', approvedBy },
            relatedRule: existing.ruleId,
        });
        return this.getById(id);
    },
    updateThreshold(id, newThreshold, actorId, actorRole, changeDescription) {
        const existing = this.getById(id);
        if (!existing)
            return null;
        const newVersion = existing.version + 1;
        const versionEntry = {
            version: newVersion,
            changedAt: new Date().toISOString(),
            changedBy: actorId,
            changeType: 'threshold_change',
            changeDescription,
        };
        const history = [...existing.versionHistory, versionEntry];
        (0, db_1.getDb)().prepare(`
      UPDATE rules
      SET threshold_value = ?, version = ?, version_history = ?,
          status = 'pending_approval', approval_status = 'pending',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(newThreshold), newVersion, JSON.stringify(history), id);
        audit_service_1.auditService.write({
            actorId,
            actorRole,
            action: 'rule.threshold_changed',
            entityType: 'rule',
            entityId: id,
            oldValue: { threshold: existing.thresholdValue },
            newValue: { threshold: newThreshold },
            note: changeDescription,
            approvalRequired: true,
            relatedRule: existing.ruleId,
        });
        return this.getById(id);
    },
    updateMetrics(ruleId, metrics) {
        const row = (0, db_1.getDb)().prepare('SELECT id, metrics FROM rules WHERE rule_id = ?').get(ruleId);
        if (!row)
            return;
        const current = JSON.parse(row.metrics || '{}');
        const updated = {
            ...current,
            ...metrics,
            impactedAircraft: Array.from(new Set([...(current.impactedAircraft ?? []), ...(metrics.impactedAircraft ?? [])])),
        };
        (0, db_1.getDb)().prepare('UPDATE rules SET metrics = ?, updated_at = datetime("now") WHERE id = ?').run(JSON.stringify(updated), row.id);
    },
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rowToRule(row) {
    return {
        id: row.id,
        ruleId: row.rule_id,
        type: row.type,
        system: row.system,
        systemHe: row.system_he,
        parameter: row.parameter,
        thresholdType: row.threshold_type,
        thresholdValue: JSON.parse(row.threshold_value),
        unit: row.unit,
        context: row.context,
        referenceDoc: row.reference_doc,
        clause: row.clause,
        name: row.name,
        description: row.description,
        severity: row.severity,
        severityS: row.severity_s,
        status: row.status,
        version: row.version,
        versionHistory: JSON.parse(row.version_history || '[]'),
        metrics: JSON.parse(row.metrics || '{"matchedCount":0,"impactedAircraft":[],"falsePositiveCount":0}'),
        createdBy: row.created_by,
        approvedBy: row.approved_by,
        approvalStatus: row.approval_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
//# sourceMappingURL=rules-service.js.map