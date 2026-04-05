/**
 * useAvailableAircraft Hook
 * 
 * PRODUCTION RULE: Aircraft list must be derived ONLY from CSV data.
 * No hardcoded tail numbers should exist anywhere in the UI.
 * 
 * This hook provides:
 * - List of aircraft from uploaded CSV
 * - Statistics per aircraft
 * - Helper functions for aircraft lookups
 */

import { useMemo } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';

export interface AircraftInfo {
  /** Tail number identifier */
  tailNumber: string;
  /** Number of flights for this aircraft */
  flightCount: number;
  /** Most recent flight end time */
  lastFlight: string;
  /** Total data records for this aircraft */
  totalRecords: number;
  /** First flight date */
  firstFlight: string;
  /** Unique phases recorded */
  recordedPhases: string[];
}

export interface UseAvailableAircraftResult {
  /** Full aircraft info list */
  aircraftList: AircraftInfo[];
  /** Just tail numbers (for select dropdowns) */
  tailNumbers: string[];
  /** Whether any aircraft data exists */
  hasAircraft: boolean;
  /** Total aircraft count */
  aircraftCount: number;
  /** Get info for specific aircraft */
  getAircraftInfo: (tailNumber: string) => AircraftInfo | undefined;
  /** Check if aircraft exists in data */
  isValidAircraft: (tailNumber: string) => boolean;
  /** Default aircraft (first in sorted list) */
  defaultAircraft: string | null;
}

export const useAvailableAircraft = (): UseAvailableAircraftResult => {
  const { processedFlights, rawData } = useCSVData();
  
  const aircraftList = useMemo((): AircraftInfo[] => {
    if (processedFlights.length === 0) return [];
    
    const aircraftMap = new Map<string, AircraftInfo>();
    
    processedFlights.forEach(pf => {
      const tail = pf.tail_number;
      if (!tail) return; // Skip invalid entries
      
      if (!aircraftMap.has(tail)) {
        aircraftMap.set(tail, {
          tailNumber: tail,
          flightCount: 0,
          lastFlight: pf.endTime,
          firstFlight: pf.startTime,
          totalRecords: 0,
          recordedPhases: [],
        });
      }
      
      const info = aircraftMap.get(tail)!;
      info.flightCount++;
      info.totalRecords += pf.records.length;
      
      // Update date range
      if (pf.endTime > info.lastFlight) {
        info.lastFlight = pf.endTime;
      }
      if (pf.startTime < info.firstFlight) {
        info.firstFlight = pf.startTime;
      }
      
      // Collect unique phases
      pf.phases.forEach(phase => {
        if (!info.recordedPhases.includes(phase)) {
          info.recordedPhases.push(phase);
        }
      });
    });
    
    // Sort by tail number for consistent ordering
    return Array.from(aircraftMap.values()).sort((a, b) => 
      a.tailNumber.localeCompare(b.tailNumber, 'he')
    );
  }, [processedFlights]);
  
  const tailNumbers = useMemo(() => 
    aircraftList.map(a => a.tailNumber),
    [aircraftList]
  );
  
  const getAircraftInfo = useMemo(() => 
    (tailNumber: string) => aircraftList.find(a => a.tailNumber === tailNumber),
    [aircraftList]
  );
  
  const isValidAircraft = useMemo(() =>
    (tailNumber: string) => tailNumbers.includes(tailNumber),
    [tailNumbers]
  );
  
  return {
    aircraftList,
    tailNumbers,
    hasAircraft: aircraftList.length > 0,
    aircraftCount: aircraftList.length,
    getAircraftInfo,
    isValidAircraft,
    defaultAircraft: tailNumbers[0] || null,
  };
};

/**
 * Hook for aircraft selector components
 * Returns props ready to use in a select element
 */
export const useAircraftSelectorOptions = () => {
  const { tailNumbers, hasAircraft, defaultAircraft } = useAvailableAircraft();
  
  const options = useMemo(() => {
    if (!hasAircraft) {
      return [{ value: '', label: 'אין מטוסים - העלה CSV', disabled: true }];
    }
    
    return tailNumbers.map(tail => ({
      value: tail,
      label: tail,
      disabled: false,
    }));
  }, [tailNumbers, hasAircraft]);
  
  return {
    options,
    hasAircraft,
    defaultValue: defaultAircraft || '',
    placeholder: hasAircraft ? 'בחר מטוס' : 'אין מטוסים זמינים',
  };
};

export default useAvailableAircraft;
