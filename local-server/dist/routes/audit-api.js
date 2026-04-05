"use strict";
/**
 * Audit API Routes — Eagle Insight Local MVP
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditApiRouter = void 0;
const express_1 = require("express");
const audit_service_1 = require("../services/audit-service");
const auth_middleware_1 = require("../middleware/auth-middleware");
exports.auditApiRouter = (0, express_1.Router)();
exports.auditApiRouter.use(auth_middleware_1.requireAuth);
// GET /api/audit — general log (engineer/commander only)
exports.auditApiRouter.get('/', (0, auth_middleware_1.requireRole)('engineer', 'commander', 'admin'), (req, res) => {
    const limit = parseInt(String(req.query.limit ?? '200'), 10);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);
    const entries = audit_service_1.auditService.getAll(limit, offset);
    return res.json({ entries, count: entries.length });
});
// GET /api/audit/finding/:findingId
exports.auditApiRouter.get('/finding/:findingId', (req, res) => {
    const entries = audit_service_1.auditService.query({ relatedFinding: req.params.findingId });
    return res.json({ entries, count: entries.length });
});
// GET /api/audit/entity/:type/:id
exports.auditApiRouter.get('/entity/:type/:id', (req, res) => {
    const entries = audit_service_1.auditService.query({
        entityType: req.params.type,
        entityId: req.params.id,
    });
    return res.json({ entries, count: entries.length });
});
//# sourceMappingURL=audit-api.js.map