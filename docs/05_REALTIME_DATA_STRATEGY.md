# Document 5: Real-Time and Growing Data Strategy

**Date:** 2026-04-05

---

## 1. Real-Time Design Philosophy

### Do not blindly push all raw data in real time

The temptation with a system like this is to make everything real-time: live telemetry streams, live finding updates, live fleet dashboards. This is a mistake at this stage and at this scale, for several reasons:

**Cost:** Streaming raw telemetry (potentially thousands of data points per second per aircraft) into a web application is expensive to transmit, store, and query. Most of this data is not operationally relevant in real time.

**Operational relevance:** Post-flight maintenance decisions are not made during flight. The most important moment for maintenance is after landing, not during cruise. Trying to process everything live creates noise without corresponding value.

**Infrastructure complexity:** Real-time streaming requires message brokers (Kafka, NATS, etc.), WebSocket infrastructure, and backpressure management. This adds significant operational complexity without proportional benefit at the current scale.

**Design principle:** Be real-time where it matters. Be batch where it suffices.

---

## 2. What Should Be Real-Time vs Batch vs Historical

### Real-time (sub-second to seconds)

These events need fast propagation because they affect safety-critical decisions or user collaboration:

| Event | Why real-time |
|---|---|
| Finding status change (user action) | Other users collaborating on same finding need immediate update |
| Emergency mode activation | All users must see this immediately |
| Task assignment (when another user assigns to you) | Assignee needs prompt notification |
| S1 finding created (safety critical) | Commander and engineer must know immediately |

**Implementation:** For MVP — 30-second polling. For production — Server-Sent Events (SSE) or WebSocket from the local server.

### Near-real-time (minutes)

These updates benefit from freshness but can tolerate some delay:

| Event | Acceptable delay |
|---|---|
| New sortie landing | 2-5 minutes to appear in system |
| Rule evaluation completion after ingestion | 1-2 minutes |
| Dossier updates | 1-2 minutes |
| Task status changes | 1-2 minutes |

**Implementation:** Polling at 60-second interval, or event-driven trigger from ingestion service.

### Batch (hours to days)

These do not need to be fresh:

| Data type | Batch frequency |
|---|---|
| Trend analysis (week over week) | Daily |
| Fleet statistics aggregation | Hourly |
| Rule hit rate metrics | Hourly |
| False positive rate calculation | Daily |
| Audit log archival | Daily |

**Implementation:** Scheduled server-side jobs (cron or setInterval at server startup).

### Historical (on-demand query)

These are retrieved when the user explicitly requests them:

| Data type | Access pattern |
|---|---|
| All sorties for a tail number over 90 days | On-demand query |
| Telemetry signals for a specific sortie | On-demand load on workbench open |
| Cross-flight parameter comparisons | On-demand analytical query |
| Historical finding patterns for a system | On-demand |

**Implementation:** REST API query with pagination. Never loaded speculatively.

---

## 3. Operational Trigger Model

### Key operational triggers

The system needs a trigger model for when maintenance-relevant events occur.

#### Trigger: Sortie landed / data available

**When:** A flight file (CSV or other format) arrives / is uploaded.  
**Action:**
1. Ingestion service normalizes and stores the sortie
2. Rules service evaluates all active rules against this sortie's telemetry
3. Rule violation findings are created
4. Dossier is automatically created for sorties with S1/S2 findings
5. Notification prepared for relevant roles (engineer, specialist)

#### Trigger: S1 finding created

**When:** Rule evaluation produces an S1 (Safety Critical) finding.  
**Action:**
1. Finding created in SQLite
2. Aircraft maintenance status → 'grounded' in SQLite
3. Audit log entry written
4. SSE/poll event emitted: `finding.s1.created`
5. Commander queue updated

#### Trigger: Task overdue

**When:** Scheduled job detects task with dueDate < now and status != completed.  
**Action:**
1. Task status → 'overdue' (or flag added)
2. Visible in specialist queue as overdue item
3. Audit log entry written

#### Trigger: Rule evaluation failure

**When:** Rule evaluation runs but a required parameter is missing from the sortie data.  
**Action:**
1. `RuleExecutionResult` stored with `parameterPresent: false`
2. This is surfaced in the engineering workbench as a data quality warning
3. No finding created (no false negatives from missing data)

---

## 4. Streaming vs Batch Balance

### For MVP (current stage)

There is no streaming. Data enters the system only via CSV upload. The correct approach:

```
CSV Upload → Ingestion (synchronous, on upload request)
           → Rule Evaluation (triggered immediately after ingestion, async job)
           → Finding creation (after evaluation)
           → Frontend polls findings API at 30-second interval
```

This is batch-on-demand, not streaming. Appropriate for current scale.

### For future growth (50+ aircraft, multiple daily sorties per aircraft)

#### Event-driven ingestion

When sorties arrive more frequently:
1. Introduce a simple job queue (Bull queue on Redis, or SQLite-based queue for on-prem)
2. Ingestion service enqueues a `sortie.evaluate` job per sortie
3. Rules worker processes jobs sequentially or with controlled concurrency
4. This prevents rule evaluation from blocking the HTTP request thread

#### Backfill / reprocessing

