export interface SourceConfigRecord {
    id: string;
    name: string;
    type: 'sql' | 'filesystem' | 'api';
    config: Record<string, unknown>;
    isActive: boolean;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}
export declare const sourceConfigService: {
    list(): SourceConfigRecord[];
    getById(id: string): SourceConfigRecord | null;
    upsert(config: {
        id: string;
        name: string;
        type: "sql" | "filesystem" | "api";
        config: Record<string, unknown>;
        enabled?: boolean;
        createdBy?: string;
    }): SourceConfigRecord;
    delete(id: string): boolean;
    registerAll(): void;
    registerWithAdapters(record: SourceConfigRecord): void;
};
//# sourceMappingURL=source-config-service.d.ts.map