export interface TelemetryRecordInput {
    timestamp: string;
    phase: string;
    parameters: Record<string, number>;
}
export interface PersistedFlightInput {
    flightId: string;
    tailNumber: string;
    missionType?: string | null;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    phases: string[];
    availableParameters: string[];
    records: TelemetryRecordInput[];
}
export interface PersistedFlight {
    flightId: string;
    tailNumber: string;
    missionType: string | null;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    phases: string[];
    availableParameters: string[];
    recordCount: number;
    records: TelemetryRecordInput[];
    createdAt: string;
    updatedAt: string;
}
export declare const flightsService: {
    replaceBatch(params: {
        batchId: string;
        sourceType: string;
        sourceName?: string;
        sourceFilename?: string;
        importedBy?: string;
        flights: PersistedFlightInput[];
    }): void;
    list(options?: {
        sampleSize?: number | null;
    }): PersistedFlight[];
    getByFlightId(flightId: string, options?: {
        sampleSize?: number | null;
    }): PersistedFlight | null;
    deleteFlightArtifacts(flightId: string): void;
};
//# sourceMappingURL=flights-service.d.ts.map