When rules change (new rule added, threshold updated):
- Provide an admin endpoint: `POST /api/rules/:id/backfill`
- This re-evaluates the rule against all historical sorties (paginated, background job)
- New violations generate new findings with note: "Generated by rule backfill on [date]"
- Prevents silent gaps when rules are added retroactively

---

## 5. Hot / Warm / Cold Data Strategy

### Hot data (active working set)

Access pattern: high frequency, low latency required.

| Data | Storage |
|---|---|
| Open findings (status not resolved/closed) | SQLite operational table, loaded on app mount |
| Open tasks | SQLite operational table |
| Recent sorties (last 30 days) | SQLite flights table |
| Active rules | SQLite rules table |
| Current audit log (last 7 days) | SQLite audit_log table |

### Warm data (recent investigation)

Access pattern: medium frequency, tolerable latency.

| Data | Storage |
|---|---|
| Closed findings (last 90 days) | SQLite with status filter |
| Completed tasks | SQLite |
| Dossiers under review or recently closed | SQLite |
| Telemetry for recent sorties | SQLite (with pagination) |

### Cold data (historical archive)

Access pattern: low frequency, query on demand.

| Data | Storage |
|---|---|
| Resolved findings older than 90 days | SQLite (or future archive DB) |
| Telemetry for sorties older than 90 days | Future: separate archive table or file store |
| Old audit log | SQLite with date filter |
| Deprecated rules | SQLite |

### Future: multi-tier storage

When data grows beyond SQLite's comfortable range (~100GB):

```
Hot:  PostgreSQL operational DB (findings, tasks, rules, recent sorties)
Warm: PostgreSQL with partitioned sortie table (partition by month)
Cold: Object storage (S3-compatible) for raw telemetry files
      TimescaleDB or ClickHouse for analytical queries on telemetry
```

---

## 6. Data Reduction Strategy

### Principle: don't store everything — store what matters

Raw telemetry is high-volume. A 2-hour F-16 flight with 30-second sampling and 20 parameters produces ~4,800 data points. Across 50 aircraft with 3 sorties each per day, that's 720,000 data points per day. Over a year: ~260 million data points.

Storing all of this in SQLite is unsustainable. Strategies:

#### Store events, not raw streams

Instead of storing every telemetry record:
- Store only records that are near or beyond rule thresholds
- Store summary statistics per phase per flight: min, max, mean, std for each parameter
- Store raw records only for flights where a rule violation occurred (evidence preservation)
- Discard raw records for clean flights after 30 days

#### Rule-triggered evidence capture

When a rule violation occurs:
- Store the full time window ±60 seconds around the violation
- Store the specific parameter's full trace for the affected phase
- Discard the rest of the raw telemetry after evaluation is complete

#### Derived features, not raw data

Store per-sortie derived features instead of raw telemetry:
```
flight_summary:
  sortie_id
  parameter
  phase
  min, max, mean, std, count
  threshold_proximity  (how close did this get to the rule threshold? 0.0-1.0)
  rule_violated        (boolean)
```

This makes fleet-level trend queries fast and cheap.

---

## 7. Current Flights + Active Dossiers Use Case

### Requirement

The system must know:
1. Which flights are currently active (aircraft in the air)
2. Which aircraft have just landed / are expected to land
3. Which landed aircraft require maintenance action
4. Which dossiers should be activated for newly landed aircraft

### Minimal operational state model

```sql
-- Add to aircraft table:
ALTER TABLE aircraft ADD COLUMN flight_status TEXT NOT NULL DEFAULT 'on_ground';
  -- Values: 'on_ground', 'airborne', 'expected_landing', 'post_flight_pending'
ALTER TABLE aircraft ADD COLUMN expected_landing_time TEXT;
ALTER TABLE aircraft ADD COLUMN last_landing_time TEXT;
ALTER TABLE aircraft ADD COLUMN post_flight_dossier_id TEXT;

-- Sortie status already in flights table:
-- status: 'in_flight' | 'landed' | 'processed' | 'archived'
```

### Active flight detection (without full real-time telemetry)

For MVP without live telemetry feeds:
- Active flights are declared manually or via CSV upload trigger
- When a CSV is uploaded for a completed flight → sortie status = 'landed'
- Dossier auto-created when S1/S2 findings detected for newly landed sortie

For future with data feeds:
- A lightweight feed provides: `tailNumber`, `status`, `expectedLandingTime`
- This feed is polled every 5 minutes (not streamed)
- On landing detection → trigger rule evaluation job for the sortie

### Dossier activation flow

```
Sortie lands → CSV data available
  → Ingestion: sortie.status = 'landed'
  → Rule evaluation: run all active rules
  → If S1 or S2 violations found:
      → Auto-create Dossier with title "[tail] [flight date] — [violation count] violations"
      → Link findings to dossier
      → Set aircraft.maintenance_status = 'grounded' (S1) or 'degraded' (S2)
      → Emit dossier.activated event
  → Specialist sees new item in fleet board
  → Engineer sees new item in review queue
```

### Maintenance queue creation

The specialist/team lead fleet board is built from:
- `aircraft` table (status, tail numbers)
- `findings` table filtered to: status IN ('new', 'acknowledged') AND sortie linked to recent landings
- `tasks` table filtered to: open tasks for these aircraft

No complex analytics. Simple join and filter. Fast and honest.
