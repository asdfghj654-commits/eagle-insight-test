/**
 * Dossiers Service — Eagle Insight Local MVP
 *
 * A dossier represents one flight's analysis package:
 * the flight metadata + all associated findings.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { findingsService } from './findings-service';

export type DossierStatus = 'new' | 'in_review' | 'findings_open' | 'all_resolved' | 'archived';

export interface Dossier {
  id: string;
  flightId?: string;
  tailNumber?: string;
  flightDate?: string;
  pilotName?: string;
  status: DossierStatus;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DossierWithFindings extends Dossier {
  findings: ReturnType<typeof findingsService.list>;
}

export const dossiersService = {
  upsert(params: {
    flightId?: string;
    tailNumber?: string;
    flightDate?: string;
    pilotName?: string;
  }): Dossier {
    const db = getDb();

    // Find existing by flightId
    if (params.flightId) {
      const existing = db.prepare(
        'SELECT * FROM dossiers WHERE flight_id = ?'
      ).get(params.flightId) as any;
      if (existing) return rowToDossier(existing);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO dossiers (id, flight_id, tail_number, flight_date, pilot_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'new', ?, ?)
    `).run(id, params.flightId ?? null, params.tailNumber ?? null,
           params.flightDate ?? null, params.pilotName ?? null, now, now);

    return this.getById(id)!;
  },

  getById(id: string): Dossier | null {
    const row = getDb().prepare('SELECT * FROM dossiers WHERE id = ?').get(id) as any;
    return row ? rowToDossier(row) : null;
  },

  getByFlightId(flightId: string): Dossier | null {
    const row = getDb().prepare(
      'SELECT * FROM dossiers WHERE flight_id = ?'
    ).get(flightId) as any;
    return row ? rowToDossier(row) : null;
  },

  list(opts: {
    tailNumber?: string;
    status?: DossierStatus;
    limit?: number;
    offset?: number;
  } = {}): Dossier[] {
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (opts.tailNumber) { conditions.push('tail_number = ?'); bindings.push(opts.tailNumber); }
    if (opts.status)     { conditions.push('status = ?');      bindings.push(opts.status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;

    const rows = getDb().prepare(
      `SELECT * FROM dossiers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...bindings, limit, offset) as any[];

    return rows.map(rowToDossier);
  },

  getWithFindings(id: string): DossierWithFindings | null {
    const dossier = this.getById(id);
    if (!dossier) return null;
    const findings = findingsService.list({ dossierId: id });
    return { ...dossier, findings };
  },

  syncStatus(id: string): Dossier | null {
    const findings = findingsService.list({ dossierId: id });
    let newStatus: DossierStatus = 'new';

    if (findings.length === 0) {
      newStatus = 'new';
    } else {
      const open = findings.filter(f =>
        !['resolved', 'rejected', 'closed'].includes(f.status)
      );
      if (open.length === 0) {
        newStatus = 'all_resolved';
      } else if (open.some(f => f.status === 'escalated')) {
        newStatus = 'findings_open';
      } else {
        newStatus = 'in_review';
      }
    }

    getDb().prepare(
      'UPDATE dossiers SET status = ?, updated_at = datetime("now") WHERE id = ?'
    ).run(newStatus, id);

    return this.getById(id);
  },
};

function rowToDossier(row: any): Dossier {
  return {
    id: row.id,
    flightId: row.flight_id,
    tailNumber: row.tail_number,
    flightDate: row.flight_date,
    pilotName: row.pilot_name,
    status: row.status as DossierStatus,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
