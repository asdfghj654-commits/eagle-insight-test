# Document 3: Target UX/UI Redesign Specification

**Date:** 2026-04-05  
**Based on:** Repository Audit (Doc 1) + UX Audit (Doc 2)

---

## 1. Design Philosophy

The redesigned UX must feel like a **serious operational workbench**, not a dashboard product.

Core principles:
- **Trust first** — every piece of information shows its source and confidence level
- **Honesty over completeness** — missing data gets honest empty states, never fabricated values
- **Action-oriented** — every screen answers "what do I need to do right now?"
- **Role depth** — each role sees only what is relevant to their responsibility
- **Evidence-centered** — findings link to evidence, evidence links to raw data
- **Workbench, not showcase** — no decorative charts, no marketing copy inside the operational UI

---

## 2. Information Architecture (Redesigned)

### Route Map

```
/login                          — Login (unchanged)
/

Role: Technician
  /tech/queue                   — My Maintenance Queue (tasks + findings assigned to me)
  /tech/aircraft/:tail          — Aircraft Detail (finding list + task list for one tail)

Role: Specialist
  /lead/fleet                   — Fleet Triage Board (all aircraft, status, open items)
  /lead/findings                — Findings Review Queue (triage, ack, escalate)
  /lead/tasks                   — Task Management Board

Role: Engineer
  /engineer/review              — Engineering Review Queue (findings pending engineer decision)
  /engineer/investigation       — Investigation Workbench (full portal)
  /engineer/rules               — Rule Management (list, compose, approve, version history)
  /engineer/dossiers            — Dossier Browser

Role: Commander
  /commander                    — Fleet Briefing Surface (status + blockers only)
  /commander/risk               — Risk Queue (S1/S2 items needing commander awareness)
  /commander/escalations        — Escalation Inbox

```

### Key structural changes from current

| Current | Redesigned |
|---|---|
| Index.tsx handles tech/specialist/engineer | 3 separate role pages |
| /portal/data-research = investigation | /engineer/investigation = investigation |
| No dedicated findings review for engineer | /engineer/review = review queue |
| No aircraft detail drill-down | /tech/aircraft/:tail = aircraft focus |
| Commander one-page | Commander split: briefing + risk + escalations |
| No dossier browser | /engineer/dossiers = dossier list |

---

## 3. Technician Workspace

### /tech/queue — My Maintenance Queue

**Purpose:** What do I need to do today?

**Layout:**
```
Header: [Aircraft tail filter] [Status filter] [My tasks only toggle]

Section A: My Open Tasks (priority sorted)
  — Task card: title, finding link, aircraft tail, due date/time, status badge
  — Action: "Mark In Progress" / "Complete" / "Add Note"

Section B: Findings Assigned to Me
  — Finding card: severity badge, title, aircraft tail, status, rule that triggered it
  — Action: "Acknowledge" / "Add Note" / "Escalate"

Section C: Recently Completed (last 7 days, collapsed)
```

**Empty states:**
- No tasks: "No open tasks assigned to you. Check with your lead if new tasks are expected."
- No findings: "No findings currently assigned to you."
- Server unavailable: "Unable to load your queue — server is not reachable."

**What is removed from current view:**
- Fleet-level statistics (technician does not need fleet readiness %)
- Time-series charts
- Trend analysis
- Role selector

### /tech/aircraft/:tail — Aircraft Detail

**Purpose:** Everything about one specific aircraft.

**Layout:**
```
Header: Aircraft [tail number] | Last flight: [date/time] | Readiness: [Ready/Degraded/Grounded]

Tab 1: Open Findings
  — Sorted by severity
  — Each finding: severity, title, rule reference, source type badge (Measured/Reported)

Tab 2: Open Tasks
  — All tasks for this aircraft
  — Sorted by due date

Tab 3: Recent Flights
  — Flight list (when flight data loaded)
  — Click → drill into flight findings
```

---

## 4. Specialist (Lead) Workspace

### /lead/fleet — Fleet Triage Board

**Purpose:** What is the state of the fleet right now? What needs attention?

**Layout:**
```
Header row: [Total aircraft: N] [Ready: N] [Degraded: N] [Grounded: N]
            [Open findings: N] [Open tasks: N] [Overdue: N]

Aircraft grid (one card per aircraft):
  [Tail] [Status badge] [S1: N] [S2: N] [S3: N] [Open tasks: N]
  Click → goes to aircraft detail (read-only specialist version)

Below grid: Overdue tasks panel (tasks past due date)
```

**Empty state:**
- No aircraft known: "No aircraft data loaded. Flight data must be uploaded by an engineer."

### /lead/findings — Findings Review Queue

**Purpose:** Triage open findings: acknowledge, assign, escalate.

**Layout:**
```
Filter bar: [Severity] [Status] [Aircraft] [System] [Date range]

Finding list:
  Each row: [Severity] [Title] [Aircraft] [System] [Status] [Assigned to] [Created]
  Actions: Acknowledge | Assign | Escalate | Add Note

Detail panel (right side on click):
  Full finding detail: description, evidence links, rule reference, status history
```

