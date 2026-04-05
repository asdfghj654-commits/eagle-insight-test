/**
 * Tasks Routes — Eagle Insight Local MVP
 */

import { Router, Request, Response } from 'express';
import { tasksService, CreateTaskParams, TaskStatus, TaskOutcomeType } from '../services/tasks-service';
import { requireAuth } from '../middleware/auth-middleware';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

// GET /api/tasks
tasksRouter.get('/', (req: Request, res: Response) => {
  const { findingId, assignedTo, status } = req.query;
  const tasks = tasksService.list({
    findingId: findingId ? String(findingId) : undefined,
    assignedTo: assignedTo ? String(assignedTo) : undefined,
    status: status ? String(status).split(',') as TaskStatus[] : undefined,
  });
  return res.json({ tasks, count: tasks.length });
});

// GET /api/tasks/:id
tasksRouter.get('/:id', (req: Request, res: Response) => {
  const task = tasksService.getById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  return res.json({ task });
});

// POST /api/tasks
tasksRouter.post('/', (req: Request, res: Response) => {
  const body = req.body as CreateTaskParams;
  if (!body.title) return res.status(400).json({ error: 'title is required' });

  try {
    const task = tasksService.create(body, req.authUser?.id, req.authUser?.role);
    return res.status(201).json({ task });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/status
tasksRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { status, note } = req.body;

  const valid: TaskStatus[] = ['open', 'in_progress', 'completed', 'deferred', 'rejected'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid: ${valid.join(', ')}` });
  }

  const updated = tasksService.updateStatus(
    req.params.id, status, req.authUser!.id, req.authUser!.role, note
  );
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  return res.json({ task: updated });
});

// POST /api/tasks/:id/complete
tasksRouter.post('/:id/complete', (req: Request, res: Response) => {
  const { outcome, outcomeType } = req.body;

  const validOutcomes: TaskOutcomeType[] = ['fixed', 'replaced', 'nff', 'deferred', 'rejected'];
  if (!outcome || !validOutcomes.includes(outcomeType)) {
    return res.status(400).json({
      error: `outcome and outcomeType required. Valid types: ${validOutcomes.join(', ')}`
    });
  }

  const updated = tasksService.complete(
    req.params.id, req.authUser!.id, req.authUser!.role, outcome, outcomeType
  );
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  return res.json({ task: updated });
});
