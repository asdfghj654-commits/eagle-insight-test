# TIER 2 UI/UX HARDENING SPECIFICATION
## Magen David Aviation Maintenance System

**Classification:** Production Hardening Document  
**Version:** 8.1-TIER2  
**Date:** January 2026  

---

## TABLE 1: MOCK/DEMO REMOVAL REPORT

| File Path | Component | Mock Type | Canonical Replacement | Empty-State/Disabled Behavior |
|-----------|-----------|-----------|----------------------|------------------------------|
| `src/pages/Index.tsx:99-145` | DashboardContent | `sampleInsights[]` hardcoded array | `useFlightDossier().getOpenFindings()` | EmptyState: "אין תובנות זמינות - העלה נתונים" |
| `src/pages/Index.tsx:297-300` | DashboardContent | Hardcoded tail numbers (417, 892, 334) | `useAvailableAircraft().tailNumbers` | EmptyState: "אין מטוסים - העלה CSV" |
| `src/pages/Index.tsx:393-406` | DashboardContent | Static daily summary (12, 3, 7) | `useDailyStats()` from canonical | Show "אין נתונים" when empty |
| `src/components/dashboard/AIPredictions.tsx:10-56` | AIPredictions | `predictions[]` hardcoded array | **MUST HIDE** - No real AI model | EmptyState: "מודלי AI אינם זמינים במערכת זו" |
| `src/components/dashboard/OpenInvestigations.tsx:94-104` | OpenInvestigations | `defaultInvestigations[]` | `useFlightDossier().findings` filtered | EmptyState: "אין תחקירים פתוחים" |
| `src/components/dashboard/OpenInvestigations.tsx:153-161` | handleUpdateStatus | `setTimeout` fake API | Update canonical store + audit | Show "פעולה מקומית בלבד" badge |
| `src/components/dashboard/OpenInvestigations.tsx:175-183` | handleCloseInvestigation | `setTimeout` fake API | Update canonical store + audit | Show "פעולה מקומית בלבד" badge |
| `src/components/dashboard/TechnicianMaintenanceView.tsx:45-89` | TechnicianMaintenanceView | `pendingInsights[]`, `waitingForParts[]` | `useMyTasks()` hook | EmptyState: "אין משימות ממתינות" |
| `src/components/dashboard/TechnicianMaintenanceView.tsx:347-360` | TechnicianMaintenanceView | Weekly summary (12, 3, 2) | `useTaskStats()` computed | Show actual computed values or "0" |
| `src/components/dashboard/RuleManagementTab.tsx:322-332` | RuleManagementTab | `Math.random()` for stats | `useRuleMetrics()` from executions | EmptyState: "אין נתוני ביצועים" |
| `src/contexts/FlightDossierContext.tsx:1010-1218` | loadRealisticDemoData | 200+ lines demo data | Protected by `DEMO_MODE_ALLOWED` | Only available in DEV builds |
| `src/lib/sample-data.ts` | generateSampleFlightData | Full demo generator | **REMOVE from PROD bundle** | N/A - file excluded |
| `src/components/portal/DemoDataButton.tsx` | DemoDataButton | Demo data loader | Protected by `DEMO_MODE_ALLOWED` | Hidden in PROD |
| `src/components/dashboard/CommanderDashboard.tsx:77-78` | FleetStatusCard | Uses "צי" terminology | Change to "כשירות מטוסים" | N/A |
| `src/hooks/useDashboardData.ts` | useDashboardData | Generates insights if no real data | Return empty when no data | EmptyState in consumers |

---

## TABLE 2: DEAD ACTIONS REPORT

