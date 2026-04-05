"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiProxyRouter = void 0;
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const api_adapter_1 = require("../adapters/api-adapter");
const router = (0, express_1.Router)();
exports.apiProxyRouter = router;
// Proxy API request
router.post('/:sourceId', async (req, res) => {
    const { sourceId } = req.params;
    const { endpoint, method, body, queryParams, headers } = req.body;
    if (!endpoint) {
        return res.status(400).json({ success: false, error: 'Endpoint is required' });
    }
    logger_1.logger.info(`API proxy request for ${sourceId}: ${method || 'GET'} ${endpoint}`);
    try {
        const result = await (0, api_adapter_1.callExternalAPI)(sourceId, {
            endpoint,
            method: method || 'GET',
            body,
            queryParams,
            headers,
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(`API proxy error for ${sourceId}:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'API call failed',
        });
    }
});
//# sourceMappingURL=api-proxy.js.map