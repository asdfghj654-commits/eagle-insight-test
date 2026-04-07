/**
 * Database Module — Eagle Insight Local MVP
 *
 * Uses Node.js built-in `node:sqlite` (available in Node v22.5+).
 * No native bindings required — works out of the box on Windows.
 *
 * DatabaseSync API mirrors better-sqlite3 semantics (synchronous),
 * making service code simple and predictable.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// node:sqlite is experimental in Node.js 22 — suppress the warning in logs
// but keep it visible via NODE_OPTIONS if needed for debugging.
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --no-experimental-sqlite-warning';

import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types (mirror better-sqlite3 API for easy migration later)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

interface Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): Row | undefined;
  all(...params: unknown[]): Row[];
}

// We use the built-in node:sqlite via require to avoid TS2712 errors
// (experimental module detection). The API is synchronous and stable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NodeSqlite: any;
try {
  NodeSqlite = require('node:sqlite');
} catch (e) {
  logger.error('[DB] node:sqlite not available. Requires Node.js v22.5+.');
  throw e;
}

// ---------------------------------------------------------------------------
// Thin wrapper that normalises node:sqlite to a better-sqlite3-like API
// ---------------------------------------------------------------------------

class Db {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _db: any;

  constructor(dbPath: string) {
    this._db = new NodeSqlite.DatabaseSync(dbPath);
    // WAL mode and foreign keys via the node:sqlite exec API
    this._db.exec("PRAGMA journal_mode = WAL;");
    this._db.exec("PRAGMA foreign_keys = ON;");
    this._db.exec("PRAGMA synchronous = NORMAL;");
  }

  exec(sql: string): void {
    this._db.exec(sql);
  }

  prepare(sql: string): Statement {
    const stmt = this._db.prepare(sql);
    return {
      run: (...params: unknown[]) => stmt.run(...params) as { changes: number; lastInsertRowid: number | bigint },
      get: (...params: unknown[]) => stmt.get(...params) as Row | undefined,
      all: (...params: unknown[]) => stmt.all(...params) as Row[],
    };
  }

  close(): void {
    this._db.close();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const DB_PATH  = path.join(DATA_DIR, 'eagle-insight.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) {
    _db = new Db(DB_PATH);
    logger.info(`[DB] Connected to ${DB_PATH}`);
    runMigrations(_db);
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

function runMigrations(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT    UNIQUE NOT NULL,
      run_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrations: { name: string; sql: string }[] = [
    { name: '001_initial_schema',          sql: MIGRATION_001 },
    { name: '002_seed_default_users',      sql: MIGRATION_002_SEED_USERS },
    { name: '003_seed_baseline_rules',     sql: MIGRATION_003_SEED_RULES },
    { name: '004_add_flights_schema',      sql: MIGRATION_004_FLIGHTS_SCHEMA },
    { name: '005_add_operational_tables',  sql: MIGRATION_005_OPERATIONAL_TABLES },
  ];

  for (const m of migrations) {
    const already = db.prepare('SELECT id FROM _migrations WHERE name = ?').get(m.name);
    if (!already) {
      logger.info(`[DB] Running migration: ${m.name}`);
      db.exec(m.sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(m.name);
    }
  }

  logger.info('[DB] Migrations complete.');
}

// ---------------------------------------------------------------------------
// Migration 001 — Core Schema
// ---------------------------------------------------------------------------

const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  personal_number TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  name_he         TEXT NOT NULL,
  role            TEXT NOT NULL CHECK(role IN ('technician','specialist','engineer','commander','admin')),
  role_he         TEXT NOT NULL,
  unit            TEXT NOT NULL DEFAULT '',
  unit_he         TEXT NOT NULL DEFAULT '',
  rank            TEXT NOT NULL DEFAULT '',
  rank_he         TEXT NOT NULL DEFAULT '',
  password_hash   TEXT NOT NULL,
  permissions     TEXT NOT NULL DEFAULT '[]',
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dossiers (
  id           TEXT PRIMARY KEY,
  flight_id    TEXT,
  tail_number  TEXT,
  flight_date  TEXT,
  pilot_name   TEXT,
  status       TEXT NOT NULL DEFAULT 'new',
  summary      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS findings (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  title_he       TEXT,
  summary        TEXT,
  summary_he     TEXT,
  severity       TEXT NOT NULL CHECK(severity IN ('S1','S2','S3','S4')),
  classification TEXT,
  source_type    TEXT NOT NULL DEFAULT 'measured',
  aircraft_id    TEXT,
  flight_id      TEXT,
  dossier_id     TEXT,
  rule_id        TEXT,
  evidence_refs  TEXT DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'new',
  assigned_to    TEXT,
  generated_by   TEXT,
  review_notes   TEXT,
  escalation_info TEXT,
  task_ids       TEXT DEFAULT '[]',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  finding_id   TEXT,
  assigned_to  TEXT,
  assigned_role TEXT,
  priority     TEXT NOT NULL DEFAULT 'medium',
  status       TEXT NOT NULL DEFAULT 'open',
  due_date     TEXT,
  notes        TEXT,
  outcome      TEXT,
  outcome_type TEXT,
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escalations (
  id           TEXT PRIMARY KEY,
  finding_id   TEXT,
  reason       TEXT NOT NULL,
  from_user    TEXT,
  from_role    TEXT NOT NULL,
  to_user      TEXT,
  to_role      TEXT NOT NULL,
  level        INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id                TEXT PRIMARY KEY,
  actor_id          TEXT,
  actor_role        TEXT,
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         TEXT,
  old_value         TEXT,
  new_value         TEXT,
  note              TEXT,
  approval_required INTEGER DEFAULT 0,
  related_finding   TEXT,
  related_task      TEXT,
  related_rule      TEXT,
  timestamp         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rules (
  id               TEXT PRIMARY KEY,
  rule_id          TEXT UNIQUE NOT NULL,
  type             TEXT NOT NULL DEFAULT 'engineer',
  system           TEXT,
  system_he        TEXT,
  parameter        TEXT NOT NULL,
  threshold_type   TEXT NOT NULL,
  threshold_value  TEXT NOT NULL,
  unit             TEXT,
  context          TEXT NOT NULL DEFAULT 'all',
  reference_doc    TEXT,
  clause           TEXT,
  name             TEXT,
  description      TEXT,
  severity         TEXT NOT NULL,
  severity_s       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',
  version          INTEGER NOT NULL DEFAULT 1,
  version_history  TEXT DEFAULT '[]',
  metrics          TEXT DEFAULT '{"matchedCount":0,"impactedAircraft":[],"falsePositiveCount":0}',
  created_by       TEXT,
  approved_by      TEXT,
  approval_status  TEXT DEFAULT 'pending',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS source_configs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  config     TEXT NOT NULL DEFAULT '{}',
  is_active  INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_trace_log (
  id                  TEXT PRIMARY KEY,
  trace_type          TEXT NOT NULL,
  input_context       TEXT,
  retrieved_docs      TEXT,
  model_response      TEXT,
  human_review        TEXT,
  human_corrected     INTEGER DEFAULT 0,
  quality_score       REAL,
  related_finding     TEXT,
  related_flight      TEXT,
  export_ready        INTEGER DEFAULT 0,
  timestamp           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rag_documents (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  source_ref    TEXT,
  doc_type      TEXT,
  content       TEXT,
  chunk_index   INTEGER DEFAULT 0,
  metadata      TEXT DEFAULT '{}',
  indexed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// ---------------------------------------------------------------------------
// Migration 004 — Persistent flight and telemetry storage
// ---------------------------------------------------------------------------

const MIGRATION_004_FLIGHTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS ingestion_batches (
  id              TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL,
  source_name     TEXT,
  source_filename TEXT,
  record_count    INTEGER NOT NULL DEFAULT 0,
  flight_count    INTEGER NOT NULL DEFAULT 0,
  imported_by     TEXT,
  imported_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flights (
  id                   TEXT PRIMARY KEY,
  batch_id             TEXT REFERENCES ingestion_batches(id) ON DELETE SET NULL,
  flight_id            TEXT UNIQUE NOT NULL,
  tail_number          TEXT NOT NULL,
  mission_type         TEXT,
  start_time           TEXT NOT NULL,
  end_time             TEXT NOT NULL,
  duration_minutes     REAL NOT NULL DEFAULT 0,
  phases               TEXT NOT NULL DEFAULT '[]',
  available_parameters TEXT NOT NULL DEFAULT '[]',
  record_count         INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telemetry_records (
  id         TEXT PRIMARY KEY,
  flight_id  TEXT NOT NULL REFERENCES flights(flight_id) ON DELETE CASCADE,
  timestamp  TEXT NOT NULL,
  phase      TEXT NOT NULL,
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_flights_tail_number ON flights(tail_number);
CREATE INDEX IF NOT EXISTS idx_flights_start_time ON flights(start_time);
CREATE INDEX IF NOT EXISTS idx_telemetry_flight_id ON telemetry_records(flight_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_records(timestamp);
`;

// ---------------------------------------------------------------------------
// Migration 005 — Operational Tables (evidence, rule results, aircraft, system state)
// ---------------------------------------------------------------------------

const MIGRATION_005_OPERATIONAL_TABLES = `

-- Evidence items persisted server-side (replaces localStorage evidence)
CREATE TABLE IF NOT EXISTS evidence_items (
  id              TEXT PRIMARY KEY,
  finding_id      TEXT,
  dossier_id      TEXT,
  flight_id       TEXT,
  sortie_id       TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),

  -- What kind of evidence
  evidence_type   TEXT NOT NULL DEFAULT 'parameter_selection',
  title           TEXT NOT NULL,
  title_he        TEXT,
  description     TEXT,
  description_he  TEXT,
  source_type     TEXT NOT NULL DEFAULT 'measured',
  source_system   TEXT,

  -- Content (JSON payload varies by type)
  content         TEXT NOT NULL DEFAULT '{}',

  -- For parameter charts
  parameter_name  TEXT,
  time_range_from TEXT,
  time_range_to   TEXT,
  value_min       REAL,
  value_max       REAL,
  value_mean      REAL,

  relevance       TEXT,
  relevance_he    TEXT,
  is_pinned       INTEGER NOT NULL DEFAULT 0
);

-- Rule execution results — tracks which rules ran, what they found
CREATE TABLE IF NOT EXISTS rule_execution_results (
  id              TEXT PRIMARY KEY,
  rule_id         TEXT NOT NULL,
  flight_id       TEXT,
  sortie_id       TEXT,
  aircraft_id     TEXT,
  batch_id        TEXT,
  executed_at     TEXT NOT NULL DEFAULT (datetime('now')),

  -- Did the rule run?
  did_run         INTEGER NOT NULL DEFAULT 1,
  skip_reason     TEXT,               -- Why it didn't run (missing parameter, etc.)

  -- Did it find a violation?
  violated        INTEGER NOT NULL DEFAULT 0,
  violation_value REAL,               -- The actual value that triggered the violation
  threshold_value REAL,               -- The threshold that was exceeded/not met
  finding_id      TEXT,               -- Link to the finding created (if any)

  -- Data quality at time of evaluation
  parameter_present  INTEGER NOT NULL DEFAULT 1,
  data_quality       TEXT DEFAULT 'complete'  -- 'complete', 'partial', 'missing'
);

-- Aircraft — canonical list of aircraft known to the system
CREATE TABLE IF NOT EXISTS aircraft (
  id              TEXT PRIMARY KEY,
  tail_number     TEXT UNIQUE NOT NULL,
  type            TEXT NOT NULL DEFAULT 'F-16',
  squadron        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- System state — persistent key/value store for operational state
-- Emergency mode, system version, feature flags, etc.
CREATE TABLE IF NOT EXISTS system_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  note        TEXT
);

-- Seed default system state
INSERT OR IGNORE INTO system_state (key, value, updated_by, note)
VALUES ('emergency_mode', '{"active":false,"reason":null,"activatedBy":null,"activatedAt":null}', 'system', 'Emergency mode initial state');

-- Fleet readiness snapshot — precomputed, updated on finding/task change
CREATE TABLE IF NOT EXISTS fleet_readiness_snapshot (
  tail_number       TEXT PRIMARY KEY,
  maintenance_status TEXT NOT NULL DEFAULT 'unknown',
  open_s1_count     INTEGER NOT NULL DEFAULT 0,
  open_s2_count     INTEGER NOT NULL DEFAULT 0,
  open_s3_count     INTEGER NOT NULL DEFAULT 0,
  open_task_count   INTEGER NOT NULL DEFAULT 0,
  last_sortie_date  TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_findings_status     ON findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_aircraft   ON findings(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity   ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_sortie     ON findings(flight_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned      ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_audit_entity        ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp     ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_evidence_finding    ON evidence_items(finding_id);
CREATE INDEX IF NOT EXISTS idx_evidence_flight     ON evidence_items(flight_id);
CREATE INDEX IF NOT EXISTS idx_rule_results_flight ON rule_execution_results(flight_id);
CREATE INDEX IF NOT EXISTS idx_rule_results_rule   ON rule_execution_results(rule_id);
`;

// ---------------------------------------------------------------------------
// Migration 002 — Seed Default Users
// Password hash is bcryptjs hash of 'password' (rounds=10).
// First-login password change strongly recommended.
// ---------------------------------------------------------------------------

const MIGRATION_002_SEED_USERS = `
INSERT OR IGNORE INTO users
  (id, personal_number, name, name_he, role, role_he, unit, unit_he, rank, rank_he, password_hash, permissions)
VALUES
  (
    'tech001', '8234567', 'Yossi Cohen', 'יוסי כהן',
    'technician', 'טכנאי מטוסים', 'Squadron 117', 'טייסת 117', 'Staff Sergeant', 'סמ"ר',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '["view_findings","ack_findings","add_notes","create_tasks","update_task_status","complete_task"]'
  ),
  (
    'spec001', '7123456', 'David Levi', 'דוד לוי',
    'specialist', 'ר"צ אחזקה', 'Squadron 117', 'טייסת 117', 'First Lieutenant', 'רס"ל',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '["view_findings","ack_findings","add_notes","create_tasks","update_task_status","complete_task","view_evidence","compare_flights","escalate_finding","triage","fleet_status","reports"]'
  ),
  (
    'eng001', '6012345', 'Ron Avraham', 'רון אברהם',
    'engineer', 'מהנדס אחזקה', 'Technical Branch', 'ענף טכני', 'Lieutenant Colonel', 'סא"ל',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '["view_findings","ack_findings","add_notes","create_tasks","update_task_status","complete_task","view_evidence","compare_flights","escalate_finding","approve_rules","modify_thresholds","reject_findings","approve_finding_rejection","investigation","rule_management","review_queue"]'
  ),
  (
    'cmd001', '5001234', 'Moshe Israeli', 'משה ישראלי',
    'commander', 'מפקד גף טכני', 'Technical Branch HQ', 'מפקדת גף טכני', 'Colonel', 'אל"מ',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '["view_all","fleet_overview","emergency_mode","view_pilot_behavior","accountability_reports"]'
  );
`;

// ---------------------------------------------------------------------------
// Migration 003 — Seed Baseline Rules
// ---------------------------------------------------------------------------

const MIGRATION_003_SEED_RULES = `
INSERT OR IGNORE INTO rules
  (id, rule_id, type, system, system_he, parameter, threshold_type, threshold_value,
   unit, context, reference_doc, clause, name, description, severity, severity_s,
   status, version, created_by)
VALUES
  ('r_hyd001','HYD_001','baseline','Hydraulics','מערכת הידראולית','hydraulic_pressure_psi',
   'less_than','2800','PSI','all','T.O. 1F-16A-2-70JG-00-1','§2.3.1',
   'Hydraulic Pressure Low','Hydraulic pressure below minimum safe operating threshold',
   'critical','S1','active',1,'system'),
  ('r_eng001','ENG_001','baseline','Engine','מנוע','egt_celsius',
   'greater_than','650','°C','all','T.O. 1F-16A-2-70GE-00-1','§3.1.2',
   'EGT Exceeded','Exhaust Gas Temperature exceeded maximum threshold',
   'critical','S1','active',1,'system'),
  ('r_eng002','ENG_002','baseline','Engine','מנוע','oil_pressure',
   'less_than','30','PSI','all','T.O. 1F-16A-2-70GE-00-1','§4.2.1',
   'Oil Pressure Low','Engine oil pressure below minimum operating limit',
   'high','S2','active',1,'system'),
  ('r_brk001','BRK_001','baseline','Brakes','מערכת בלמים','brake_temp_celsius',
   'greater_than','400','°C','all','T.O. 1F-16A-6-1','§5.3.1',
   'Brake Temperature High','Brake temperature exceeds safe operating range',
   'high','S2','active',1,'system'),
  ('r_eng003','ENG_003','baseline','Engine','מנוע','fuel_flow_pph',
   'greater_than','15000','PPH','combat','T.O. 1F-16A-2-70GE-00-1','§3.3.1',
   'Fuel Flow Excessive (Combat)','Fuel consumption abnormally high in combat context',
   'medium','S3','active',1,'system'),
  ('r_struc001','STRUC_001','baseline','Structure','מבנה','g_force',
   'greater_than','9','G','all','T.O. 1F-16A-1','§2.1.1',
   'G-Force Limit Exceeded','Structural G-force limit exceeded',
   'critical','S1','active',1,'system'),
  ('r_hyd002','HYD_002','baseline','Hydraulics','מערכת הידראולית','hydraulic_pressure_psi',
   'greater_than','3500','PSI','all','T.O. 1F-16A-2-70JG-00-1','§2.3.2',
   'Hydraulic Pressure High','Hydraulic pressure above maximum operating threshold',
   'high','S2','active',1,'system'),
  ('r_fuel001','FUEL_001','baseline','Fuel','מערכת דלק','fuel_remaining_lbs',
   'less_than','1500','lbs','all','T.O. 1F-16A-1-1','§7.2.1',
   'Fuel Low','Fuel quantity below minimum reserve threshold',
   'critical','S1','active',1,'system');
`;
