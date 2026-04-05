# Production Refactor Plan - Magen David V7.2
## Eliminating Demo/Mock Data for Production-Ready CSV-Driven System

**Document Version:** 1.0  
**Date:** January 2026  
**Target:** Production deployment-ready system

---

## Executive Summary

This document provides a comprehensive refactoring plan to transform the Magen David maintenance intelligence system from a demo-capable prototype to a production-ready application where **CSV upload is the ONLY source of truth**.

### Current State Analysis

After thorough code review, the following critical issues were identified:

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Auto-loading demo data on mount | P0 | `FlightDossierContext.tsx:208-213` | Findings/tasks appear without real data |
| Hardcoded aircraft tail numbers | P0 | Multiple dashboard components | UI shows non-existent aircraft |
| Static flight files | P0 | `FlightFiles.tsx:39-79` | Flight dossiers disconnected from CSV |
| Fallback demo recommendations | P0 | `TechnicalRecommendations.tsx:17-40` | Fake recommendations in production |
| Mock failure history | P1 | `FailureHistory.tsx:9-51` | Charts show fabricated statistics |
| Static active flights | P1 | `ActiveFlights.tsx:9-37` | Displays hardcoded flight data |
| Demo insights in Index.tsx | P1 | `Index.tsx:99-145` | Hardcoded sample insights |
| Static daily summary stats | P2 | `Index.tsx:393-406` | Inconsistent with actual data |

---

## Architecture Decision: Global Data Mode

### Introduction of `dataMode: 'demo' | 'live'`

A global data mode flag will be introduced to strictly control data flow:

```typescript
// In CSVDataContext.tsx
interface DataModeState {
  mode: 'demo' | 'live';
  hasRealData: boolean;
  lastUploadTimestamp: string | null;
  dataSource: 'csv' | 'none';
}
```

**Rules:**
1. `mode === 'live'` is the DEFAULT in production
2. Demo data may ONLY be loaded when explicitly enabled via UI control
3. In live mode with no CSV: show empty states, NEVER auto-load demo
4. All components must respect this mode

---

## P0 Critical Fixes

### P0-A: Flight Dossier Context - Remove Auto Demo Seeding

**File:** `src/contexts/FlightDossierContext.tsx`

**Problem (Lines 208-213):**
```typescript
React.useEffect(() => {
  if (!isInitialized) {
    loadRealisticDemoData();  // ❌ AUTO-LOADS DEMO DATA
    setIsInitialized(true);
  }
}, [isInitialized]);
```

**Solution:**
```typescript
// REMOVE the auto-load effect entirely
// Replace with explicit initialization that respects dataMode

React.useEffect(() => {
  if (!isInitialized) {
    // Initialize with empty state - no auto demo loading
    setIsInitialized(true);
  }
}, [isInitialized]);
```

**Additional Changes:**
1. Add `clearAllData()` method to reset state
2. Add `setDataFromCSV(flights, findings, tasks)` to populate from CSV processing
3. Keep `loadDemoData()` but make it explicit, gated by dataMode check

**Empty State Handling:**
```typescript
// Components should check:
const { findings, dataMode } = useFlightDossier();
if (findings.length === 0 && dataMode === 'live') {
  return <EmptyState message="אין ממצאים פעילים - העלה קובץ CSV להתחלת ניתוח" />;
}
```

---

### P0-B: Technical Recommendations - Remove Fallback Demo

**File:** `src/components/dashboard/TechnicalRecommendations.tsx`

**Problem (Lines 17-40):**
```typescript
if (openFindings.length === 0) {
  return [  // ❌ HARDCODED FAKE DATA
    {
      id: 1,
      flightId: "F16-001",
      severity: "critical",
      title: "נדרשת השבתה מיידית",
      // ... more fake data
    }
  ];
}
```

