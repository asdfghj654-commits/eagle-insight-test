import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { executeSQL } from '../adapters/sql-adapter';

const router = Router();

// Execute SQL query
router.post('/:sourceId/query', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  const { query, parameters, limit, offset, timeout } = req.body;
  
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }
  
  logger.info(`SQL Query on ${sourceId}: ${query.substring(0, 100)}...`);
  
  try {
    const startTime = Date.now();
    const result = await executeSQL(sourceId, {
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
  } catch (error) {
    logger.error(`SQL query error on ${sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Query execution failed',
    });
  }
});

// Get table schema
router.get('/:sourceId/schema/:table', async (req: Request, res: Response) => {
  const { sourceId, table } = req.params;
  
  try {
    const result = await executeSQL(sourceId, {
      query: `SELECT column_name, data_type, is_nullable 
              FROM information_schema.columns 
              WHERE table_name = $1`,
      parameters: { table },
    });
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get schema',
    });
  }
});

// List tables
router.get('/:sourceId/tables', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  
  try {
    const result = await executeSQL(sourceId, {
      query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    });
    
    res.json({ success: true, data: result.rows.map((r: any) => r.table_name) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list tables',
    });
  }
});

export { router as sqlRouter };
