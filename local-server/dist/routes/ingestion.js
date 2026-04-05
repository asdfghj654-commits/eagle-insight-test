"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestionRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth-middleware");
const ingestion_service_1 = require("../services/ingestion-service");
exports.ingestionRouter = (0, express_1.Router)();
exports.ingestionRouter.use(auth_middleware_1.requireAuth);
exports.ingestionRouter.post('/csv', (0, auth_middleware_1.requireRole)('engineer', 'admin'), (req, res) => {
    const { csvContent, sourceFilename } = req.body;
    if (!csvContent) {
        return res.status(400).json({ error: 'csvContent is required' });
    }
    try {
        const result = ingestion_service_1.ingestionService.ingestCsv({
            csvContent,
            sourceFilename,
            actorId: req.authUser.id,
            actorRole: req.authUser.role,
        });
        return res.status(201).json(result);
    }
    catch (error) {
        return res.status(400).json({
            error: error instanceof Error ? error.message : 'CSV ingestion failed',
        });
    }
});
//# sourceMappingURL=ingestion.js.map