**Solution:**
```typescript
const recommendations = useMemo(() => {
  const openFindings = getOpenFindings();
  
  // NO FALLBACK - return empty if no real data
  if (openFindings.length === 0) {
    return [];
  }
  
  return openFindings.slice(0, 5).map((finding, idx) => ({
    // ... mapping logic stays the same
  }));
}, [findings, getOpenFindings]);

// In the render:
{recommendations.length === 0 ? (
  <EmptyStateCard 
    icon={ShieldCheck}
    title="אין המלצות טכניות פעילות"
    description="לא זוהו ממצאים הדורשים פעולה. העלה נתוני טיסה לניתוח."
  />
) : (
  recommendations.map((rec) => (/* existing render */))
)}
```

---

### P0-C: Flight Files - Derive from CSV/Dossiers

**File:** `src/components/dashboard/FlightFiles.tsx`

**Problem (Lines 39-79):**
```typescript
const flights: FlightFile[] = [
  {
    flightCode: "OP-2401",
    aircraft: "892",  // ❌ HARDCODED
    // ...
  },
  // More hardcoded flights
];
```

**Solution:**
```typescript
export const FlightFiles = () => {
  const { processedFlights, rawData } = useCSVData();
  const { dossiers, getFindingsForDossier } = useFlightDossier();
  
  // Derive flights from REAL data sources
  const flights = useMemo((): FlightFile[] => {
    if (processedFlights.length === 0) return [];
    
    return processedFlights.map(pf => {
      // Find matching dossier
      const dossier = dossiers.find(d => d.flightId === pf.flight_id);
      const findings = dossier ? getFindingsForDossier(dossier.id) : [];
      
      // Compute file completeness
      const requiredParams = ['altitude', 'airspeed', 'engine_temp', 'hydraulic_pressure'];
      const presentParams = requiredParams.filter(p => pf.parameters.includes(p));
      const completeness = (presentParams.length / requiredParams.length) * 100;
      
      return {
        flightCode: pf.flight_id,
        aircraft: pf.tail_number,
        missionCode: dossier?.missionTypeHe || 'לא ידוע',
        date: pf.startTime.split('T')[0],
        flightHours: calculateFlightHours(pf.startTime, pf.endTime),
        type: dossier?.missionType || 'unknown',
        status: 'completed',
        maintenanceStatus: computeMaintenanceStatus(findings),
        alerts: findings.filter(f => f.status !== 'resolved').length,
        severity: computeHighestSeverity(findings),
        specialFeatures: [], // Derive from flight data if needed
        fileCompleteness: completeness, // NEW: track data quality
      };
    });
  }, [processedFlights, dossiers, getFindingsForDossier]);
  
  // Empty state when no flights
  if (flights.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState 
            icon={Folder}
            title="אין תיקי טיסה"
            description="העלה קובץ CSV עם נתוני טיסה לצפייה בתיקים"
          />
        </CardContent>
      </Card>
    );
  }
  
  return (/* existing render with real flights */);
};
```

---

### P0-D: Active Flights - CSV-Derived Only

**File:** `src/components/dashboard/ActiveFlights.tsx`

**Problem (Lines 9-37):** Hardcoded `activeFlights` array

**Solution:**
```typescript
export const ActiveFlights = () => {
  const { processedFlights, rawData } = useCSVData();
  
  // Derive active flights from CSV - flights from last 24h not yet closed
  const activeFlights = useMemo(() => {
    if (processedFlights.length === 0) return [];
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return processedFlights
      .filter(pf => {
        const endTime = new Date(pf.endTime);
        return endTime > twentyFourHoursAgo;
      })
      .map(pf => ({
        id: pf.flight_id,
        flightCode: pf.flight_id,
        tailNumber: pf.tail_number,
        flightType: determineFlightType(pf),
        takeoffTime: new Date(pf.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        estimatedLanding: new Date(pf.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        status: determineFlightStatus(pf),
      }));
  }, [processedFlights]);
  
  if (activeFlights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            טיסות פעילות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState 
            icon={Plane}
            title="אין טיסות פעילות"
            description="לא נמצאו טיסות מ-24 השעות האחרונות בנתונים"
          />
        </CardContent>
      </Card>
    );
  }
  
  return (/* existing render */);
};
```

