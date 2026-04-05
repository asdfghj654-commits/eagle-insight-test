/**
 * Eagle Insight Local MVP Server
 *
 * Provides:
 * - Real local authentication (JWT + bcrypt)
 * - Persistent SQLite backend (findings, tasks, rules, audit, dossiers)
 * - Data source adapters (SQL, file, API, CSV)
 * - All operational API endpoints
 *
 * Designed for on-premise / air-gapped deployment on Windows.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Initialize DB before any services (runs migrations on first start)
import { getDb } from './database/db';

// Routes — legacy data proxy
import { sqlRouter } from './routes/sql';
import { filesRouter } from './routes/files';
import { apiProxyRouter } from './routes/api-proxy';
import { sourcesRouter } from './routes/sources';
import { flightsRouter } from './routes/flights';

// Routes — new MVP operational routes
import { authRouter } from './routes/auth';
import { findingsRouter } from './routes/findings';
import { tasksRouter } from './routes/tasks';
import { rulesApiRouter } from './routes/rules-api';
import { dossiersApiRouter } from './routes/dossiers-api';
import { auditApiRouter } from './routes/audit-api';
import { ingestionRouter } from './routes/ingestion';
import { operationsFlightsRouter } from './routes/operations-flights';

import { logger } from './utils/logger';
import { authService } from './services/auth-service';
import { sourceConfigService } from './services/source-config-service';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

dotenv.config();

// Ensure DB is initialized on startup
try {
  getDb();
  sourceConfigService.registerAll();
} catch (err) {
  logger.error('[Startup] Failed to initialize database:', err);
  process.exit(1);
}

// Periodic session cleanup (every 30 minutes)
setInterval(() => authService.purgeExpiredSessions(), 30 * 60 * 1000);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY; // Optional static key for non-JWT callers

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      callback(null, origin || true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Attach request ID
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// Static API Key guard (only for legacy proxy routes, not for JWT-protected routes)
const LEGACY_PROXY_PATHS = ['/api/sql', '/api/files', '/api/proxy', '/api/sources', '/api/flights'];
app.use((req: Request, res: Response, next: NextFunction) => {
  if (API_KEY && LEGACY_PROXY_PATHS.some(p => req.path.startsWith(p))) {
    const provided = req.headers['x-api-key'];
    if (provided !== API_KEY) {
      logger.warn(`[API Key] Unauthorized request to ${req.path}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    uptime: process.uptime(),
  });
});

// MVP operational routes (JWT-protected internally)
app.use('/api/auth',     authRouter);
app.use('/api/findings', findingsRouter);
app.use('/api/tasks',    tasksRouter);
app.use('/api/rules',    rulesApiRouter);
app.use('/api/dossiers', dossiersApiRouter);
app.use('/api/audit',    auditApiRouter);
app.use('/api/ingestion', ingestionRouter);
app.use('/api/operations/flights', operationsFlightsRouter);

// Legacy data proxy routes (API Key protected)
app.use('/api/sources', sourcesRouter);
app.use('/api/sql',     sqlRouter);
app.use('/api/files',   filesRouter);
app.use('/api/proxy',   apiProxyRouter);
app.use('/api/flights', flightsRouter);

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack, path: req.path });
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  logger.info(`Eagle Insight Local Server running on http://localhost:${PORT}`);
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║  Eagle Insight Local MVP Server v2.0                 ║
  ║  http://localhost:${PORT}                               ║
  ║                                                      ║
  ║  Auth:     POST /api/auth/login                      ║
  ║  Findings: GET  /api/findings                        ║
  ║  Tasks:    GET  /api/tasks                           ║
  ║  Rules:    GET  /api/rules                           ║
  ║  Audit:    GET  /api/audit                           ║
  ║  Health:   GET  /api/health                          ║
  ╚══════════════════════════════════════════════════════╝
  `);
});

export default app;
