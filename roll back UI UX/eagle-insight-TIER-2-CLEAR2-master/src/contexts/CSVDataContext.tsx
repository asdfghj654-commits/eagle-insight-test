import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateSampleFlightData, sampleDataHeaders } from '@/lib/sample-data';

export interface CSVRecord {
  flight_id: string;
  tail_number: string;
  timestamp: string;
  phase: 'taxi' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'landing';
  [key: string]: any; // Additional parameters like engine_temp, hydraulic_pressure, etc.
}

export interface ProcessedFlight {
  flight_id: string;
  tail_number: string;
  records: CSVRecord[];
  phases: string[];
  startTime: string;
  endTime: string;
  parameters: string[];
}

export interface SelectionSet {
  id: string;
  name: string;
  color: string;
  description?: string;
  type: 'time-range' | 'value-range' | 'lasso' | 'combined';
  data: any[];
  source: 'signals' | 'distributions' | 'correlations';
  createdAt: string;
  statistics?: {
    count: number;
    mean?: number;
    std?: number;
    min?: number;
    max?: number;
    outlierPercentage?: number;
  };
}

export interface Evidence {
  id: string;
  name: string;
  description: string;
  selectionSets: string[]; // IDs of selection sets
  createdAt: string;
  createdBy: string;
  metadata: {
    parameters: string[];
    flights: string[];
    phases: string[];
  };
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  conditions: {
    parameter: string;
    type: 'threshold' | 'range' | 'consecutive' | 'delta' | 'ratio' | 'pattern';
    value: any;
    debounce?: number;
    hysteresis?: number;
  }[];
  scope: {
    tailNumbers?: string[];
    phases?: string[];
    timeRange?: { start: string; end: string };
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskMatrix: {
    severity: number;
    probability: number;
  };
  status: 'draft' | 'pending-review' | 'approved' | 'rejected';
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  backtest?: {
    precision: number;
    recall: number;
    falsePositives: number;
    falseNegatives: number;
    examples: any[];
  };
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  reviewComments?: string;
  changesRequestedAt?: string;
  changesRequestedBy?: string;
}

// Data mode for production vs demo distinction
export type DataMode = 'demo' | 'live';

export interface DataStats {
  flightCount: number;
  recordCount: number;
  aircraftCount: number;
  parameterCount: number;
  dateRange: { from: string; to: string } | null;
  lastUploadTimestamp: string | null;
}

interface CSVDataContextType {
  // Raw data
  rawData: CSVRecord[];
  processedFlights: ProcessedFlight[];
  availableParameters: string[];
  
  // Processing state
  isProcessing: boolean;
  processingError: string | null;
  
  // Data mode (PRODUCTION: always check this before showing data)
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  hasRealData: boolean;
  dataStats: DataStats;
  
  // Selection sets and evidence
  selectionSets: SelectionSet[];
  evidence: Evidence[];
  rules: Rule[];
  
  // Actions
  uploadCSV: (file: File) => Promise<void>;
  loadDemoData: () => Promise<void>;
  createSelectionSet: (set: Omit<SelectionSet, 'id' | 'createdAt'>) => string;
  updateSelectionSet: (id: string, updates: Partial<SelectionSet>) => void;
  deleteSelectionSet: (id: string) => void;
  combineSelectionSets: (ids: string[], operation: 'union' | 'intersect' | 'difference', name: string) => string;
  
  pinToEvidence: (selectionSetIds: string[], name: string, description: string) => string;
  createRule: (rule: Omit<Rule, 'id' | 'createdAt'>) => string;
  updateRule: (id: string, updates: Partial<Rule>) => void;
  toggleRuleActive: (id: string) => void;
  deleteRule: (id: string) => void;
  
  // Data access
  getFlightData: (flightId: string) => ProcessedFlight | undefined;
  getParameterData: (parameter: string, flightId?: string) => any[];
  
  // Snapshots
  saveSnapshot: (name: string) => void;
  loadSnapshot: (name: string) => void;
  getSnapshots: () => string[];
  
