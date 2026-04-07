# Document 4: Technical Architecture Redesign Specification

**Date:** 2026-04-05

---

## 1. Architectural Principles

The redesigned architecture must be governed by the following principles:

1. **Canonical operational truth lives on the server.** No operational state (findings, rules, evidence, tasks) is authoritative in the browser. Browser state is a derived view.
2. **Rule evaluation happens on the server.** Never in the browser. Browser submits data; server evaluates and stores results.
3. **One truth source per entity.** Rules exist in SQLite only. Findings exist in SQLite only. No parallel state.
4. **Empty is better than fabricated.** Missing data shows an explicit message, never a placeholder metric.
5. **Audit every state transition.** Every status change, assignment, escalation, and rule evaluation writes an audit record.
6. **Local-first resilience.** The system must be usable with the local SQLite server. Cloud/OpenShift is a later deployment target, not a design driver.
7. **Separation of ingestion, evaluation, workflow, and presentation.** Each layer has a clear boundary.
8. **Honest data lineage.** Every finding and chart carries metadata: source, timestamp, rule reference.
9. **AI-ready contracts without fake AI.** Scaffold the AI layer with proper interfaces. Do not call anything AI that isn't.
10. **Standard integration patterns.** SQL/JDBC for relational, REST for APIs, file ingestion for CSV, S3-compatible for object storage.

---

## 2. Target Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│   React + TypeScript + shadcn/ui (RTL Hebrew)                   │
│   Role-based pages | Investigation workbench | Empty states     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (JSON)
┌──────────────────────────▼──────────────────────────────────────┐
│                    API GATEWAY / LOCAL SERVER                    │
│   Node.js + Express                                             │
│   Auth middleware (JWT) | Rate limiting | CORS | Audit hooks    │
└──────┬──────────┬──────────┬──────────┬────────────────────────┘
       │          │          │          │
┌──────▼──┐  ┌───▼────┐  ┌──▼─────┐  ┌▼──────────┐
│Ingestion │  │Rules   │  │Workflow│  │Query/Read │
│Service  │  │Service │  │Service │  │Service    │
└──────┬──┘  └───┬────┘  └──┬─────┘  └┬──────────┘
       │          │          │          │