---

### P0-E: Aircraft Selectors - Dynamic from CSV

**Affected Components:**
- `Index.tsx` (Lines 297-300) - Black box view selector
- Any component with aircraft dropdown

**Solution - Shared Hook:**
```typescript
// src/hooks/useAvailableAircraft.ts
export const useAvailableAircraft = () => {
  const { processedFlights } = useCSVData();
  
  const aircraft = useMemo(() => {
    if (processedFlights.length === 0) return [];
    
    // Extract unique tail numbers from CSV data
    const tailNumbers = new Set<string>();
    processedFlights.forEach(pf => {
      if (pf.tail_number) {
        tailNumbers.add(pf.tail_number);
      }
    });
    
    return Array.from(tailNumbers).sort();
  }, [processedFlights]);
  
  return {
    aircraft,
    hasAircraft: aircraft.length > 0,
    defaultAircraft: aircraft[0] || null,
  };
};
```

**Usage in components:**
```typescript
// In Index.tsx black box selector:
const { aircraft, hasAircraft } = useAvailableAircraft();

<select className="w-full p-2 border rounded-lg bg-background text-right">
  {!hasAircraft && <option value="">אין מטוסים - העלה CSV</option>}
  {aircraft.map(tail => (
    <option key={tail} value={tail}>{tail}</option>
  ))}
</select>
```

---

## P1 Important Fixes

### P1-A: Failure History - Computed from Real Data

**File:** `src/components/dashboard/FailureHistory.tsx`

**Problem:** All chart data is hardcoded mock data

**Solution:**
```typescript
export const FailureHistory = () => {
  const { processedFlights } = useCSVData();
  const { findings, auditLog } = useFlightDossier();
  
  // Compute flight hours from real data
  const flightHoursData = useMemo(() => {
    if (processedFlights.length === 0) return [];
    
    // Group by month
    const monthlyData = new Map<string, { hours: number; failures: number }>();
    
    processedFlights.forEach(pf => {
      const month = new Date(pf.startTime).toLocaleDateString('he-IL', { month: 'short' });
      const hours = calculateFlightHours(pf.startTime, pf.endTime);
      
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { hours: 0, failures: 0 });
      }
      monthlyData.get(month)!.hours += hours;
    });
    
    // Count failures per month from findings
    findings.forEach(f => {
      const month = new Date(f.createdAt).toLocaleDateString('he-IL', { month: 'short' });
      if (monthlyData.has(month)) {
        monthlyData.get(month)!.failures++;
      }
    });
    
    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      flightHours: Math.round(data.hours),
      failures: data.failures,
      reliability: data.hours > 0 ? 
        Math.round((1 - data.failures / (data.hours * 10)) * 1000) / 10 : 100,
    }));
  }, [processedFlights, findings]);
  
  // Empty state
  if (flightHoursData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>היסטוריית תקלות</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState 
            icon={History}
            title="אין נתוני היסטוריה"
            description="נדרשים נתוני טיסה וממצאים לחישוב סטטיסטיקות"
          />
        </CardContent>
      </Card>
    );
  }
  
  return (/* existing render with computed data */);
};
```

---

### P1-B: Daily Summary - Consistent with Real Data

**File:** `src/pages/Index.tsx` (Lines 393-406)

**Problem:** Hardcoded numbers like "12 flights", "3 critical failures"

