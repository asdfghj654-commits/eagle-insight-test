/**
 * Audit API Routes — Eagle Insight Local MVP
 */

import { Router, Request, Response } from 'express';
import { auditService } from '../services/audit-service';
import { requireAuth, requireRole } from '../middleware/auth-middleware';

export const auditApiRouter = Router();
auditApiRouter.use(requireAuth);

// GET /api/audit — general log (engineer/commander only)
auditApiRouter.get('/', requireRole('engineer', 'commander', 'admin'), (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit ?? '200'), 10);
  const offset = parseInt(String(req.query.offset ?? '0'), 10);
  const entries = auditService.getAll(limit, offset);
  return res.json({ entries, count: entries.length });
});

// GET /api/audit/finding/:findingId
auditApiRouter.get('/finding/:findingId', (req: Request, res: Response) => {
  const entries = auditService.query({ relatedFinding: req.params.findingId });
  return res.json({ entries, count: entries.length });
});

// GET /api/audit/entity/:type/:id
auditApiRouter.get('/entity/:type/:id', (req: Request, res: Response) => {
  const entries = auditService.query({
    entityType: req.params.type,
    entityId: req.params.id,
  });
  return res.json({ entries, count: entries.length });
});
