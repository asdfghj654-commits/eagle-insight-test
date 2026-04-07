# Document 1: Repository Audit — Eagle Insight TIER-2

**Date:** 2026-04-05  
**Auditor:** Principal Architect Review  
**Codebase:** eagle-insight-TIER-2-CLEAR2-master

---

## 1. Repository Overview

| Dimension | Current State |
|---|---|
| Stack | React 18 + TypeScript + Vite, shadcn/ui, Tailwind CSS, RTL Hebrew UI |
| Backend | Node.js Express + SQLite (node:sqlite, Node v22.5+) |
| Auth | JWT tokens in sessionStorage, bcrypt hashes in SQLite |
| Data entry point | CSV upload by engineers |
| Deployment | Local Windows / on-prem |
| Routing | react-router-dom v6, role-based redirect |

---

## 2. Directory Structure

```
/src
  /components
    /dashboard      — 20+ components, many role-specific
    /portal         — EngineeringPortal tabs (Signals, Events, Distributions, etc.)
    /findings       — FindingCard component
    /layout         — AppLayout
    /ui             — shadcn/ui primitives + custom empty-state
    /guards         — RuleAuthorityGuard
  /contexts
    AuthContext.tsx          — Real API auth + demo fallback
    CSVDataContext.tsx        — Flight data + selections/evidence/rules (localStorage)
    FlightDossierContext.tsx  — Findings/tasks/audit (real API)
  /hooks
    useDashboardData.ts
    useAvailableAircraft.ts
    useAvailableFlights.ts
    useFailureHistory.ts
    useMyTasks.ts
    useParameterAvailability.ts
    useRuleAuthority.ts
  /lib
    rules-engine.ts          — Client-side rule evaluation
    sample-data.ts           — Fabricated random data generator
    insights-engine.ts       — Insight derivation
    data-adapter.ts          — Adapter between CSV data and dashboard
    data-sources/            — DataSourceManager + types
    ai/                      — provider-interface, rag-interface, fine-tuning stubs
  /pages
    Index.tsx                — Multi-role main dashboard
    EngineeringPortal.tsx    — Investigation workbench
    CommanderView.tsx        — Commander summary
    LoginPage.tsx
    Review.tsx
  /types
    core.ts                  — Domain types (SeverityLevel, Finding, Task, etc.)
    canonical.ts
    data-mode.ts

/local-server/src
  /adapters     — api-adapter, file-adapter, flight-data-adapter, sql-adapter
  /database     — db.ts (SQLite, migrations)
  /middleware   — auth-middleware
  /routes       — auth, findings, tasks, rules-api, dossiers-api, audit-api,
                  ingestion, operations-flights, sources, sql, files, api-proxy
  /services     — auth-service, findings-service, tasks-service, rules-service,
                  dossiers-service, audit-service, ingestion-service,
                  source-config-service, flights-service
  /utils        — logger
```

---

## 3. Current Architecture — Positive Findings

### 3.1 What is genuinely good

**Auth layer (AuthContext + auth-service):**  
Real JWT-based auth. Tokens in sessionStorage. Server health check on mount. Demo fallback gated to dev mode. Server-side bcrypt. Role-based routing. This is production-appropriate.

**FlightDossierContext:**  
API-backed. Falls back to empty state on server unavailability — not to fabricated data. Optimistic updates with revert on failure. Audit trail via API. This is the correct pattern.

**SQLite schema (db.ts migrations):**  
Tables: users, sessions, dossiers, findings, tasks, escalations, audit_log, rules, source_configs, ai_trace_log, flights. Foreign keys enabled. WAL mode. Migrations tracked. Schema is coherent and well-designed for the MVP scope.

**Rules engine governance (rules-engine.ts):**  
Rule versioning, approval workflow (draft → pending → active), rollback, metrics tracking. Governance model is conceptually sound.

**Severity model (S1-S4):**  
Clear, well-defined severity tiers with operational language (S1=Safety Critical, S2=Mission Critical, S3=Advisory, S4=Informational). Each tier has response time, impact, and Hebrew label. This is valuable and should be preserved exactly.

**AIPredictions component:**  
Honest. Shows "AI not available" rather than fabricating predictions. This is the right behavior.

**Empty state component:**  
`/components/ui/empty-state.tsx` exists. Shows the team has already thought about honest empty states. Good.

