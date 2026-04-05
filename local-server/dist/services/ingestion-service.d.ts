import { PersistedFlightInput } from './flights-service';
type CsvRow = Record<string, string>;
export interface IngestionResult {
    batchId: string;
    recordCount: number;
    flightCount: number;
    findingCount: number;
    availableParameters: string[];
}
export declare const ingestionService: {
    ingestCsv(params: {
        csvContent: string;
        sourceFilename?: string;
        actorId: string;
        actorRole: string;
    }): IngestionResult;
    deriveNumericParameters(rows: CsvRow[]): string[];
    groupRowsByFlight(rows: CsvRow[], availableParameters: string[]): Map<string, PersistedFlightInput>;
    replaceFindingsForFlight(params: {
        flight: PersistedFlightInput;
        dossierId: string;
        actorId: string;
        actorRole: string;
    }): number;
};
export {};
//# sourceMappingURL=ingestion-service.d.ts.map