# Document 6: Multi-Database Query Strategy

**Date:** 2026-04-05

---

## 1. Principle: Standard Methods First

The system must never adopt clever or exotic querying patterns when standard methods work. The priority order is:

1. **Direct query of canonical SQLite/PostgreSQL** — for operational data already ingested
2. **Scheduled ingestion into canonical store** — for data from external systems
3. **REST API calls** — for external systems with REST interfaces
4. **File ingestion** — for CSV/flat file sources
5. **SQL/JDBC/ODBC connectors** — for external SQL databases
6. **Federated live queries** — last resort, only when latency and freshness truly require it

---

## 2. Standard Integration Methods

### 2.1 CSV / File ingestion (current primary method)

Already implemented in `ingestion-service`. The engineer uploads a CSV file containing sortie telemetry. The server normalizes it and stores in SQLite.

This is appropriate for:
- Flight data files delivered post-flight from recording systems
- Maintenance log exports
- Bulk historical data loads

**Extend this pattern** by adding:
- File system watcher: a background job watches a configured directory for new files and auto-ingests them
- Scheduled file ingestion: poll a shared network path every N minutes for new flight data files

```typescript
// local-server/src/jobs/file-watcher.ts
import chokidar from 'chokidar';
const watcher = chokidar.watch(process.env.WATCH_DIR || '/data/incoming');
watcher.on('add', (path) => {
  if (path.endsWith('.csv')) ingestionService.processFile(path);
});
```

### 2.2 SQL / JDBC / ODBC for external databases

The existing `sql-adapter.ts` and `sql.ts` route provide a foundation. The local server already supports `mssql` (based on `mssql.d.ts` present in local-server/src).

**Extend this pattern** by:
- Configuring named SQL connections via `source_configs` table
- A scheduled SQL ingestion job that pulls from configured external databases
- Using standard SQL SELECT queries — no stored procedures or proprietary extensions

```typescript
// Scheduled ingestion from external SQL:
// 1. Load active source_configs where type='sql'
// 2. For each config: run configured SELECT query
// 3. Map results to canonical Sortie/TelemetryRecord schema
// 4. Insert into local SQLite (deduplication by flightId)
```

**Target external SQL sources:**
- Maintenance management systems (CMMS) — SQL export
- Flight operations systems — SQL query on flight log tables
- ATIS/ACARS data feeds — if SQL-accessible

### 2.3 REST API integration

For external systems with REST interfaces:
- The existing `api-adapter.ts` and `api-proxy.ts` provide this pattern
- Extend with OAuth2/API key authentication per source config
- Cache responses: do not query external APIs on every frontend request

```typescript
// api-adapter: scheduled pull
// Every 15 minutes, query external REST API
// Store results in local canonical tables
// Frontend queries local SQLite only — never hits external API directly
```

### 2.4 Object storage (future)

For large file storage (original CSV files, documents, manuals):
- Use S3-compatible object storage (MinIO for on-prem, S3 for cloud)
- Files stored by key: `sorties/{sortie_id}/raw.csv`, `docs/{doc_id}/{filename}`
- SQLite stores metadata and presigned URL or local path
- Frontend downloads directly from object storage when needed (not via API server)

---

## 3. Query Architecture — When to Query Where

### Decision matrix

| Query type | Access pattern | Storage |
|---|---|---|
| Current open findings | Always local | SQLite findings table |
| Open tasks for my role | Always local | SQLite tasks table |
| Aircraft fleet status | Always local | SQLite aircraft table (derived from findings) |
| Sortie telemetry for investigation | On-demand, local | SQLite telemetry records |
| Historical findings for a tail | On-demand, local | SQLite with date filter |
| Cross-fleet parameter trends | On-demand, derived | SQLite aggregates or materialized view |
| Rule definitions | Always local | SQLite rules table |
| Audit log | On-demand, local | SQLite audit_log with pagination |
| Document/manual retrieval | Future, local | SQLite metadata + file store |
| Real-time aircraft position | Future, external | External system → SSE or poll |

**Golden rule:** The frontend never queries an external system directly. All external data must be ingested and stored locally first.

---

## 4. Materialized Views and Derived Data

To avoid expensive joins on every request, precompute and store derived aggregates.

### Fleet readiness snapshot (precomputed, updated on finding change)

