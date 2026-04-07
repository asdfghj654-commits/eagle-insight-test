/**
 * Evidence Service — Eagle Insight
 *
 * Manages evidence items persisted to SQLite.
 * Evidence items are the analyst's marked selections and observations
 * from the investigation workbench — they must survive page reload.
 *
 * Previously stored in localStorage (wrong). Now persisted server-side.
 */

import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface EvidenceItem {
  id: string;
  findingId?: string;
  dossierId?: string;
  flightId?: string;
  sortieId?: string;
  createdBy: string;
  createdAt: string;
  evidenceType: string;
  title: string;
  titleHe?: string;
  description?: string;
  descriptionHe?: string;
  sourceType: string;
  sourceSystem?: string;
  content: Record<string, unknown>;
  parameterName?: string;
  timeRangeFrom?: string;
  timeRangeTo?: string;
  valueMin?: number;
  valueMax?: number;
  valueMean?: number;
  relevance?: string;
  relevanceHe?: string;
  isPinned: boolean;
}

export interface CreateEvidenceParams {
  findingId?: string;
  dossierId?: string;
  flightId?: string;
  sortieId?: string;
  createdBy: string;
  evidenceType?: string;
  title: string;
  titleHe?: string;
  description?: string;
  descriptionHe?: string;
  sourceType?: string;
  sourceSystem?: string;
  content?: Record<string, unknown>;
  parameterName?: string;
  timeRangeFrom?: string;
  timeRangeTo?: string;
  valueMin?: number;
  valueMax?: number;
  valueMean?: number;
  relevance?: string;
  relevanceHe?: string;
  isPinned?: boolean;
}

export interface EvidenceListParams {
  findingId?: string;
  dossierId?: string;
  flightId?: string;
  sortieId?: string;
  createdBy?: string;
  isPinned?: boolean;
  limit?: number;
  offset?: number;
}

function rowToEvidence(row: Record<string, unknown>): EvidenceItem {
  return {
    id: row.id as string,
    findingId: row.finding_id as string | undefined,
    dossierId: row.dossier_id as string | undefined,
    flightId: row.flight_id as string | undefined,
    sortieId: row.sortie_id as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    evidenceType: row.evidence_type as string,
    title: row.title as string,
    titleHe: row.title_he as string | undefined,
    description: row.description as string | undefined,
    descriptionHe: row.description_he as string | undefined,
    sourceType: row.source_type as string,
    sourceSystem: row.source_system as string | undefined,
    content: JSON.parse((row.content as string) || '{}'),
    parameterName: row.parameter_name as string | undefined,
    timeRangeFrom: row.time_range_from as string | undefined,
    timeRangeTo: row.time_range_to as string | undefined,
    valueMin: row.value_min as number | undefined,
    valueMax: row.value_max as number | undefined,
    valueMean: row.value_mean as number | undefined,
    relevance: row.relevance as string | undefined,
    relevanceHe: row.relevance_he as string | undefined,
    isPinned: Boolean(row.is_pinned),
  };
}

export const evidenceService = {
  list(params: EvidenceListParams = {}): { items: EvidenceItem[]; count: number } {
    const db = getDb();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.findingId)  { conditions.push('finding_id = ?'); values.push(params.findingId); }
    if (params.dossierId)  { conditions.push('dossier_id = ?'); values.push(params.dossierId); }
    if (params.flightId)   { conditions.push('flight_id = ?');  values.push(params.flightId); }
    if (params.sortieId)   { conditions.push('sortie_id = ?');  values.push(params.sortieId); }
    if (params.createdBy)  { conditions.push('created_by = ?'); values.push(params.createdBy); }
    if (params.isPinned !== undefined) {
      conditions.push('is_pinned = ?');
      values.push(params.isPinned ? 1 : 0);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = Math.min(params.limit ?? 200, 500);
    const offset = params.offset ?? 0;

    const items = db.prepare(`
      SELECT * FROM evidence_items ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset) as Record<string, unknown>[];

    const countRow = db.prepare(`SELECT COUNT(*) as n FROM evidence_items ${where}`).get(...values) as { n: number };

    return { items: items.map(rowToEvidence), count: countRow.n };
  },

  getById(id: string): EvidenceItem | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM evidence_items WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToEvidence(row) : undefined;
  },

  create(params: CreateEvidenceParams): EvidenceItem {
    const db = getDb();
    const id = uuidv4();
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
    `).run(
      id,
      params.findingId ?? null,
      params.dossierId ?? null,
      params.flightId  ?? null,
      params.sortieId  ?? null,
      params.createdBy,
      now,
      params.evidenceType  ?? 'parameter_selection',
      params.title,
      params.titleHe       ?? null,
      params.description   ?? null,
      params.descriptionHe ?? null,
      params.sourceType    ?? 'measured',
      params.sourceSystem  ?? null,
      JSON.stringify(params.content ?? {}),
      params.parameterName  ?? null,
      params.timeRangeFrom  ?? null,
      params.timeRangeTo    ?? null,
      params.valueMin  != null ? params.valueMin  : null,
      params.valueMax  != null ? params.valueMax  : null,
      params.valueMean != null ? params.valueMean : null,
      params.relevance    ?? null,
      params.relevanceHe  ?? null,
      params.isPinned ? 1 : 0,
    );

    return this.getById(id)!;
  },

  pin(id: string, isPinned: boolean): EvidenceItem | undefined {
    const db = getDb();
    const changes = db.prepare(
      "UPDATE evidence_items SET is_pinned = ? WHERE id = ?",
    ).run(isPinned ? 1 : 0, id).changes;
    if (!changes) return undefined;
    return this.getById(id);
  },

  delete(id: string): boolean {
    const db = getDb();
    return db.prepare('DELETE FROM evidence_items WHERE id = ?').run(id).changes > 0;
  },
};
