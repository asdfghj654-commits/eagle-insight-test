/**
 * Rules API Routes — Eagle Insight Local MVP
 *
 * GET    /api/rules         — List rules (optionally filter by type/status)
 * GET    /api/rules/:id     — Get single rule
 * POST   /api/rules         — Create engineer rule (engineer only)
 * PATCH  /api/rules/:id/approve   — Approve rule (engineer only)
 * PATCH  /api/rules/:id/threshold — Update threshold (engineer only, triggers re-approval)
 * PATCH  /api/rules/:id/status    — Pause / deprecate rule
 */

import { Router, Request, Response } from 'express';
import { rulesService, CreateRuleParams, RuleStatus } from '../services/rules-service';
import { requireAuth, requireRole } from '../middleware/auth-middleware';

export const rulesApiRouter = Router();
rulesApiRouter.use(requireAuth);

// GET /api/rules
rulesApiRouter.get('/', (req: Request, res: Response) => {
  const { type, status } = req.query;
  const rules = rulesService.list({
    type: type as any,
    status: status ? String(status).split(',') as RuleStatus[] : undefined,
  });
  return res.json({ rules, count: rules.length });
});

// GET /api/rules/:id
rulesApiRouter.get('/:id', (req: Request, res: Response) => {
  const rule = rulesService.getById(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  return res.json({ rule });
});

// POST /api/rules  (engineer only)
rulesApiRouter.post('/', requireRole('engineer', 'admin'), (req: Request, res: Response) => {
  const body = req.body as CreateRuleParams;
  if (!body.parameter || !body.thresholdType || body.thresholdValue == null || !body.severity || !body.severityS) {
    return res.status(400).json({ error: 'parameter, thresholdType, thresholdValue, severity, severityS required' });
  }
  try {
    const rule = rulesService.create(body, req.authUser?.id, req.authUser?.role);
    return res.status(201).json({ rule });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/rules/:id/approve  (engineer only)
rulesApiRouter.patch('/:id/approve', requireRole('engineer', 'admin'), (req: Request, res: Response) => {
  const rule = rulesService.approve(req.params.id, req.authUser!.id, req.authUser!.role);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  return res.json({ rule });
});

// PATCH /api/rules/:id/threshold  (engineer only)
rulesApiRouter.patch('/:id/threshold', requireRole('engineer', 'admin'), (req: Request, res: Response) => {
  const { thresholdValue, changeDescription } = req.body;
  if (thresholdValue == null || !changeDescription) {
    return res.status(400).json({ error: 'thresholdValue and changeDescription required' });
  }
  const rule = rulesService.updateThreshold(
    req.params.id, thresholdValue, req.authUser!.id, req.authUser!.role, changeDescription
  );
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  return res.json({ rule });
});

// PATCH /api/rules/:id/status
rulesApiRouter.patch('/:id/status', requireRole('engineer', 'admin'), (req: Request, res: Response) => {
  const { status } = req.body;
  const valid: RuleStatus[] = ['draft', 'pending_approval', 'active', 'paused', 'deprecated'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid: ${valid.join(', ')}` });
  }

  const db_row = rulesService.getById(req.params.id);
  if (!db_row) return res.status(404).json({ error: 'Rule not found' });

  // Use direct DB update for status-only changes
  const { getDb } = require('../database/db');
  getDb().prepare(
    'UPDATE rules SET status = ?, updated_at = datetime("now") WHERE id = ?'
  ).run(status, req.params.id);

  const { auditService } = require('../services/audit-service');
  auditService.write({
    actorId: req.authUser?.id,
    actorRole: req.authUser?.role,
    action: 'rule.status_changed',
    entityType: 'rule',
    entityId: req.params.id,
    oldValue: { status: db_row.status },
    newValue: { status },
    relatedRule: db_row.ruleId,
  });

  return res.json({ rule: rulesService.getById(req.params.id) });
});