**Solution:**
```typescript
// Create dedicated component
const DailySummary = () => {
  const { processedFlights } = useCSVData();
  const { findings, tasks } = useFlightDossier();
  
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    const todayFlights = processedFlights.filter(pf => 
      pf.startTime.startsWith(today)
    );
    
    const criticalFindings = findings.filter(f => 
      f.severity === 'S1' && 
      f.createdAt.startsWith(today) &&
      f.status !== 'resolved'
    );
    
    const maintenanceGaps = tasks.filter(t => 
      t.status === 'open' || t.status === 'pending_parts'
    );
    
    return {
      flightsToday: todayFlights.length,
      criticalIssues: criticalFindings.length,
      maintenanceGaps: maintenanceGaps.length,
    };
  }, [processedFlights, findings, tasks]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>סיכום תובנות סוף יום</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatRow label="טיסות שבוצעו היום" value={todayStats.flightsToday} />
        <StatRow 
          label="תקלות קריטיות זוהו" 
          value={todayStats.criticalIssues}
          variant="destructive"
        />
        <StatRow 
          label="פערי אחזקה נדרשים" 
          value={todayStats.maintenanceGaps}
          variant="warning"
        />
      </CardContent>
    </Card>
  );
};
```

---

### P1-C: Sample Insights in Index.tsx - Remove Hardcoded

**File:** `src/pages/Index.tsx` (Lines 99-145)

**Problem:** `sampleInsights` array is hardcoded

**Solution:**
```typescript
// Remove sampleInsights constant entirely
// Use real data from context:

const DashboardContent = () => {
  const { insights, dashboardStats, hasData } = useDashboardData();
  const { findings, getOpenFindings } = useFlightDossier();
  
  // Convert findings to insight format for InsightCard
  const displayInsights = useMemo(() => {
    const openFindings = getOpenFindings().slice(0, 10);
    
    return openFindings.map(f => ({
      id: f.id,
      aircraft: f.tailNumbers[0] || 'N/A',
      flightDate: f.createdAt.split('T')[0],
      title: f.titleHe,
      description: f.descriptionHe,
      technicalDescription: f.technicalDetail,
      pilotBehaviorContext: f.pilotBehaviorContext,
      severity: mapSeverityToInsightLevel(f.severity),
      requiredRank: mapSeverityToRank(f.severity),
      isRecurring: f.isRecurring,
      occurrences: f.occurrences,
      system: f.systemAffectedHe,
      status: f.status,
    }));
  }, [getOpenFindings]);
  
  return (/* render with displayInsights */);
};
```

---

### P1-D: Technician Maintenance View - Real Data

**File:** `src/components/dashboard/TechnicianMaintenanceView.tsx`

**Problem (Lines 45-89):** Hardcoded `pendingInsights` and `waitingForParts`

**Solution:**
```typescript
export const TechnicianMaintenanceView = () => {
  const { findings, tasks, getTasksForFinding } = useFlightDossier();
  const { user } = useAuth();
  
  // Get tasks assigned to current technician
  const myTasks = useMemo(() => {
    return tasks.filter(t => 
      t.assignedRole === 'technician' &&
      t.status !== 'completed' &&
      t.status !== 'cancelled'
    );
  }, [tasks]);
  
  // Get findings that need technician attention
  const pendingInsights = useMemo(() => {
    return findings
      .filter(f => 
        f.status === 'new' || f.status === 'acknowledged'
      )
      .filter(f => {
        // S3/S4 can be handled by technician
        return f.severity === 'S3' || f.severity === 'S4';
      })
      .map(f => ({
        id: f.id,
        aircraft: f.tailNumbers[0] || 'N/A',
        flightCode: f.dossierIds[0] || f.id,
        flightDate: f.createdAt.split('T')[0],
        title: f.titleHe,
        technicalDescription: f.descriptionHe,
        severity: mapSeverityToLevel(f.severity),
        requiredRank: 'technician',
        system: f.systemAffectedHe,
        status: f.status,
        isMyResponsibility: true,
      }));
  }, [findings]);
  
  // Items waiting for others (higher rank)
  const waitingForOthers = useMemo(() => {
    return findings
      .filter(f => f.severity === 'S1' || f.severity === 'S2')
      .filter(f => f.status !== 'resolved')
      .map(f => ({
        id: f.id,
        aircraft: f.tailNumbers[0] || 'N/A',
        // ...
        isMyResponsibility: false,
        assignedTo: f.assignedTo || 'ר"צ אחזקה',
      }));
  }, [findings]);
  
  if (pendingInsights.length === 0 && waitingForOthers.length === 0) {
    return (
      <EmptyState 
        icon={Wrench}
        title="אין משימות ממתינות"
        description="כל המשימות הושלמו או שאין נתונים זמינים"
      />
    );
  }
  
  return (/* existing render with real data */);
};
```

