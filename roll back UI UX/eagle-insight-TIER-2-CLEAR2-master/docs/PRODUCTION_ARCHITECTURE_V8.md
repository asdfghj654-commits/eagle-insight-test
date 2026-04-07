# PRODUCTION REFACTOR SPECIFICATION
## Magen David Aviation Maintenance System - V8.0 PROD

**CLASSIFICATION:** Production Architecture Document  
**Version:** 8.0-PROD  
**Date:** January 2026  
**Status:** MANDATORY PRE-DEPLOYMENT  

---

## EXECUTIVE SUMMARY

This document specifies the complete refactoring required to transition the Magen David system from a prototype with demo data to a production-grade aviation maintenance analytics platform.

### Core Principles

1. **Single Source of Truth (SSOT)**: One canonical data model fed by integrations
2. **No Mock/Demo Data in Production**: Zero fabricated data in PROD builds
3. **Rule Authority**: Classifications require active, authorized rules
4. **Empty States Over Fabrication**: Show "no data" rather than fake data
5. **Audit Trail**: Every action must be logged and traceable

---

## PART 1: CANONICAL DATA MODEL ARCHITECTURE

### 1.1 Data Sources Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                     │
├─────────────────────────────────────────────────────────────┤
│  Maintenance DB │ Logistics API │ Aircraft Telemetry │ CSV  │
│  (work orders)  │ (parts/ETA)   │ (black box data)   │(fallback)
└────────┬────────┴───────┬───────┴────────┬───────────┴──┬───┘
         │                │                │              │
         └────────────────┴────────────────┴──────────────┘
                                   │
                           ┌───────▼───────┐
                           │  DATA ADAPTER  │
                           │  (normalize)   │
                           └───────┬───────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   CANONICAL DATA PROVIDER    │
                    │  (CanonicalDataContext.tsx)  │
                    ├─────────────────────────────┤
                    │ • aircraft: Aircraft[]       │
                    │ • flights: Flight[]          │
                    │ • telemetry: TelemetryData[] │
                    │ • maintenance: WorkOrder[]   │
                    │ • logistics: PartStatus[]    │
                    │ • findings: Finding[]        │
                    │ • tasks: Task[]              │
                    └─────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   DERIVED DATA HOOKS        │
                    ├─────────────────────────────┤
                    │ • useAircraft()              │
                    │ • useFlights()               │
                    │ • useTelemetry()             │
                    │ • useFindings()              │
                    │ • useFleetReadiness()        │
                    │ • useRuleAuthority()         │
                    └─────────────────────────────┘
```

### 1.2 Canonical Types

```typescript
// src/types/canonical.ts

export interface CanonicalAircraft {
  tailNumber: string;
  model: string;
  status: AircraftStatus; // MUST be derived from rules, not hardcoded
  lastFlightDate: string | null;
  totalFlightHours: number;
  nextScheduledMaintenance: string | null;
  // NO fabricated readiness percentages
}

export type AircraftStatus = 
  | 'unknown'           // Default when no rule determines status
  | 'available'         // Rule: all checks pass
  | 'in_maintenance'    // Rule: active work order
  | 'awaiting_parts'    // Rule: logistics block
  | 'grounded'          // Rule: S1 finding with grounding flag
  | 'restricted';       // Rule: S2 finding limiting operations

export interface CanonicalFlight {
  flightId: string;
  tailNumber: string;
  startTime: string;
  endTime: string;
  phases: FlightPhase[];
  hasProcessedTelemetry: boolean;
  findingCount: number;
}

export interface CanonicalTelemetry {
  flightId: string;
  timestamp: string;
  phase: string;
  parameters: Record<string, number>;
}

export interface CanonicalFinding {
  id: string;
  source: 'measured' | 'reported' | 'derived';
  severity: SeverityLevel;
  ruleId: string | null;        // MUST reference active rule
  ruleVersion: number | null;
  status: FindingStatus;
  classification: FindingClassification | null;
  // Classification is NULL if no active rule authorizes it
}

export type FindingClassification =
  | null                      // No rule authorizes classification
  | 'observation'             // Baseline - always allowed
  | 'candidate'               // Needs review
  | 'confirmed'               // Rule-authorized finding
  | 'grounding'               // Rule-authorized + grounding policy
  | 'critical';               // Rule-authorized + critical policy

