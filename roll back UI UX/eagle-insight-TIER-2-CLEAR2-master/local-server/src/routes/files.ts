import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { listDirectory, readFile } from '../adapters/file-adapter';

const router = Router();

// List directory contents
router.post('/:sourceId/list', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  const { path, recursive, fileTypes, includeMetadata } = req.body;
  
  logger.info(`Listing directory for ${sourceId}: ${path}`);
  
  try {
    const result = await listDirectory(sourceId, {
      path: path || '/',
      recursive: recursive || false,
      fileTypes,
      includeMetadata: includeMetadata !== false,
    });
    
    res.json(result);
  } catch (error) {
    logger.error(`Directory listing error for ${sourceId}:`, error);
    res.status(500).json({
      success: false,
      currentPath: path || '/',
      error: error instanceof Error ? error.message : 'Directory listing failed',
    });
  }
});

// Read file contents
router.post('/:sourceId/read', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  const { path, format, encoding, headers, delimiter, limit } = req.body;
  
  if (!path) {
    return res.status(400).json({ success: false, error: 'Path is required' });
  }
  
  logger.info(`Reading file for ${sourceId}: ${path}`);
  
  try {
    const result = await readFile(sourceId, {
      path,
      format: format || 'auto',
      encoding: encoding || 'utf-8',
      headers: headers !== false,
      delimiter: delimiter || ',',
      limit,
    });
    
    res.json(result);
  } catch (error) {
    logger.error(`File read error for ${sourceId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'File read failed',
    });
  }
});

// Get file info
router.get('/:sourceId/info', async (req: Request, res: Response) => {
  const { sourceId } = req.params;
  const path = req.query.path as string;
  
  if (!path) {
    return res.status(400).json({ success: false, error: 'Path is required' });
  }
  
  try {
    const result = await listDirectory(sourceId, {
      path,
      includeMetadata: true,
    });
    
    if (result.success && result.data && result.data.length > 0) {
      res.json({ success: true, data: result.data[0] });
    } else {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get file info',
    });
  }
});

export { router as filesRouter };
