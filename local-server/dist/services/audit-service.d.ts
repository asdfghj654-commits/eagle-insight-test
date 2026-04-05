/**
 * Audit Service — Eagle Insight Local MVP
 *
 * Every meaningful state change must produce an audit entry.
 * Entries are immutable once written.
 */
export interface AuditEntry {
    id: string;
    actorId?: string;
    actorRole?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    note?: string;
    approvalRequired?: boolean;
    relatedFinding?: string;
    relatedTask?: string;
    relatedRule?: string;
    timestamp: string;
}
export interface WriteAuditParams {
    actorId?: string;
    actorRole?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    note?: string;
    approvalRequired?: boolean;
    relatedFinding?: string;
    relatedTask?: string;
    relatedRule?: string;
}
export declare const auditService: {
    write(params: WriteAuditParams): string;
    query(opts: {
        entityType?: string;
        entityId?: string;
        actorId?: string;
        relatedFinding?: string;
        limit?: number;
        offset?: number;
    }): AuditEntry[];
    getAll(limit?: number, offset?: number): AuditEntry[];
};
//# sourceMappingURL=audit-service.d.ts.map