export interface RuleAuthority {
  ruleId: string;
  isActive: boolean;
  isApproved: boolean;
  allowedClassifications: FindingClassification[];
  groundingAuthorized: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
}
```

### 1.3 DataMode Enforcement

```typescript
// src/types/data-mode.ts

export type DataMode = 'live' | 'demo';

export interface DataModeConfig {
  mode: DataMode;
  // PRODUCTION: Demo mode disabled in production builds
  isDemoAllowed: boolean;
  lastDataSource: 'integration' | 'csv' | 'demo' | null;
  lastUpdateTimestamp: string | null;
}

// Build-time configuration
export const PRODUCTION_BUILD = process.env.NODE_ENV === 'production';
export const DEMO_MODE_ALLOWED = !PRODUCTION_BUILD;
```

---

## PART 2: MOCK REMOVAL REPORT

### 2.1 Mock Data Inventory

| File | Location | Mock Type | Severity | Replacement Strategy |
|------|----------|-----------|----------|---------------------|
| **FlightDossierContext.tsx** | Lines 1010-1218 | `loadRealisticDemoData()` | P0 | Conditional on `DEMO_MODE_ALLOWED` |
| **sample-data.ts** | Entire file | `generateSampleFlightData()` | P0 | Remove from PROD, keep for DEV only |
| **Index.tsx** | Lines 99-145 | `sampleInsights[]` | P0 | Derive from `useFindings()` |
| **Index.tsx** | Lines 297-300 | Hardcoded tail numbers | P0 | Use `useAircraft().tailNumbers` |
| **Index.tsx** | Lines 393-406 | Static daily summary | P0 | Use `useDailyStats()` |
| **FailureHistory.tsx** | Lines 9-56 | All chart/stats data | P0 | Use `useHistoricalMetrics()` |
| **TechnicianMaintenanceView.tsx** | Lines 45-89 | `pendingInsights[]`, `waitingForParts[]` | P0 | Use `useMyTasks()` |
| **TechnicianMaintenanceView.tsx** | Lines 347-360 | Weekly summary counts | P1 | Use `useTaskStats()` |
| **RuleManagementTab.tsx** | Lines 322-332 | Random performance stats | P0 | Use `useRuleMetrics()` |
| **CSVDataContext.tsx** | Lines 305-340 | `loadDemoData()` | P0 | Conditional on `DEMO_MODE_ALLOWED` |
| **FlightFiles.tsx** | Entire logic | Demo flight derivation | P0 | Already fixed in previous session |
| **ActiveFlights.tsx** | Entire logic | Demo active flights | P0 | Already fixed in previous session |
| **TechnicalRecommendations.tsx** | Lines 17-40 (removed) | Fallback demo | P0 | Already fixed in previous session |

### 2.2 Removal Actions

#### CRITICAL (P0) - Block Production

```typescript
// === FlightDossierContext.tsx ===
// BEFORE:
const loadRealisticDemoData = useCallback(() => {
  const today = new Date().toISOString().split('T')[0];
  const demoDossiers: FlightDossier[] = [...]; // 1000+ lines of demo
  // ...
}, []);

// AFTER:
const loadRealisticDemoData = useCallback(() => {
  if (!DEMO_MODE_ALLOWED) {
    console.error('Demo data loading is disabled in production');
    return;
  }
  // Demo data only in development
  const today = new Date().toISOString().split('T')[0];
  // ...
}, []);
```

```typescript
// === Index.tsx ===
// BEFORE:
const sampleInsights = [
  { id: "INS-001", aircraft: "892", ... },
  { id: "INS-002", aircraft: "334", ... },
  // ...
];

// AFTER:
const { insights, isLoading, isEmpty } = useDashboardInsights();
// No fallback data - show empty state if isEmpty
```

```typescript
// === FailureHistory.tsx ===
// BEFORE:
const flightHoursData = [
  { month: "ינו", flightHours: 120, failures: 2, reliability: 98.3 },
  // ... hardcoded
];

// AFTER:
const { data: flightHoursData, isLoading, isEmpty } = useFlightHoursHistory();
if (isEmpty) return <NoHistoryEmptyState />;
```

---

## PART 3: CANONICAL PROVIDER DESIGN

### 3.1 CanonicalDataContext

```typescript
// src/contexts/CanonicalDataContext.tsx

