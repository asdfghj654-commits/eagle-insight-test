# Document 8: Phased Implementation Roadmap

**Date:** 2026-04-05  
**Principle:** Evolve what exists. Don't rebuild what works. Don't hide problems behind new features.

---

## Phase 0: Cleanup and Stabilization (Before any feature work)

**Duration:** 1-2 days  
**Goal:** Remove fabricated state, quarantine demo artifacts, establish correct truth model.

### Actions

**Delete / remove:**
- [ ] `src/lib/sample-data.ts` — delete file, remove all imports
- [ ] `f16-maintenance-system.html` — move to `/docs/archive/` or delete
- [ ] `eagle-insight-improvements.zip` — move to `/docs/archive/` or delete
- [ ] `demo_f16_big.csv` — add to `.gitignore`, do not commit
- [ ] `components/dashboard/RoleSelector.tsx` — remove from all production views (keep in dev-only conditional)
- [ ] `components/dashboard/SystemExplanation.tsx` — remove from main workflow (can move to help panel)

**Fix immediately:**
- [ ] `dtoToFinding()` in `FlightDossierContext.tsx`: remove `confidence.value = 85`, remove `confidence` field from the mapping entirely until backed by calculation
- [ ] Load dossiers in `FlightDossierContext.refresh()` by calling `dossiersApi.list()`
- [ ] Persist emergency mode via `system_state` table in SQLite (add route + service method)
- [ ] Remove the 1200-record hard cap: replace with `limit: 200` (first load) + pagination support

**Add immediately:**
- [ ] SQLite migration 005: add `evidence_items` table, `rule_execution_results` table, `aircraft` table, `system_state` table, indexes
- [ ] SQLite migration 006: add missing columns to tasks (`aircraft_id`, `dossier_id`), add `rule_execution_result_id` to findings

**Preserve exactly:**
- Auth system (AuthContext + auth-service + JWT)
- SQLite schema for findings, tasks, rules, dossiers, audit_log
- Severity model (S1-S4) with Hebrew labels
- API client (api-client.ts)
- All shadcn/ui components
- FlightDossierContext API-backed pattern (except confidence)
- EngineeringPortal tabs structure (Signals, Events, Distributions, Correlations)

---

## Phase 1: Fix the Truth Model (Critical correctness)

**Duration:** 3-5 days  
**Goal:** One source of truth per entity. Rules evaluated server-side. No localStorage for operational state.

### 1.1 Move rule evaluation to server-side

**What to change:**
- Add `rules-service.evaluateForSortie(sortieId)` method in local-server
- This method: loads active rules from SQLite, loads telemetry for the sortie, evaluates each rule, stores `rule_execution_results`, calls `findings-service.create()` for violations
- Add API endpoint: `POST /api/rules/evaluate/:sortieId`
- In `ingestion-service`: after successful CSV ingestion, call `rulesService.evaluateForSortie(sortieId)` (or enqueue)
- Update `CSVDataContext.uploadCSV()`: after upload, only call `restoreOperationalData()` — no more client-side rule evaluation

**What to remove from frontend:**
- Remove `RulesEngine` instantiation from any hook or component
- Remove `ingestFindings()` call after client-side evaluation
- `src/lib/rules-engine.ts` — keep the type definitions (they are referenced), but remove the `evaluateFlightData()` call path from the UI layer

**Rollback:** See Rollback Document RB-001.

### 1.2 Move evidence and selection sets to server

**What to change:**
- Add `POST /api/evidence` and `GET /api/evidence` routes to local-server
- Add `evidence-service.ts` in local-server
- In `CSVDataContext`: replace `localStorage.setItem('csvData', ...)` with API calls
- Replace `createSelectionSet()`, `pinToEvidence()` with API-backed versions
- `selectionSets` becomes a concept local to the EngineeringPortal session (not persisted) — evidence items that are pinned go to the server

