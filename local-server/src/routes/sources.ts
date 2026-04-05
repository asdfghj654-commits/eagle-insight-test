import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sourceConfigService } from '../services/source-config-service';

const router = Router();

// Get all data sources
router.get('/', (req: Request, res: Response) => {
  const sources = sourceConfigService.list().map(sourceToClientShape);
  res.json({ success: true, data: sources });
});

// Get a single data source
router.get('/:id', (req: Request, res: Response) => {
  const source = sourceConfigService.getById(req.params.id);
  if (!source) {
    return res.status(404).json({ success: false, error: 'Data source not found' });
  }
  res.json({ success: true, data: sourceToClientShape(source) });
});

// Add a new data source
router.post('/', (req: Request, res: Response) => {
  const config = req.body;
  
  if (!config.id || !config.type) {
    return res.status(400).json({ success: false, error: 'Missing required fields: id, type' });
  }

  const saved = sourceConfigService.upsert(clientToSourceConfig(config));
  logger.info(`Data source added: ${config.id} (${config.type})`);
  
  res.json({ success: true, data: sourceToClientShape(saved) });
});

// Update a data source
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = sourceConfigService.getById(id);
  
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Data source not found' });
  }
  
  const updated = { ...existing, ...req.body, id };
  const saved = sourceConfigService.upsert(clientToSourceConfig(updated));
  logger.info(`Data source updated: ${id}`);
  
  res.json({ success: true, data: sourceToClientShape(saved) });
});

// Delete a data source
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!sourceConfigService.delete(id)) {
    return res.status(404).json({ success: false, error: 'Data source not found' });
  }

  logger.info(`Data source deleted: ${id}`);
  
  res.json({ success: true });
});

// Test connection
router.post('/:id/test', async (req: Request, res: Response) => {
  const source = sourceConfigService.getById(req.params.id);
  
  if (!source) {
    return res.status(404).json({ success: false, message: 'Data source not found' });
  }
  
  try {
    // Test based on source type
    switch (source.type) {
      case 'sql':
        // Import SQL adapter and test
        const { testSQLConnection } = await import('../adapters/sql-adapter');
        const sqlResult = await testSQLConnection(source.config as any);
        return res.json(sqlResult);
        
      case 'filesystem':
        // Import file adapter and test
        const { testFileSystemConnection } = await import('../adapters/file-adapter');
        const fsResult = await testFileSystemConnection(source.config as any);
        return res.json(fsResult);
        
      case 'api':
        // Import API adapter and test
        const { testAPIConnection } = await import('../adapters/api-adapter');
        const apiResult = await testAPIConnection(source.config as any);
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

function clientToSourceConfig(input: Record<string, any>) {
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

function sourceToClientShape(source: {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}) {
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
