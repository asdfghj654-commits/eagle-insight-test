import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { flightsService } from '../services/flights-service';

export const operationsFlightsRouter = Router();

operationsFlightsRouter.use(requireAuth);

operationsFlightsRouter.get('/', (req: Request, res: Response) => {
  const sampleSizeRaw = req.query.sampleSize;
  const sampleSize = typeof sampleSizeRaw === 'string' ? Number.parseInt(sampleSizeRaw, 10) : null;
  const flights = flightsService.list({
    sampleSize: Number.isFinite(sampleSize) ? sampleSize : 1200,
  });
  return res.json({
    flights,
    count: flights.length,
  });
});

operationsFlightsRouter.get('/:flightId', (req: Request, res: Response) => {
  const flight = flightsService.getByFlightId(req.params.flightId);
  if (!flight) {
    return res.status(404).json({ error: 'Flight not found' });
  }
  return res.json({ flight });
});
