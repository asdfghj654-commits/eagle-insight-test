"use strict";
/**
 * Evidence Service — Eagle Insight
 *
 * Manages evidence items persisted to SQLite.
 * Evidence items are the analyst's marked selections and observations
 * from the investigation workbench — they must survive page reload.
 *
 * Previously stored in localStorage (wrong). Now persisted server-side.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceService = void 0;
const db_1 = require("../database/db");
const uuid_1 = require("uuid");
function rowToEvidence(row) {
    return {
        id: row.id,
        findingId: row.finding_id,
        dossierId: row.dossier_id,
        flightId: row.flight_id,
        sortieId: row.sortie_id,
        createdBy: row.created_by,
        createdAt: row.created_at,
        evidenceType: row.evidence_type,
        title: row.title,
        titleHe: row.title_he,
        description: row.description,
        descriptionHe: row.description_he,
        sourceType: row.source_type,
        sourceSystem: row.source_system,
        content: JSON.parse(row.content || '{}'),
        parameterName: row.parameter_name,
        timeRangeFrom: row.time_range_from,
        timeRangeTo: row.time_range_to,
        valueMin: row.value_min,
        valueMax: row.value_max,
        valueMean: row.value_mean,
        relevance: row.relevance,
        relevanceHe: row.relevance_he,
        isPinned: Boolean(row.is_pinned),
    };
}
exports.evidenceService = {
    list(params = {}) {
        const db = (0, db_1.getDb)();
        const conditions = [];
        const values = [];
        if (params.findingId) {
            conditions.push('finding_id = ?');
            values.push(params.findingId);
        }
        if (params.dossierId) {
            conditions.push('dossier_id = ?');
            values.push(params.dossierId);
        }
        if (params.flightId) {
            conditions.push('flight_id = ?');
            values.push(params.flightId);
        }
        if (params.sortieId) {
            conditions.push('sortie_id = ?');
            values.push(params.sortieId);
        }
        if (params.createdBy) {
            conditions.push('created_by = ?');
            values.push(params.createdBy);
        }
        if (params.isPinned !== undefined) {
            conditions.push('is_pinned = ?');
            values.push(params.isPinned ? 1 : 0);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.min(params.limit ?? 200, 500);
        const offset = params.offset ?? 0;
        const items = db.prepare(`
      SELECT * FROM evidence_items ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset);
        const countRow = db.prepare(`SELECT COUNT(*) as n FROM evidence_items ${where}`).get(...values);
        return { items: items.map(rowToEvidence), count: countRow.n };
    },
    getById(id) {
        const db = (0, db_1.getDb)();
        const row = db.prepare('SELECT * FROM evidence_items WHERE id = ?').get(id);
        return row ? rowToEvidence(row) : undefined;
    },
    create(params) {
        const db = (0, db_1.getDb)();
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO evidence_items (
        id, finding_id, dossier_id, flight_id, sortie_id, created_by, created_at,
        evidence_type, title, title_he, description, description_he,
        source_type, source_system, content,
        parameter_name, time_range_from, time_range_to,
        value_min, value_max, value_mean,
        relevance, relevance_he, is_pinned
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(id, params.findingId ?? null, params.dossierId ?? null, params.flightId ?? null, params.sortieId ?? null, params.createdBy, now, params.evidenceType ?? 'parameter_selection', params.title, params.titleHe ?? null, params.description ?? null, params.descriptionHe ?? null, params.sourceType ?? 'measured', params.sourceSystem ?? null, JSON.stringify(params.content ?? {}), params.parameterName ?? null, params.timeRangeFrom ?? null, params.timeRangeTo ?? null, params.valueMin != null ? params.valueMin : null, params.valueMax != null ? params.valueMax : null, params.valueMean != null ? params.valueMean : null, params.relevance ?? null, params.relevanceHe ?? null, params.isPinned ? 1 : 0);
        return this.getById(id);
    },
    pin(id, isPinned) {
        const db = (0, db_1.getDb)();
        const changes = db.prepare("UPDATE evidence_items SET is_pinned = ? WHERE id = ?").run(isPinned ? 1 : 0, id).changes;
        if (!changes)
            return undefined;
        return this.getById(id);
    },
    delete(id) {
        const db = (0, db_1.getDb)();
        return db.prepare('DELETE FROM evidence_items WHERE id = ?').run(id).changes > 0;
    },
};
//# sourceMappingURL=evidence-service.js.map