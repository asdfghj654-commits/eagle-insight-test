"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourcesRouter = void 0;
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const source_config_service_1 = require("../services/source-config-service");
const router = (0, express_1.Router)();
exports.sourcesRouter = router;
// Get all data sources
router.get('/', (req, res) => {
    const sources = source_config_service_1.sourceConfigService.list().map(sourceToClientShape);
    res.json({ success: true, data: sources });
});
// Get a single data source
router.get('/:id', (req, res) => {
    const source = source_config_service_1.sourceConfigService.getById(req.params.id);
    if (!source) {
        return res.status(404).json({ success: false, error: 'Data source not found' });
    }
    res.json({ success: true, data: sourceToClientShape(source) });
});
// Add a new data source
router.post('/', (req, res) => {
    const config = req.body;
    if (!config.id || !config.type) {
        return res.status(400).json({ success: false, error: 'Missing required fields: id, type' });
    }
    const saved = source_config_service_1.sourceConfigService.upsert(clientToSourceConfig(config));
    logger_1.logger.info(`Data source added: ${config.id} (${config.type})`);
    res.json({ success: true, data: sourceToClientShape(saved) });
});
// Update a data source
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const existing = source_config_service_1.sourceConfigService.getById(id);
    if (!existing) {
        return res.status(404).json({ success: false, error: 'Data source not found' });
    }
    const updated = { ...existing, ...req.body, id };
    const saved = source_config_service_1.sourceConfigService.upsert(clientToSourceConfig(updated));
    logger_1.logger.info(`Data source updated: ${id}`);
    res.json({ success: true, data: sourceToClientShape(saved) });
});
// Delete a data source
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    if (!source_config_service_1.sourceConfigService.delete(id)) {
        return res.status(404).json({ success: false, error: 'Data source not found' });
    }
    logger_1.logger.info(`Data source deleted: ${id}`);
    res.json({ success: true });
});
// Test connection
router.post('/:id/test', async (req, res) => {
    const source = source_config_service_1.sourceConfigService.getById(req.params.id);
    if (!source) {
        return res.status(404).json({ success: false, message: 'Data source not found' });
    }
    try {
        // Test based on source type
        switch (source.type) {
            case 'sql':
                // Import SQL adapter and test
                const { testSQLConnection } = await Promise.resolve().then(() => __importStar(require('../adapters/sql-adapter')));
                const sqlResult = await testSQLConnection(source.config);
                return res.json(sqlResult);
            case 'filesystem':
                // Import file adapter and test
                const { testFileSystemConnection } = await Promise.resolve().then(() => __importStar(require('../adapters/file-adapter')));
                const fsResult = await testFileSystemConnection(source.config);
                return res.json(fsResult);
            case 'api':
                // Import API adapter and test
                const { testAPIConnection } = await Promise.resolve().then(() => __importStar(require('../adapters/api-adapter')));
                const apiResult = await testAPIConnection(source.config);
                return res.json(apiResult);
            default:
                return res.json({ success: false, message: `Unknown source type: ${source.type}` });
        }
    }
    catch (error) {
        logger_1.logger.error(`Connection test failed for ${req.params.id}:`, error);
        return res.json({
            success: false,
            message: error instanceof Error ? error.message : 'Connection test failed',
        });
    }
});
function clientToSourceConfig(input) {
    const { id, name, type, enabled, createdBy, createdAt, updatedAt, ...config } = input;
    return {
        id,
        name: name || id,
        type,
        enabled,
        createdBy,
        config,
    };
}
function sourceToClientShape(source) {
    return {
        id: source.id,
        name: source.name,
        type: source.type,
        enabled: source.isActive,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        ...source.config,
    };
}
//# sourceMappingURL=sources.js.map