import React, { createContext, useContext, useMemo, useState } from 'react';
import { DEMO_MODE_ALLOWED } from '@/types/data-mode';

interface CanonicalDataState {
  // Mode
  dataMode: DataMode;
  isLoading: boolean;
  lastUpdate: string | null;
  
  // Raw canonical data
  aircraft: CanonicalAircraft[];
  flights: CanonicalFlight[];
  telemetry: CanonicalTelemetry[];
  workOrders: WorkOrder[];
  partStatuses: PartStatus[];
  
  // Derived from rules engine
  findings: CanonicalFinding[];
  tasks: Task[];
  
  // Rules (the AUTHORITY source)
  rules: Rule[];
  activeRules: Rule[];
}

interface CanonicalDataActions {
  // Data ingestion
  ingestFromIntegration: (source: string, data: any) => Promise<void>;
  ingestFromCSV: (file: File) => Promise<void>;
  
  // PRODUCTION: No fabrication
  loadDemoData: () => void; // Only works if DEMO_MODE_ALLOWED
  clearAllData: () => void;
  
  // Validation
  validateDataIntegrity: () => ValidationResult;
}

const CanonicalDataContext = createContext<
  (CanonicalDataState & CanonicalDataActions) | undefined
>(undefined);

export const CanonicalDataProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [dataMode, setDataMode] = useState<DataMode>('live');
  const [aircraft, setAircraft] = useState<CanonicalAircraft[]>([]);
  const [flights, setFlights] = useState<CanonicalFlight[]>([]);
  const [telemetry, setTelemetry] = useState<CanonicalTelemetry[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [partStatuses, setPartStatuses] = useState<PartStatus[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [findings, setFindings] = useState<CanonicalFinding[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Active rules that can authorize classifications
  const activeRules = useMemo(() => 
    rules.filter(r => r.status === 'approved' && r.isActive),
    [rules]
  );

  // PRODUCTION: Demo data protection
  const loadDemoData = () => {
    if (!DEMO_MODE_ALLOWED) {
      console.error('[PRODUCTION] Demo data loading is DISABLED');
      return;
    }
    setDataMode('demo');
    // Load demo data only in development
  };

  const ingestFromCSV = async (file: File) => {
    setIsLoading(true);
    try {
      // Parse and normalize CSV to canonical format
      const data = await parseCSV(file);
      const normalized = normalizeToCanonical(data);
      
      // Update state
      setAircraft(normalized.aircraft);
      setFlights(normalized.flights);
      setTelemetry(normalized.telemetry);
      setDataMode('live');
      setLastUpdate(new Date().toISOString());
      
      // Run rules engine on new data
      await runRulesEngine(normalized);
    } finally {
      setIsLoading(false);
    }
  };

  // ... rest of implementation
};
```

### 3.2 Derived Hooks (No Logic Duplication)

```typescript
// src/hooks/useAircraft.ts
export const useAircraft = () => {
  const { aircraft, dataMode, isLoading } = useCanonicalData();
  
  return {
    aircraft,
    tailNumbers: useMemo(() => aircraft.map(a => a.tailNumber), [aircraft]),
    hasAircraft: aircraft.length > 0,
    isLoading,
    isDemo: dataMode === 'demo',
    
    // Lookup functions
    getByTail: (tail: string) => aircraft.find(a => a.tailNumber === tail),
    getAvailable: () => aircraft.filter(a => a.status === 'available'),
  };
};

// src/hooks/useRuleAuthority.ts
export const useRuleAuthority = () => {
  const { activeRules } = useCanonicalData();
  
  return {
    // Check if a classification is allowed by any active rule
    canClassify: (classification: FindingClassification): boolean => {
      if (classification === 'observation') return true; // Always allowed
      return activeRules.some(r => 
        r.allowedClassifications?.includes(classification)
      );
    },
    
    // Check if grounding is authorized
    canGround: (): boolean => {
      return activeRules.some(r => r.groundingAuthorized);
    },
    
    // Get the rule that authorizes a specific action
    getAuthorityFor: (action: string): Rule | null => {
      return activeRules.find(r => r.authorizedActions?.includes(action)) || null;
    },
    
    // Validation: can we show this status label?
    isStatusAuthorized: (status: string): boolean => {
      const ALWAYS_ALLOWED = ['unknown', 'observation', 'pending', 'new'];
      if (ALWAYS_ALLOWED.includes(status)) return true;
      return activeRules.some(r => r.allowedStatuses?.includes(status));
    },
  };
};
```

---

## PART 4: RULE AUTHORITY ENFORCEMENT

### 4.1 Unauthorized Status Labels

The following status labels MUST NOT appear without active rule authorization:

| Label (Hebrew) | Label (English) | Requires Rule | Alternative |
|----------------|-----------------|---------------|-------------|
| חריג | Anomaly | YES | "תצפית" (Observation) |
| מקורקע | Grounded | YES | "סטטוס לא ידוע" (Status Unknown) |
| לא כשיר | Not Airworthy | YES | "בבדיקה" (Under Review) |
| קריטי | Critical | YES | "עדיפות גבוהה" (High Priority) |
| דחוף | Urgent | YES | "ממתין לבדיקה" (Awaiting Review) |
| חסימה | Blocking | YES | "פתוח" (Open) |

### 4.2 Rule Authority Guard Component

```typescript
// src/components/guards/RuleAuthorityGuard.tsx

interface RuleAuthorityGuardProps {
  requiredClassification: FindingClassification;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RuleAuthorityGuard: React.FC<RuleAuthorityGuardProps> = ({
  requiredClassification,
  children,
  fallback = null,
}) => {
  const { canClassify } = useRuleAuthority();
  
  if (!canClassify(requiredClassification)) {
    return fallback;
  }
  
  return <>{children}</>;
};

// Usage:
<RuleAuthorityGuard 
  requiredClassification="grounding"
  fallback={<Badge variant="outline">סטטוס לא ידוע</Badge>}
>
  <Badge variant="destructive">מקורקע</Badge>
</RuleAuthorityGuard>
```

### 4.3 Status Sanitization Utility

```typescript
// src/lib/status-sanitization.ts

const REQUIRES_AUTHORITY: Record<string, string> = {
  'grounded': 'unknown',
  'critical': 'high_priority',
  'anomaly': 'observation',
  'blocking': 'open',
  'not_airworthy': 'under_review',
  // Hebrew equivalents
  'מקורקע': 'לא ידוע',
  'קריטי': 'עדיפות גבוהה',
  'חריג': 'תצפית',
  'חסימה': 'פתוח',
  'לא כשיר': 'בבדיקה',
};

export const sanitizeStatus = (
  status: string, 
  activeRules: Rule[]
): string => {
  // Check if status requires authority
  const fallback = REQUIRES_AUTHORITY[status.toLowerCase()];
  if (!fallback) return status; // Status doesn't require authority
  
  // Check if any active rule authorizes this status
  const isAuthorized = activeRules.some(r => 
    r.allowedStatuses?.includes(status.toLowerCase())
  );
  
  return isAuthorized ? status : fallback;
};
```

---

## PART 5: COMPONENT REFACTOR PLAN

### 5.1 Index.tsx (Main Dashboard)

**Current Issues:**
1. Lines 99-145: Hardcoded `sampleInsights[]`
2. Lines 297-300: Static aircraft selector
3. Lines 393-406: Fabricated daily summary

**Refactored Approach:**

```typescript
// BEFORE
const sampleInsights = [
  { id: "INS-001", aircraft: "892", title: "חריגת מהירות נחיתה", ... },
];

// AFTER
const DashboardContent = () => {
  const { insights, isEmpty, isLoading } = useDashboardInsights();
  const { tailNumbers, hasAircraft } = useAircraft();
  const { todayStats } = useDailyStats();
  
  // Display actual insights or empty state
  const displayInsights = insights.length > 0 ? insights : [];
  
  return (
    <>
      {/* Aircraft Selector - From Canonical Data Only */}
      <select>
        {hasAircraft ? (
          tailNumbers.map(tail => <option key={tail}>{tail}</option>)
        ) : (
          <option disabled>אין מטוסים - העלה נתונים</option>
        )}
      </select>
      
      {/* Insights Section */}
      {isEmpty ? (
        <NoInsightsEmptyState />
      ) : (
        displayInsights.map(insight => <InsightCard key={insight.id} {...insight} />)
      )}
      
      {/* Daily Summary - From Actual Data */}
      <DailySummary stats={todayStats} />
    </>
  );
};
```

### 5.2 FailureHistory.tsx

**Current Issues:**
- Lines 9-16: Hardcoded `flightHoursData[]`
- Lines 18-24: Hardcoded `materialFatigueData[]`
- Lines 26-51: Hardcoded `recentFailures[]`
- Lines 53-55: Hardcoded summary stats

**Refactored Approach:**

```typescript
// NEW FILE: src/hooks/useFailureHistory.ts
export const useFailureHistory = (months: number = 6) => {
  const { flights, findings, workOrders } = useCanonicalData();
  
  const flightHoursData = useMemo(() => {
    if (flights.length === 0) return [];
    
    // Group by month and compute actual statistics
    const byMonth = groupByMonth(flights, months);
    return byMonth.map(month => ({
      month: month.label,
      flightHours: month.totalHours,
      failures: findings.filter(f => 
        f.createdAt.startsWith(month.key) && f.severity === 'S1'
      ).length,
      reliability: computeReliability(month.totalHours, month.failures),
    }));
  }, [flights, findings, months]);
  
  const isEmpty = flightHoursData.length === 0;
  
  return { flightHoursData, isEmpty };
};

// COMPONENT REFACTOR:
export const FailureHistory = () => {
  const { flightHoursData, isEmpty } = useFailureHistory();
  
  if (isEmpty) {
    return (
      <Card>
        <CardContent className="py-12">
          <NoHistoryEmptyState 
            title="אין היסטוריה זמינה"
            description="נדרשים נתוני טיסות להצגת היסטוריה"
          />
        </CardContent>
      </Card>
    );
  }
  
  return (
    // ... render actual data
  );
};
```

### 5.3 TechnicianMaintenanceView.tsx

**Current Issues:**
- Lines 45-72: Hardcoded `pendingInsights[]`
- Lines 74-89: Hardcoded `waitingForParts[]`
- Lines 347-360: Hardcoded weekly summary

**Refactored Approach:**

```typescript
// NEW HOOK: src/hooks/useMyTasks.ts
export const useMyTasks = (userId: string) => {
  const { tasks, findings, workOrders } = useCanonicalData();
  
  const myPendingTasks = useMemo(() => 
    tasks.filter(t => 
      t.assignedTo === userId && 
      t.status !== 'completed'
    ),
    [tasks, userId]
  );
  
  const waitingForOthers = useMemo(() =>
    tasks.filter(t =>
      t.createdBy === userId &&
      t.assignedTo !== userId &&
      t.status === 'pending'
    ),
    [tasks, userId]
  );
  
  return {
    myPendingTasks,
    waitingForOthers,
    isEmpty: myPendingTasks.length === 0 && waitingForOthers.length === 0,
  };
};

// COMPONENT REFACTOR:
export const TechnicianMaintenanceView = () => {
  const { user } = useAuth();
  const { myPendingTasks, waitingForOthers, isEmpty } = useMyTasks(user?.id || '');
  
  if (isEmpty) {
    return <NoTasksEmptyState />;
  }
  
  return (
    // ... render actual tasks
  );
};
```

### 5.4 RuleManagementTab.tsx

**Current Issues:**
- Lines 322-332: Random performance statistics

**Refactored Approach:**

```typescript
// REMOVE THESE LINES:
<div className="text-2xl font-bold text-yellow-600">
  {Math.floor(Math.random() * 50)}  // ❌ RANDOM
</div>
<div className="text-2xl font-bold text-blue-600">
  {Math.floor(Math.random() * 20) + 80}%  // ❌ RANDOM
</div>

// REPLACE WITH:
const { ruleMetrics, hasMetrics } = useRuleMetrics();

{hasMetrics ? (
  <>
    <div className="text-2xl font-bold text-yellow-600">
      {ruleMetrics.triggersThisWeek}
    </div>
    <div className="text-2xl font-bold text-blue-600">
      {ruleMetrics.averageAccuracy}%
    </div>
  </>
) : (
  <NoMetricsAvailable />
)}
```

---

## PART 6: EMPTY STATE COMPONENTS

### 6.1 Standardized Empty States

```typescript
// src/components/ui/empty-states.tsx

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'subtle' | 'warning' | 'info';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Database,
  title,
  description,
  action,
  variant = 'default',
}) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 text-center",
      variants[variant]
    )}>
      <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="font-semibold text-lg">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-2 max-w-md">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
};

