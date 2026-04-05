/**
 * Findings Service — Eagle Insight Local MVP
 *
 * Findings are the core domain object.
 * Every finding must be backed by real rule execution or explicit manual entry.
 * No fabricated findings — empty is better than fake.
 */
export type FindingStatus = 'new' | 'acknowledged' | 'under_review' | 'escalated' | 'resolved' | 'rejected' | 'closed';
export type SeverityLevel = 'S1' | 'S2' | 'S3' | 'S4';
export interface Finding {
    id: string;
    title: string;
    titleHe?: string;
    summary?: string;
    summaryHe?: string;
    severity: SeverityLevel;
    classification?: string;
    sourceType: 'measured' | 'reported';
    aircraftId?: string;
    flightId?: string;
    dossierId?: string;
    ruleId?: string;
    evidenceRefs: string[];
    status: FindingStatus;
    assignedTo?: string;
    generatedBy?: string;
    reviewNotes?: string;
    escalationInfo?: string;
    taskIds: string[];
    createdAt: string;
    updatedAt: string;
}
export interface CreateFindingParams {
    title: string;
    titleHe?: string;
    summary?: string;
    summaryHe?: string;
    severity: SeverityLevel;
    classification?: string;
    sourceType?: 'measured' | 'reported';
    aircraftId?: string;
    flightId?: string;
    dossierId?: string;
    ruleId?: string;
    evidenceRefs?: string[];
    generatedBy?: string;
}
export declare const findingsService: {
    create(params: CreateFindingParams, actorId?: string, actorRole?: string): Finding;
    getById(id: string): Finding | null;
    list(opts?: {
        status?: FindingStatus | FindingStatus[];
        severity?: SeverityLevel | SeverityLevel[];
        aircraftId?: string;
        flightId?: string;
        dossierId?: string;
        assignedTo?: string;
        limit?: number;
        offset?: number;
    }): Finding[];
    updateStatus(id: string, newStatus: FindingStatus, actorId: string, actorRole: string, note?: string): Finding | null;
    assign(id: string, assigneeId: string, actorId: string, actorRole: string): Finding | null;
    addTaskId(findingId: string, taskId: string): void;
    getStats(): {
        total: number;
        byStatus: Record<string, number>;
        bySeverity: Record<string, number>;
        open: number;
    };
};
//# sourceMappingURL=findings-service.d.ts.map