**What to remove:**
- Remove `saveSnapshot()` and `loadSnapshot()` (localStorage-based) — replace with server-side evidence persistence
- Remove `getSnapshots()` (localStorage key enumeration)

**Rollback:** See Rollback Document RB-002.

### 1.3 Remove RoleProvider duplication

**What to change:**
- Replace all `useRole()` / `currentUser` from `RoleProvider` with `useAuth()` / `user` from `AuthContext`
- Delete `src/components/dashboard/RoleProvider.tsx` (or make it a thin wrapper around AuthContext)
- Update all components that call `useRole()` to use `useAuth()`

**Rollback:** See Rollback Document RB-003.

### 1.4 Add polling for multi-user sync

**What to add:**
- In `FlightDossierContext`: `setInterval(() => refresh(), 30000)` with cleanup
- Add "Last synced: [time]" indicator in AppLayout header
- Add "Syncing..." spinner when refresh is in flight

---

## Phase 2: Role-Specific Pages (UX correctness)

**Duration:** 3-5 days  
**Goal:** Each role gets a purpose-built view. Index.tsx becomes multiple focused pages.

### 2.1 Create role-specific page components

New files to create:
- `src/pages/tech/TechnicianQueue.tsx`
- `src/pages/tech/AircraftDetail.tsx`
- `src/pages/lead/FleetBoard.tsx`
- `src/pages/lead/FindingsQueue.tsx`
- `src/pages/engineer/EngineerReview.tsx`
- `src/pages/engineer/RuleManagement.tsx`
- `src/pages/engineer/DossierBrowser.tsx`
- `src/pages/commander/CommanderBriefing.tsx`
- `src/pages/commander/RiskQueue.tsx`
- `src/pages/commander/EscalationsInbox.tsx`

### 2.2 Update routing in App.tsx

Replace current role-catching routes to Index.tsx with specific routes per page.

### 2.3 Decompose Index.tsx

Move each role's content blocks from Index.tsx into the respective role pages. Delete Index.tsx when all content is migrated.

### 2.4 Update investigation workbench navigation

Add 3-panel layout to EngineeringPortal:
- Left: scope + evidence panel
- Center: existing tab content (Signals, Events, Distributions, Correlations)
- Right: findings + rules + actions panel

**Rollback:** See Rollback Document RB-004.

---

## Phase 3: Data Quality and Transparency (Trust)

**Duration:** 2-3 days  
**Goal:** Every data point shows its source. Empty states are honest and specific.

### 3.1 Add data lineage badges

- Add `sourceType` badge to every finding card: [MEASURED] / [REPORTED] / [RULE-DERIVED]
- Add "Source: [filename], uploaded [date]" label to telemetry charts
- Add "Rule: [ID] — [description]" reference to every rule-derived finding

### 3.2 Fix empty states

Replace all generic empty states (0 records = broken-looking screen) with specific honest messages. Audit every component that renders a list or chart and add explicit empty state for each scenario.

### 3.3 Add data quality panel to investigation workbench

Left panel of the workbench shows:
- Parameters loaded: [N of M expected]
- Missing parameters: [list]
- Rules that could not run: [N] (with expandable detail)

### 3.4 Surface rule evaluation results

In the investigation workbench right panel:
- Show every rule evaluated for the current sortie
- For each: did it run? did it find a violation? was the parameter present?
- This replaces the current opacity where rules just silently skip

---

## Phase 4: Dossier and Collaboration (Workflow)

**Duration:** 3-4 days  
**Goal:** Dossiers are real, navigable, and collaborative.

### 4.1 Auto-create dossiers on S1/S2 violations

In `rules-service.evaluateForSortie()`:
- After creating S1 or S2 findings, auto-create a dossier if one doesn't exist for this sortie
- Link findings to dossier

### 4.2 Dossier browser page

`/engineer/dossiers`:
- List of all dossiers (open, under review, closed)
- Filter by status, aircraft, date
- Click → dossier detail with linked findings, tasks, evidence

### 4.3 Investigation workbench scope selector