// Pre-built variants
export const NoDataEmptyState = () => (
  <EmptyState
    icon={Database}
    title="אין נתונים"
    description="העלה קובץ CSV או חבר למקור נתונים"
  />
);

export const NoFindingsEmptyState = () => (
  <EmptyState
    icon={CheckCircle}
    title="אין ממצאים"
    description="לא זוהו חריגות בנתונים הנוכחיים"
    variant="info"
  />
);

export const NoAircraftEmptyState = () => (
  <EmptyState
    icon={Plane}
    title="אין מטוסים במערכת"
    description="נדרשת העלאת נתונים עם פרטי מטוסים"
  />
);

export const InsufficientDataEmptyState = () => (
  <EmptyState
    icon={AlertCircle}
    title="נתונים לא מספיקים"
    description="נדרשים נתונים נוספים לניתוח זה"
    variant="warning"
  />
);

export const NoRuleAuthorityEmptyState = ({ feature }: { feature: string }) => (
  <EmptyState
    icon={Shield}
    title="לא מורשה"
    description={`אין כלל פעיל שמאשר ${feature}`}
    variant="warning"
  />
);
```

---

## PART 7: ACTION BUTTON AUDIT

### 7.1 Dangerous Actions Requiring Safeguards

| Action | Component | Risk | Required Safeguards |
|--------|-----------|------|---------------------|
| Ground Aircraft | CommanderRecommendations | HIGH | Rule authority + Commander role + Audit |
| Close Finding | FindingCard | MEDIUM | Role permission + Reason required + Audit |
| Delete Rule | RuleManagementTab | HIGH | Approval workflow + Audit |
| Complete Task | TechnicianMaintenanceView | MEDIUM | Outcome required + Audit |
| Emergency Mode | FlightDossierContext | CRITICAL | Commander only + Reason + Dual audit |

### 7.2 Action Guard Implementation

```typescript
// src/components/guards/ActionGuard.tsx