| File Path | Button/Action | Why Dead/Toast-Only | Required Fix | Preconditions |
|-----------|---------------|---------------------|--------------|---------------|
| `src/components/dashboard/OpenInvestigations.tsx:148-161` | "עדכן סטטוס" | setTimeout + toast only, no state change | Update canonical `findings` state + add audit entry | Role: commander/maintenance-chief; Investigation exists |
| `src/components/dashboard/OpenInvestigations.tsx:170-183` | "סגור תחקיר" | setTimeout + toast only, no state change | Call `updateFindingStatus(id, 'closed')` + audit | Role: commander; Investigation exists; Has resolution note |
| `src/components/dashboard/OpenInvestigations.tsx:186-189` | "פתח תחקיר חדש" | Toast + navigate only | Navigate to portal with pre-populated form | Role: commander |
| `src/components/dashboard/FlightFiles.tsx:142-164` | "ייצוא JSON" | **EXPORT - MUST DISABLE** | Remove button or disable with "ייצוא לא זמין" | N/A - Remove |
| `src/components/dashboard/FlightFiles.tsx:270-275` | Download icon button | **EXPORT - MUST DISABLE** | Remove button entirely | N/A - Remove |
| `src/components/dashboard/FlightFiles.tsx:356-360` | "ייצא JSON" dialog button | **EXPORT - MUST DISABLE** | Remove button entirely | N/A - Remove |
| `src/components/dashboard/FlightFileSystem.tsx:120-138` | "ייצוא נתונים" | **EXPORT - MUST DISABLE** | Remove button entirely | N/A - Remove |
| `src/components/portal/EvidenceTab.tsx:259` | Download evidence | **EXPORT - MUST DISABLE** | Remove button or disable | N/A - Remove |
| `src/components/portal/FullScreenModal.tsx:88-92` | "Export Chart" | **EXPORT - MUST DISABLE** | Remove button entirely | N/A - Remove |
| `src/components/dashboard/FleetAnalysisTab.tsx:289` | Download analysis | **EXPORT - MUST DISABLE** | Remove button entirely | N/A - Remove |
| `src/components/dashboard/TechnicianMaintenanceView.tsx:127-141` | "פתח תיק עבודה" | setTimeout + toast, no state | Create task in canonical store + audit | Role: technician+; Finding exists |
| `src/components/dashboard/TechnicianMaintenanceView.tsx:158-183` | "התחל טיפול" | Creates task but may fail silently | Must succeed or show error; update status | Role: technician+; Not awaiting parts |
| `src/components/dashboard/RuleManagementTab.tsx:69-74` | "ניתוח ביצועים" | setTimeout + toast only | Navigate to rule details with metrics | Rule exists |
| `src/components/dashboard/CommanderRecommendations.tsx` | Various action buttons | Need audit - likely toast-only | Verify all change canonical state | Role-based |
| `src/components/dashboard/AIPredictions.tsx` | All predictions | **FAKE DATA - HIDE COMPONENT** | Hide entirely in live mode | No real AI model |

---

## TABLE 3: NAVIGATION & ROUTING FIXES

| Route | Current Behavior | Required Fix |
|-------|------------------|--------------|
| `/engineer/rules` | Opens Index.tsx (default tab) | Must open Index with `rules` tab pre-selected via query param or state |
| `/engineer/investigation` | Opens EngineeringPortal | Correct - keep as is |
| `/lead/triage` | Opens Index (default) | Consider dedicated triage view |
| `/commander/analytics` | Opens Index (default) | Consider dedicated analytics view |

---

## PART 2: INCREMENTAL IMPLEMENTATION PLAN

### Commit 1: Remove All Export Features
**Files Touched:**
- `src/components/dashboard/FlightFiles.tsx`
- `src/components/dashboard/FlightFileSystem.tsx`
- `src/components/portal/EvidenceTab.tsx`
- `src/components/portal/FullScreenModal.tsx`
- `src/components/dashboard/FleetAnalysisTab.tsx`

**Changes:**
1. Remove/comment out all `handleExport*` functions
2. Remove all Download button JSX
3. Remove all Download imports where no longer used

**DoD:**
- No Download/Export buttons visible in UI
- No console errors
- Build succeeds

**Manual Test:**
- [ ] FlightFiles: No export button visible
- [ ] FlightFileSystem: No export button visible
- [ ] EvidenceTab: No download button visible
- [ ] FullScreenModal: No export button visible
- [ ] FleetAnalysisTab: No download visible

---

### Commit 2: Hide AIPredictions in Live Mode
**Files Touched:**
- `src/components/dashboard/AIPredictions.tsx`
- `src/pages/Index.tsx` (where AIPredictions is used)

**Changes:**
1. Add `dataMode` check at component start
2. Return empty-state if no active rules/real AI model
3. OR hide component entirely from parent

**DoD:**
- AIPredictions shows empty-state or is hidden in live mode
- Component still works if demo mode enabled

**Manual Test:**
- [ ] Fresh load (no demo): AIPredictions shows empty or hidden
- [ ] After demo data load: Component may appear (if permitted)

---

### Commit 3: Fix OpenInvestigations to Update Canonical State
**Files Touched:**
- `src/components/dashboard/OpenInvestigations.tsx`
- `src/contexts/FlightDossierContext.tsx` (if needed)

