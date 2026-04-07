# 🔴 MOCK DATA ELIMINATION REPORT - CRITICAL
## מגן דוד לאחזקה - Red Team Final Audit

**Date:** January 2026  
**Status:** BLOCKING PRODUCTION  
**Priority:** P0 - MUST FIX BEFORE DEPLOYMENT

---

## 🚨 EXECUTIVE SUMMARY

The system currently displays **fabricated data as if it were real** in multiple places.
This creates a **dangerous illusion of intelligence** that could mislead maintenance personnel.

**Key Finding:** 14 components show mock data WITHOUT clear indication that CSV was never loaded.

---

## TABLE 1: COMPLETE MOCK DATA INVENTORY

| # | File | Component | Mock Data Type | Hardcoded Values | Risk Level |
|---|------|-----------|----------------|------------------|------------|
| 1 | `Index.tsx:99-145` | DashboardContent | `sampleInsights[]` | 892, 334, 155, INS-001/002/003 | 🔴 CRITICAL |
| 2 | `Index.tsx:297-300` | Aircraft Selector | Hardcoded options | 417, 892, 334 | 🔴 CRITICAL |
| 3 | `Index.tsx:310` | Black Box Tree | Static flight | F16-006 | 🔴 CRITICAL |
| 4 | `Index.tsx:393-406` | Daily Summary | Static numbers | 12, 3, 7, 8/12, 2 | 🟠 HIGH |
| 5 | `FlightDataChart.tsx:10-38` | FlightDataChart | `aircraftList[]`, `flightData{}` | 417, 892, 334, 156 + full telemetry | 🔴 CRITICAL |
| 6 | `SquadronStatusCard.tsx:49-53` | SquadronStatusCard | `defaultAircraftData[]` | 417, 892, 334 with statuses | 🔴 CRITICAL |
| 7 | `AircraftAvailability.tsx:31-59` | AircraftAvailability | `defaultAircraftFleet[]` | 417, 892, 334 with locations | 🔴 CRITICAL |
| 8 | `FleetAnalysisTab.tsx:31-84` | FleetAnalysisTab | `mockFleetData{}` | 417, 892, 334, 155 with fault history | 🔴 CRITICAL |
| 9 | `FlightTechniqueAnalysis.tsx:12-49` | FlightTechniqueAnalysis | `flightAnalyses[]` | 892, 334, 155 with pilot names! | 🔴 CRITICAL |
| 10 | `TechnicianMaintenanceView.tsx:45-89` | TechnicianMaintenanceView | `pendingInsights[]`, `waitingForParts[]` | 417, 334, 892 | 🔴 CRITICAL |
| 11 | `TechnicianMaintenanceView.tsx:347-360` | Weekly Summary | Static numbers | 12, 3, 2 | 🟠 HIGH |
| 12 | `RuleManagementTab.tsx:322-332` | Rule Performance | `Math.random()` | Random numbers | 🟠 HIGH |
| 13 | `FlightDossierContext.tsx:1002-1217` | loadRealisticDemoData | Demo findings/tasks | FND-001/002/003/004, TSK-001 | 🔴 CRITICAL |
| 14 | `CommanderDashboard.tsx` | FleetStatusCard | Uses context demo | From FlightDossierContext | 🟠 HIGH |

---

## TABLE 2: UNAUTHORIZED STATUS LABELS

These labels appear WITHOUT rule authority:

| Label | Hebrew | Location | Should Show Instead |
|-------|--------|----------|---------------------|
| "לא כשיר" | Not Airworthy | SquadronStatusCard, AircraftAvailability | "לא ידוע" |
| "מקורקע" | Grounded | SquadronStatusCard, FleetAnalysisTab | "סטטוס לא ידוע" |
| "קריטי" | Critical | Multiple components | "עדיפות גבוהה" |
| "חריג" | Anomaly | FlightTechniqueAnalysis | "תצפית" |
| "חסימה" | Blocking | OpenInvestigations | "פתוח" |

---

## TABLE 3: COMPONENTS THAT NEED EMPTY STATE