interface ActionGuardProps {
  action: string;
  children: React.ReactNode;
  onBlocked?: (reason: string) => void;
  fallback?: React.ReactNode;
}

export const ActionGuard: React.FC<ActionGuardProps> = ({
  action,
  children,
  onBlocked,
  fallback = null,
}) => {
  const { user } = useAuth();
  const { canClassify, getAuthorityFor } = useRuleAuthority();
  const { canPerformAction } = useFlightDossier();
  
  // Check role permission
  if (!canPerformAction(action, user?.role as any)) {
    return fallback;
  }
  
  // Check rule authority for classification actions
  if (action.startsWith('classify:') || action.startsWith('ground:')) {
    const authority = getAuthorityFor(action);
    if (!authority) {
      onBlocked?.('No active rule authorizes this action');
      return fallback;
    }
  }
  
  return <>{children}</>;
};

// Usage:
<ActionGuard 
  action="ground:aircraft"
  fallback={<Button disabled>פעולה לא מורשית</Button>}
>
  <Button onClick={handleGround}>קרקע מטוס</Button>
</ActionGuard>
```

---

## PART 8: VERIFICATION CHECKLIST

### 8.1 Pre-Production Verification

```markdown
## Mock Data Elimination Checklist

### FlightDossierContext
- [ ] `loadRealisticDemoData` protected by DEMO_MODE_ALLOWED
- [ ] No auto-loading of demo data on mount
- [ ] Demo badge visible when dataMode === 'demo'