---

## Shared Components & Hooks

### Empty State Component

**File:** `src/components/ui/empty-state.tsx`

```typescript
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './card';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
```

---

### Data Mode Provider Enhancement

**File:** `src/contexts/CSVDataContext.tsx` - Enhanced

```typescript
interface CSVDataContextType {
  // Existing...
  
  // NEW: Data mode management
  dataMode: 'demo' | 'live';
  setDataMode: (mode: 'demo' | 'live') => void;
  hasRealData: boolean;
  dataStats: {
    flightCount: number;
    recordCount: number;
    aircraftCount: number;
    dateRange: { from: string; to: string } | null;
  };
  
  // NEW: Clear all data
  clearAllData: () => void;
}

// In provider:
const [dataMode, setDataMode] = useState<'demo' | 'live'>('live');

const hasRealData = rawData.length > 0;

const dataStats = useMemo(() => ({
  flightCount: processedFlights.length,
  recordCount: rawData.length,
  aircraftCount: new Set(processedFlights.map(f => f.tail_number)).size,
  dateRange: processedFlights.length > 0 ? {
    from: processedFlights.reduce((min, f) => f.startTime < min ? f.startTime : min, processedFlights[0].startTime),
    to: processedFlights.reduce((max, f) => f.endTime > max ? f.endTime : max, processedFlights[0].endTime),
  } : null,
}), [processedFlights, rawData]);

const clearAllData = useCallback(() => {
  setRawData([]);
  setProcessedFlights([]);
  setAvailableParameters([]);
  setSelectionSets([]);
  setEvidence([]);
  setRules([]);
}, []);
```

---

### Available Aircraft Hook

**File:** `src/hooks/useAvailableAircraft.ts`

```typescript
import { useMemo } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';

export interface AircraftInfo {
  tailNumber: string;
  flightCount: number;
  lastFlight: string;
  totalRecords: number;
}

export const useAvailableAircraft = () => {
  const { processedFlights } = useCSVData();
  
  const aircraftList = useMemo((): AircraftInfo[] => {
    if (processedFlights.length === 0) return [];
    
    const aircraftMap = new Map<string, AircraftInfo>();
    
    processedFlights.forEach(pf => {
      const tail = pf.tail_number;
      if (!aircraftMap.has(tail)) {
        aircraftMap.set(tail, {
          tailNumber: tail,
          flightCount: 0,
          lastFlight: pf.endTime,
          totalRecords: 0,
        });
      }
      
      const info = aircraftMap.get(tail)!;
      info.flightCount++;
      info.totalRecords += pf.records.length;
      if (pf.endTime > info.lastFlight) {
        info.lastFlight = pf.endTime;
      }
    });
    
    return Array.from(aircraftMap.values()).sort((a, b) => 
      a.tailNumber.localeCompare(b.tailNumber)
    );
  }, [processedFlights]);
  
  return {
    aircraftList,
    tailNumbers: aircraftList.map(a => a.tailNumber),
    hasAircraft: aircraftList.length > 0,
    getAircraftInfo: (tail: string) => aircraftList.find(a => a.tailNumber === tail),
  };
};
```

---

### Available Flights Hook

**File:** `src/hooks/useAvailableFlights.ts`

