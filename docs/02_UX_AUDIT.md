# Document 2: Current UX/UI Audit — Eagle Insight TIER-2

**Date:** 2026-04-05

---

## 1. Overall Product UX Diagnosis

### What it currently feels like

The product presents as a sophisticated-looking F-16 maintenance intelligence dashboard. It has strong visual investment: gradient headers, severity badges, Hebrew/English bilingualism, IAF branding, and well-structured tab layouts. The UI vocabulary is correct — it uses the right words (findings, dossiers, rules, severity, evidence). The component library (shadcn/ui) is cleanly applied.

However, below the visual surface:
- The product feels wider than it is deep
- It shows categories of information without enough actual data behind them
- Role separation exists in routing but collapses inside Index.tsx
- The "investigation workbench" aspiration (EngineeringPortal) is partially realized but fragmented across tabs with weak connective tissue
- Several screens exist in anticipation of features that are not yet backed by real data flows

### Where it succeeds

- **Visual clarity of severity tiers** — S1/S2/S3/S4 with color coding is immediately readable
- **Empty-state handling in some areas** — AIPredictions shows "not available" honestly
- **Hebrew RTL rendering** — consistent and correct
- **Login and auth flow** — clean, functional
- **Findings card structure** — shows title, severity, status, system, tail number correctly
- **Safety banner in EngineeringPortal** — real-time derived from actual findings (grounded/degraded/safe)

### Where it fails

- **Dashboard (Index.tsx) is overloaded** — too many components rendered conditionally per role. The technician, specialist, and engineer all land on the same page with different components switched on/off. This produces a cluttered, ambiguous experience.
- **FleetAnalysisTab, SquadronTrends, SquadronStatusCard** — likely showing derived metrics without guaranteed real backing data. These components make the dashboard feel more like an analytics showcase than an operational tool.
- **RoleSelector still visible in some views** — allows users to switch role in a live UI. This is a development-time affordance that should not be visible to real users.
- **AIPredictions appears in the dashboard** — even though it shows "not available," placing it in the main dashboard real estate suggests the system will eventually have AI predictions. This belongs in a future roadmap panel, not in the live workbench.
- **SystemExplanation component** — sounds like marketing copy placed inside the operational UI. Real users don't need the system to explain itself on every visit.
- **CommanderRecommendations** — it is unclear whether these are rule-derived, manually authored, or fabricated. Without clear data lineage shown, users cannot distinguish recommendations from suggestions.
- **EngineeringPortal tabs** — Signals, Events, Distributions, Correlations, Evidence, RuleComposer exist but lack clear connective narrative. A user arriving at the portal sees 6+ tabs with no guided workflow.

### Where it over-designs

- Multiple gradient banners and card headers
- Logo area in dashboard header uses emoji-based placeholders (✈, ⚙)
- Time display (live clock) in header is cosmetic, not operational
- "מערכת תובנות מערכת F-16" as the title is generic — the system should identify itself by what it does for the user, not just by its category

### Where it creates false confidence

- `systemHealthScore` in DashboardStats — derived metric from open findings. Its exact formula is opaque to the user and could feel arbitrary.
- Fleet readiness percentage — correctly derived from findings, but showing "0% aircraft" when no data is loaded looks like a broken system rather than an honest empty state.
- SquadronTrends and FailureHistory — trend-over-time visualizations require multi-day data. With a single CSV upload, these graphs may render with insufficient data, creating misleading visual patterns.

### Where it confuses data types

The system does not consistently visually distinguish:
- Raw measured parameters (from CSV)
- Rule-evaluated findings (derived from rules engine)
- Human-entered notes or manual reports
- System-generated summaries
- Future AI-generated content

All information appears with similar visual weight. A technician cannot immediately tell whether a finding came from an automatic rule, a human report, or a legacy calculation.

---

## 2. Screen-by-Screen Assessment

### 2.1 LoginPage

**Status: Keep as-is.**  
Clean, functional, Hebrew. Demo users with personal numbers for dev. Server availability check shown.

### 2.2 Index.tsx — Main Dashboard (multi-role)

**Status: Redesign and split.**

Current problems:
- One component serving 3 roles by conditional rendering
- Role detection via useRole() context causes unnecessary complexity
- DashboardHeader contains a live clock, IAF logos, role name — decorative over functional
- Tab structure varies by role but is not cleanly separated

What should happen:
- Split into `TechnicianWorkspace`, `SpecialistWorkspace`, `EngineerDashboard` — separate route-level components
- Each role gets a curated view: only what is relevant and actionable for that role
- Remove SystemExplanation, AIPredictions, FlightTechniqueAnalysis from production views
- Replace SquadronTrends/FleetAnalysisTab with honest "Insufficient data — upload flight data to see trends" messages when data is absent

### 2.3 EngineeringPortal.tsx — Investigation Workbench

**Status: Keep structure, rework navigation and connective tissue.**

Current problems:
- 6 tabs (Signals, Events, Distributions, Correlations, Evidence, RuleComposer) with no clear workflow guidance
- Tabs are modular but not narratively connected — a user doesn't know which tab to use first
- Evidence tab creates evidence objects persisted in localStorage — not durable
- RuleComposer creates rules that go to localStorage, not to the server's rules API
- Safety banner is good but occupies too much vertical space
- GraphEditor within Signals tab suggests a visual investigation tool — potentially very valuable if connected to real data

What should happen:
- Add a clear left panel: "Current Investigation Context" showing which flight/aircraft is in scope
- Replace tab-centric layout with a primary signal/evidence area + secondary rules/findings panel
- Connect RuleComposer to the server-side rules API
- Persist evidence to server (SQLite)
- Add clear data lineage labels on every chart: "Source: CSV upload [filename], [timestamp]"