### CSVDataContext
- [ ] `loadDemoData` protected by DEMO_MODE_ALLOWED
- [ ] `dataMode` defaults to 'live'
- [ ] No localStorage fallback to demo data

### Index.tsx
- [ ] No `sampleInsights` array
- [ ] Aircraft selector uses `useAircraft().tailNumbers`
- [ ] Daily summary uses `useDailyStats()`
- [ ] All static numbers replaced with computed values

### FailureHistory.tsx
- [ ] No hardcoded `flightHoursData`
- [ ] No hardcoded `materialFatigueData`
- [ ] No hardcoded `recentFailures`
- [ ] Shows empty state when no data

### TechnicianMaintenanceView.tsx
- [ ] No hardcoded `pendingInsights`
- [ ] No hardcoded `waitingForParts`
- [ ] Weekly summary from actual data
- [ ] Shows empty state when no tasks

### RuleManagementTab.tsx
- [ ] No `Math.random()` for statistics
- [ ] Performance metrics from actual rule execution
- [ ] Shows "no metrics" when insufficient data

### All Components
- [ ] Status labels pass through `sanitizeStatus()`
- [ ] Classifications guarded by `RuleAuthorityGuard`
- [ ] Actions guarded by `ActionGuard`
- [ ] Empty states use standardized components
```

### 8.2 Runtime Verification

```typescript
// src/lib/production-verification.ts