```typescript
import { useMemo } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { useFlightDossier } from '@/contexts/FlightDossierContext';

export interface FlightInfo {
  flightId: string;
  tailNumber: string;
  startTime: string;
  endTime: string;
  phases: string[];
  hasFindings: boolean;
  findingCount: number;
  criticalFindingCount: number;
}

export const useAvailableFlights = (tailNumber?: string) => {
  const { processedFlights } = useCSVData();
  const { findings } = useFlightDossier();
  
  const flights = useMemo((): FlightInfo[] => {
    let filtered = processedFlights;
    
    if (tailNumber) {
      filtered = filtered.filter(pf => pf.tail_number === tailNumber);
    }
    
    return filtered.map(pf => {
      const flightFindings = findings.filter(f => 
        f.dossierIds.some(id => id.includes(pf.flight_id)) ||
        f.tailNumbers.includes(pf.tail_number)
      );
      
      return {
        flightId: pf.flight_id,
        tailNumber: pf.tail_number,
        startTime: pf.startTime,
        endTime: pf.endTime,
        phases: pf.phases,
        hasFindings: flightFindings.length > 0,
        findingCount: flightFindings.length,
        criticalFindingCount: flightFindings.filter(f => f.severity === 'S1').length,
      };
    });
  }, [processedFlights, findings, tailNumber]);
  
  return {
    flights,
    hasFlights: flights.length > 0,
  };
};
```

---

## Parameter Availability Hook

**File:** `src/hooks/useParameterAvailability.ts`

```typescript
import { useMemo } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';

export interface ParameterAvailability {
  parameter: string;
  hasData: boolean;
  dataPointCount: number;
  coverage: number; // percentage
  minValue: number | null;
  maxValue: number | null;
}

export const useParameterAvailability = () => {
  const { rawData, availableParameters, processedFlights } = useCSVData();
  
  const parameterStats = useMemo((): ParameterAvailability[] => {
    if (rawData.length === 0 || availableParameters.length === 0) return [];
    
    return availableParameters.map(param => {
      const values = rawData
        .map(r => r[param])
        .filter(v => v !== null && v !== undefined && v !== '');
      
      const numericValues = values
        .map(v => typeof v === 'number' ? v : parseFloat(v))
        .filter(v => !isNaN(v));
      
      return {
        parameter: param,
        hasData: values.length > 0,
        dataPointCount: values.length,
        coverage: (values.length / rawData.length) * 100,
        minValue: numericValues.length > 0 ? Math.min(...numericValues) : null,
        maxValue: numericValues.length > 0 ? Math.max(...numericValues) : null,
      };
    });
  }, [rawData, availableParameters]);
  
  return {
    parameterStats,
    getParameterInfo: (param: string) => parameterStats.find(p => p.parameter === param),
    hasDataForParameter: (param: string) => {
      const info = parameterStats.find(p => p.parameter === param);
      return info?.hasData ?? false;
    },
    parametersWithData: parameterStats.filter(p => p.hasData).map(p => p.parameter),
    parametersWithoutData: parameterStats.filter(p => !p.hasData).map(p => p.parameter),
  };
};
```

---

## Files to Modify Summary

### Critical Priority (P0) - Do First

| File | Action | Lines Affected |
|------|--------|----------------|
| `src/contexts/FlightDossierContext.tsx` | Remove auto demo load | 208-213 |
| `src/components/dashboard/TechnicalRecommendations.tsx` | Remove fallback demo | 17-40 |
| `src/components/dashboard/FlightFiles.tsx` | Derive from CSV | 39-79 |
| `src/components/dashboard/ActiveFlights.tsx` | Derive from CSV | 9-37 |
| `src/pages/Index.tsx` | Remove static selectors | 297-300 |

### High Priority (P1) - Do Second

