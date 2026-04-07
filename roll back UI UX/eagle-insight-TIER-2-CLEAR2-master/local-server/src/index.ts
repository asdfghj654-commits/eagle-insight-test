/**
 * F-16 Data Proxy Server
 * Local server for connecting to SQL databases, file systems, and APIs
 * Designed for on-premise deployment on Windows
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

import { sqlRouter } from './routes/sql';
import { filesRouter } from './routes/files';
import { apiProxyRouter } from './routes/api-proxy';
import { sourcesRouter } from './routes/sources';
import { flightsRouter } from './routes/flights';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// API Key authentication (optional)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (API_KEY && req.path !== '/api/health') {
    const providedKey = req.headers['x-api-key'];
    if (providedKey !== API_KEY) {
      logger.warn(`Unauthorized request to ${req.path}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/sources', sourcesRouter);
app.use('/api/sql', sqlRouter);
app.use('/api/files', filesRouter);
app.use('/api/proxy', apiProxyRouter);
app.use('/api/flights', flightsRouter);

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack, path: req.path });
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 F-16 Data Proxy Server running on http://localhost:${PORT}`);
  logger.info(`📊 API Key required: ${API_KEY ? 'Yes' : 'No'}`);
  console.log(`\n  ╔════════════════════════════════════════════╗`);
  console.log(`  ║  F-16 Data Proxy Server                    ║`);
  console.log(`  ║  Running on: http://localhost:${PORT}         ║`);
  console.log(`  ╚════════════════════════════════════════════╝\n`);
});

export default app;