export const verifyProductionReadiness = (): VerificationResult => {
  const issues: string[] = [];
  
  // Check 1: Demo mode should be disabled
  if (DEMO_MODE_ALLOWED && process.env.NODE_ENV === 'production') {
    issues.push('CRITICAL: Demo mode is enabled in production build');
  }
  
  // Check 2: No mock data functions should be callable
  const mockFunctions = ['loadDemoData', 'generateSampleFlightData'];
  mockFunctions.forEach(fn => {
    if (typeof window !== 'undefined' && (window as any)[fn]) {
      issues.push(`WARNING: Mock function ${fn} is exposed on window`);
    }
  });
  
  // Check 3: Canonical data provider should be present
  // (This would be called from within React context)
  
  return {
    isReady: issues.length === 0,
    issues,
    timestamp: new Date().toISOString(),
  };
};
```

---

## PART 9: IMPLEMENTATION PRIORITY

### Phase 1: Critical Path (Day 1)
1. Create `src/types/data-mode.ts` with `DEMO_MODE_ALLOWED`
2. Guard all demo loading functions
3. Remove `sampleInsights` from Index.tsx
4. Create `useRuleAuthority` hook

### Phase 2: Data Architecture (Day 2)
1. Create `CanonicalDataContext.tsx`
2. Migrate CSVDataContext to feed canonical model
3. Create derived hooks (`useAircraft`, `useFlights`, etc.)

### Phase 3: Component Refactoring (Day 3-4)
1. Refactor FailureHistory.tsx
2. Refactor TechnicianMaintenanceView.tsx
3. Refactor RuleManagementTab.tsx
4. Update all aircraft selectors

### Phase 4: Guards & Validation (Day 5)
1. Implement `RuleAuthorityGuard`
2. Implement `ActionGuard`
3. Add `sanitizeStatus` to all status displays
4. Complete verification checklist

---

## APPENDIX A: File Changes Summary

| File | Action | Status |
|------|--------|--------|
| src/types/data-mode.ts | CREATE | New |
| src/types/canonical.ts | CREATE | New |
| src/contexts/CanonicalDataContext.tsx | CREATE | New |
| src/hooks/useAircraft.ts | MODIFY | Expand from existing |
| src/hooks/useFlights.ts | MODIFY | Expand from existing |
| src/hooks/useRuleAuthority.ts | CREATE | New |
| src/hooks/useFailureHistory.ts | CREATE | New |
| src/hooks/useMyTasks.ts | CREATE | New |
| src/hooks/useDailyStats.ts | CREATE | New |
| src/components/guards/RuleAuthorityGuard.tsx | CREATE | New |
| src/components/guards/ActionGuard.tsx | CREATE | New |
| src/lib/status-sanitization.ts | CREATE | New |
| src/pages/Index.tsx | MODIFY | Remove all mocks |
| src/components/dashboard/FailureHistory.tsx | REWRITE | Use hooks |
| src/components/dashboard/TechnicianMaintenanceView.tsx | REWRITE | Use hooks |
| src/components/dashboard/RuleManagementTab.tsx | MODIFY | Remove random |
| src/contexts/FlightDossierContext.tsx | MODIFY | Guard demo |
| src/contexts/CSVDataContext.tsx | MODIFY | Guard demo |
| src/lib/sample-data.ts | CONDITIONAL | Dev-only |

---

**Document End**
*This specification is binding for production deployment.*