---

## 5. Engineer Investigation Workbench

### /engineer/investigation — Investigation Workbench

This is the most critical screen. It must feel like a real investigation tool.

**Layout (3-panel):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LEFT PANEL (250px)          │ CENTER PANEL (flex)       │ RIGHT PANEL (300px) │
│  Investigation Scope         │ Evidence & Signal Area    │ Findings & Rules    │
│                             │                           │                     │
│  Aircraft: [selector]        │ [Tab: Signals]            │ Triggered Findings  │
│  Flight: [selector]          │ [Tab: Events]             │  [S1] [S2] [S3] ... │
│  Date range: [picker]        │ [Tab: Distributions]      │                     │
│  Mission type: [selector]    │ [Tab: Correlations]       │ Active Rules        │
│                             │                           │  Rule list for scope│
│  ─────────────────          │                           │                     │
│  Pinned Evidence             │                           │ Notes & Reasoning   │
│  [E1] Signal anomaly 14:32   │                           │  [+ Add note]       │
│  [E2] Brake temp spike       │                           │  [Recent notes]     │
│  [+ Pin selection to evidence│                           │                     │
│                             │                           │ ─────────────────── │
│  ─────────────────          │                           │ Actions             │
│  Data quality               │                           │  [Create finding]   │
│  Parameters loaded: 12/18    │                           │  [Escalate]         │
│  Missing: g_load, fuel_flow  │                           │  [Assign task]      │
│  Source: upload_20260405     │                           │                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Center panel — Signals tab:**
- Time-series charts for selected parameters
- Phase band overlays (taxi, takeoff, climb, cruise, descent, landing)
- Selection tool: lasso or time-range → "Pin as evidence"
- Each selection labeled with: parameter name, time range, value range, deviation from baseline
- Rule threshold lines shown as reference overlays

**Center panel — Events tab:**
- List of discrete events detected in flight data
- Each event: timestamp, parameter, value, threshold, rule ID, severity
- Click event → highlights corresponding region in Signals chart

**Center panel — Distributions tab:**
- Parameter distribution histograms
- Fleet baseline overlay (when multiple flights loaded)
- Deviation markers

**Center panel — Correlations tab:**
- Scatter plots of parameter pairs
- Correlation coefficient shown
- Envelope bounds from fleet baseline

**Right panel — Findings & Rules:**
- Live list of findings triggered by rules for current scope
- Rules panel: shows which rules are active for current scope, which ran, which had no data
- "Rule [X] could not run — parameter [Y] not in dataset" shown explicitly

**Left panel — Scope:**
- Clear scope definition (aircraft + flight + date)
- Evidence collection: pinned items with names and descriptions
- Data quality: which parameters are present/missing, source file name, upload time

### /engineer/review — Engineering Review Queue

**Purpose:** Findings waiting for engineer decision (approve/reject/escalate/comment).

**Layout:**
```
Filter: [Status: pending_review] [Severity] [Aircraft]

Finding list with required actions shown:
  [GLOAD_001] G-load exceeded 7.5G | Aircraft 253 | Requires: Engineer review
  Actions: [Approve Finding] [Reject Finding] [Request Clarification] [Escalate to Commander]
```

**Finding detail panel:**
- Full finding detail with evidence links
- Rule reference with threshold and actual value
- Data lineage: "Detected by rules-engine on [date], from flight data uploaded [date]"
- Source type badge: Measured | Reported
- Status history (full audit trail)

### /engineer/rules — Rule Management

**Layout:**
```
Header: [Active: N] [Pending Approval: N] [Draft: N] [Paused: N]

Rule list:
  Each row: [ID] [System] [Parameter] [Threshold] [Type] [Status] [Last matched] [Hit count]
  
Actions:
  [+ New Rule (Draft)]
  Click existing → edit with version history visible

Rule Detail / Composer:
  — All fields from MaintenanceRule interface
  — Version history visible
  — If pending approval: [Approve] [Reject] [Request changes] buttons
  — Governance: "Cannot modify active rule threshold without entering review queue"
```

---

## 6. Commander Briefing Surface

### /commander — Fleet Briefing

**Purpose:** Situational awareness, not analysis. What do I need to know and decide right now?

**Layout:**
```
Header: Fleet Status as of [timestamp] | [Refresh]

Banner (if grounded aircraft):
  ⛔ [N] aircraft grounded — requires commander awareness
  [View blockers →]

Section A: Fleet Readiness
  Ready: N | Degraded: N | Grounded: N
  (Simple count, no percentage — percentages require context)

Section B: Critical Blockers (S1 findings)
  One row per blocker: [Tail] [Finding title] [Blocked since] [Assigned to]

Section C: Pending Commander Decisions
  Escalations awaiting commander: [N]
  [View escalations →]

Section D: Emergency Controls
  [⚠ Activate Emergency Mode] — with confirmation dialog
  (Only shown if no emergency active)
  OR: [Emergency Active: reason] [Deactivate] — if active
```

**What is removed:**
- SquadronTrends (trend analysis belongs in engineering view)
- Analytics charts (FlightTechniqueAnalysis, etc.)
- AIPredictions
- SystemExplanation

---

## 7. Collaboration UX

### Notes and reasoning capture

Every finding, task, and dossier should support notes. Notes UI:
```
[+ Add note]
  Text area: "Note (required for status changes)"
  Submitted with: user identity, timestamp, role

Note display:
  [Avatar/name] [Role badge] [Timestamp]
  Note text
```

### Handoff visibility

When a finding or task changes hands:
- "Assigned to: [name] [role] by [assigner] at [time]" visible on card
- Previous assignee visible in status history

### Status transitions

Status changes must always be explicit user actions with confirmation:
- Finding: new → acknowledged → in_progress → resolved/rejected/escalated
- Each transition: confirms intent, optionally requires note
- All transitions logged in audit_log

### Activity history

Every finding and task should have an activity timeline:
```
[timestamp] [user] [role]: Status changed: new → acknowledged
[timestamp] [user] [role]: Note added: "Checked brake system visually, no visible damage"
[timestamp] [user] [role]: Task created: "Full brake inspection"
[timestamp] [user] [role]: Escalated to engineer
```

---

## 8. Empty States — Full Specification

All empty states must be honest and actionable. Every empty state should tell the user:
1. Why data is absent
2. What would make it appear
3. Whether absence is normal or a problem

### Required empty state types

| State | Message pattern |
|---|---|
| No flight data loaded | "No flight data in the system. An engineer must upload a CSV flight data file to begin analysis." |
| No findings | "No open findings for this aircraft / this period." |
| No tasks | "No tasks assigned to you." |
| Server unavailable | "Unable to connect to the local server. Showing last known state. [Retry]" |
| Rule not evaluated (missing parameter) | "Rule [ID] was not evaluated — parameter [name] was not found in the uploaded data file." |
| Partial data | "Data loaded with missing parameters: [list]. Some rules could not run." |
| Source unavailable | "Data source [name] is currently unreachable. Last data received: [timestamp]." |
| No dossiers | "No investigation dossiers created yet." |
| AI not available | (already correct — keep AIPredictions pattern) |
| Insufficient data for trend | "Trend analysis requires at least 7 days of flight data. Current dataset covers [N] days." |
| No confidence value | Never show a confidence score if it is fabricated or unavailable. Show: "Confidence: N/A — automated assessment not available." |

---

## 9. Data Lineage Labels

Every data display must show its source. Proposed label system:

```
[MEASURED]     — directly from CSV telemetry
[REPORTED]     — manually entered by a user
[RULE-DERIVED] — output of a rule evaluation
[SYSTEM]       — generated by system logic (e.g., readiness calculation)
[PENDING]      — awaiting evaluation or confirmation
```

These labels appear as small badges next to:
- Finding severity badges
- Chart titles
- Evidence items
- Recommendation text

---

## 10. Copy and Terminology Guide

### Labels

| Context | Use | Avoid |
|---|---|---|
| Main entity for anomaly | Finding (ממצא) | Insight, alert, issue |
| Collection per aircraft/flight | Dossier (תיק) | Report, record |
| Work unit | Task (משימה) | Ticket, issue, item |
| Pilot flight | Sortie (גיחה) | Flight, trip |
| Threshold breach | Rule violation | Alert, flag |
| Rule category | Baseline rule / Engineer rule | System rule, custom rule |

### Status labels

| Status | English | Hebrew |
|---|---|---|
| new | New | חדש |
| acknowledged | Acknowledged | נלקח לידיעה |
| in_progress | In Progress | בטיפול |
| escalated | Escalated | הוסלם |
| resolved | Resolved | טופל |
| rejected | Rejected (not a finding) | נדחה |
| closed | Closed | סגור |

### Uncertainty language

When data is incomplete:
- "Based on available data as of [timestamp]"
- "Parameter [X] not evaluated — data unavailable"
- "Threshold not confirmed — awaiting engineer review"

Never use:
- "Predicted" (unless a real model produces the prediction)
- "Expected" (unless backed by calculation)
- "Likely" without a defined source
- "AI recommends" without an actual AI integration

---

## 11. Visual Design Adjustments

### Remove from production views
- Live clock in header (decorative)
- IAF logo placeholders using emoji (✈, ⚙) — replace with proper SVG or remove
- systemHealthScore percentage — remove until formula is defined and audited
- SystemExplanation component — move to onboarding help, not main workflow

### Keep
- Severity color coding (S1=red, S2=orange, S3=yellow, S4=blue)
- Hebrew RTL layout
- shadcn/ui card-based layout
- Status badges with color
- Breadcrumb or back navigation per drill-down

### Add
- Data lineage badge on every finding and chart
- "Last updated: [timestamp]" on every data-bearing card
- "Source: [filename/source name]" on charts
- Explicit "Loading..." and "Error" states on every async panel
- Dossier breadcrumb in investigation workbench: "Investigating: Aircraft 253 / Flight FL-2026-04-05-001"
