"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.findingsRouter = void 0;
const express_1 = require("express");
const findings_service_1 = require("../services/findings-service");
const auth_middleware_1 = require("../middleware/auth-middleware");
exports.findingsRouter = (0, express_1.Router)();
// All findings routes require auth
exports.findingsRouter.use(auth_middleware_1.requireAuth);
// GET /api/findings/stats
exports.findingsRouter.get('/stats', (req, res) => {
    return res.json(findings_service_1.findingsService.getStats());
});
// GET /api/findings
exports.findingsRouter.get('/', (req, res) => {
    const { status, severity, aircraftId, flightId, dossierId, assignedTo, limit, offset } = req.query;
    const findings = findings_service_1.findingsService.list({
        status: status ? String(status).split(',') : undefined,
        severity: severity ? String(severity).split(',') : undefined,
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
exports.findingsRouter.get('/:id', (req, res) => {
    const finding = findings_service_1.findingsService.getById(req.params.id);
    if (!finding)
        return res.status(404).json({ error: 'Finding not found' });
    return res.json({ finding });
});
// POST /api/findings
exports.findingsRouter.post('/', (0, auth_middleware_1.requirePermission)('view_findings'), (req, res) => {
    const body = req.body;
    if (!body.title || !body.severity) {
        return res.status(400).json({ error: 'title and severity are required' });
    }
    try {
        const finding = findings_service_1.findingsService.create(body, req.authUser?.id, req.authUser?.role);
        return res.status(201).json({ finding });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/findings/bulk — used by ingestion pipeline
exports.findingsRouter.post('/bulk', (req, res) => {
    const { findings: list } = req.body;
    if (!Array.isArray(list) || list.length === 0) {
        return res.status(400).json({ error: 'findings array is required' });
    }
    try {
        const created = list.map(f => findings_service_1.findingsService.create(f, req.authUser?.id ?? 'system', req.authUser?.role ?? 'system'));
        return res.status(201).json({ findings: created, count: created.length });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PATCH /api/findings/:id/status
exports.findingsRouter.patch('/:id/status', (req, res) => {
    const { status, note } = req.body;
    const validStatuses = [
        'new', 'acknowledged', 'under_review', 'escalated', 'resolved', 'rejected', 'closed'
    ];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }
    const updated = findings_service_1.findingsService.updateStatus(req.params.id, status, req.authUser.id, req.authUser.role, note);
    if (!updated)
        return res.status(404).json({ error: 'Finding not found' });
    return res.json({ finding: updated });
});
// PATCH /api/findings/:id/assign
exports.findingsRouter.patch('/:id/assign', (req, res) => {
    const { assigneeId } = req.body;
    if (!assigneeId)
        return res.status(400).json({ error: 'assigneeId is required' });
    const updated = findings_service_1.findingsService.assign(req.params.id, assigneeId, req.authUser.id, req.authUser.role);
    if (!updated)
        return res.status(404).json({ error: 'Finding not found' });
    return res.json({ finding: updated });
});
//# sourceMappingURL=findings.js.map