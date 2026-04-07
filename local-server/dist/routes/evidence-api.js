"use strict";
/**
 * Evidence API Routes — Eagle Insight
 *
 * GET    /api/evidence              — list evidence items (filterable)
 * POST   /api/evidence              — create new evidence item
 * GET    /api/evidence/:id          — get single evidence item
 * PATCH  /api/evidence/:id/pin      — pin/unpin evidence item
 * DELETE /api/evidence/:id          — delete evidence item
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceApiRouter = void 0;
const express_1 = require("express");
const evidence_service_1 = require("../services/evidence-service");
const auth_middleware_1 = require("../middleware/auth-middleware");
exports.evidenceApiRouter = (0, express_1.Router)();
exports.evidenceApiRouter.use(auth_middleware_1.requireAuth);
// GET /api/evidence
exports.evidenceApiRouter.get('/', (req, res) => {
    const { findingId, dossierId, flightId, sortieId, createdBy, isPinned, limit, offset } = req.query;
    const result = evidence_service_1.evidenceService.list({
        findingId: findingId ? String(findingId) : undefined,
        dossierId: dossierId ? String(dossierId) : undefined,
        flightId: flightId ? String(flightId) : undefined,
        sortieId: sortieId ? String(sortieId) : undefined,
        createdBy: createdBy ? String(createdBy) : undefined,
        isPinned: isPinned !== undefined ? isPinned === 'true' : undefined,
        limit: limit ? Number(limit) : 200,
        offset: offset ? Number(offset) : 0,
    });
    return res.json(result);
});
// GET /api/evidence/:id
exports.evidenceApiRouter.get('/:id', (req, res) => {
    const item = evidence_service_1.evidenceService.getById(req.params.id);
    if (!item)
        return res.status(404).json({ error: 'Evidence item not found' });
    return res.json({ item });
});
// POST /api/evidence
exports.evidenceApiRouter.post('/', (req, res) => {
    const user = req.authUser;
    const body = req.body;
    if (!body.title || typeof body.title !== 'string') {
        return res.status(400).json({ error: 'title is required' });
    }
    try {
        const item = evidence_service_1.evidenceService.create({
            ...body,
            createdBy: user?.id || 'unknown',
        });
        return res.status(201).json({ item });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to create evidence item' });
    }
});
// PATCH /api/evidence/:id/pin
exports.evidenceApiRouter.patch('/:id/pin', (req, res) => {
    const { isPinned } = req.body;
    if (typeof isPinned !== 'boolean') {
        return res.status(400).json({ error: 'isPinned (boolean) is required' });
    }
    const item = evidence_service_1.evidenceService.pin(req.params.id, isPinned);
    if (!item)
        return res.status(404).json({ error: 'Evidence item not found' });
    return res.json({ item });
});
// DELETE /api/evidence/:id
exports.evidenceApiRouter.delete('/:id', (req, res) => {
    const deleted = evidence_service_1.evidenceService.delete(req.params.id);
    if (!deleted)
        return res.status(404).json({ error: 'Evidence item not found' });
    return res.json({ success: true });
});
//# sourceMappingURL=evidence-api.js.map