**Changes:**
1. Replace `setTimeout` in `handleUpdateStatus` with actual `updateFindingStatus` call
2. Replace `setTimeout` in `handleCloseInvestigation` with actual status update
3. Add audit log entries for both actions
4. Remove `defaultInvestigations` fallback array
5. Add explicit empty-state when no investigations

**DoD:**
- Status updates persist in context state
- Close investigation updates status to 'closed'
- Audit log has entries
- No demo data fallback

**Manual Test:**
- [ ] Update status: Verify status persists on page refresh (via context)
- [ ] Close investigation: Verify investigation shows as closed
- [ ] Empty state: Shows "אין תחקירים פתוחים" when no data

---

### Commit 4: Remove sampleInsights and Hardcoded Tails from Index.tsx
**Files Touched:**
- `src/pages/Index.tsx`

**Changes:**
1. Remove lines 99-145 (`sampleInsights` array)
2. Replace with `useFlightDossier().getOpenFindings()` usage
3. Replace hardcoded tail selector (297-300) with `useAvailableAircraft()`
4. Replace static daily summary (393-406) with computed values or empty-state
5. Fix terminology: "צי" → "כשירות מטוסים"

**DoD:**
- No hardcoded data in Index.tsx
- Aircraft selector shows only canonical aircraft
- Daily summary shows real or empty values

**Manual Test:**
- [ ] Fresh load: No sample insights visible
- [ ] Aircraft selector: Shows "אין מטוסים" if no data
- [ ] Daily summary: Shows "אין נתונים" or real computed values

---

### Commit 5: Fix TechnicianMaintenanceView Mock Data
**Files Touched:**
- `src/components/dashboard/TechnicianMaintenanceView.tsx`
- `src/hooks/useMyTasks.ts`

**Changes:**
1. Remove hardcoded `pendingInsights[]` and `waitingForParts[]`
2. Use `useMyTasks()` hook exclusively
3. Fix weekly summary to use actual task counts
4. Fix "פתח תיק עבודה" to create real task
5. Fix "התחל טיפול" to update status properly

**DoD:**
- All data from canonical hooks
- Task creation works and persists
- Weekly stats are computed from real data

**Manual Test:**
- [ ] Empty state when no tasks
- [ ] "פתח תיק עבודה" creates task in context
- [ ] Weekly summary shows 0 when no tasks

---

### Commit 6: Fix RuleManagementTab Random Stats
**Files Touched:**
- `src/components/dashboard/RuleManagementTab.tsx`
- Create `src/hooks/useRuleMetrics.ts`

**Changes:**
1. Remove `Math.random()` usage (lines 322-332)
2. Create `useRuleMetrics()` hook that computes from rule execution logs
3. Show empty-state when no metrics available
4. Add "אין נתוני ביצועים" message

**DoD:**
- No random numbers in UI
- Metrics from real execution data or empty-state

**Manual Test:**
- [ ] Rule stats show "אין נתוני ביצועים" when no rules executed
- [ ] No flickering random numbers

---

### Commit 7: Fix Route Navigation for /engineer/rules
**Files Touched:**
- `src/App.tsx`
- `src/pages/Index.tsx`

**Changes:**
1. Add URL query param support: `?tab=rules`
2. In Index.tsx, read query param and set default tab
3. Update route `/engineer/rules` to navigate with `?tab=rules`

**DoD:**
- `/engineer/rules` opens directly to rules tab
- Tab state persists in URL

**Manual Test:**
- [ ] Navigate to `/engineer/rules` → Rules tab is active
- [ ] Direct URL `/lead/triage?tab=insights` → Insights tab active

---

### Commit 8: Add FlightSelectionContext for Consistent Tail/Flight Selection
**Files Touched:**
- Create `src/contexts/FlightSelectionContext.tsx`
- Update consumers: charts, black box view, rule test

**Changes:**
1. Create context with `selectedTail`, `selectedFlightId`, `timeWindow`
2. Add context provider in App.tsx
3. Update SignalsTab, DistributionsTab, CorrelationsTab to use context
4. Block "rule test" if no tail is selected

**DoD:**
- Selection context available app-wide
- All charts show consistent tail/flight
- Backtest requires explicit tail scope

**Manual Test:**
- [ ] Change tail in one component → others update
- [ ] Backtest without tail selection → shows "בחר מטוס לפני בדיקה"

---

## PART 3: EMPTY-STATE UX TEXT (HEBREW)

### Missing PDF/Document
```
אין מסמך מצורף
המסמך שהתבקש אינו זמין במערכת.
ניתן להעלות מסמך חדש או ליצור קשר עם מפקד הגף הטכני.
```