| Component | Current Behavior | Required Empty State |
|-----------|------------------|---------------------|
| FlightDataChart | Shows hardcoded chart | "יש לבחור מטוס ולהעלות נתונים" |
| SquadronStatusCard | Shows 3 fake aircraft | "אין נתוני מטוסים - העלה CSV" |
| AircraftAvailability | Shows 3 fake aircraft | "אין נתוני כשירות זמינים" |
| FleetAnalysisTab | Shows mock fleet data | "אין נתוני צי - העלה נתונים" |
| FlightTechniqueAnalysis | Shows fake pilot analyses | "אין נתוני טכניקת טיסה" |
| Index.tsx (Daily Summary) | Shows fake numbers | "אין נתונים לסיכום יומי" |
| Index.tsx (Black Box Tree) | Shows fake tree | "בחר מטוס ותאריך לצפייה בנתונים" |

---

## 🛠️ REQUIRED FIXES BY COMPONENT

### 1. Index.tsx (Main Dashboard)

**Lines 99-145 - REMOVE:**
```typescript
// DELETE THIS ENTIRE ARRAY:
const sampleInsights = [
  { id: "INS-001", aircraft: "892", ... },
  // ...
];
```

**Lines 297-300 - REPLACE:**
```typescript
// BEFORE:
<option value="417">417</option>
<option value="892">892</option>
<option value="334">334</option>

// AFTER:
{hasAircraft ? (
  tailNumbers.map(tail => <option key={tail} value={tail}>{tail}</option>)
) : (
  <option disabled>אין מטוסים - העלה CSV</option>
)}
```

**Lines 310-360 - REPLACE:**
```typescript
// BEFORE: Static F16-006 tree

// AFTER:
{hasFlightSelected ? (
  <SystemTree flightId={selectedFlightId} />
) : (
  <EmptyState
    title="בחר תיק טיסה"
    description="יש לבחור מטוס ותאריך לצפייה בנתוני קופסה שחורה"
  />
)}
```

### 2. FlightDataChart.tsx - COMPLETE REWRITE

```typescript
export const FlightDataChart = () => {
  const { processedFlights, hasRealData } = useCSVData();
  const { tailNumbers, hasAircraft } = useAvailableAircraft();
  
  if (!hasRealData) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Activity}
            title="אין נתוני טיסה"
            description="העלה קובץ CSV עם נתוני קופסה שחורה לצפייה בגרפים"
          />
        </CardContent>
      </Card>
    );
  }
  
  // Use only REAL data from processedFlights
  // NO hardcoded aircraftList or flightData
};
```

### 3. SquadronStatusCard.tsx - REMOVE DEFAULT

```typescript
// DELETE lines 49-53:
const defaultAircraftData = [
  { tailNumber: "417", status: "זמין", ... },
  ...
];

// REPLACE line 55:
const displayAircraftData = aircraftData; // NO FALLBACK

// ADD check:
if (displayAircraftData.length === 0) {
  return <EmptyState title="אין נתוני טייסת" />;
}
```

### 4. AircraftAvailability.tsx - REMOVE DEFAULT

```typescript
// DELETE lines 31-59:
const defaultAircraftFleet = [ ... ];

// REPLACE line 61:
const aircraftFleet = aircraftFromData; // NO FALLBACK

// ADD empty state:
if (aircraftFleet.length === 0) {
  return <NoAircraftEmptyState />;
}
```

### 5. FleetAnalysisTab.tsx - COMPLETE REWRITE

```typescript
// DELETE lines 31-84:
const mockFleetData: Record<string, AircraftData[]> = { ... };

// REPLACE with canonical data hook:
const { aircraftByType, hasData } = useFleetData();

if (!hasData) {
  return (
    <EmptyState
      title="אין נתוני כשירות מטוסים"
      description="נדרשת העלאת נתונים לניתוח כשירות"
    />
  );
}
```

### 6. FlightTechniqueAnalysis.tsx - REMOVE ALL MOCK

