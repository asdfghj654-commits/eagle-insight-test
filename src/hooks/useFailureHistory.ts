/**
 * useFailureHistory Hook
 * 
 * PRODUCTION RULE: History data MUST be derived from canonical sources.
 * NO hardcoded data - return empty state if insufficient data.
 */

import { useMemo } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { useFlightDossier } from '@/contexts/FlightDossierContext';

interface MonthlyFlightData {
  month: string;
  monthKey: string;
  flightHours: number;
  failures: number;
  reliability: number;
}

interface ComponentFatigue {
  component: string;
  componentHe: string;
  usage: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

interface RecentFailure {
  id: string;
  date: string;
  component: string;
  severity: 'critical' | 'medium' | 'minor';
  flightHours: number;
  description: string;
  impact: string;
}

interface FailureHistoryData {
  // Monthly flight hours vs failures
  flightHoursData: MonthlyFlightData[];
  
  // Material fatigue by component
  materialFatigueData: ComponentFatigue[];
  
  // Recent failures list
  recentFailures: RecentFailure[];
  
  // Summary statistics
  overallReliability: number | null;
  totalFlightHours: number;
  averageFailuresPerMonth: number | null;
  
  // Data availability flags
  hasFlightData: boolean;
  hasFindingsData: boolean;
  isEmpty: boolean;
  isLoading: boolean;
  
  // Date range
  dateRange: { from: string; to: string } | null;
}

/**
 * Hebrew month names
 */
const HEBREW_MONTHS = [
  'ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ',
  'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'
];

/**
 * Get Hebrew month abbreviation from date
 */
const getHebrewMonth = (date: Date): string => {
  return HEBREW_MONTHS[date.getMonth()];
};

/**
 * Calculate reliability percentage
 * Formula: (1 - failures / flightHours) * 100
 * Clamped to 0-100 range
 */
const calculateReliability = (flightHours: number, failures: number): number => {
  if (flightHours === 0) return 0;
  const reliability = (1 - failures / (flightHours * 10)) * 100;
  return Math.max(0, Math.min(100, reliability));
};

/**
 * Hook to get failure history data from canonical sources
 */
export const useFailureHistory = (months: number = 6): FailureHistoryData => {
  const { processedFlights, isProcessing, hasRealData } = useCSVData();
  const { findings } = useFlightDossier();
  
  // Calculate date range for the query
  const dateRange = useMemo(() => {
    if (processedFlights.length === 0) return null;
    
    const dates = processedFlights.map(f => new Date(f.startTime));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    return {
      from: minDate.toISOString().split('T')[0],
      to: maxDate.toISOString().split('T')[0],
    };
  }, [processedFlights]);
  
  // Group flights by month and calculate statistics
  const flightHoursData = useMemo((): MonthlyFlightData[] => {
    if (processedFlights.length === 0) return [];
    
    // Group flights by month
    const byMonth = new Map<string, { hours: number; failures: number }>();
    
    processedFlights.forEach(flight => {
      const date = new Date(flight.startTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const existing = byMonth.get(monthKey) || { hours: 0, failures: 0 };
      
      // Calculate flight hours from duration
      const durationMinutes = flight.records.length * 0.5; // Assuming 30-second intervals
      const flightHours = durationMinutes / 60;
      
      existing.hours += flightHours;
      byMonth.set(monthKey, existing);
    });
    
    // Count failures (S1 findings) per month
    findings.forEach(finding => {
      if (finding.severity === 'S1') {
        const date = new Date(finding.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const existing = byMonth.get(monthKey);
        if (existing) {
          existing.failures += 1;
          byMonth.set(monthKey, existing);
        }
      }
    });
    
    // Convert to array and sort by date
    const sortedMonths = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-months);
    
    return sortedMonths.map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      
      return {
        month: getHebrewMonth(date),
        monthKey,
        flightHours: Math.round(data.hours),
        failures: data.failures,
        reliability: calculateReliability(data.hours, data.failures),
      };
    });
  }, [processedFlights, findings, months]);
  
  // Calculate component fatigue from findings
  const materialFatigueData = useMemo((): ComponentFatigue[] => {
    if (findings.length === 0) return [];
    
    // Group findings by system/component
    const byComponent = new Map<string, number>();
    
    findings.forEach(finding => {
      const component = finding.systemAffectedHe || finding.systemAffected || 'לא מזוהה';
      byComponent.set(component, (byComponent.get(component) || 0) + 1);
    });
    
    // Define thresholds (in production, these would come from configuration)
    const THRESHOLDS: Record<string, number> = {
      'הידראוליקה': 80,
      'הידראוליות': 80,
      'מנוע': 85,
      'אוויוניקה': 75,
      'מערכת שליטה': 70,
      'מערכת דלק': 80,
      'מערכת נחיתה': 75,
      'בלמים': 70,
      'default': 75,
    };
    
    // Calculate usage percentage (normalized to max 100)
    const maxFindings = Math.max(...Array.from(byComponent.values()), 1);
    
    return Array.from(byComponent.entries())
      .map(([component, count]) => {
        const threshold = THRESHOLDS[component] || THRESHOLDS['default'];
        const usage = Math.round((count / maxFindings) * 100);
        
        let status: 'good' | 'warning' | 'critical';
        if (usage >= threshold) {
          status = 'critical';
        } else if (usage >= threshold * 0.9) {
          status = 'warning';
        } else {
          status = 'good';
        }
        
        return {
          component,
          componentHe: component,
          usage,
          threshold,
          status,
        };
      })
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
  }, [findings]);
  
  // Get recent failures (S1 and S2 findings)
  const recentFailures = useMemo((): RecentFailure[] => {
    if (findings.length === 0) return [];
    
    // Get critical and medium severity findings
    const failures = findings
      .filter(f => f.severity === 'S1' || f.severity === 'S2')
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);
    
    return failures.map(f => ({
      id: f.id,
      date: f.createdAt.split('T')[0],
      component: f.systemAffectedHe || f.systemAffected || 'לא מזוהה',
      severity: f.severity === 'S1' ? 'critical' : f.severity === 'S2' ? 'medium' : 'minor',
      flightHours: 0, // Would need to correlate with flight data
      description: f.titleHe || f.title || 'ללא תיאור',
      impact: f.recommendationHe || 'נדרשת בדיקה',
    }));
  }, [findings]);
  
  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (flightHoursData.length === 0) {
      return {
        overallReliability: null,
        totalFlightHours: 0,
        averageFailuresPerMonth: null,
      };
    }
    
    const totalHours = flightHoursData.reduce((sum, m) => sum + m.flightHours, 0);
    const totalFailures = flightHoursData.reduce((sum, m) => sum + m.failures, 0);
    
    return {
      overallReliability: calculateReliability(totalHours, totalFailures),
      totalFlightHours: Math.round(totalHours),
      averageFailuresPerMonth: totalFailures / flightHoursData.length,
    };
  }, [flightHoursData]);
  
  const hasFlightData = processedFlights.length > 0;
  const hasFindingsData = findings.length > 0;
  const isEmpty = !hasFlightData && !hasFindingsData;
  
  return {
    flightHoursData,
    materialFatigueData,
    recentFailures,
    ...summaryStats,
    hasFlightData,
    hasFindingsData,
    isEmpty,
    isLoading: isProcessing,
    dateRange,
  };
};

export default useFailureHistory;
