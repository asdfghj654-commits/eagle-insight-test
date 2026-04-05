"use strict";
/**
 * Dossiers API Routes — Eagle Insight Local MVP
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dossiersApiRouter = void 0;
const express_1 = require("express");
const dossiers_service_1 = require("../services/dossiers-service");
const auth_middleware_1 = require("../middleware/auth-middleware");
exports.dossiersApiRouter = (0, express_1.Router)();
exports.dossiersApiRouter.use(auth_middleware_1.requireAuth);
// GET /api/dossiers
exports.dossiersApiRouter.get('/', (req, res) => {
    const { tailNumber, status } = req.query;
    const dossiers = dossiers_service_1.dossiersService.list({
        tailNumber: tailNumber ? String(tailNumber) : undefined,
        status: status,
    });
    return res.json({ dossiers, count: dossiers.length });
});
// GET /api/dossiers/:id
exports.dossiersApiRouter.get('/:id', (req, res) => {
    const dossier = dossiers_service_1.dossiersService.getWithFindings(req.params.id);
    if (!dossier)
        return res.status(404).json({ error: 'Dossier not found' });
    return res.json({ dossier });
});
// POST /api/dossiers
exports.dossiersApiRouter.post('/', (req, res) => {
    const dossier = dossiers_service_1.dossiersService.upsert(req.body);
    return res.status(201).json({ dossier });
});
// POST /api/dossiers/:id/sync-status
exports.dossiersApiRouter.post('/:id/sync-status', (req, res) => {
    const dossier = dossiers_service_1.dossiersService.syncStatus(req.params.id);
    if (!dossier)
        return res.status(404).json({ error: 'Dossier not found' });
    return res.json({ dossier });
});
//# sourceMappingURL=dossiers-api.js.map