```sql
CREATE TABLE IF NOT EXISTS fleet_readiness_snapshot (
  tail_number         TEXT PRIMARY KEY,
  maintenance_status  TEXT NOT NULL DEFAULT 'unknown',
  open_s1_count       INTEGER NOT NULL DEFAULT 0,
  open_s2_count       INTEGER NOT NULL DEFAULT 0,
  open_s3_count       INTEGER NOT NULL DEFAULT 0,
  open_task_count     INTEGER NOT NULL DEFAULT 0,
  last_sortie_date    TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Update strategy: recompute per aircraft when any finding/task for that aircraft changes status.

### Rule hit rate metrics (precomputed, updated hourly)

```sql
CREATE TABLE IF NOT EXISTS rule_metrics_snapshot (
  rule_id           TEXT PRIMARY KEY,
  last_evaluated    TEXT,
  total_runs        INTEGER DEFAULT 0,
  total_violations  INTEGER DEFAULT 0,
  false_positives   INTEGER DEFAULT 0,
  impacted_aircraft TEXT DEFAULT '[]',
  updated_at        TEXT DEFAULT (datetime('now'))
);
```

---

## 5. Performance and Cost Strategy

### Query optimization for SQLite

SQLite performs well for typical workloads when properly indexed. Add indexes for common query patterns:

```sql
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_aircraft ON findings(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_sortie ON findings(flight_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_telemetry_sortie ON telemetry_records(sortie_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
```

### Pagination

Never load unbounded data sets. All list APIs must support pagination:
- `GET /api/findings?limit=50&offset=0`
- `GET /api/audit?limit=200&after=timestamp`
- `GET /api/flights?limit=100&tailNumber=253`

The current 1,200-record hard cap must be replaced with proper pagination with a configurable page size and a `total` count in the response.

### Query by operational need, not by table

The frontend should never say "load all findings" and then filter client-side. Every filter (severity, status, aircraft, date) is applied in the SQL WHERE clause on the server.

### Source system resilience

When an external source is unavailable:
- Return the last successfully ingested data from local SQLite
- Include a `sourceUnavailableSince: timestamp` field in the API response
- Frontend displays: "Data source [name] unavailable since [timestamp] — showing last known state"
- Never fail silently

---

## 6. Data Access by Use Case

### Use case: Technician queue

```
GET /api/tasks?assignedTo={userId}&status=open
GET /api/findings?assignedTo={userId}&status[]=new&status[]=acknowledged
```
Two queries. Local SQLite. Fast.

### Use case: Fleet board (specialist)

```
GET /api/fleet/status           // Returns fleet_readiness_snapshot
GET /api/findings?status[]=new&status[]=acknowledged&limit=100
```
Fleet readiness is precomputed. One fast query.

### Use case: Investigation workbench (engineer)

```
GET /api/sorties/{sortieId}/telemetry?parameters[]=hydraulic_pressure_psi&parameters[]=egt_celsius
GET /api/findings?sortieId={sortieId}
GET /api/rules?status=active
GET /api/evidence?sortieId={sortieId}
```
Telemetry loaded on demand for the specific sortie under investigation. Not bulk-loaded.

### Use case: Commander briefing

```
GET /api/fleet/status           // fleet_readiness_snapshot
GET /api/findings?severity[]=S1&status[]=new&status[]=acknowledged
GET /api/escalations?status=active
```
Three fast queries. All from precomputed or indexed local data.

### Use case: Historical cross-flight analysis

```
GET /api/sorties?tailNumber=253&after=2026-01-01&limit=50
// For each sortie (paginated):
GET /api/rule-execution-results?sortieId={id}&violated=true
```
Paginated. Never loads entire history at once.

### Use case: Document retrieval (future)

```
GET /api/documents?query=hydraulic+system+inspection
// Returns: [{ id, title, relevanceScore, excerpt, url }]
```
Backed by SQLite full-text search (FTS5) or future vector search index.

---

## 7. Future Multi-Database Architecture

When the data outgrows SQLite and multiple sources need to be integrated:

```
┌─────────────────────────────────────────────────────────────────┐
│              CANONICAL DATA ACCESS LAYER                        │
│                                                                 │
│  CanonicalRepository interface:                                 │
│    findingRepository.findByAircraft(tail, filters)              │
│    sortieRepository.findRecent(limit, after)                    │
│    telemetryRepository.loadForSortie(sortieId, params)          │
│                                                                 │
│  Implementations:                                               │
│    SqliteRepository   — for local MVP                           │
│    PostgresRepository — for OpenShift deployment                │
└──────────────────┬──────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│                  SOURCE ADAPTERS                                 │
│                                                                 │
│  CsvIngestionAdapter    — file upload / file watcher            │
│  SqlIngestionAdapter    — MSSQL / PostgreSQL external systems   │
│  RestApiAdapter         — External REST APIs                    │
│  FileSystemAdapter      — Network shares / document stores      │
└─────────────────────────────────────────────────────────────────┘
```

The canonical repository layer means:
- The rest of the application (services, routes) doesn't know which database is underneath
- Switching from SQLite to PostgreSQL is a repository implementation change, not a service change
- External sources are always ingested first, never queried live by services