  // Data management (PRODUCTION)
  clearAllData: () => void;
}

const CSVDataContext = createContext<CSVDataContextType | undefined>(undefined);

export const useCSVData = () => {
  const context = useContext(CSVDataContext);
  if (!context) {
    throw new Error('useCSVData must be used within a CSVDataProvider');
  }
  return context;
};

export const CSVDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rawData, setRawData] = useState<CSVRecord[]>([]);
  const [processedFlights, setProcessedFlights] = useState<ProcessedFlight[]>([]);
  const [availableParameters, setAvailableParameters] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // PRODUCTION: Data mode state - defaults to 'live'
  const [dataMode, setDataMode] = useState<DataMode>('live');
  const [lastUploadTimestamp, setLastUploadTimestamp] = useState<string | null>(null);
  
  const [selectionSets, setSelectionSets] = useState<SelectionSet[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  
  // PRODUCTION: Computed values for data availability
  const hasRealData = rawData.length > 0;
  
  const dataStats = React.useMemo((): DataStats => ({
    flightCount: processedFlights.length,
    recordCount: rawData.length,
    aircraftCount: new Set(processedFlights.map(f => f.tail_number)).size,
    parameterCount: availableParameters.length,
    dateRange: processedFlights.length > 0 ? {
      from: processedFlights.reduce((min, f) => f.startTime < min ? f.startTime : min, processedFlights[0].startTime),
      to: processedFlights.reduce((max, f) => f.endTime > max ? f.endTime : max, processedFlights[0].endTime),
    } : null,
    lastUploadTimestamp,
  }), [processedFlights, rawData, availableParameters, lastUploadTimestamp]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('csvData');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Only load essential data - rawData and processedFlights are not saved anymore
        // due to localStorage size limitations
        setAvailableParameters(data.availableParameters || []);
        setSelectionSets(data.selectionSets || []);
        setEvidence(data.evidence || []);
        setRules(data.rules || []);
      } catch (error) {
        console.error('Failed to load saved data:', error);
      }
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    // Only save essential data to avoid localStorage quota exceeded error
    const essentialData = {
      availableParameters,
      selectionSets,
      evidence,
      rules,
      // Save only metadata for large datasets
      dataMetadata: {
        recordCount: rawData.length,
        flightCount: processedFlights.length,
        hasData: rawData.length > 0
      }
    };
    
    try {
      localStorage.setItem('csvData', JSON.stringify(essentialData));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data and retrying with minimal data');
        // Clear old data and try saving minimal data
        localStorage.removeItem('csvData');
        try {
          localStorage.setItem('csvData', JSON.stringify({
            availableParameters,
            selectionSets,
            dataMetadata: { hasData: rawData.length > 0 }
          }));
        } catch (retryError) {
          console.error('Failed to save even minimal data to localStorage:', retryError);
        }
      } else {
        console.error('Error saving to localStorage:', error);
      }
    }
  }, [rawData, processedFlights, availableParameters, selectionSets, evidence, rules]);

  const processFlightData = (sampleData: any[], headers: string[]): void => {
    // Map sample data to CSVRecord format
    const records: CSVRecord[] = sampleData.map(row => {
      const record: CSVRecord = {} as CSVRecord;
      
      // Map sample data fields to expected CSV format
      record.flight_id = `FL-${row.aircraft_tail}-${new Date(row.timestamp).getFullYear()}${String(new Date(row.timestamp).getMonth() + 1).padStart(2, '0')}${String(new Date(row.timestamp).getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 100)}`;
      record.tail_number = row.aircraft_tail;
      record.timestamp = row.timestamp;
      
      // Map Hebrew phases to English
      const phaseMap: Record<string, 'taxi' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'landing'> = {
        'טקסי': 'taxi',
        'המראה': 'takeoff', 
        'עלייה': 'climb',
        'טיסת שיוט': 'cruise',
        'ירידה': 'descent',
        'נחיתה': 'landing'
      };
      record.phase = phaseMap[row.flight_phase] || 'cruise' as 'cruise';
      
      // Add all other parameters
      headers.forEach(header => {
        if (row[header] !== undefined) {
          const value = row[header];
          record[header] = isNaN(Number(value)) ? value : Number(value);
        }
      });
      
      return record;
    });

    // Process flights
    const flightGroups = new Map<string, CSVRecord[]>();
    records.forEach(record => {
      if (!flightGroups.has(record.flight_id)) {
        flightGroups.set(record.flight_id, []);
      }
      flightGroups.get(record.flight_id)!.push(record);
    });

    const flights: ProcessedFlight[] = Array.from(flightGroups.entries()).map(([flightId, flightRecords]) => {
      const sortedRecords = flightRecords.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      return {
        flight_id: flightId,
        tail_number: sortedRecords[0].tail_number,
        records: sortedRecords,
        phases: [...new Set(sortedRecords.map(r => r.phase))],
        startTime: sortedRecords[0].timestamp,
        endTime: sortedRecords[sortedRecords.length - 1].timestamp,
        parameters: headers.filter(h => !['flight_id', 'tail_number', 'timestamp', 'phase'].includes(h)),
      };
    });

    // Get all available parameters (excluding required columns)
    const parameters = headers.filter(h => !['flight_id', 'tail_number', 'timestamp', 'phase'].includes(h));

    setRawData(records);
    setProcessedFlights(flights);
    setAvailableParameters(parameters);
  };

  const loadDemoData = async (): Promise<void> => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const sampleData = generateSampleFlightData();
      const headers = sampleDataHeaders;
      
      processFlightData(sampleData, headers);
      
      // PRODUCTION: Mark as demo data
      setDataMode('demo');
      setLastUploadTimestamp(new Date().toISOString());
      
      console.log('Demo data loaded successfully. Data mode set to DEMO.');
      
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'שגיאה בטעינת נתוני הדמו');
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadCSV = async (file: File): Promise<void> => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('קובץ CSV חייב להכיל לפחות שורת כותרות ושורת נתונים אחת');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      
      // Validate required columns
      const requiredColumns = ['flight_id', 'tail_number', 'timestamp', 'phase'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`עמודות חסרות: ${missingColumns.join(', ')}`);
      }

      // Parse data
      const records: CSVRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;
        
        const record: CSVRecord = {} as CSVRecord;
        headers.forEach((header, index) => {
          const value = values[index];
          // Try to parse as number, otherwise keep as string
          record[header] = isNaN(Number(value)) ? value : Number(value);
        });
        
        // Validate required fields
        if (record.flight_id && record.tail_number && record.timestamp && record.phase) {
          records.push(record);
        }
      }

      if (records.length === 0) {
        throw new Error('לא נמצאו רשומות תקינות בקובץ');
      }

      processFlightData(records, headers);
      
      // PRODUCTION: Mark as live data
      setDataMode('live');
      setLastUploadTimestamp(new Date().toISOString());
      
      console.log('CSV processed successfully. Data mode set to LIVE.');

    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'שגיאה בעיבוד הקובץ');
    } finally {
      setIsProcessing(false);
    }
  };

  const createSelectionSet = (set: Omit<SelectionSet, 'id' | 'createdAt'>): string => {
    const id = `S${selectionSets.length + 1}`;
    const newSet: SelectionSet = {
      ...set,
      id,
      createdAt: new Date().toISOString(),
    };
    setSelectionSets(prev => [...prev, newSet]);
    return id;
  };

  const updateSelectionSet = (id: string, updates: Partial<SelectionSet>) => {
    setSelectionSets(prev => prev.map(set => 
      set.id === id ? { ...set, ...updates } : set
    ));
  };

  const deleteSelectionSet = (id: string) => {
    setSelectionSets(prev => prev.filter(set => set.id !== id));
  };

  const combineSelectionSets = (ids: string[], operation: 'union' | 'intersect' | 'difference', name: string): string => {
    const sets = selectionSets.filter(set => ids.includes(set.id));
    if (sets.length < 2) return '';

    // Simplified combination logic - in real implementation would handle different data types
    let combinedData = sets[0].data;
    for (let i = 1; i < sets.length; i++) {
      switch (operation) {
        case 'union':
          combinedData = [...combinedData, ...sets[i].data];
          break;
        case 'intersect':
          // Simplified intersection
          combinedData = combinedData.filter(item => 
            sets[i].data.some(otherItem => JSON.stringify(item) === JSON.stringify(otherItem))
          );
          break;
        case 'difference':
          combinedData = combinedData.filter(item => 
            !sets[i].data.some(otherItem => JSON.stringify(item) === JSON.stringify(otherItem))
          );
          break;
      }
    }

    return createSelectionSet({
      name,
      color: '#8B5CF6',
      type: 'combined',
      data: combinedData,
      source: 'signals',
      description: `${operation} of ${sets.map(s => s.name).join(', ')}`,
    });
  };

  const pinToEvidence = (selectionSetIds: string[], name: string, description: string): string => {
    const id = `E${evidence.length + 1}`;
    const newEvidence: Evidence = {
      id,
      name,
      description,
      selectionSets: selectionSetIds,
      createdAt: new Date().toISOString(),
      createdBy: 'current-user', // Would come from auth context
      metadata: {
        parameters: [],
        flights: [],
        phases: [],
      },
    };
    setEvidence(prev => [...prev, newEvidence]);
    return id;
  };

  const createRule = (rule: Omit<Rule, 'id' | 'createdAt'>): string => {
    const id = `R${rules.length + 1}`;
    const newRule: Rule = {
      ...rule,
      id,
      createdAt: new Date().toISOString(),
      isActive: rule.status === 'approved',
    };
    setRules(prev => [...prev, newRule]);
    return id;
  };

  const updateRule = (id: string, updates: Partial<Rule>) => {
    setRules(prev => prev.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    ));
  };

  const toggleRuleActive = (id: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === id ? { ...rule, isActive: !rule.isActive } : rule
    ));
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(rule => rule.id !== id));
  };

  const getFlightData = (flightId: string): ProcessedFlight | undefined => {
    return processedFlights.find(flight => flight.flight_id === flightId);
  };

  const getParameterData = (parameter: string, flightId?: string): any[] => {
    let records = rawData;
    if (flightId) {
      records = records.filter(r => r.flight_id === flightId);
    }
    return records.map(r => ({ timestamp: r.timestamp, value: r[parameter] }));
  };

  const saveSnapshot = (name: string) => {
    const snapshot = {
      rawData,
      processedFlights,
      availableParameters,
      selectionSets,
      evidence,
      rules,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(`snapshot_${name}`, JSON.stringify(snapshot));
  };

  const loadSnapshot = (name: string) => {
    const saved = localStorage.getItem(`snapshot_${name}`);
    if (saved) {
      const snapshot = JSON.parse(saved);
      setRawData(snapshot.rawData || []);
      setProcessedFlights(snapshot.processedFlights || []);
      setAvailableParameters(snapshot.availableParameters || []);
      setSelectionSets(snapshot.selectionSets || []);
      setEvidence(snapshot.evidence || []);
      setRules(snapshot.rules || []);
    }
  };

  const getSnapshots = (): string[] => {
    const keys = Object.keys(localStorage);
    return keys
      .filter(key => key.startsWith('snapshot_'))
      .map(key => key.replace('snapshot_', ''));
  };

  // PRODUCTION: Clear all data - reset to empty state
  const clearAllData = () => {
    setRawData([]);
    setProcessedFlights([]);
    setAvailableParameters([]);
    setSelectionSets([]);
    setEvidence([]);
    setRules([]);
    setDataMode('live');
    setLastUploadTimestamp(null);
    setProcessingError(null);
    console.log('All data cleared. System reset to empty live mode.');
  };

  const contextValue: CSVDataContextType = {
    rawData,
    processedFlights,
    availableParameters,
    isProcessing,
    processingError,
    // Data mode (PRODUCTION)
    dataMode,
    setDataMode,
    hasRealData,
    dataStats,
    // Selection sets
    selectionSets,
    evidence,
    rules,
    uploadCSV,
    loadDemoData,
    createSelectionSet,
    updateSelectionSet,
    deleteSelectionSet,
    combineSelectionSets,
    pinToEvidence,
    createRule,
    updateRule,
    toggleRuleActive,
    deleteRule,
    getFlightData,
    getParameterData,
    saveSnapshot,
    loadSnapshot,
    getSnapshots,
    clearAllData,
  };

  return (
    <CSVDataContext.Provider value={contextValue}>
      {children}
    </CSVDataContext.Provider>
  );
};
