/**
 * useParameterAvailability Hook
 * 
 * PRODUCTION RULE: Parameter availability must be computed from actual CSV data.
 * Parameters without data should be disabled/explained, not show fake values.
 * 
 * This hook provides:
 * - Which parameters have actual data
 * - Data coverage and statistics per parameter
 * - Helper functions for parameter validation
 */

import { useMemo } from 'react';
import { useCSVData, CSVRecord } from '@/contexts/CSVDataContext';
import { getParameterUnit, getParameterLabel } from '@/lib/parameter-categories';

export interface ParameterAvailability {
  /** Parameter name (column header) */
  parameter: string;
  /** Human-readable label */
  label: string;
  /** Unit of measurement */
  unit: string;
  /** Whether this parameter has any valid data */
  hasData: boolean;
  /** Number of records with valid data */
  dataPointCount: number;
  /** Percentage of records with valid data */
  coverage: number;
  /** Minimum numeric value (if numeric) */
  minValue: number | null;
  /** Maximum numeric value (if numeric) */
  maxValue: number | null;
  /** Average value (if numeric) */
  avgValue: number | null;
  /** Whether this is a numeric parameter */
  isNumeric: boolean;
  /** Sample values (first 5 unique) */
  sampleValues: (string | number)[];
}

export interface UseParameterAvailabilityResult {
  /** All parameter stats */
  parameterStats: ParameterAvailability[];
  /** Parameters that have data */
  parametersWithData: string[];
  /** Parameters without data */
  parametersWithoutData: string[];
  /** Get info for specific parameter */
  getParameterInfo: (param: string) => ParameterAvailability | undefined;
  /** Check if parameter has data */
  hasDataForParameter: (param: string) => boolean;
  /** Get coverage percentage for parameter */
  getParameterCoverage: (param: string) => number;
  /** Total parameter count */
  totalParameters: number;
  /** Parameters with data count */
  availableParameterCount: number;
}

// Parameters to exclude from analysis (metadata, not sensor data)
const EXCLUDED_PARAMETERS = [
  'flight_id',
  'tail_number',
  'timestamp',
  'phase',
  'pilot_id',
  'pilot_name',
];

export const useParameterAvailability = (): UseParameterAvailabilityResult => {
  const { rawData, availableParameters } = useCSVData();
  
  const parameterStats = useMemo((): ParameterAvailability[] => {
    if (rawData.length === 0 || availableParameters.length === 0) return [];
    
    // Filter out metadata parameters
    const dataParameters = availableParameters.filter(
      p => !EXCLUDED_PARAMETERS.includes(p.toLowerCase())
    );
    
    return dataParameters.map((param): ParameterAvailability => {
      // Get all values for this parameter
      const values = rawData
        .map(r => r[param])
        .filter(v => v !== null && v !== undefined && v !== '' && v !== 'N/A');
      
      // Try to parse as numbers
      const numericValues = values
        .map(v => typeof v === 'number' ? v : parseFloat(String(v)))
        .filter(v => !isNaN(v) && isFinite(v));
      
      const isNumeric = numericValues.length > values.length * 0.5; // >50% numeric
      
      // Calculate statistics
      const coverage = rawData.length > 0 
        ? (values.length / rawData.length) * 100 
        : 0;
      
      let minValue: number | null = null;
      let maxValue: number | null = null;
      let avgValue: number | null = null;
      
      if (isNumeric && numericValues.length > 0) {
        minValue = Math.min(...numericValues);
        maxValue = Math.max(...numericValues);
        avgValue = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      }
      
      // Get sample values
      const uniqueValues = [...new Set(values)];
      const sampleValues = uniqueValues.slice(0, 5);
      
      return {
        parameter: param,
        label: getParameterLabel(param, false),
        unit: getParameterUnit(param),
        hasData: values.length > 0,
        dataPointCount: values.length,
        coverage: Math.round(coverage * 10) / 10,
        minValue,
        maxValue,
        avgValue: avgValue !== null ? Math.round(avgValue * 100) / 100 : null,
        isNumeric,
        sampleValues,
      };
    });
  }, [rawData, availableParameters]);
  
  const parametersWithData = useMemo(() => 
    parameterStats.filter(p => p.hasData).map(p => p.parameter),
    [parameterStats]
  );
  
  const parametersWithoutData = useMemo(() => 
    parameterStats.filter(p => !p.hasData).map(p => p.parameter),
    [parameterStats]
  );
  
  const getParameterInfo = useMemo(() => 
    (param: string) => parameterStats.find(p => p.parameter === param),
    [parameterStats]
  );
  
  const hasDataForParameter = useMemo(() => 
    (param: string) => {
      const info = parameterStats.find(p => p.parameter === param);
      return info?.hasData ?? false;
    },
    [parameterStats]
  );
  
  const getParameterCoverage = useMemo(() => 
    (param: string) => {
      const info = parameterStats.find(p => p.parameter === param);
      return info?.coverage ?? 0;
    },
    [parameterStats]
  );
  
  return {
    parameterStats,
    parametersWithData,
    parametersWithoutData,
    getParameterInfo,
    hasDataForParameter,
    getParameterCoverage,
    totalParameters: parameterStats.length,
    availableParameterCount: parametersWithData.length,
  };
};

/**
 * Hook for parameter selector with availability awareness
 */
export const useParameterSelectorOptions = (options?: {
  onlyWithData?: boolean;
  category?: string;
}) => {
  const { parameterStats, parametersWithData } = useParameterAvailability();
  const { onlyWithData = true } = options || {};
  
  const selectorOptions = useMemo(() => {
    let params = parameterStats;
    
    if (onlyWithData) {
      params = params.filter(p => p.hasData);
    }
    
    return params.map(p => ({
      value: p.parameter,
      label: p.label,
      unit: p.unit,
      disabled: !p.hasData,
      coverage: p.coverage,
      tooltip: p.hasData 
        ? `${p.dataPointCount} נקודות נתונים (${p.coverage}%)`
        : 'אין נתונים לפרמטר זה',
    }));
  }, [parameterStats, onlyWithData]);
  
  return {
    options: selectorOptions,
    hasOptions: selectorOptions.length > 0,
    availableCount: parametersWithData.length,
    totalCount: parameterStats.length,
  };
};

/**
 * Hook to check if multiple parameters are available for correlation
 */
export const useCanCorrelateParameters = (params: string[]) => {
  const { hasDataForParameter, getParameterInfo } = useParameterAvailability();
  
  return useMemo(() => {
    if (params.length < 2) {
      return {
        canCorrelate: false,
        reason: 'נדרשים לפחות 2 פרמטרים',
        missingParams: [],
      };
    }
    
    const missingParams = params.filter(p => !hasDataForParameter(p));
    
    if (missingParams.length > 0) {
      return {
        canCorrelate: false,
        reason: `אין נתונים לפרמטרים: ${missingParams.join(', ')}`,
        missingParams,
      };
    }
    
    // Check if parameters are numeric
    const nonNumeric = params.filter(p => {
      const info = getParameterInfo(p);
      return info && !info.isNumeric;
    });
    
    if (nonNumeric.length > 0) {
      return {
        canCorrelate: false,
        reason: `פרמטרים לא מספריים: ${nonNumeric.join(', ')}`,
        missingParams: [],
        nonNumericParams: nonNumeric,
      };
    }
    
    return {
      canCorrelate: true,
      reason: null,
      missingParams: [],
    };
  }, [params, hasDataForParameter, getParameterInfo]);
};

export default useParameterAvailability;