```typescript
// DELETE lines 12-49:
const flightAnalyses = [ ... ];

// REPLACE:
const { techniqueAnalyses, hasData } = useTechniqueAnalysis();

if (!hasData) {
  return (
    <EmptyState
      title="אין נתוני טכניקת טיסה"
      description="נתונים אלו מופקים מניתוח קופסה שחורה"
    />
  );
}
```

### 7. TechnicianMaintenanceView.tsx - REMOVE HARDCODED

```typescript
// DELETE lines 45-89:
const pendingInsights: MaintenanceInsight[] = [ ... ];
const waitingForParts: MaintenanceInsight[] = [ ... ];

// USE ONLY canonical data:
const { myPendingTasks, waitingForOthers } = useMyTasks();
```

---

## 🔒 DATA FLOW GATE IMPLEMENTATION

Add to `App.tsx` or create `DataGate.tsx`:

```typescript
interface DataGateProps {
  requiresData: boolean;
  children: React.ReactNode;
  emptyState?: React.ReactNode;
}

export const DataGate: React.FC<DataGateProps> = ({
  requiresData,
  children,
  emptyState
}) => {
  const { hasRealData } = useCSVData();
  
  if (requiresData && !hasRealData) {
    return emptyState || (
      <EmptyState
        title="נדרשת העלאת נתונים"
        description="יש להעלות קובץ CSV לצפייה בתוכן זה"
      />
    );
  }
  
  return <>{children}</>;
};
```

---

## ✅ VERIFICATION CHECKLIST

After implementing all fixes, verify:

### Fresh Load (No CSV):
- [ ] FlightDataChart shows empty state
- [ ] SquadronStatusCard shows empty state
- [ ] AircraftAvailability shows empty state
- [ ] FleetAnalysisTab shows empty state
- [ ] FlightTechniqueAnalysis shows empty state
- [ ] Index.tsx sampleInsights removed
- [ ] Index.tsx aircraft selector shows "אין מטוסים"
- [ ] Index.tsx black box tree shows empty state
- [ ] Daily summary shows "אין נתונים"
- [ ] NO 417, 892, 334, 155 visible anywhere
- [ ] NO F16-006, F16-007, F16-008 visible
- [ ] NO INS-001, INS-002, etc. visible
- [ ] NO fake pilot names visible

### After CSV Upload:
- [ ] All components populate from CSV data only
- [ ] Aircraft selector shows ONLY CSV tail numbers
- [ ] Insights generated ONLY from CSV analysis
- [ ] No mixing of demo and real data

### Status Labels:
- [ ] "לא כשיר" only shown with active grounding rule
- [ ] "מקורקע" only shown with active rule
- [ ] "קריטי" only shown with S1 severity rule
- [ ] All other statuses show neutral alternatives

---

## 📊 IMPACT ASSESSMENT

| Metric | Current State | After Fix |
|--------|---------------|-----------|
| Mock data components | 14 | 0 |
| Hardcoded tail numbers | 4 (417, 892, 334, 155) | 0 |
| Unauthorized status labels | 5 | 0 |
| User trust risk | HIGH | LOW |
| Compliance risk | HIGH | LOW |

---

## 🚀 IMPLEMENTATION ORDER

1. **Phase 1 (BLOCKING):** Remove all hardcoded arrays (2 hours)
2. **Phase 2 (BLOCKING):** Add empty states to all components (2 hours)
3. **Phase 3 (BLOCKING):** Fix Index.tsx aircraft selector and black box (1 hour)
4. **Phase 4:** Verify no demo data visible on fresh load (1 hour)
5. **Phase 5:** Verify data flow gate working (1 hour)

**Total estimated time:** 7 hours

---

## ⚠️ WARNING

**DO NOT DEPLOY TO PRODUCTION** until ALL items in this report are resolved.

Any mock data visible to users will:
1. Create false sense of system intelligence
2. Lead to incorrect maintenance decisions
3. Undermine trust when real data differs
4. Violate aviation safety standards

---

**Document prepared by:** Red Team Security Review  
**Reviewed by:** Senior Engineering  
**Approval required from:** Technical Commander before deployment
