"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationsFlightsRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth-middleware");
const flights_service_1 = require("../services/flights-service");
exports.operationsFlightsRouter = (0, express_1.Router)();
exports.operationsFlightsRouter.use(auth_middleware_1.requireAuth);
exports.operationsFlightsRouter.get('/', (req, res) => {
    const sampleSizeRaw = req.query.sampleSize;
    const sampleSize = typeof sampleSizeRaw === 'string' ? Number.parseInt(sampleSizeRaw, 10) : null;
    const flights = flights_service_1.flightsService.list({
        sampleSize: Number.isFinite(sampleSize) ? sampleSize : 1200,
    });
    return res.json({
        flights,
        count: flights.length,
    });
});
exports.operationsFlightsRouter.get('/:flightId', (req, res) => {
    const flight = flights_service_1.flightsService.getByFlightId(req.params.flightId);
    if (!flight) {
        return res.status(404).json({ error: 'Flight not found' });
    }
    return res.json({ flight });
});
//# sourceMappingURL=operations-flights.js.map