### Missing Data / No Insights
```
אין נתונים זמינים
טרם הועלו נתוני טיסה למערכת.
העלה קובץ CSV עם נתוני קופסה שחורה להתחלת עבודה.
```

### Action Disabled - No Rule Authority
```
פעולה לא מורשית
אין כלל פעיל שמאשר סיווג זה.
פנה למהנדס דיסיפלינה ליצירת כלל מתאים.
```

### Action Disabled - Missing Role
```
אין הרשאה
פעולה זו מצריכה הרשאת {role_name}.
פנה למפקד הגף הטכני אם נדרש.
```

### Investigation No PDF
```
אין דו"ח תחקיר
לתחקיר זה לא צורף מסמך PDF.
ניתן להוסיף מסמך דרך פורטל ההנדסי.
```

### Export Disabled
```
ייצוא לא זמין
ייצוא נתונים אינו זמין במערכת זו.
לבקשות מיוחדות פנה למהנדס המטה.
```

### No Active Rules
```
אין כללים פעילים
לא הוגדרו כללי אחזקה במערכת.
צור כלל חדש בפורטל ההנדסי.
```

### Backtest Blocked - No Scope
```
נדרש בחירת היקף
לא ניתן להריץ בדיקה ללא בחירת מטוס/טיסות.
בחר מטוס ספציפי או טווח תאריכים להמשך.
```

---

## PART 4: VERIFICATION CHECKLIST

### A. No Demo Data in Live Mode
- [ ] Fresh app load (no localStorage) shows only empty states
- [ ] `sampleInsights` array removed from Index.tsx
- [ ] `defaultInvestigations` removed from OpenInvestigations
- [ ] `predictions` array removed/hidden from AIPredictions
- [ ] `pendingInsights` removed from TechnicianMaintenanceView
- [ ] DemoDataButton hidden or disabled in PROD build
- [ ] `Math.random()` removed from RuleManagementTab
- [ ] No hardcoded tail numbers (417, 892, 334) visible

### B. No Unauthorized Operational Statuses
- [ ] "מקורקע" only appears if grounding rule is active
- [ ] "קריטי" only appears if severity rule is active
- [ ] "חריג" only appears if anomaly rule is active
- [ ] Status badges use `AuthorizedStatusBadge` component
- [ ] Finding classifications checked via `useRuleAuthority()`

### C. Rule Management Navigation Correct
- [ ] `/engineer/rules` opens with Rules tab active
- [ ] Breadcrumb shows correct location
- [ ] Back navigation returns to expected screen

### D. Backtest Cannot Run Without Tail Scope
- [ ] "בדוק כלל" button disabled if no tail selected
- [ ] Shows message: "בחר מטוס ספציפי להרצת בדיקה"
- [ ] Multi-tail selection shows explicit list: "נבדק על מטוסים: 101, 102, 103"

### E. No Export Features Available
- [ ] FlightFiles: No download buttons
- [ ] FlightFileSystem: No export button
- [ ] EvidenceTab: No download button
- [ ] FullScreenModal: No export button
- [ ] FleetAnalysisTab: No download button

### F. Investigations Real or Empty
- [ ] View investigation shows real data or "אין מסמך מצורף"
- [ ] Update status persists in canonical state
- [ ] Close investigation persists in canonical state
- [ ] Audit log records all actions

### G. Terminology Correct
- [ ] "צי" → "כשירות מטוסים" in all places
- [ ] Fleet terminology updated in CommanderDashboard

---

## APPENDIX: TERMINOLOGY REPLACEMENTS

| Current (Wrong) | Correct | Locations |
|-----------------|---------|-----------|
| צי | כשירות מטוסים | CommanderDashboard.tsx |
| כשירות צי | כשירות מטוסים | CommanderDashboard.tsx |
| Fleet Readiness | Aircraft Readiness | CommanderDashboard.tsx |
| Export | (Remove) | Multiple files |
| ייצוא | (Remove or disable) | Multiple files |

---

## APPENDIX: ROLE MAPPING

| Hebrew Role | System Role | Permissions |
|-------------|-------------|-------------|
| מפקד טייסת תחזוקה | commander | All + emergency mode |
| מפקד גף טכני | commander/specialist | Maintenance impact, escalation |
| ר״צ | specialist | Directives with logistics, routing |
| טכנאי | technician | Executor, limited view |
| מהנדס דיסיפלינה | engineer | Rule governance, mapping |

---

**Document End**
*Implementation must complete all 8 commits before production deployment.*
