/**
 * useAvailableFlights Hook
 * 
 * PRODUCTION RULE: Flight list must be derived ONLY from CSV data.
 * No hardcoded flight IDs should exist anywhere in the UI.
 * 
 * This hook provides:
 * - List of flights from uploaded CSV
 * - Filtering by aircraft
 * - Flight status and finding correlation
 */

import { useMemo } from 'react';
import { useCSVData, ProcessedFlight } from '@/contexts/CSVDataContext';
import { useFlightDossier } from '@/contexts/FlightDossierContext';
import { SeverityLevel } from '@/types/core';

export interface FlightInfo {
  /** Unique flight identifier */
  flightId: string;
  /** Aircraft tail number */
  tailNumber: string;
  /** Flight start time (ISO string) */
  startTime: string;
  /** Flight end time (ISO string) */
  endTime: string;
  /** Duration in minutes */
  durationMinutes: number;
  /** Recorded flight phases */
  phases: string[];
  /** Number of data records */
  recordCount: number;
  /** Whether this flight has any findings */
  hasFindings: boolean;
  /** Total finding count */
  findingCount: number;
  /** Critical (S1) finding count */
  criticalFindingCount: number;
  /** Highest severity level of findings */
  highestSeverity: SeverityLevel | null;
  /** Available parameters in this flight */
  parameters: string[];
}

export interface UseAvailableFlightsOptions {
  /** Filter by specific aircraft */
  tailNumber?: string;
  /** Only include flights with findings */
  withFindingsOnly?: boolean;
  /** Filter by date range */
  dateRange?: { from: string; to: string };
  /** Maximum number of flights to return */
  limit?: number;
}

export interface UseAvailableFlightsResult {
  /** Full flight info list */
  flights: FlightInfo[];
  /** Just flight IDs */
  flightIds: string[];
  /** Whether any flights exist */
  hasFlights: boolean;
  /** Total flight count */
  flightCount: number;
  /** Get info for specific flight */
  getFlightInfo: (flightId: string) => FlightInfo | undefined;
  /** Check if flight exists in data */
  isValidFlight: (flightId: string) => boolean;
}

export const useAvailableFlights = (
  options: UseAvailableFlightsOptions = {}
): UseAvailableFlightsResult => {
  const { processedFlights } = useCSVData();
  const { findings, dossiers } = useFlightDossier();
  
  const { tailNumber, withFindingsOnly, dateRange, limit } = options;
  
  const flights = useMemo((): FlightInfo[] => {
    if (processedFlights.length === 0) return [];
    
    let filtered = processedFlights;
    
    // Filter by tail number
    if (tailNumber) {
      filtered = filtered.filter(pf => pf.tail_number === tailNumber);
    }
    
    // Filter by date range
    if (dateRange) {
      filtered = filtered.filter(pf => {
        const flightDate = pf.startTime.split('T')[0];
        return flightDate >= dateRange.from && flightDate <= dateRange.to;
      });
    }
    
    // Map to FlightInfo
    const mapped = filtered.map((pf): FlightInfo => {
      // Find related findings
      const flightFindings = findings.filter(f => {
        // Match by dossier ID containing flight ID
        const matchesDossier = f.dossierIds.some(id => 
          id.includes(pf.flight_id) || id.includes(pf.tail_number)
        );
        // Match by tail number
        const matchesTail = f.tailNumbers.includes(pf.tail_number);
        
        return matchesDossier || matchesTail;
      });
      
      // Calculate duration
      const start = new Date(pf.startTime).getTime();
      const end = new Date(pf.endTime).getTime();
      const durationMinutes = Math.round((end - start) / (1000 * 60));
      
      // Determine highest severity
      const severityOrder: SeverityLevel[] = ['S1', 'S2', 'S3', 'S4'];
      const highestSeverity = severityOrder.find(s => 
        flightFindings.some(f => f.severity === s)
      ) || null;
      
      return {
        flightId: pf.flight_id,
        tailNumber: pf.tail_number,
        startTime: pf.startTime,
        endTime: pf.endTime,
        durationMinutes,
        phases: pf.phases,
        recordCount: pf.records.length,
        hasFindings: flightFindings.length > 0,
        findingCount: flightFindings.length,
        criticalFindingCount: flightFindings.filter(f => f.severity === 'S1').length,
        highestSeverity,
        parameters: pf.parameters,
      };
    });
    
    // Filter to only flights with findings if requested
    let result = withFindingsOnly 
      ? mapped.filter(f => f.hasFindings)
      : mapped;
    
    // Sort by start time (most recent first)
    result = result.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    
    // Apply limit
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }
    
    return result;
  }, [processedFlights, findings, tailNumber, withFindingsOnly, dateRange, limit]);
  
  const flightIds = useMemo(() => 
    flights.map(f => f.flightId),
    [flights]
  );
  
  const getFlightInfo = useMemo(() => 
    (flightId: string) => flights.find(f => f.flightId === flightId),
    [flights]
  );
  
  const isValidFlight = useMemo(() =>
    (flightId: string) => flightIds.includes(flightId),
    [flightIds]
  );
  
  return {
    flights,
    flightIds,
    hasFlights: flights.length > 0,
    flightCount: flights.length,
    getFlightInfo,
    isValidFlight,
  };
};

/**
 * Get recent flights (last 24 hours)
 */
export const useRecentFlights = (hours: number = 24) => {
  const cutoffTime = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
  }, [hours]);
  
  const { flights, ...rest } = useAvailableFlights();
  
  const recentFlights = useMemo(() => 
    flights.filter(f => f.endTime >= cutoffTime),
    [flights, cutoffTime]
  );
  
  return {
    flights: recentFlights,
    ...rest,
    hasFlights: recentFlights.length > 0,
    flightCount: recentFlights.length,
  };
};

/**
 * Get flights for today
 */
export const useTodayFlights = () => {
  const today = useMemo(() => 
    new Date().toISOString().split('T')[0],
    []
  );
  
  return useAvailableFlights({
    dateRange: { from: today, to: today },
  });
};

export default useAvailableFlights;
