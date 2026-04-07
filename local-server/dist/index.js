"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const uuid_1 = require("uuid");
// Initialize DB before any services (runs migrations on first start)
const db_1 = require("./database/db");
// Routes — legacy data proxy
const sql_1 = require("./routes/sql");
const files_1 = require("./routes/files");
const api_proxy_1 = require("./routes/api-proxy");
const sources_1 = require("./routes/sources");
const flights_1 = require("./routes/flights");
// Routes — new MVP operational routes
const auth_1 = require("./routes/auth");
const findings_1 = require("./routes/findings");
const tasks_1 = require("./routes/tasks");
const rules_api_1 = require("./routes/rules-api");
const dossiers_api_1 = require("./routes/dossiers-api");
const audit_api_1 = require("./routes/audit-api");
const ingestion_1 = require("./routes/ingestion");
const operations_flights_1 = require("./routes/operations-flights");
const system_state_1 = require("./routes/system-state");
const evidence_api_1 = require("./routes/evidence-api");
const logger_1 = require("./utils/logger");
const auth_service_1 = require("./services/auth-service");
const source_config_service_1 = require("./services/source-config-service");
// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
dotenv_1.default.config();
// Ensure DB is initialized on startup
try {
    (0, db_1.getDb)();
    source_config_service_1.sourceConfigService.registerAll();
}
catch (err) {
    logger_1.logger.error('[Startup] Failed to initialize database:', err);
    process.exit(1);
}
// Periodic session cleanup (every 30 minutes)
setInterval(() => auth_service_1.authService.purgeExpiredSessions(), 30 * 60 * 1000);
// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY; // Optional static key for non-JWT callers
// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const ALLOWED_ORIGINS = new Set([
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
]);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.has(origin)) {
            callback(null, origin || true);
            return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use((0, morgan_1.default)('combined', { stream: { write: (msg) => logger_1.logger.info(msg.trim()) } }));
// Attach request ID
app.use((req, _res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || (0, uuid_1.v4)();
    next();
});
// Static API Key guard (only for legacy proxy routes, not for JWT-protected routes)
const LEGACY_PROXY_PATHS = ['/api/sql', '/api/files', '/api/proxy', '/api/sources', '/api/flights'];
app.use((req, res, next) => {
    if (API_KEY && LEGACY_PROXY_PATHS.some(p => req.path.startsWith(p))) {
        const provided = req.headers['x-api-key'];
        if (provided !== API_KEY) {
            logger_1.logger.warn(`[API Key] Unauthorized request to ${req.path}`);
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }
    next();
});
// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
// Health
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        uptime: process.uptime(),
    });
});
// MVP operational routes (JWT-protected internally)
app.use('/api/auth', auth_1.authRouter);
app.use('/api/findings', findings_1.findingsRouter);
app.use('/api/tasks', tasks_1.tasksRouter);
app.use('/api/rules', rules_api_1.rulesApiRouter);
app.use('/api/dossiers', dossiers_api_1.dossiersApiRouter);
app.use('/api/audit', audit_api_1.auditApiRouter);
app.use('/api/ingestion', ingestion_1.ingestionRouter);
app.use('/api/operations/flights', operations_flights_1.operationsFlightsRouter);
app.use('/api/system', system_state_1.systemStateRouter);
app.use('/api/evidence', evidence_api_1.evidenceApiRouter);
// Legacy data proxy routes (API Key protected)
app.use('/api/sources', sources_1.sourcesRouter);
app.use('/api/sql', sql_1.sqlRouter);
app.use('/api/files', files_1.filesRouter);
app.use('/api/proxy', api_proxy_1.apiProxyRouter);
app.use('/api/flights', flights_1.flightsRouter);
// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
    logger_1.logger.error(`Error: ${err.message}`, { stack: err.stack, path: req.path });
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
    logger_1.logger.info(`Eagle Insight Local Server running on http://localhost:${PORT}`);
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
exports.default = app;
//# sourceMappingURL=index.js.map