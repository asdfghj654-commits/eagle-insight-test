/**
 * Rules Service — Eagle Insight Local MVP
 *
 * Rules are persisted in SQLite.
 * Baseline rules are seeded on startup (see db.ts migrations).
 * Engineer rules are created/modified via the API with approval workflow.
 */
export type RuleStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'deprecated';
export type RuleType = 'baseline' | 'engineer';
export type ThresholdType = 'greater_than' | 'less_than' | 'band' | 'trend' | 'consecutive';
export type RuleContext = 'training' | 'combat' | 'weather_hard' | 'all';
export interface RuleVersion {
    version: number;
    changedAt: string;
    changedBy: string;
    changeType: 'created' | 'modified' | 'threshold_change' | 'status_change';
    changeDescription: string;
    approvedBy?: string;
    approvedAt?: string;
}
export interface RuleMetrics {
    lastRun?: string;
    matchedCount: number;
    impactedAircraft: string[];
    falsePositiveCount: number;
    lastMatchedFlightId?: string;
}
export interface Rule {
    id: string;
    ruleId: string;
    type: RuleType;
    system?: string;
    systemHe?: string;
    parameter: string;
    thresholdType: ThresholdType;
    thresholdValue: number | [number, number];
    unit?: string;
    context: RuleContext;
    referenceDoc?: string;
    clause?: string;
    name?: string;
    description?: string;
    severity: string;
    severityS: string;
    status: RuleStatus;
    version: number;
    versionHistory: RuleVersion[];
    metrics: RuleMetrics;
    createdBy?: string;
    approvedBy?: string;
    approvalStatus: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    updatedAt: string;
}
export interface CreateRuleParams {
    ruleId?: string;
    type?: RuleType;
    system?: string;
    systemHe?: string;
    parameter: string;
    thresholdType: ThresholdType;
    thresholdValue: number | [number, number];
    unit?: string;
    context?: RuleContext;
    referenceDoc?: string;
    clause?: string;
    name?: string;
    description?: string;
    severity: string;
    severityS: string;
    createdBy?: string;
}
export declare const rulesService: {
    create(params: CreateRuleParams, actorId?: string, actorRole?: string): Rule;
    getById(id: string): Rule | null;
    getByRuleId(ruleId: string): Rule | null;
    list(opts?: {
        type?: RuleType;
        status?: RuleStatus | RuleStatus[];
        system?: string;
    }): Rule[];
    listActive(): Rule[];
    approve(id: string, approvedBy: string, approverRole: string): Rule | null;
    updateThreshold(id: string, newThreshold: number | [number, number], actorId: string, actorRole: string, changeDescription: string): Rule | null;
    updateMetrics(ruleId: string, metrics: Partial<RuleMetrics>): void;
};
//# sourceMappingURL=rules-service.d.ts.map