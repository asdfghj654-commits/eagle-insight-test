import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { callExternalAPI } from '../adapters/api-adapter';

const router = Router();

// Proxy API request
router.post('/:sourceId', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  const { endpoint, method, body, queryParams, headers } = req.body;
  
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Endpoint is required' });
  }
  
  logger.info(`API proxy request for ${sourceId}: ${method || 'GET'} ${endpoint}`);
  
  try {
    const result = await callExternalAPI(sourceId, {
      endpoint,
      method: method || 'GET',
      body,
      queryParams,
      headers,
    });
    
    res.json(result);
  } catch (error) {
    logger.error(`API proxy error for ${sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'API call failed',
    });
  }
});

export { router as apiProxyRouter };