**Ingestion service (local-server):**  
CSV upload → server-side normalization → SQLite storage. Not just loading CSV into browser memory. This is the right direction.

**Operations flights route:**  
`operations-flights.ts` serves normalized flight data from SQLite back to the frontend. Correct: the frontend hydrates from the server, not from raw CSV.

---

## 4. Current Architecture — Problems

### 4.1 Split truth: rules exist in two disconnected places

**Problem (critical):**  
- `src/lib/rules-engine.ts` contains `MAINTENANCE_RULES` — a static TypeScript array with hardcoded baseline rules (HYD_001, ENG_001, LAND_001, GLOAD_001, BRAKE_001, FUEL_001).
- `local-server/src/services/rules-service.ts` manages rules in SQLite (`rules` table).
- The client-side `RulesEngine` class evaluates rules in the **browser** against CSV data in memory.
- Rules stored in SQLite are seeded from `MIGRATION_003_SEED_RULES` but are a **separate population** from what the client-side engine uses.

**Consequence:**  
Two rule populations exist. The client evaluates rules against CSV data and calls `findingsApi.bulkCreate()` via `ingestFindings()`. The server stores rules in SQLite but does not execute them. Rule changes made in the UI do not reach the evaluation engine. Rules approved in the SQLite database are not what runs against flight data.

### 4.2 localStorage as operational state

**Problem (critical):**  
`CSVDataContext` stores `selectionSets`, `evidence`, and `rules` in `localStorage`:
```ts
localStorage.setItem('csvData', JSON.stringify({ selectionSets, evidence, rules }));
```
- Selection sets are ephemeral in-browser state with no server persistence.
- Evidence collections pinned by engineers are lost on browser clear, incognito, or device change.
- Snapshots (`saveSnapshot`) write entire flight data to localStorage — a 13MB CSV causes a JSON explosion.
- Rules created in the UI via `createRule()` go to localStorage, not the server.

### 4.3 Rules evaluated client-side on raw CSV

**Problem (high):**  
The `useDashboardData` hook or related logic runs the `RulesEngine` in the browser against `processedFlights` from `CSVDataContext`. This means:
- Rule evaluation happens inside the React render cycle.
- Very large CSV files (demo_f16_big.csv is 13MB) will cause browser freezes.
- No server-side audit of what rules actually ran against what data.
- Rules can silently skip parameters not present in the uploaded CSV.

### 4.4 Fabricated data artifacts still present

**Problem (high):**  
- `src/lib/sample-data.ts` — still present, generates random F-16 flight data with fake anomalies. While demo mode is "disabled," this file remains and can be reactivated.
- `demo_f16_big.csv` (13MB) at the repo root — a demo data file committed to the repository.
- `f16-maintenance-system.html` (47KB) — a standalone prototype HTML file at root. It is unclear if this is referenced anywhere or is just legacy.
- `eagle-insight-improvements.zip` at root — unexplained archived artifact.

### 4.5 Hardcoded confidence value

**Problem (medium):**  
In `FlightDossierContext.tsx`, `dtoToFinding()`:
```ts
confidence: {
  value: 85,      // <-- hardcoded, meaningless
  factors: [],
  dataQuality: dto.sourceType === 'measured' ? 'complete' : 'partial',
```
Every finding gets `85%` confidence regardless of rule type, data completeness, or evidence quality. This is fabricated operational confidence.

### 4.6 Flight data loading cap

**Problem (medium):**  
`CSVDataContext.restoreOperationalData()`:
```ts
const response = await operationsFlightsApi.list(1200);
```
Hard-coded limit of 1200 records. As data grows, this will silently truncate the operational dataset with no warning to the user.

### 4.7 Dossiers not created

**Problem (medium):**  
The `dossiers` table exists in SQLite and `dossiersApi` exists on the client. However, `FlightDossierContext` initializes `dossiers` as `[]` and never calls `dossiersApi.list()`. The `getDossier()`, `getDossierByFlight()`, and `getDossiersByTail()` methods always return undefined/empty.  
The dossier concept exists in the schema but is effectively non-functional in the UI.

### 4.8 Emergency mode not persisted

**Problem (medium):**  
Emergency mode is in-memory React state only:
```ts
const [emergencyMode, setEmergencyModeState] = useState(false);
```
If the page is refreshed, emergency mode is lost. No API call, no audit entry, no persistence.

### 4.9 Task creation is fire-and-forget

