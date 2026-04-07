import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// In-memory storage for data sources (in production, use a database)
const dataSources = new Map<string, any>();

// Get all data sources
router.get('/', (req: Request, res: Response) => {
  const sources = Array.from(dataSources.values());
  res.json({ success: true, data: sources });
});

// Get a single data source
router.get('/:id', (req: Request, res: Response) => {
  const source = dataSources.get(req.params.id);
  if (!source) {
    return res.status(404).json({ success: false, error: 'Data source not found' });
  }
  res.json({ success: true, data: source });
});

// Add a new data source
router.post('/', (req: Request, res: Response) => {
  const config = req.body;
  
  if (!config.id || !config.type) {
    return res.status(400).json({ success: false, error: 'Missing required fields: id, type' });
  }
  
  dataSources.set(config.id, config);
  logger.info(`Data source added: ${config.id} (${config.type})`);
  
  res.json({ success: true, data: config });
});

// Update a data source
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = dataSources.get(id);
  
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Data source not found' });
  }
  
  const updated = { ...existing, ...req.body, id };
  dataSources.set(id, updated);
  logger.info(`Data source updated: ${id}`);
  
  res.json({ success: true, data: updated });
});

// Delete a data source
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!dataSources.has(id)) {
    return res.status(404).json({ success: false, error: 'Data source not found' });
  }
  
  dataSources.delete(id);
  logger.info(`Data source deleted: ${id}`);
  
  res.json({ success: true });
});

// Test connection
router.post('/:id/test', async (req: Request, res: Response) => {
  const source = dataSources.get(req.params.id);
  
  if (!source) {
    return res.status(404).json({ success: false, message: 'Data source not found' });
  }
  
  try {
    // Test based on source type
    switch (source.type) {
      case 'sql':
        // Import SQL adapter and test
        const { testSQLConnection } = await import('../adapters/sql-adapter');
        const sqlResult = await testSQLConnection(source);
        return res.json(sqlResult);
        
      case 'filesystem':
        // Import file adapter and test
        const { testFileSystemConnection } = await import('../adapters/file-adapter');
        const fsResult = await testFileSystemConnection(source);
        return res.json(fsResult);
        
      case 'api':
        // Import API adapter and test
        const { testAPIConnection } = await import('../adapters/api-adapter');
        const apiResult = await testAPIConnection(source);
        return res.json(apiResult);
        
      default:
        return res.json({ success: false, message: `Unknown source type: ${source.type}` });
    }
  } catch (error) {
    logger.error(`Connection test failed for ${req.params.id}:`, error);
    return res.json({
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
});

export { router as sourcesRouter };