| File | Action | Lines Affected |
|------|--------|----------------|
| `src/components/dashboard/FailureHistory.tsx` | Compute from data | 9-51 |
| `src/components/dashboard/TechnicianMaintenanceView.tsx` | Use real data | 45-89 |
| `src/pages/Index.tsx` | Remove sampleInsights | 99-145 |
| `src/pages/Index.tsx` | Daily summary from data | 393-406 |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/empty-state.tsx` | Reusable empty state component |
| `src/hooks/useAvailableAircraft.ts` | Aircraft list from CSV |
| `src/hooks/useAvailableFlights.ts` | Flight list from CSV |
| `src/hooks/useParameterAvailability.ts` | Parameter data availability |

---

## Testing Checklist

### Pre-deployment Verification

```
=== NO DATA LOADED ===
[ ] FlightDossierContext initializes empty (no auto-demo)
[ ] TechnicalRecommendations shows "אין המלצות טכניות פעילות"
[ ] FlightFiles shows "אין תיקי טיסה"
[ ] ActiveFlights shows "אין טיסות פעילות"
[ ] Aircraft selectors show "אין מטוסים - העלה CSV"
[ ] FailureHistory shows "אין נתוני היסטוריה"
[ ] Daily Summary shows zeros, not hardcoded values

=== CSV UPLOADED ===
[ ] All components update with real data
[ ] Aircraft selectors populated from CSV tail numbers
[ ] Flight files derived from processed flights
[ ] Findings shown are only from CSV processing
[ ] Charts use computed statistics
[ ] Daily summary reflects actual CSV data

=== DATA MODE ===
[ ] Default mode is 'live'
[ ] Demo button exists but requires explicit click
[ ] Demo mode clearly labeled when active
[ ] Switching modes clears stale data appropriately

=== CONSISTENCY ===
[ ] No aircraft shown that isn't in CSV
[ ] No flights shown that aren't in CSV
[ ] No findings without corresponding data
[ ] Parameters without data are disabled/explained
```

---

## Implementation Order

1. **Phase 1: Foundation (2-3 hours)**
   - Create `empty-state.tsx` component
   - Create hooks: `useAvailableAircraft`, `useAvailableFlights`, `useParameterAvailability`
   - Add `dataMode` and `dataStats` to `CSVDataContext`

2. **Phase 2: Remove Auto-Demo (1-2 hours)**
   - Remove auto-load from `FlightDossierContext`
   - Update `TechnicalRecommendations` to remove fallback
   - Add empty states to P0 components

3. **Phase 3: CSV-Driven Components (3-4 hours)**
   - Refactor `FlightFiles` to use CSV data
   - Refactor `ActiveFlights` to use CSV data
   - Update all aircraft selectors

4. **Phase 4: Statistics & History (2-3 hours)**
   - Refactor `FailureHistory` to compute from real data
   - Update daily summary in `Index.tsx`
   - Remove hardcoded `sampleInsights`

5. **Phase 5: Testing & Polish (2-3 hours)**
   - Run full test checklist
   - Fix any edge cases
   - Verify Hebrew text and RTL layout

**Total Estimated Time: 10-15 hours**

---

## Risk Mitigation

### What if CSV has missing columns?

Components should gracefully handle missing data:
```typescript
const altitude = record.altitude ?? record.alt ?? null;
if (altitude === null) {
  // Show "N/A" or disable feature
}
```

### What if no findings are generated?

This is valid production state. Show:
```typescript
<EmptyState 
  title="לא זוהו ממצאים"
  description="הנתונים נותחו ולא נמצאו חריגות. המטוסים במצב תקין."
/>
```

### What about legacy localStorage data?

Clear on version update:
```typescript
const CURRENT_DATA_VERSION = '7.2.1';
const savedVersion = localStorage.getItem('dataVersion');
if (savedVersion !== CURRENT_DATA_VERSION) {
  localStorage.clear();
  localStorage.setItem('dataVersion', CURRENT_DATA_VERSION);
}
```

---

## Conclusion

This refactoring plan ensures the Magen David system operates strictly on real CSV data in production. The key principles are:

1. **No fabrication** - Empty states over fake data
2. **Single source of truth** - CSV drives everything
3. **Explicit demo mode** - Demo only when requested
4. **Graceful degradation** - Missing data handled professionally
5. **Consistency** - All views reflect the same underlying data

Following this plan will result in a production-ready system that maintains trust with operational users.
