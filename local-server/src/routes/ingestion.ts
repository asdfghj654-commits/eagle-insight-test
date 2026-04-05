import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth-middleware';
import { ingestionService } from '../services/ingestion-service';

export const ingestionRouter = Router();

ingestionRouter.use(requireAuth);

ingestionRouter.post('/csv', requireRole('engineer', 'admin'), (req: Request, res: Response) => {
  const { csvContent, sourceFilename } = req.body as {
    csvContent?: string;
    sourceFilename?: string;
  };

  if (!csvContent) {
    return res.status(400).json({ error: 'csvContent is required' });
  }

  try {
    const result = ingestionService.ingestCsv({
      csvContent,
      sourceFilename,
      actorId: req.authUser!.id,
      actorRole: req.authUser!.role,
    });

    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'CSV ingestion failed',
    });
  }
});
