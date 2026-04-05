"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqlRouter = void 0;
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const sql_adapter_1 = require("../adapters/sql-adapter");
const router = (0, express_1.Router)();
exports.sqlRouter = router;
// Execute SQL query
router.post('/:sourceId/query', async (req, res) => {
    const { sourceId } = req.params;
    const { query, parameters, limit, offset, timeout } = req.body;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Query is required' });
    }
    logger_1.logger.info(`SQL Query on ${sourceId}: ${query.substring(0, 100)}...`);
    try {
        const startTime = Date.now();
        const result = await (0, sql_adapter_1.executeSQL)(sourceId, {
            query,
            parameters,
            limit: limit || 1000,
            offset: offset || 0,
            timeout: timeout || 30000,
        });
        const executionTime = Date.now() - startTime;
        res.json({
            success: true,
            data: result.rows,
            metadata: {
                rowCount: result.rowCount,
                executionTime,
                columns: result.columns,
                sourceId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`SQL query error on ${sourceId}:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Query execution failed',
        });
    }
});
// Get table schema
router.get('/:sourceId/schema/:table', async (req, res) => {
    const { sourceId, table } = req.params;
    try {
        const result = await (0, sql_adapter_1.executeSQL)(sourceId, {
            query: `SELECT column_name, data_type, is_nullable 
              FROM information_schema.columns 
              WHERE table_name = $1`,
            parameters: { table },
        });
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get schema',
        });
    }
});
// List tables
router.get('/:sourceId/tables', async (req, res) => {
    const { sourceId } = req.params;
    try {
        const result = await (0, sql_adapter_1.executeSQL)(sourceId, {
            query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
        });
        res.json({ success: true, data: result.rows.map((r) => r.table_name) });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list tables',
        });
    }
});
//# sourceMappingURL=sql.js.map