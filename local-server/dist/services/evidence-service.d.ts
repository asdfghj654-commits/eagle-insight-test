/**
 * Evidence Service — Eagle Insight
 *
 * Manages evidence items persisted to SQLite.
 * Evidence items are the analyst's marked selections and observations
 * from the investigation workbench — they must survive page reload.
 *
 * Previously stored in localStorage (wrong). Now persisted server-side.
 */
export interface EvidenceItem {
    id: string;
    findingId?: string;
    dossierId?: string;
    flightId?: string;
    sortieId?: string;
    createdBy: string;
    createdAt: string;
    evidenceType: string;
    title: string;
    titleHe?: string;
    description?: string;
    descriptionHe?: string;
    sourceType: string;
    sourceSystem?: string;
    content: Record<string, unknown>;
    parameterName?: string;
    timeRangeFrom?: string;
    timeRangeTo?: string;
    valueMin?: number;
    valueMax?: number;
    valueMean?: number;
    relevance?: string;
    relevanceHe?: string;
    isPinned: boolean;
}
export interface CreateEvidenceParams {
    findingId?: string;
    dossierId?: string;
    flightId?: string;
    sortieId?: string;
    createdBy: string;
    evidenceType?: string;
    title: string;
    titleHe?: string;
    description?: string;
    descriptionHe?: string;
    sourceType?: string;
    sourceSystem?: string;
    content?: Record<string, unknown>;
    parameterName?: string;
    timeRangeFrom?: string;
    timeRangeTo?: string;
    valueMin?: number;
    valueMax?: number;
    valueMean?: number;
    relevance?: string;
    relevanceHe?: string;
    isPinned?: boolean;
}
export interface EvidenceListParams {
    findingId?: string;
    dossierId?: string;
    flightId?: string;
    sortieId?: string;
    createdBy?: string;
    isPinned?: boolean;
    limit?: number;
    offset?: number;
}
export declare const evidenceService: {
    list(params?: EvidenceListParams): {
        items: EvidenceItem[];
        count: number;
    };
    getById(id: string): EvidenceItem | undefined;
    create(params: CreateEvidenceParams): EvidenceItem;
    pin(id: string, isPinned: boolean): EvidenceItem | undefined;
    delete(id: string): boolean;
};
//# sourceMappingURL=evidence-service.d.ts.map