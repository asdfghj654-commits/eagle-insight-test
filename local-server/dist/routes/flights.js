"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flightsRouter = void 0;
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const flight_data_adapter_1 = require("../adapters/flight-data-adapter");
const router = (0, express_1.Router)();
exports.flightsRouter = router;
// Load flight data from any source
router.post('/:sourceId', async (req, res) => {
    const { sourceId } = req.params;
    const { filters } = req.body;
    logger_1.logger.info(`Loading flight data from ${sourceId}`, { filters });
    try {
        const result = await (0, flight_data_adapter_1.loadFlightDataFromSource)(sourceId, filters);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(`Flight data loading error for ${sourceId}:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load flight data',
        });
    }
});
// Get available flight IDs
router.get('/:sourceId/ids', async (req, res) => {
    const { sourceId } = req.params;
    const { tailNumber, dateFrom, dateTo } = req.query;
    try {
        const result = await (0, flight_data_adapter_1.loadFlightDataFromSource)(sourceId, {
            tailNumbers: tailNumber ? [tailNumber] : undefined,
            dateRange: dateFrom && dateTo ? {
                start: dateFrom,
                end: dateTo,
            } : undefined,
        });
        if (result.success && result.data) {
            const flightIds = [...new Set(result.data.map((r) => r.flight_id))];
            res.json({ success: true, data: flightIds });
        }
        else {
            res.json(result);
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get flight IDs',
        });
    }
});
// Get flight parameters (available columns)
router.get('/:sourceId/parameters', async (req, res) => {
    const { sourceId } = req.params;
    try {
        const result = await (0, flight_data_adapter_1.loadFlightDataFromSource)(sourceId, {});
        if (result.success && result.data && result.data.length > 0) {
            const parameters = Object.keys(result.data[0]).filter(key => !['flight_id', 'tail_number', 'timestamp', 'phase'].includes(key));
            res.json({ success: true, data: parameters });
        }
        else {
            res.json({ success: true, data: [] });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get parameters',
        });
    }
});
//# sourceMappingURL=flights.js.map