Left panel allows opening an existing dossier or starting a new one. Scope (aircraft + flight) defines what data is loaded in the center panel.

### 4.4 Collaboration notes

Every finding, task, and dossier:
- Show existing notes with user + role + timestamp
- Add note field with submit button
- Notes persisted in SQLite via `notes` table or `review_notes` field updates

---

## Phase 5: OpenShift and Deployment Readiness

**Duration:** 2-3 days  
**Goal:** The system can be packaged and deployed to OpenShift without architectural changes.

### 5.1 Containerize

- `Dockerfile` for local-server (Node.js)
- `Dockerfile` for frontend (nginx serving the Vite build)
- `docker-compose.yml` for local multi-container development

### 5.2 Stateless API server

- Move in-memory session management to SQLite-backed sessions (already started, complete it)
- Remove any process-level state in the server

### 5.3 Health endpoints

- `GET /api/health` — liveness
- `GET /api/health/ready` — readiness (DB connected)

### 5.4 Environment configuration

- Audit all `process.env` references, ensure all config is externalizable
- Document required environment variables in `.env.example`

### 5.5 OpenShift manifests (stub)

- `deploy/openshift/deployment.yaml`
- `deploy/openshift/service.yaml`
- `deploy/openshift/route.yaml`
- `deploy/openshift/pvc.yaml`

---

## Phase 6: Real-Time Data (Future)

**Duration:** 4-6 days when ready  
**Goal:** Replace 30-second polling with event-driven updates.

### 6.1 Server-Sent Events (SSE)

Add SSE endpoint: `GET /api/events/stream`  
Events emitted:
- `finding.created`
- `finding.status.changed`
- `task.assigned`
- `emergency.activated`

Frontend subscribes and updates React state on event receipt.

### 6.2 File watcher for auto-ingestion

Add `chokidar` file watcher on a configured directory.  
Auto-ingests new CSV files as they appear (for integration with flight recording systems).

---

## Phase 7: AI Layer Activation (Future)

**Prerequisites:** Phases 0-5 complete. Training data captured. Human review process established.

### 7.1 Configure AI provider

- Set `AI_PROVIDER=anthropic` (or `openai`, or `local_ollama`)
- Configure API key via environment variable
- AI gateway returns real responses instead of `{ available: false }`

### 7.2 First AI capability: Finding explanation

- Engineer views a finding → sidebar shows "Explain this finding"
- AI generates structured explanation
- Explanation logged to `ai_trace_log`
- Engineer can approve for training data

### 7.3 Document ingestion for RAG

- Upload T.O. documents, maintenance procedures
- Chunking and embedding generation
- RAG retrieval integrated into finding explanation

### 7.4 Training data export

- `GET /api/training-data/export` → JSONL
- Human-reviewed examples with corrections

---

## What to Postpone

These are out of scope for Phases 0-5 and should not be started until foundation is solid:

- Live telemetry streaming from aircraft
- Native mobile application
- Cross-squadron fleet aggregation (multi-unit deployment)
- AI-generated findings (findings can only come from rules or human entry)
- Automated airworthiness recommendations
- Pilot performance analysis (requires additional access control review)
- Historical cross-fleet analytics (requires time-series database)

---

## What Becomes Foundation Before AI Work Begins

Before any AI capability goes live, the following must be in place:

1. Rule evaluation fully server-side (Phase 1.1) — AI context must reference real rule results
2. Evidence persisted to server (Phase 1.2) — AI must be able to reference real evidence
3. Dossiers functional (Phase 4) — AI context is dossier-scoped
4. `ai_trace_log` actively written (Phase 4) — logging infrastructure ready
5. Human review notes captured systematically (Phase 3/4) — training data accumulating
6. Role-based access enforced on all API routes (Phase 0/1) — AI cannot bypass auth
7. Data lineage visible in UI (Phase 3) — AI outputs must trace to evidence
8. At least 30 days of real operational data in the system — AI context is meaningful