### 2.4 CommanderView.tsx

**Status: Needs simplification.**

Likely problems (based on component imports in Index.tsx):
- CommanderDashboard, CommanderRecommendations, SquadronStatusCard, AircraftAvailability
- Commander view should be minimal: fleet status, blockers, risk queue, open escalations
- It should not be a dashboard full of analytics — it should be a briefing surface

What should happen:
- One clear fleet-state panel: how many aircraft, how many grounded/degraded/ready
- Critical blockers requiring commander decision
- Open escalations awaiting commander review
- No time-series charts — commanders need status, not trend analysis
- Emergency mode toggle in a prominent but confirmed-action pattern

### 2.5 Review.tsx

**Status: Investigate and define.**  
Review page exists but its relationship to findings review, dossier review, or rule review is unclear from audit alone. Needs scoping before any change.

---

## 3. Navigation and Information Architecture

### Current structure
```
/ → role redirect
/login
/tech/queue         → Index.tsx (technician view)
/tech/my-tasks      → Index.tsx (technician view)
/lead/fleet         → Index.tsx (specialist view)
/lead/reports       → Index.tsx (specialist view)
/portal/data-research → EngineeringPortal.tsx
/engineer/dashboard → Index.tsx (engineer view)
/commander          → CommanderView.tsx
```

### Problems
- Multiple paths resolve to the same component (`Index.tsx`) with no differentiation
- `/tech/my-tasks` and `/tech/queue` are semantically different but render the same component
- `/portal/magen-achzaka-david` redirects to `/portal/data-research` — legacy URL noise
- `/engineer/rules` redirects to `/engineer/dashboard` — rules management is not surfaced

### Target structure (proposed — see UX Redesign doc)
Each role should have distinct, well-scoped pages with unambiguous purpose per route.

---

## 4. Terminology Assessment

### Current problems

| Term | Problem |
|---|---|
| "תובנות" (Insights) | Too soft for operational findings — "insights" implies optional reading |
| "AIPredictions" | Misleading label for a "not available" placeholder |
| "Emergency Mode" in Hebrew: "מצב חירום" | Correct but needs confirmation UX to prevent accidental activation |
| "systemHealthScore" | Opaque metric — users don't know what feeds it |
| "data-research" in URL | Sounds like a BI tool, not an investigation workbench |
| "מגן דוד לאחזקה" in loading screen | Branding placeholder — unclear meaning to external users |
| confidence: 85% | Fabricated — should not appear |
| "Fleet Readiness %" | Correct term but formula must be shown |

### What terminology should be

| Current | Better |
|---|---|
| תובנות (Insights) | ממצאים (Findings) — already used, make consistent |
| AIPredictions | (remove from main UI) |
| systemHealthScore | Do not show until backed by real calculation |
| data-research portal | Research & Investigation Workbench |
| מצב חירום (Emergency Mode) | (keep but require explicit confirmation) |
| Flight files / flights | גיחות (Sorties) — correct operational Hebrew |

---

## 5. Empty State Assessment

### Existing good behavior
- AIPredictions: "AI not available" — correct
- Server unavailable: falls back to empty state (not fake data)
- FlightDossierContext: empty arrays when server unreachable

### Missing honest empty states

| Scenario | Current behavior | Correct behavior |
|---|---|---|
| No flights loaded | Fleet readiness shows 0 aircraft with no explanation | "No flight data loaded. Upload a CSV to begin analysis." |
| Rules not run yet | No findings shown (correct) but no message explaining why | "No rule violations found for this dataset." or "No data loaded — rules not evaluated." |
| Dossiers not loaded | Dossier context always empty | "No dossiers in this period." |
| Partial data (some params missing) | Rules silently skip | Show: "Rule [X] could not be evaluated — parameter [Y] not found in uploaded data" |
| Historical trend with single day data | Trend charts render with 1 data point | "Insufficient data for trend analysis — [N] days of data required" |
| Source unavailable | Not shown | "Data source [name] is currently unreachable — last known state shown" |

---

## 6. Role-Based UX Assessment

### Technician
**Should see:** My assigned tasks, open findings for my aircraft, what I need to do today, what is blocked on me.  
**Currently gets:** A version of the full dashboard with some components toggled off. Still sees fleet-level metrics that are not actionable at technician level.

### Specialist (Lead)
**Should see:** Triage queue, fleet overview for their aircraft, findings requiring ack or escalation, what is overdue.  
**Currently gets:** Fleet-level view similar to engineer's view without the investigation tools.

### Engineer
**Should see:** Findings requiring review/rejection/escalation, rule status and governance, investigation workbench with evidence, engineering decisions pending approval.  
**Currently gets:** Dashboard + EngineeringPortal (2 separate areas, workflow unclear).

### Commander
**Should see:** Fleet readiness summary, blockers, risk queue, accountability, emergency controls.  
**Currently gets:** CommanderView which may include analytics tabs beyond operational need.

---

## 7. Priority Issues for UX Redesign

**P1 (Must fix before any serious use):**
1. Split Index.tsx into role-specific components
2. Remove RoleSelector from production UI
3. Add honest empty states for all no-data scenarios
4. Remove or clearly label the fabricated confidence score
5. Connect RuleComposer to server API

**P2 (Must fix before multi-user use):**
6. Add data lineage labels to every chart and finding card
7. Add navigation structure for investigation workflow in EngineeringPortal
8. Commander view: simplify to briefing surface
9. Fix terminology inconsistencies

**P3 (Improve before wider deployment):**
10. Add refresh/sync indicator for multi-user scenarios
11. Remove SystemExplanation from main workflow
12. Define and implement evidence detail view
13. Add dossier creation and navigation UI