**Problem (medium):**  
`createTaskFromFinding()` calls `tasksApi.create(payload).then(...)` but does not update local state optimistically — the new task only appears after a full `refresh()`. Meanwhile, the function returns `{ success: true }` before the API responds.

### 4.10 Index.tsx is a monolithic role-switcher

**Problem (medium):**  
`Index.tsx` appears to serve all three non-commander roles (technician, specialist, engineer) from a single component by switching content based on role. This creates a large component with complex conditional rendering, making it difficult to maintain and test.

### 4.11 RoleProvider vs AuthContext duplication

**Problem (low):**  
Both `RoleProvider` (`/components/dashboard/RoleProvider.tsx`) and `AuthContext` maintain user/role state. The `useRole()` hook returns a `currentUser` from `RoleProvider`, while `useAuth()` returns a different `user` from `AuthContext`. Both are in scope simultaneously. This creates a dual source of user identity.

### 4.12 No real-time update mechanism

**Problem (low for now, high for future):**  
The system has no polling, WebSocket, or Server-Sent Events. Data is fetched once on mount. If another user acknowledges a finding, the current user won't see it until they manually refresh. This will become a significant collaboration problem.

---

## 5. Data Flow Summary

```
CSV Upload
  → /api/ingestion/upload-csv (local-server)
  → ingestion-service → SQLite flights table
  → CSVDataContext.restoreOperationalData()
  → operationsFlightsApi.list(1200)
  → processedFlights (React state)
  → RulesEngine.evaluateFlightData() [CLIENT-SIDE]
  → violations → FlightDossierContext.ingestFindings()
  → findingsApi.bulkCreate() → SQLite findings table
  → findingsApi.list() → findings (React state)
  → UI renders findings
```

**Key problem:** rules evaluation runs in the browser (step 6), not on the server. This is architecturally incorrect.

---

## 6. Persistence Reality

| Data type | Where stored | Honest? |
|---|---|---|
| User auth | SQLite + sessionStorage token | Yes |
| Findings | SQLite (via API) | Yes |
| Tasks | SQLite (via API) | Yes |
| Audit log | SQLite (via API) | Yes |
| Rules | SQLite + client-side static array | Dual truth — no |
| Dossiers | SQLite (but not loaded in UI) | Partial |
| Selection sets | localStorage | No — ephemeral |
| Evidence | localStorage | No — ephemeral |
| Flight data | SQLite | Yes |
| Emergency mode | React in-memory | No |
| Snapshots | localStorage | No |
| Confidence score | Hardcoded 85% | No |

---

## 7. File-level Risk Assessment

| File | Risk | Reason |
|---|---|---|
| `src/lib/sample-data.ts` | High | Fabricated data generator — should be removed |
| `demo_f16_big.csv` | High | 13MB demo CSV at repo root |
| `f16-maintenance-system.html` | Medium | 47KB legacy prototype |
| `eagle-insight-improvements.zip` | Low | Unexplained artifact |
| `CSVDataContext.tsx` (localStorage) | High | localStorage as operational truth |
| `rules-engine.ts` (client-side eval) | High | Rules run in browser |
| `FlightDossierContext.tsx` (confidence=85) | Medium | Fabricated metric |
| `Index.tsx` (monolithic) | Medium | Maintainability |

---

## 8. What to Preserve

- Auth architecture (AuthContext + auth-service) — solid
- SQLite schema and migrations — well structured
- Severity model (S1-S4) with Hebrew labels — keep exactly
- FlightDossierContext API-backed pattern — correct
- Service layer in local-server — good boundaries
- shadcn/ui components — good foundation
- AIPredictions "not available" pattern — correct behavior
- Empty state component — keep and expand
- Findings/tasks/audit API routes — all sound
- Rules governance model — keep concept, move execution server-side
- Bilingual (Hebrew/English) field pattern — keep

---

## 9. What Must Change

1. Move rule evaluation to server-side
2. Persist selection sets and evidence in SQLite, not localStorage
3. Remove or quarantine sample-data.ts, demo CSV, legacy HTML
4. Remove hardcoded confidence=85
5. Load dossiers from API
6. Persist emergency mode via API
7. Implement polling or SSE for multi-user updates
8. Split Index.tsx into role-specific pages
9. Unify RoleProvider and AuthContext user identity
10. Remove the 1200-record hard cap on flight data loading
