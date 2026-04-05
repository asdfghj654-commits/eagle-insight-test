/**
 * Rules Service — Eagle Insight Local MVP
 *
 * Rules are persisted in SQLite.
 * Baseline rules are seeded on startup (see db.ts migrations).
 * Engineer rules are created/modified via the API with approval workflow.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { auditService } from './audit-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RuleStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'deprecated';
export type RuleType = 'baseline' | 'engineer';
export type ThresholdType = 'greater_than' | 'less_than' | 'band' | 'trend' | 'consecutive';
export type RuleContext = 'training' | 'combat' | 'weather_hard' | 'all';

export interface RuleVersion {
  version: number;
  changedAt: string;
  changedBy: string;
  changeType: 'created' | 'modified' | 'threshold_change' | 'status_change';
  changeDescription: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface RuleMetrics {
  lastRun?: string;
  matchedCount: number;
  impactedAircraft: string[];
  falsePositiveCount: number;
  lastMatchedFlightId?: string;
}

export interface Rule {
  id: string;
  ruleId: string;
  type: RuleType;
  system?: string;
  systemHe?: string;
  parameter: string;
  thresholdType: ThresholdType;
  thresholdValue: number | [number, number];
  unit?: string;
  context: RuleContext;
  referenceDoc?: string;
  clause?: string;
  name?: string;
  description?: string;
  severity: string;
  severityS: string;
  status: RuleStatus;
  version: number;
  versionHistory: RuleVersion[];
  metrics: RuleMetrics;
  createdBy?: string;
  approvedBy?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleParams {
  ruleId?: string;
  type?: RuleType;
  system?: string;
  systemHe?: string;
  parameter: string;
  thresholdType: ThresholdType;
  thresholdValue: number | [number, number];
  unit?: string;
  context?: RuleContext;
  referenceDoc?: string;
  clause?: string;
  name?: string;
  description?: string;
  severity: string;
  severityS: string;
  createdBy?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const rulesService = {
  create(params: CreateRuleParams, actorId?: string, actorRole?: string): Rule {
    const id = uuidv4();
    const ruleId = params.ruleId || `RULE_${Date.now()}`;
    const now = new Date().toISOString();

    const initialVersion: RuleVersion = {
      version: 1,
      changedAt: now,
      changedBy: actorId ?? 'system',
      changeType: 'created',
      changeDescription: 'Initial creation',
    };

    getDb().prepare(`
      INSERT INTO rules
        (id, rule_id, type, system, system_he, parameter, threshold_type, threshold_value,
         unit, context, reference_doc, clause, name, description, severity, severity_s,
         status, version, version_history, created_by, approval_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, 'pending', ?, ?)
    `).run(
      id, ruleId,
      params.type ?? 'engineer',
      params.system ?? null,
      params.systemHe ?? null,
      params.parameter,
      params.thresholdType,
      JSON.stringify(params.thresholdValue),
      params.unit ?? null,
      params.context ?? 'all',
      params.referenceDoc ?? null,
      params.clause ?? null,
      params.name ?? null,
      params.description ?? null,
      params.severity,
      params.severityS,
      JSON.stringify([initialVersion]),
      params.createdBy ?? actorId ?? null,
      now, now,
    );

    auditService.write({
      actorId,
      actorRole,
      action: 'rule.created',
      entityType: 'rule',
      entityId: id,
      newValue: { ruleId, parameter: params.parameter, severityS: params.severityS },
      relatedRule: ruleId,
      approvalRequired: true,
    });

    return this.getById(id)!;
  },

  getById(id: string): Rule | null {
    const row = getDb().prepare('SELECT * FROM rules WHERE id = ?').get(id) as any;
    return row ? rowToRule(row) : null;
  },

  getByRuleId(ruleId: string): Rule | null {
    const row = getDb().prepare('SELECT * FROM rules WHERE rule_id = ?').get(ruleId) as any;
    return row ? rowToRule(row) : null;
  },

  list(opts: {
    type?: RuleType;
    status?: RuleStatus | RuleStatus[];
    system?: string;
  } = {}): Rule[] {
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (opts.type) { conditions.push('type = ?'); bindings.push(opts.type); }
    if (opts.system) { conditions.push('system = ?'); bindings.push(opts.system); }
    if (opts.status) {
      const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
      conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
      bindings.push(...statuses);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = getDb().prepare(
      `SELECT * FROM rules ${where} ORDER BY type ASC, created_at DESC`
    ).all(...bindings) as any[];

    return rows.map(rowToRule);
  },

  listActive(): Rule[] {
    return this.list({ status: 'active' });
  },

  approve(id: string, approvedBy: string, approverRole: string): Rule | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const history = [...existing.versionHistory];
    const last = history[history.length - 1];
    if (last) {
      last.approvedBy = approvedBy;
      last.approvedAt = new Date().toISOString();
    }

    getDb().prepare(`
      UPDATE rules
      SET status = 'active', approved_by = ?, approval_status = 'approved',
          version_history = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(approvedBy, JSON.stringify(history), id);

    auditService.write({
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

  updateThreshold(
    id: string,
    newThreshold: number | [number, number],
    actorId: string,
    actorRole: string,
    changeDescription: string,
  ): Rule | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const newVersion = existing.version + 1;
    const versionEntry: RuleVersion = {
      version: newVersion,
      changedAt: new Date().toISOString(),
      changedBy: actorId,
      changeType: 'threshold_change',
      changeDescription,
    };
    const history = [...existing.versionHistory, versionEntry];

    getDb().prepare(`
      UPDATE rules
      SET threshold_value = ?, version = ?, version_history = ?,
          status = 'pending_approval', approval_status = 'pending',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(newThreshold), newVersion, JSON.stringify(history), id);

    auditService.write({
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

  updateMetrics(ruleId: string, metrics: Partial<RuleMetrics>): void {
    const row = getDb().prepare(
      'SELECT id, metrics FROM rules WHERE rule_id = ?'
    ).get(ruleId) as any;
    if (!row) return;

    const current: RuleMetrics = JSON.parse(row.metrics || '{}');
    const updated: RuleMetrics = {
      ...current,
      ...metrics,
      impactedAircraft: Array.from(
        new Set([...(current.impactedAircraft ?? []), ...(metrics.impactedAircraft ?? [])])
      ),
    };

    getDb().prepare(
      'UPDATE rules SET metrics = ?, updated_at = datetime("now") WHERE id = ?'
    ).run(JSON.stringify(updated), row.id);
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToRule(row: any): Rule {
  return {
    id: row.id,
    ruleId: row.rule_id,
    type: row.type as RuleType,
    system: row.system,
    systemHe: row.system_he,
    parameter: row.parameter,
    thresholdType: row.threshold_type as ThresholdType,
    thresholdValue: JSON.parse(row.threshold_value),
    unit: row.unit,
    context: row.context as RuleContext,
    referenceDoc: row.reference_doc,
    clause: row.clause,
    name: row.name,
    description: row.description,
    severity: row.severity,
    severityS: row.severity_s,
    status: row.status as RuleStatus,
    version: row.version,
    versionHistory: JSON.parse(row.version_history || '[]'),
    metrics: JSON.parse(row.metrics || '{"matchedCount":0,"impactedAircraft":[],"falsePositiveCount":0}'),
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvalStatus: row.approval_status as 'pending' | 'approved' | 'rejected',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
