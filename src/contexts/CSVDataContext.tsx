import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ingestionApi, operationsFlightsApi, type OperationsFlightDto } from '@/lib/api-client';
import { UserRole } from '@/types/core';

export interface CSVRecord {
  flight_id: string;
  tail_number: string;
  timestamp: string;
  phase: 'taxi' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'landing';
  [key: string]: any;
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
  selectionSets: string[];
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
  rawData: CSVRecord[];
  processedFlights: ProcessedFlight[];
  availableParameters: string[];
  isProcessing: boolean;
  processingProgress: number | null;
  processingStage: string | null;
  processingError: string | null;
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  hasRealData: boolean;
  dataStats: DataStats;
  selectionSets: SelectionSet[];
  evidence: Evidence[];
  rules: Rule[];
  uploadCSV: (file: File, uploaderRole: UserRole) => Promise<void>;
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
  getFlightData: (flightId: string) => ProcessedFlight | undefined;
  getParameterData: (parameter: string, flightId?: string) => any[];
  saveSnapshot: (name: string) => void;
  loadSnapshot: (name: string) => void;
  getSnapshots: () => string[];
  clearAllData: () => void;
}

const CSVDataContext = createContext<CSVDataContextType | undefined>(undefined);

const PROGRESS_STAGES = {
  reading: { progress: 8, label: 'קורא את קובץ ה-CSV' },
  uploading: { progress: 20, label: 'מעלה את הקובץ לשרת המקומי' },
  processing: { progress: 78, label: 'מעבד, מנרמל ושומר נתונים' },
  restoring: { progress: 92, label: 'טוען נתונים למחקר' },
  complete: { progress: 100, label: 'הטעינה הושלמה' },
};

function normalizePhase(phase: string): CSVRecord['phase'] {
  if (phase === 'taxi' || phase === 'takeoff' || phase === 'climb' || phase === 'cruise' || phase === 'descent' || phase === 'landing') {
    return phase;
  }
  return 'cruise';
}

function deriveTelemetryParameters(records: CSVRecord[], seededParameters: string[] = []): string[] {
  const parameters = new Set(seededParameters);

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (key === 'flight_id' || key === 'tail_number' || key === 'timestamp' || key === 'phase') {
        continue;
      }

      const numericValue = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(numericValue)) {
        parameters.add(key);
      }
    }
  }

  return Array.from(parameters).sort();
}

function dtoToProcessedFlight(flight: OperationsFlightDto): ProcessedFlight {
  const records = flight.records.map((record) => ({
    flight_id: flight.flightId,
    tail_number: flight.tailNumber,
    timestamp: record.timestamp,
    phase: normalizePhase(record.phase),
    ...record.parameters,
  }));

  return {
    flight_id: flight.flightId,
    tail_number: flight.tailNumber,
    records,
    phases: flight.phases,
    startTime: flight.startTime,
    endTime: flight.endTime,
    parameters: deriveTelemetryParameters(records, flight.availableParameters),
  };
}

