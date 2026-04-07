/**
 * Flight Data Adapter
 * Unified interface for loading flight data from any source
 */

import { logger } from '../utils/logger';
import { executeSQL, registerSQLSource } from './sql-adapter';
import { readFile, registerFileSystemSource } from './file-adapter';
import { callExternalAPI, registerAPISource } from './api-adapter';

interface FlightFilter {
  tailNumbers?: string[];
  dateRange?: { start: string; end: string };
  phases?: string[];
  squadrons?: string[];
  flightIds?: string[];
  parameters?: string[];
}

interface FlightDataResult {
  success: boolean;
  data?: any[];
  metadata?: {
    rowCount: number;
    columns: string[];
    sourceType: string;
    executionTime: number;
  };
  error?: string;
}

// In-memory storage for source type mappings
const sourceTypes = new Map<string, 'sql' | 'filesystem' | 'api'>();

export function registerSourceType(sourceId: string, type: 'sql' | 'filesystem' | 'api'): void {
  sourceTypes.set(sourceId, type);
}

export async function loadFlightDataFromSource(
  sourceId: string,
  filters: FlightFilter
): Promise<FlightDataResult> {
  const sourceType = sourceTypes.get(sourceId);
  const startTime = Date.now();
  
  logger.info(`Loading flight data from ${sourceId} (${sourceType})`, { filters });
  
  try {
    switch (sourceType) {
      case 'sql':
        return await loadFromSQL(sourceId, filters, startTime);
        
      case 'filesystem':
        return await loadFromFileSystem(sourceId, filters, startTime);
        
      case 'api':
        return await loadFromAPI(sourceId, filters, startTime);
        
      default:
        return {
          success: false,
          error: `Unknown source type for ${sourceId}. Please register the source first.`,
        };
    }
  } catch (error) {
    logger.error(`Flight data loading error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load flight data',
    };
  }
}

async function loadFromSQL(sourceId: string, filters: FlightFilter, startTime: number): Promise<FlightDataResult> {
  // Build dynamic SQL query based on filters
  let whereConditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;
  
  if (filters.tailNumbers && filters.tailNumbers.length > 0) {
    whereConditions.push(`tail_number IN (${filters.tailNumbers.map(() => `$${paramIndex++}`).join(', ')})`);
    params.push(...filters.tailNumbers);
  }
  
  if (filters.dateRange) {
    whereConditions.push(`timestamp >= $${paramIndex++} AND timestamp <= $${paramIndex++}`);
    params.push(filters.dateRange.start, filters.dateRange.end);
  }
  
  if (filters.phases && filters.phases.length > 0) {
    whereConditions.push(`phase IN (${filters.phases.map(() => `$${paramIndex++}`).join(', ')})`);
    params.push(...filters.phases);
  }
  
  if (filters.flightIds && filters.flightIds.length > 0) {
    whereConditions.push(`flight_id IN (${filters.flightIds.map(() => `$${paramIndex++}`).join(', ')})`);
    params.push(...filters.flightIds);
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // Select specific parameters if specified
  const selectColumns = filters.parameters && filters.parameters.length > 0
    ? ['flight_id', 'tail_number', 'timestamp', 'phase', ...filters.parameters].join(', ')
    : '*';
  
  const query = `SELECT ${selectColumns} FROM flight_data ${whereClause} ORDER BY timestamp`;
  
  const result = await executeSQL(sourceId, {
    query,
    parameters: params.reduce((acc, val, idx) => ({ ...acc, [`$${idx + 1}`]: val }), {}),
  });
  
  return {
    success: true,
    data: result.rows,
    metadata: {
      rowCount: result.rowCount,
      columns: result.columns,
      sourceType: 'sql',
      executionTime: Date.now() - startTime,
    },
  };
}

async function loadFromFileSystem(sourceId: string, filters: FlightFilter, startTime: number): Promise<FlightDataResult> {
  // Read file and apply filters in memory
  const result = await readFile(sourceId, {
    path: '/', // This would be configured per source
    format: 'auto',
    headers: true,
  });
  
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }
  
  // Apply filters in memory
  let filteredData = result.data;
  
  if (filters.tailNumbers && filters.tailNumbers.length > 0) {
    filteredData = filteredData.filter(row => filters.tailNumbers!.includes(row.tail_number));
  }
  
  if (filters.dateRange) {
    const start = new Date(filters.dateRange.start);
    const end = new Date(filters.dateRange.end);
    filteredData = filteredData.filter(row => {
      const timestamp = new Date(row.timestamp);
      return timestamp >= start && timestamp <= end;
    });
  }
  
  if (filters.phases && filters.phases.length > 0) {
    filteredData = filteredData.filter(row => filters.phases!.includes(row.phase));
  }
  
  if (filters.flightIds && filters.flightIds.length > 0) {
    filteredData = filteredData.filter(row => filters.flightIds!.includes(row.flight_id));
  }
  
  // Select specific parameters if specified
  if (filters.parameters && filters.parameters.length > 0) {
    const requiredCols = ['flight_id', 'tail_number', 'timestamp', 'phase', ...filters.parameters];
    filteredData = filteredData.map(row => {
      const filtered: any = {};
      requiredCols.forEach(col => {
        if (row[col] !== undefined) {
          filtered[col] = row[col];
        }
      });
      return filtered;
    });
  }
  
  return {
    success: true,
    data: filteredData,
    metadata: {
      rowCount: filteredData.length,
      columns: result.metadata?.columns || [],
      sourceType: 'filesystem',
      executionTime: Date.now() - startTime,
    },
  };
}

async function loadFromAPI(sourceId: string, filters: FlightFilter, startTime: number): Promise<FlightDataResult> {
  // Call API with filters as query parameters
  const queryParams: Record<string, string> = {};
  
  if (filters.tailNumbers && filters.tailNumbers.length > 0) {
    queryParams.tail_numbers = filters.tailNumbers.join(',');
  }
  
  if (filters.dateRange) {
    queryParams.date_from = filters.dateRange.start;
    queryParams.date_to = filters.dateRange.end;
  }
  
  if (filters.phases && filters.phases.length > 0) {
    queryParams.phases = filters.phases.join(',');
  }
  
  if (filters.flightIds && filters.flightIds.length > 0) {
    queryParams.flight_ids = filters.flightIds.join(',');
  }
  
  const result = await callExternalAPI(sourceId, {
    endpoint: '/flights',
    method: 'GET',
    queryParams,
  });
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  const data = Array.isArray(result.data) ? result.data : result.data?.data || [];
  
  return {
    success: true,
    data,
    metadata: {
      rowCount: data.length,
      columns: data.length > 0 ? Object.keys(data[0]) : [],
      sourceType: 'api',
      executionTime: Date.now() - startTime,
    },
  };
}
