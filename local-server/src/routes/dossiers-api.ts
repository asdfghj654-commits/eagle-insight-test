/**
 * Dossiers API Routes — Eagle Insight Local MVP
 */

import { Router, Request, Response } from 'express';
import { dossiersService } from '../services/dossiers-service';
import { requireAuth } from '../middleware/auth-middleware';

export const dossiersApiRouter = Router();
dossiersApiRouter.use(requireAuth);

// GET /api/dossiers
dossiersApiRouter.get('/', (req: Request, res: Response) => {
  const { tailNumber, status } = req.query;
  const dossiers = dossiersService.list({
    tailNumber: tailNumber ? String(tailNumber) : undefined,
    status: status as any,
  });
  return res.json({ dossiers, count: dossiers.length });
});

// GET /api/dossiers/:id
dossiersApiRouter.get('/:id', (req: Request, res: Response) => {
  const dossier = dossiersService.getWithFindings(req.params.id);
  if (!dossier) return res.status(404).json({ error: 'Dossier not found' });
  return res.json({ dossier });
});

// POST /api/dossiers
dossiersApiRouter.post('/', (req: Request, res: Response) => {
  const dossier = dossiersService.upsert(req.body);
  return res.status(201).json({ dossier });
});

// POST /api/dossiers/:id/sync-status
dossiersApiRouter.post('/:id/sync-status', (req: Request, res: Response) => {
  const dossier = dossiersService.syncStatus(req.params.id);
  if (!dossier) return res.status(404).json({ error: 'Dossier not found' });
  return res.json({ dossier });
});