function hydrateOperationalData(flights: OperationsFlightDto[]) {
  const processedFlights = flights.map(dtoToProcessedFlight);
  const rawData = processedFlights.flatMap((flight) => flight.records);
  const availableParameters = deriveTelemetryParameters(
    rawData,
    processedFlights.flatMap((flight) => flight.parameters),
  );

  return { rawData, processedFlights, availableParameters };
}

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
  const [processingProgress, setProcessingProgress] = useState<number | null>(null);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>('live');
  const [lastUploadTimestamp, setLastUploadTimestamp] = useState<string | null>(null);
  const [selectionSets, setSelectionSets] = useState<SelectionSet[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);

  const hasRealData = processedFlights.length > 0;

  const dataStats = useMemo(
    (): DataStats => ({
      flightCount: processedFlights.length,
      recordCount: processedFlights.reduce((sum, flight) => sum + flight.records.length, 0),
      aircraftCount: new Set(processedFlights.map((flight) => flight.tail_number)).size,
      parameterCount: availableParameters.length,
      dateRange:
        processedFlights.length > 0
          ? {
              from: processedFlights.reduce(
                (min, flight) => (flight.startTime < min ? flight.startTime : min),
                processedFlights[0].startTime,
              ),
              to: processedFlights.reduce(
                (max, flight) => (flight.endTime > max ? flight.endTime : max),
                processedFlights[0].endTime,
              ),
            }
          : null,
      lastUploadTimestamp,
    }),
    [availableParameters, lastUploadTimestamp, processedFlights],
  );

  const restoreOperationalData = useCallback(async () => {
    const response = await operationsFlightsApi.list(1200);
    if (!response.ok || !response.data) {
      return;
    }

    const hydrated = hydrateOperationalData(response.data.flights);
    setRawData(hydrated.rawData);
    setProcessedFlights(hydrated.processedFlights);
    setAvailableParameters(hydrated.availableParameters);
    if (response.data.flights.length > 0) {
      setLastUploadTimestamp(response.data.flights[0].updatedAt);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('csvData');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setSelectionSets(data.selectionSets || []);
        setEvidence(data.evidence || []);
        setRules(data.rules || []);
      } catch (error) {
        console.error('Failed to load saved data:', error);
      }
    }

    restoreOperationalData().catch((error) => {
      console.warn('Failed to restore operational flight data:', error);
    });
  }, [restoreOperationalData]);

  useEffect(() => {
    const convenienceState = {
      selectionSets,
      evidence,
      rules,
    };

    try {
      localStorage.setItem('csvData', JSON.stringify(convenienceState));
    } catch (error) {
      console.error('Error saving CSV convenience state:', error);
    }
  }, [selectionSets, evidence, rules]);

  const loadDemoData = async (): Promise<void> => {
    setProcessingError('Demo mode is disabled in the local MVP.');
    throw new Error('Demo mode is disabled');
  };

  const uploadCSV = useCallback(
    async (file: File, uploaderRole: UserRole): Promise<void> => {
      if (uploaderRole !== 'engineer') {
        throw new Error('Only engineers can upload operational CSV data.');
      }

      setIsProcessing(true);
      setProcessingProgress(PROGRESS_STAGES.reading.progress);
      setProcessingStage(PROGRESS_STAGES.reading.label);
      setProcessingError(null);

      try {
        const csvContent = await file.text();
        setProcessingProgress(PROGRESS_STAGES.uploading.progress);
        setProcessingStage(PROGRESS_STAGES.uploading.label);

        const response = await ingestionApi.uploadCsv(csvContent, file.name, (percent) => {
          setProcessingProgress(20 + Math.round(percent * 0.45));
          setProcessingStage(percent >= 100 ? PROGRESS_STAGES.processing.label : PROGRESS_STAGES.uploading.label);
        });

        if (!response.ok || !response.data) {
          throw new Error(response.errorHe || response.error || 'CSV ingestion failed');
        }

        setProcessingProgress(PROGRESS_STAGES.processing.progress);
        setProcessingStage(PROGRESS_STAGES.processing.label);
        await restoreOperationalData();

        setProcessingProgress(PROGRESS_STAGES.restoring.progress);
        setProcessingStage(PROGRESS_STAGES.restoring.label);
        setDataMode('live');
        setLastUploadTimestamp(new Date().toISOString());
        setProcessingProgress(PROGRESS_STAGES.complete.progress);
        setProcessingStage(PROGRESS_STAGES.complete.label);
      } catch (error) {
        setProcessingError(error instanceof Error ? error.message : 'Upload failed.');
        throw error;
      } finally {
        setIsProcessing(false);
        setProcessingProgress(null);
        setProcessingStage(null);
      }
    },
    [restoreOperationalData],
  );

  const createSelectionSet = (set: Omit<SelectionSet, 'id' | 'createdAt'>): string => {
    const id = `S${selectionSets.length + 1}`;
    const next: SelectionSet = { ...set, id, createdAt: new Date().toISOString() };
    setSelectionSets((prev) => [...prev, next]);
    return id;
  };

  const updateSelectionSet = (id: string, updates: Partial<SelectionSet>) => {
    setSelectionSets((prev) => prev.map((set) => (set.id === id ? { ...set, ...updates } : set)));
  };

  const deleteSelectionSet = (id: string) => {
    setSelectionSets((prev) => prev.filter((set) => set.id !== id));
  };

  const combineSelectionSets = (
    ids: string[],
    operation: 'union' | 'intersect' | 'difference',
    name: string,
  ): string => {
    const sets = selectionSets.filter((set) => ids.includes(set.id));
    if (sets.length < 2) {
      return '';
    }

    let combinedData = sets[0].data;
    for (let index = 1; index < sets.length; index += 1) {
      const current = sets[index].data;
      if (operation === 'union') {
        combinedData = [...combinedData, ...current];
      }
      if (operation === 'intersect') {
        combinedData = combinedData.filter((item) => current.some((other) => JSON.stringify(item) === JSON.stringify(other)));
      }
      if (operation === 'difference') {
        combinedData = combinedData.filter((item) => !current.some((other) => JSON.stringify(item) === JSON.stringify(other)));
      }
    }

    return createSelectionSet({
      name,
      color: '#8B5CF6',
      type: 'combined',
      data: combinedData,
      source: 'signals',
      description: `${operation} of ${sets.map((set) => set.name).join(', ')}`,
    });
  };

  const pinToEvidence = (selectionSetIds: string[], name: string, description: string): string => {
    const id = `E${evidence.length + 1}`;
    const next: Evidence = {
      id,
      name,
      description,
      selectionSets: selectionSetIds,
      createdAt: new Date().toISOString(),
      createdBy: 'current-user',
      metadata: { parameters: [], flights: [], phases: [] },
    };
    setEvidence((prev) => [...prev, next]);
    return id;
  };

  const createRule = (rule: Omit<Rule, 'id' | 'createdAt'>): string => {
    const id = `R${rules.length + 1}`;
    const next: Rule = {
      ...rule,
      id,
      createdAt: new Date().toISOString(),
      isActive: rule.status === 'approved',
    };
    setRules((prev) => [...prev, next]);
    return id;
  };

  const updateRule = (id: string, updates: Partial<Rule>) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule)));
  };

  const toggleRuleActive = (id: string) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, isActive: !rule.isActive } : rule)));
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const getFlightData = (flightId: string) => processedFlights.find((flight) => flight.flight_id === flightId);

  const getParameterData = (parameter: string, flightId?: string) => {
    const records = flightId ? rawData.filter((record) => record.flight_id === flightId) : rawData;
    return records.map((record) => ({ timestamp: record.timestamp, value: record[parameter] }));
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
    if (!saved) {
      return;
    }

    const snapshot = JSON.parse(saved);
    setRawData(snapshot.rawData || []);
    setProcessedFlights(snapshot.processedFlights || []);
    setAvailableParameters(snapshot.availableParameters || []);
    setSelectionSets(snapshot.selectionSets || []);
    setEvidence(snapshot.evidence || []);
    setRules(snapshot.rules || []);
  };

  const getSnapshots = (): string[] =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('snapshot_'))
      .map((key) => key.replace('snapshot_', ''));

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
  };

  const contextValue: CSVDataContextType = {
    rawData,
    processedFlights,
    availableParameters,
    isProcessing,
    processingProgress,
    processingStage,
    processingError,
    dataMode,
    setDataMode,
    hasRealData,
    dataStats,
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

  return <CSVDataContext.Provider value={contextValue}>{children}</CSVDataContext.Provider>;
};
