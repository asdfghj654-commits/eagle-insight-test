"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.rulesApiRouter = void 0;
const express_1 = require("express");
const rules_service_1 = require("../services/rules-service");
const auth_middleware_1 = require("../middleware/auth-middleware");
exports.rulesApiRouter = (0, express_1.Router)();
exports.rulesApiRouter.use(auth_middleware_1.requireAuth);
// GET /api/rules
exports.rulesApiRouter.get('/', (req, res) => {
    const { type, status } = req.query;
    const rules = rules_service_1.rulesService.list({
        type: type,
        status: status ? String(status).split(',') : undefined,
    });
    return res.json({ rules, count: rules.length });
});
// GET /api/rules/:id
exports.rulesApiRouter.get('/:id', (req, res) => {
    const rule = rules_service_1.rulesService.getById(req.params.id);
    if (!rule)
        return res.status(404).json({ error: 'Rule not found' });
    return res.json({ rule });
});
// POST /api/rules  (engineer only)
exports.rulesApiRouter.post('/', (0, auth_middleware_1.requireRole)('engineer', 'admin'), (req, res) => {
    const body = req.body;
    if (!body.parameter || !body.thresholdType || body.thresholdValue == null || !body.severity || !body.severityS) {
        return res.status(400).json({ error: 'parameter, thresholdType, thresholdValue, severity, severityS required' });
    }
    try {
        const rule = rules_service_1.rulesService.create(body, req.authUser?.id, req.authUser?.role);
        return res.status(201).json({ rule });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PATCH /api/rules/:id/approve  (engineer only)
exports.rulesApiRouter.patch('/:id/approve', (0, auth_middleware_1.requireRole)('engineer', 'admin'), (req, res) => {
    const rule = rules_service_1.rulesService.approve(req.params.id, req.authUser.id, req.authUser.role);
    if (!rule)
        return res.status(404).json({ error: 'Rule not found' });
    return res.json({ rule });
});
// PATCH /api/rules/:id/threshold  (engineer only)
exports.rulesApiRouter.patch('/:id/threshold', (0, auth_middleware_1.requireRole)('engineer', 'admin'), (req, res) => {
    const { thresholdValue, changeDescription } = req.body;
    if (thresholdValue == null || !changeDescription) {
        return res.status(400).json({ error: 'thresholdValue and changeDescription required' });
    }
    const rule = rules_service_1.rulesService.updateThreshold(req.params.id, thresholdValue, req.authUser.id, req.authUser.role, changeDescription);
    if (!rule)
        return res.status(404).json({ error: 'Rule not found' });
    return res.json({ rule });
});
// PATCH /api/rules/:id/status
exports.rulesApiRouter.patch('/:id/status', (0, auth_middleware_1.requireRole)('engineer', 'admin'), (req, res) => {
    const { status } = req.body;
    const valid = ['draft', 'pending_approval', 'active', 'paused', 'deprecated'];
    if (!valid.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Valid: ${valid.join(', ')}` });
    }
    const db_row = rules_service_1.rulesService.getById(req.params.id);
    if (!db_row)
        return res.status(404).json({ error: 'Rule not found' });
    // Use direct DB update for status-only changes
    const { getDb } = require('../database/db');
    getDb().prepare('UPDATE rules SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, req.params.id);
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
    return res.json({ rule: rules_service_1.rulesService.getById(req.params.id) });
});
//# sourceMappingURL=rules-api.js.map