/**
 * Evidence API Routes — Eagle Insight
 *
 * GET    /api/evidence              — list evidence items (filterable)
 * POST   /api/evidence              — create new evidence item
 * GET    /api/evidence/:id          — get single evidence item
 * PATCH  /api/evidence/:id/pin      — pin/unpin evidence item
 * DELETE /api/evidence/:id          — delete evidence item
 */

import { Router, Request, Response } from 'express';
import { evidenceService } from '../services/evidence-service';
import { requireAuth } from '../middleware/auth-middleware';

export const evidenceApiRouter = Router();
evidenceApiRouter.use(requireAuth);

// GET /api/evidence
evidenceApiRouter.get('/', (req: Request, res: Response) => {
  const { findingId, dossierId, flightId, sortieId, createdBy, isPinned, limit, offset } = req.query;

  const result = evidenceService.list({
    findingId:  findingId  ? String(findingId)  : undefined,
    dossierId:  dossierId  ? String(dossierId)  : undefined,
    flightId:   flightId   ? String(flightId)   : undefined,
    sortieId:   sortieId   ? String(sortieId)   : undefined,
    createdBy:  createdBy  ? String(createdBy)  : undefined,
    isPinned:   isPinned !== undefined ? isPinned === 'true' : undefined,
    limit:      limit  ? Number(limit)  : 200,
    offset:     offset ? Number(offset) : 0,
  });

  return res.json(result);
});

// GET /api/evidence/:id
evidenceApiRouter.get('/:id', (req: Request, res: Response) => {
  const item = evidenceService.getById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Evidence item not found' });
  return res.json({ item });
});

// POST /api/evidence
evidenceApiRouter.post('/', (req: Request, res: Response) => {
  const user = req.authUser;
  const body = req.body;

  if (!body.title || typeof body.title !== 'string') {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const item = evidenceService.create({
      ...body,
      createdBy: user?.id || 'unknown',
    });
    return res.status(201).json({ item });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create evidence item' });
  }
});

// PATCH /api/evidence/:id/pin
evidenceApiRouter.patch('/:id/pin', (req: Request, res: Response) => {
  const { isPinned } = req.body as { isPinned: boolean };
  if (typeof isPinned !== 'boolean') {
    return res.status(400).json({ error: 'isPinned (boolean) is required' });
  }
  const item = evidenceService.pin(req.params.id, isPinned);
  if (!item) return res.status(404).json({ error: 'Evidence item not found' });
  return res.json({ item });
});

// DELETE /api/evidence/:id
evidenceApiRouter.delete('/:id', (req: Request, res: Response) => {
  const deleted = evidenceService.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Evidence item not found' });
  return res.json({ success: true });
});
