/**
 * Tasks Service — Eagle Insight Local MVP
 */
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'deferred' | 'rejected';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskOutcomeType = 'fixed' | 'replaced' | 'nff' | 'deferred' | 'rejected';
export interface Task {
    id: string;
    title: string;
    findingId?: string;
    assignedTo?: string;
    assignedRole?: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate?: string;
    notes?: string;
    outcome?: string;
    outcomeType?: TaskOutcomeType;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateTaskParams {
    title: string;
    findingId?: string;
    assignedTo?: string;
    assignedRole?: string;
    priority?: TaskPriority;
    dueDate?: string;
    notes?: string;
    createdBy?: string;
}
export declare const tasksService: {
    create(params: CreateTaskParams, actorId?: string, actorRole?: string): Task;
    getById(id: string): Task | null;
    list(opts?: {
        findingId?: string;
        assignedTo?: string;
        status?: TaskStatus | TaskStatus[];
        limit?: number;
        offset?: number;
    }): Task[];
    updateStatus(id: string, newStatus: TaskStatus, actorId: string, actorRole: string, note?: string): Task | null;
    complete(id: string, actorId: string, actorRole: string, outcome: string, outcomeType: TaskOutcomeType): Task | null;
};
//# sourceMappingURL=tasks-service.d.ts.map