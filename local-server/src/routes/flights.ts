import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { loadFlightDataFromSource } from '../adapters/flight-data-adapter';

const router = Router();

// Load flight data from any source
router.post('/:sourceId', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  const { filters } = req.body;
  
  logger.info(`Loading flight data from ${sourceId}`, { filters });
  
  try {
    const result = await loadFlightDataFromSource(sourceId, filters);
    res.json(result);
  } catch (error) {
    logger.error(`Flight data loading error for ${sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load flight data',
    });
  }
});

// Get available flight IDs
router.get('/:sourceId/ids', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  const { tailNumber, dateFrom, dateTo } = req.query;
  
  try {
    const result = await loadFlightDataFromSource(sourceId, {
      tailNumbers: tailNumber ? [tailNumber as string] : undefined,
      dateRange: dateFrom && dateTo ? {
        start: dateFrom as string,
        end: dateTo as string,
      } : undefined,
    });
    
    if (result.success && result.data) {
      const flightIds = [...new Set(result.data.map((r: any) => r.flight_id))];
      res.json({ success: true, data: flightIds });
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get flight IDs',
    });
  }
});

// Get flight parameters (available columns)
router.get('/:sourceId/parameters', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  
  try {
    const result = await loadFlightDataFromSource(sourceId, {});
    
    if (result.success && result.data && result.data.length > 0) {
      const parameters = Object.keys(result.data[0]).filter(
        key => !['flight_id', 'tail_number', 'timestamp', 'phase'].includes(key)
      );
      res.json({ success: true, data: parameters });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get parameters',
    });
  }
});

export { router as flightsRouter };
