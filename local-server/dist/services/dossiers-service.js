"use strict";
/**
 * Dossiers Service — Eagle Insight Local MVP
 *
 * A dossier represents one flight's analysis package:
 * the flight metadata + all associated findings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dossiersService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../database/db");
const findings_service_1 = require("./findings-service");
exports.dossiersService = {
    upsert(params) {
        const db = (0, db_1.getDb)();
        // Find existing by flightId
        if (params.flightId) {
            const existing = db.prepare('SELECT * FROM dossiers WHERE flight_id = ?').get(params.flightId);
            if (existing)
                return rowToDossier(existing);
        }
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO dossiers (id, flight_id, tail_number, flight_date, pilot_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'new', ?, ?)
    `).run(id, params.flightId ?? null, params.tailNumber ?? null, params.flightDate ?? null, params.pilotName ?? null, now, now);
        return this.getById(id);
    },
    getById(id) {
        const row = (0, db_1.getDb)().prepare('SELECT * FROM dossiers WHERE id = ?').get(id);
        return row ? rowToDossier(row) : null;
    },
    getByFlightId(flightId) {
        const row = (0, db_1.getDb)().prepare('SELECT * FROM dossiers WHERE flight_id = ?').get(flightId);
        return row ? rowToDossier(row) : null;
    },
    list(opts = {}) {
        const conditions = [];
        const bindings = [];
        if (opts.tailNumber) {
            conditions.push('tail_number = ?');
            bindings.push(opts.tailNumber);
        }
        if (opts.status) {
            conditions.push('status = ?');
            bindings.push(opts.status);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = opts.limit ?? 100;
        const offset = opts.offset ?? 0;
        const rows = (0, db_1.getDb)().prepare(`SELECT * FROM dossiers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...bindings, limit, offset);
        return rows.map(rowToDossier);
    },
    getWithFindings(id) {
        const dossier = this.getById(id);
        if (!dossier)
            return null;
        const findings = findings_service_1.findingsService.list({ dossierId: id });
        return { ...dossier, findings };
    },
    syncStatus(id) {
        const findings = findings_service_1.findingsService.list({ dossierId: id });
        let newStatus = 'new';
        if (findings.length === 0) {
            newStatus = 'new';
        }
        else {
            const open = findings.filter(f => !['resolved', 'rejected', 'closed'].includes(f.status));
            if (open.length === 0) {
                newStatus = 'all_resolved';
            }
            else if (open.some(f => f.status === 'escalated')) {
                newStatus = 'findings_open';
            }
            else {
                newStatus = 'in_review';
            }
        }
        (0, db_1.getDb)().prepare('UPDATE dossiers SET status = ?, updated_at = datetime("now") WHERE id = ?').run(newStatus, id);
        return this.getById(id);
    },
};
function rowToDossier(row) {
    return {
        id: row.id,
        flightId: row.flight_id,
        tailNumber: row.tail_number,
        flightDate: row.flight_date,
        pilotName: row.pilot_name,
        status: row.status,
        summary: row.summary,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
//# sourceMappingURL=dossiers-service.js.map