/**
 * Flight Data Adapter
 * Unified interface for loading flight data from any source
 */
interface FlightFilter {
    tailNumbers?: string[];
    dateRange?: {
        start: string;
        end: string;
    };
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
export declare function registerSourceType(sourceId: string, type: 'sql' | 'filesystem' | 'api'): void;
export declare function loadFlightDataFromSource(sourceId: string, filters: FlightFilter): Promise<FlightDataResult>;
export {};
//# sourceMappingURL=flight-data-adapter.d.ts.map