┌──────▼──────────▼──────────▼──────────▼──────────┐
│              DATA LAYER                           │
│  SQLite (operational) | File store (CSVs, docs)  │
│  [Future: TimescaleDB/InfluxDB for telemetry]    │
│  [Future: S3-compatible object storage]          │
└───────────────────────────────────────────────────┘
```

---

## 3. Canonical Data Model

### 3.1 Aircraft

```typescript
interface Aircraft {
  id: string;                    // UUID
  tailNumber: string;            // e.g. "253"
  type: string;                  // e.g. "F-16D"
  squadron: string;
  maintenanceStatus: 'ready' | 'degraded' | 'grounded' | 'unknown';
  lastMaintenanceDate?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Sortie (Flight)

```typescript
interface Sortie {
  id: string;                    // UUID
  flightId: string;              // External ID (e.g. from source system)
  tailNumber: string;
  aircraftId: string;
  pilotId?: string;              // Reference, not name (for access control)
  missionType: 'training' | 'combat' | 'weather_hard' | 'ferry' | 'test';
  startTime: string;             // ISO 8601
  endTime?: string;
  durationMinutes?: number;
  phases: FlightPhase[];
  status: 'in_flight' | 'landed' | 'processed' | 'archived';
  dataSourceId: string;          // Which source/upload produced this
  availableParameters: string[]; // Which telemetry params are in the data
  createdAt: string;
  updatedAt: string;
}

interface FlightPhase {
  name: 'taxi' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'landing';
  startIndex: number;
  endIndex: number;
  startTime: string;
  endTime: string;
}
```

### 3.3 Telemetry Record

```typescript
// Stored in SQLite for MVP; future: time-series database
interface TelemetryRecord {
  id: string;
  sortieid: string;
  timestamp: string;
  phase: string;
  parameters: Record<string, number>; // Stored as JSON blob in SQLite
}
```

### 3.4 Rule

```typescript
interface Rule {
  id: string;                    // UUID
  ruleId: string;                // Business ID: HYD_001, ENG_001 etc.
  type: 'baseline' | 'engineer';
  system: string;
  systemHe: string;
  parameter: string;
  thresholdType: 'greater_than' | 'less_than' | 'band' | 'consecutive' | 'trend';
  thresholdValue: number | [number, number];
  unit?: string;
  context: 'training' | 'combat' | 'weather_hard' | 'all';
  referenceDoc?: string;
  clause?: string;
  severity: 'S1' | 'S2' | 'S3' | 'S4';
  status: 'draft' | 'pending_approval' | 'active' | 'paused' | 'deprecated';
  version: number;
  versionHistory: RuleVersion[];
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  metrics: RuleMetrics;
  createdAt: string;
  updatedAt: string;
}
```

### 3.5 Rule Execution Result

New entity — currently missing. Tracks every rule evaluation:

```typescript
interface RuleExecutionResult {
  id: string;
  ruleId: string;
  sortieId: string;
  tailNumber: string;
  evaluatedAt: string;
  parameterPresent: boolean;      // Was the parameter in the dataset?
  violated: boolean;
  actualValue?: number;
  thresholdValue?: number | [number, number];
  violationTimestamp?: string;    // When in the flight the violation occurred
  findingId?: string;             // If a finding was created from this result
  evaluationSource: 'ingestion' | 'manual_rerun' | 'backfill';
}
```

### 3.6 Finding

```typescript
interface Finding {
  id: string;
  title: string;
  titleHe?: string;
  summary?: string;
  summaryHe?: string;
  severity: 'S1' | 'S2' | 'S3' | 'S4';
  classification?: string;
  sourceType: 'measured' | 'reported';  // measured = from telemetry; reported = manual entry
  aircraftId?: string;
  sortieId?: string;
  dossierId?: string;
  ruleId?: string;
  ruleExecutionResultId?: string;       // Link to exact rule evaluation
  evidenceRefs: string[];               // Links to EvidenceItem IDs
  status: FindingStatus;
  assignedTo?: string;
  generatedBy: string;                  // user ID or 'rules-engine'
  reviewNotes?: string;
  escalationInfo?: string;
  taskIds: string[];
  // Removed: hardcoded confidence — add this only when backed by real calculation
  createdAt: string;
  updatedAt: string;
}
```

### 3.7 Evidence Item

New entity — currently findings reference evidence via string refs only:

```typescript
interface EvidenceItem {
  id: string;
  name: string;
  nameHe?: string;
  description?: string;
  type: 'signal_selection' | 'parameter_chart' | 'event_log' | 'document_ref' | 'manual_note';
  sourceType: 'measured' | 'reported';
  sortieId?: string;
  aircraftId?: string;
  parameters: string[];
  timeRange?: { start: string; end: string };
  valueRange?: { min: number; max: number };
  data?: any;                           // Selected data subset
  createdBy: string;
  createdAt: string;
  dossierId?: string;
  findingId?: string;
}
```

### 3.8 Dossier

```typescript
interface Dossier {
  id: string;
  title: string;
  titleHe?: string;
  aircraftId?: string;
  tailNumber?: string;
  sortieId?: string;
  flightId?: string;
  flightDate?: string;
  missionType?: string;
  status: 'open' | 'under_review' | 'closed' | 'archived';
  summary?: string;
  summaryHe?: string;
  findingIds: string[];
  taskIds: string[];
  evidenceIds: string[];
  createdBy: string;
  assignedEngineer?: string;
  closedAt?: string;
  closedBy?: string;
  closureNote?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.9 Task

```typescript
interface Task {
  id: string;
  title: string;
  findingId?: string;
  dossierId?: string;
  aircraftId?: string;
  assignedTo?: string;
  assignedRole: UserRole;
  assignedBy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  dueDate?: string;
  notes?: string;
  outcome?: string;
  outcomeType?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.10 Audit Log Entry

```typescript
interface AuditLogEntry {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;                // e.g. 'finding.status.changed', 'rule.approved'
  entityType: string;            // 'finding' | 'task' | 'rule' | 'dossier' | 'user'
  entityId: string;
  oldValue?: string;             // JSON
  newValue?: string;             // JSON
  note?: string;
  approvalRequired: boolean;
  relatedFinding?: string;
  relatedTask?: string;
  relatedRule?: string;
  ipAddress?: string;
  timestamp: string;
}
```

### 3.11 DataSource Config

```typescript
interface DataSourceConfig {
  id: string;
  name: string;
  type: 'csv_upload' | 'sql' | 'rest_api' | 'file_system' | 'object_storage';
  config: Record<string, any>;    // Type-specific configuration
  isActive: boolean;
  lastConnected?: string;
  lastError?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.12 AI Trace Record (future-ready, schema already exists)

```typescript
interface AiTraceRecord {
  id: string;
  traceType: 'explanation' | 'summarization' | 'retrieval' | 'recommendation';
  inputContext: string;           // JSON: what was given to the AI
  retrievedDocs: string;         // JSON: RAG results
  modelResponse: string;
  humanReview?: string;
  humanCorrected: boolean;
  qualityScore?: number;
  relatedFinding?: string;
  relatedFlight?: string;
  exportReady: boolean;          // Ready for fine-tuning export
  timestamp: string;
}
```

---

## 4. Service Boundaries

### 4.1 Ingestion Service

**Responsibility:** Accept raw data (CSV, SQL query result, API response), normalize to canonical `Sortie` + `TelemetryRecord` format, store in SQLite, trigger rule evaluation.

**Must do:**
- Parse CSV with field mapping
- Detect flight boundaries (by flight_id or time gap)
- Identify phase labels
- Store normalized records
- Emit ingestion event: `sortie.ingested`
- Trigger rule evaluation job

**Must not do:**
- Run rules itself
- Write to finding table directly
- Return unprocessed raw CSV data to frontend

### 4.2 Rules Service

**Responsibility:** Manage rule definitions (CRUD, approval workflow). Evaluate rules against telemetry. Store execution results. Generate findings when rules are violated.

**Critical change from current:** Rule evaluation MOVES from client-side (`src/lib/rules-engine.ts`) to server-side (`local-server/src/services/rules-service.ts`).

**Evaluation flow:**
```
sortie.ingested event
  → rules-service.evaluateForSortie(sortieId)
  → Load active rules from SQLite
  → Load telemetry records for sortieId from SQLite
  → For each rule: evaluate → store RuleExecutionResult
  → For each violation: createFinding() if not duplicate
  → Emit findings.created event
```

**Must do:**
- Server-side evaluation only
- Store `RuleExecutionResult` for every rule evaluated (not just violations)
- Track missing parameters explicitly
- Deduplication: do not create duplicate findings for same rule+sortie

### 4.3 Findings Service

**Responsibility:** CRUD for findings. Status transitions with permission enforcement. Bulk creation from rule evaluation.

**Change:** Add `ruleExecutionResultId` link. Remove hardcoded confidence.

### 4.4 Dossier Service

**Responsibility:** Create, manage, and close investigation dossiers. Link findings, tasks, evidence.

**Change:** Dossiers must be loadable by the frontend. `dossiersApi.list()` must be called by `FlightDossierContext`.

### 4.5 Evidence Service (new)

**Responsibility:** Persist evidence items created during investigation. Link to dossiers and findings.

Currently evidence exists only in `localStorage`. This service moves it to SQLite.

**API endpoints needed:**
- `POST /api/evidence` — create evidence item
- `GET /api/evidence?dossierId=X` — list for dossier
- `GET /api/evidence/:id` — detail
- `PATCH /api/evidence/:id` — update name/description

### 4.6 Task Service

No major change needed. Ensure `aircraftId` is stored on tasks (currently it is not in the schema).

### 4.7 Audit Service

No major change. Ensure rule evaluation events are audited.

### 4.8 Auth Service

No major change. Ensure emergency mode state is persisted (currently in-memory only). Add `system_state` table or extend with a key-value config store.

### 4.9 AI Gateway (stub — future)

Current state: `src/lib/ai/provider-interface.ts`, `rag-interface.ts`, `fine-tuning.ts` stubs exist.

Keep these as interfaces only. Do not activate. Add server-side stub route:
- `POST /api/ai/explain` → returns `{ available: false }` for now
- `POST /api/ai/summarize` → returns `{ available: false }` for now

This establishes the contract without fake behavior.

---

## 5. Database Schema Changes

### Add to existing SQLite schema

```sql
-- Rule execution results (currently missing)
CREATE TABLE IF NOT EXISTS rule_execution_results (
  id                    TEXT PRIMARY KEY,
  rule_id               TEXT NOT NULL,
  sortie_id             TEXT,
  tail_number           TEXT,
  evaluated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  parameter_present     INTEGER NOT NULL DEFAULT 0,
  violated              INTEGER NOT NULL DEFAULT 0,
  actual_value          REAL,
  threshold_value       TEXT,
  violation_timestamp   TEXT,
  finding_id            TEXT,
  evaluation_source     TEXT NOT NULL DEFAULT 'ingestion'
);

-- Evidence items (currently only in localStorage)
CREATE TABLE IF NOT EXISTS evidence_items (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name_he       TEXT,
  description   TEXT,
  type          TEXT NOT NULL,
  source_type   TEXT NOT NULL DEFAULT 'measured',
  sortie_id     TEXT,
  aircraft_id   TEXT,
  parameters    TEXT DEFAULT '[]',
  time_range    TEXT,
  value_range   TEXT,
  data_json     TEXT,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  dossier_id    TEXT,
  finding_id    TEXT
);

-- Aircraft registry (currently implicit from tail numbers in findings)
CREATE TABLE IF NOT EXISTS aircraft (
  id                  TEXT PRIMARY KEY,
  tail_number         TEXT UNIQUE NOT NULL,
  aircraft_type       TEXT,
  squadron            TEXT,
  maintenance_status  TEXT NOT NULL DEFAULT 'unknown',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- System state (for persisting emergency mode, etc.)
CREATE TABLE IF NOT EXISTS system_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add missing column to tasks
ALTER TABLE tasks ADD COLUMN aircraft_id TEXT;
ALTER TABLE tasks ADD COLUMN dossier_id TEXT;

-- Add rule_execution_result_id to findings
ALTER TABLE findings ADD COLUMN rule_execution_result_id TEXT;
```

---

## 6. Frontend Architecture Changes

### 6.1 Remove client-side rule evaluation

- Delete: `const violations = rulesEngine.evaluateFlightData(...)` calls from frontend
- Remove: `RulesEngine` instantiation in hooks
- `CSVDataContext.ingestFindings()` call chain becomes unnecessary after rule evaluation moves server-side
- Instead: after CSV upload, poll `findingsApi.list()` to get server-evaluated findings

### 6.2 Remove localStorage operational state

```typescript
// Remove from CSVDataContext:
localStorage.setItem('csvData', JSON.stringify({ selectionSets, evidence, rules }));

// Replace selectionSets and evidence with API calls:
// GET /api/evidence?dossierId=X
// POST /api/evidence

// Remove rules from CSVDataContext entirely — rules are managed in /engineer/rules page
// and fetched from server via rulesApi.list()
```

### 6.3 Unify user identity

- Remove `RoleProvider` entirely
- Use `useAuth()` everywhere for user identity and role
- `RoleProvider.currentUser` is a duplicate of `AuthContext.user` — merge

### 6.4 Load dossiers on mount

```typescript
// Add to FlightDossierContext refresh():
const dossiersRes = await dossiersApi.list({ limit: 100 });
if (dossiersRes.ok && dossiersRes.data) {
  setDossiers(dossiersRes.data.dossiers);
}
```

### 6.5 Polling for multi-user sync

For MVP (before WebSockets), add a 30-second poll in `FlightDossierContext`:
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refresh();
  }, 30000);
  return () => clearInterval(interval);
}, [refresh]);
```

### 6.6 Split Index.tsx

Create:
- `src/pages/tech/TechnicianQueue.tsx`
- `src/pages/tech/AircraftDetail.tsx`
- `src/pages/lead/FleetBoard.tsx`
- `src/pages/lead/FindingsQueue.tsx`
- `src/pages/engineer/EngineerReview.tsx`
- `src/pages/engineer/RuleManagement.tsx`
- `src/pages/engineer/DossierBrowser.tsx`

Update `App.tsx` routes to use these.

---

## 7. OpenShift Readiness

The system must be designed to migrate to OpenShift without architectural rework.

### Container boundaries

| Service | Container | Stateful? |
|---|---|---|
| Frontend (React build) | nginx container | No |
| Local server (API) | Node.js container | No (stateless) |
| SQLite DB | Volume mount or migrate to PostgreSQL | Yes |
| File storage | Volume mount or S3-compatible | Yes |

### Stateless server design

The local server should be made fully stateless:
- No in-process caching (currently auth sessions are in-memory via `authService`)
- Sessions should be entirely in the database
- Emergency mode should be in the database
- This enables horizontal scaling (multiple API replicas)

### Config and secrets

- All config via environment variables (already done)
- No hardcoded secrets in code
- Secrets injected via OpenShift Secrets / ConfigMaps

### Health checks

Add health endpoints (already partially exists at `/api/health`):
- `GET /api/health` — liveness: returns 200 if server is up
- `GET /api/health/ready` — readiness: returns 200 only if DB is connected

### Database migration path

For OpenShift: replace SQLite with PostgreSQL (same SQL interface, minimal code changes if services use parameterized SQL without SQLite-specific features). Avoid SQLite-specific pragmas in query logic.

### Deployment progression

```
Phase 1 (current): Windows local server, SQLite, Vite dev server
Phase 2:           Docker Compose: nginx (frontend) + node (api) + volume (sqlite)
Phase 3:           OpenShift: Deployment (api) + Service + Route (nginx) + PVC (data)
Phase 4:           OpenShift + PostgreSQL (via OpenShift DB operator)
Phase 5:           OpenShift + external time-series DB + object storage
```

---

## 8. Removing Fabricated State

### Immediate actions

| Fabricated item | Removal action |
|---|---|
| `confidence.value = 85` | Remove confidence from FindingDto mapping; do not display confidence until backed by calculation |
| `systemHealthScore` | Remove from DashboardStats until formula is defined |
| `sample-data.ts` | Delete file; remove all imports |
| `demo_f16_big.csv` | Move to `.gitignore` / external storage or delete |
| `f16-maintenance-system.html` | Archive or delete |
| `saveSnapshot` to localStorage | Remove — snapshots not needed when server persists data |
| Rules in localStorage | Remove — rules stored in SQLite only |
| Evidence in localStorage | Remove — evidence stored in SQLite via evidence service |
| `DEMO_USERS_FALLBACK` | Keep only in dev mode; ensure it cannot be reached in production build |
