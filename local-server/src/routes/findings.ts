/**
 * Findings Routes — Eagle Insight Local MVP
 *
 * GET    /api/findings          — List findings (filterable)
 * POST   /api/findings          — Create finding (from ingestion or manual)
 * GET    /api/findings/stats    — Aggregate statistics
 * GET    /api/findings/:id      — Get single finding
 * PATCH  /api/findings/:id/status  — Update status
 * PATCH  /api/findings/:id/assign  — Assign to user
 * POST   /api/findings/bulk     — Bulk create (from rule execution)
 */

import { Router, Request, Response } from 'express';
import { findingsService, CreateFindingParams, FindingStatus, SeverityLevel } from '../services/findings-service';
import { requireAuth, requirePermission } from '../middleware/auth-middleware';

export const findingsRouter = Router();

// All findings routes require auth
findingsRouter.use(requireAuth);

// GET /api/findings/stats
findingsRouter.get('/stats', (req: Request, res: Response) => {
  return res.json(findingsService.getStats());
});

// GET /api/findings
findingsRouter.get('/', (req: Request, res: Response) => {
  const {
    status, severity, aircraftId, flightId, dossierId, assignedTo,
    limit, offset
  } = req.query;

  const findings = findingsService.list({
    status: status ? String(status).split(',') as FindingStatus[] : undefined,
    severity: severity ? String(severity).split(',') as SeverityLevel[] : undefined,
    aircraftId: aircraftId ? String(aircraftId) : undefined,
    flightId: flightId ? String(flightId) : undefined,
    dossierId: dossierId ? String(dossierId) : undefined,
    assignedTo: assignedTo ? String(assignedTo) : undefined,
    limit: limit ? parseInt(String(limit), 10) : 200,
    offset: offset ? parseInt(String(offset), 10) : 0,
  });

  return res.json({ findings, count: findings.length });
});

// GET /api/findings/:id
findingsRouter.get('/:id', (req: Request, res: Response) => {
  const finding = findingsService.getById(req.params.id);
  if (!finding) return res.status(404).json({ error: 'Finding not found' });
  return res.json({ finding });
});

// POST /api/findings
findingsRouter.post('/', requirePermission('view_findings'), (req: Request, res: Response) => {
  const body = req.body as CreateFindingParams;

  if (!body.title || !body.severity) {
    return res.status(400).json({ error: 'title and severity are required' });
  }

  try {
    const finding = findingsService.create(body, req.authUser?.id, req.authUser?.role);
    return res.status(201).json({ finding });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/findings/bulk — used by ingestion pipeline
findingsRouter.post('/bulk', (req: Request, res: Response) => {
  const { findings: list } = req.body as { findings: CreateFindingParams[] };

  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: 'findings array is required' });
  }

  try {
    const created = list.map(f =>
      findingsService.create(f, req.authUser?.id ?? 'system', req.authUser?.role ?? 'system')
    );
    return res.status(201).json({ findings: created, count: created.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/findings/:id/status
findingsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { status, note } = req.body;

  const validStatuses: FindingStatus[] = [
    'new', 'acknowledged', 'under_review', 'escalated', 'resolved', 'rejected', 'closed'
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
  }

  const updated = findingsService.updateStatus(
    req.params.id,
    status,
    req.authUser!.id,
    req.authUser!.role,
    note,
  );

  if (!updated) return res.status(404).json({ error: 'Finding not found' });
  return res.json({ finding: updated });
});

// PATCH /api/findings/:id/assign
findingsRouter.patch('/:id/assign', (req: Request, res: Response) => {
  const { assigneeId } = req.body;
  if (!assigneeId) return res.status(400).json({ error: 'assigneeId is required' });

  const updated = findingsService.assign(
    req.params.id,
    assigneeId,
    req.authUser!.id,
    req.authUser!.role,
  );

  if (!updated) return res.status(404).json({ error: 'Finding not found' });
  return res.json({ finding: updated });
});
