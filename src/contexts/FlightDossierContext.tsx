/**
 * Flight Dossier Context — Eagle Insight Local MVP
 *
 * API-backed implementation.
 * All findings, tasks, and audit log are persisted via the local server.
 * Falls back to empty state (not fake data) when the server is unavailable.
 *
 * Public interface is preserved for UI compatibility.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  FlightDossier,
  Finding,
  FindingStatus,
  Task,
  TaskStatus,
  SeverityLevel,
  UserRole,
  StatusChange,
  AuditEntry,
  AuditAction,
  FilterOptions,
  FINDING_STATUS_CONFIG,
  FleetReadiness,
  AircraftReadiness,
  Blocker,
  RiskItem,
} from '@/types/core';
import {
  findingsApi,
  tasksApi,
  auditApi,
  dossiersApi,
  FindingDto,
  TaskDto,
  AuditEntryDto,
} from '@/lib/api-client';

// =============================================================================
// CONTEXT TYPES (unchanged public interface)
// =============================================================================

interface FlightDossierContextType {
  // Dossiers
  dossiers: FlightDossier[];
  getDossier: (id: string) => FlightDossier | undefined;
  getDossierByFlight: (flightId: string) => FlightDossier | undefined;
  getDossiersByTail: (tailNumber: string) => FlightDossier[];

  // Findings
  findings: Finding[];
  getFinding: (id: string) => Finding | undefined;
  getFindingsForDossier: (dossierId: string) => Finding[];
  getFindingsByTail: (tailNumber: string) => Finding[];
  getFindingsBySeverity: (severity: SeverityLevel) => Finding[];
  getOpenFindings: () => Finding[];
  getFilteredFindings: (filters: FilterOptions) => Finding[];
  getAggregatedFindings: () => AggregatedFinding[];

  // Finding Actions
  acknowledgeFinding: (findingId: string, userId: string, userRole: UserRole, note?: string) => ActionResult;
  updateFindingStatus: (findingId: string, newStatus: FindingStatus, userId: string, userRole: UserRole, note?: string) => ActionResult;
  assignFinding: (findingId: string, assigneeId: string, userId: string, userRole: UserRole) => ActionResult;

  // Tasks
  tasks: Task[];
  getTask: (id: string) => Task | undefined;
  getTasksForFinding: (findingId: string) => Task[];
  getTasksByAssignee: (assigneeId: string) => Task[];
  getOpenTasks: () => Task[];
  getOverdueTasks: () => Task[];

  // Task Actions
  createTaskFromFinding: (findingId: string, task: Partial<Task>, userId: string, userRole: UserRole) => ActionResult<Task>;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus, userId: string, userRole: UserRole, note?: string) => ActionResult;
  completeTask: (taskId: string, userId: string, userRole: UserRole, outcome: string, outcomeType: string) => ActionResult;

  // Fleet Readiness
  getFleetReadiness: () => FleetReadiness;
  getBlockers: () => Blocker[];
  getRiskQueue: () => RiskItem[];

  // Emergency Mode
  emergencyMode: boolean;
  emergencyReason?: string;
  setEmergencyMode: (enabled: boolean, reason: string, userId: string, userRole: UserRole) => ActionResult;

  // Audit
  auditLog: AuditEntry[];

  // Permission Checking
  canPerformAction: (action: string, userRole: UserRole) => boolean;

  // Ingestion bridge — called by CSVDataContext after rules execution
  ingestFindings: (newFindings: Partial<Finding>[]) => Promise<void>;

  isInitialized: boolean;
  isServerConnected: boolean;
  refresh: () => Promise<void>;

  // Legacy compat
  loadDemoData: () => void;
}

interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  errorHe?: string;
  data?: T;
  requiresApproval?: boolean;
}

interface AggregatedFinding {
  key: string;
  title: string;
  titleHe: string;
  severity: SeverityLevel;
  findings: Finding[];
  tailNumbers: string[];
  totalOccurrences: number;
  latestOccurrence: string;
}

// =============================================================================
// PERMISSIONS MATRIX
// =============================================================================

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  technician: ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task'],
  specialist: ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task', 'view_evidence', 'compare_flights', 'escalate_finding'],
  engineer:   ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task', 'view_evidence', 'compare_flights', 'escalate_finding', 'approve_rules', 'modify_thresholds', 'reject_findings', 'approve_finding_rejection'],
  commander:  ['view_all', 'fleet_overview', 'emergency_mode', 'view_pilot_behavior', 'accountability_reports'],
};

// =============================================================================
// CONTEXT
// =============================================================================

const FlightDossierContext = createContext<FlightDossierContextType | undefined>(undefined);

export const FlightDossierProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dossiers, setDossiers] = useState<FlightDossier[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [emergencyMode, setEmergencyModeState] = useState(false);
  const [emergencyReason, setEmergencyReasonState] = useState<string | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(false);

  // ===========================================================================
  // API SYNC — load data from backend on mount
  // ===========================================================================

  const refresh = useCallback(async () => {
    try {
      const [findingsRes, tasksRes] = await Promise.all([
        findingsApi.list({ limit: 500 }),
        tasksApi.list(),
      ]);

      if (findingsRes.ok && findingsRes.data) {
        setFindings(findingsRes.data.findings.map(dtoToFinding));
        setIsServerConnected(true);
      }

      if (tasksRes.ok && tasksRes.data) {
        setTasks(tasksRes.data.tasks.map(dtoToTask));
      }

      // Load audit (non-blocking — engineers/commanders only)
      const auditRes = await auditApi.list(200);
      if (auditRes.ok && auditRes.data) {
        setAuditLog(auditRes.data.entries.map(dtoToAuditEntry));
      }
    } catch {
      // Server unreachable — stay in empty state
      setIsServerConnected(false);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsInitialized(true));
  }, [refresh]);

  // ===========================================================================
  // DOSSIER METHODS
  // ===========================================================================

  const getDossier = useCallback((id: string) =>
    dossiers.find(d => d.id === id), [dossiers]);

  const getDossierByFlight = useCallback((flightId: string) =>
    dossiers.find(d => d.flightId === flightId), [dossiers]);

  const getDossiersByTail = useCallback((tailNumber: string) =>
    dossiers.filter(d => d.tailNumber === tailNumber), [dossiers]);

  // ===========================================================================
  // FINDING METHODS
  // ===========================================================================

  const getFinding = useCallback((id: string) =>
    findings.find(f => f.id === id), [findings]);

  const getFindingsForDossier = useCallback((dossierId: string) =>
    findings.filter(f => f.dossierIds.includes(dossierId)), [findings]);

  const getFindingsByTail = useCallback((tailNumber: string) =>
    findings.filter(f => f.tailNumbers.includes(tailNumber)), [findings]);

  const getFindingsBySeverity = useCallback((severity: SeverityLevel) =>
    findings.filter(f => f.severity === severity), [findings]);

  const getOpenFindings = useCallback(() =>
    findings.filter(f => !['resolved', 'rejected', 'closed'].includes(f.status)), [findings]);

  const getFilteredFindings = useCallback((filters: FilterOptions) => {
    return findings.filter(f => {
      if (filters.tailNumbers?.length && !filters.tailNumbers.some(t => f.tailNumbers.includes(t))) return false;
      if (filters.severities?.length && !filters.severities.includes(f.severity)) return false;
      if (filters.statuses?.length && !filters.statuses.includes(f.status)) return false;
      if (filters.systems?.length && !filters.systems.includes(f.systemAffected)) return false;
      if (!filters.showResolved && ['resolved', 'rejected', 'closed'].includes(f.status)) return false;
      return true;
    });
  }, [findings]);

  const getAggregatedFindings = useCallback((): AggregatedFinding[] => {
    const open = findings.filter(f => !['resolved', 'rejected', 'closed'].includes(f.status));
    const groups = new Map<string, Finding[]>();

    for (const f of open) {
      const key = f.ruleId || f.title;
      groups.set(key, [...(groups.get(key) || []), f]);
    }

    return Array.from(groups.entries()).map(([key, group]) => {
      const severityOrder: SeverityLevel[] = ['S1', 'S2', 'S3', 'S4'];
      const highest = severityOrder.find(s => group.some(f => f.severity === s)) || 'S4';
      const tailNumbers = [...new Set(group.flatMap(f => f.tailNumbers))];
      const latestOccurrence = group.reduce((max, f) => f.createdAt > max ? f.createdAt : max, group[0].createdAt);

      return {
        key,
        title: group[0].title,
        titleHe: group[0].titleHe,
        severity: highest,
        findings: group,
        tailNumbers,
        totalOccurrences: group.length,
        latestOccurrence,
      };
    });
  }, [findings]);

  // ===========================================================================
  // FINDING ACTIONS
  // ===========================================================================

  const acknowledgeFinding = useCallback((
    findingId: string,
    userId: string,
    userRole: UserRole,
    note?: string,
  ): ActionResult => {
    // Optimistic update
    setFindings(prev =>
      prev.map(f =>
        f.id === findingId
          ? {
              ...f,
              status: 'acknowledged' as FindingStatus,
              statusHistory: [
                ...f.statusHistory,
                { from: f.status, to: 'acknowledged' as FindingStatus, changedAt: new Date().toISOString(), changedBy: userId, note },
              ],
            }
          : f
      )
    );

    // Persist to API (fire and forget — data will sync on next refresh)
    findingsApi.updateStatus(findingId, 'acknowledged', note).then(res => {
      if (!res.ok) {
        // Revert on failure
        refresh();
      }
    });

    return { success: true };
  }, [refresh]);

  const updateFindingStatus = useCallback((
    findingId: string,
    newStatus: FindingStatus,
    userId: string,
    userRole: UserRole,
    note?: string,
  ): ActionResult => {
    const finding = findings.find(f => f.id === findingId);
    if (!finding) return { success: false, error: 'Finding not found' };

    // Check permissions
    if (!canPerformAction('update_finding_status', userRole)) {
      return { success: false, error: 'Insufficient permissions', errorHe: 'אין הרשאה' };
    }

    // Optimistic update
    setFindings(prev =>
      prev.map(f =>
        f.id === findingId
          ? {
              ...f,
              status: newStatus,
              statusHistory: [
                ...f.statusHistory,
                { from: f.status, to: newStatus, changedAt: new Date().toISOString(), changedBy: userId, note },
              ],
            }
          : f
      )
    );

    findingsApi.updateStatus(findingId, newStatus, note).then(res => {
      if (!res.ok) refresh();
    });

    return { success: true };
  }, [findings, refresh]);

  const assignFinding = useCallback((
    findingId: string,
    assigneeId: string,
    userId: string,
    userRole: UserRole,
  ): ActionResult => {
    setFindings(prev =>
      prev.map(f => f.id === findingId ? { ...f, assignedTo: assigneeId } : f)
    );

    findingsApi.assign(findingId, assigneeId).then(res => {
      if (!res.ok) refresh();
    });

    return { success: true };
  }, [refresh]);

  // ===========================================================================
  // TASK METHODS
  // ===========================================================================

  const getTask = useCallback((id: string) =>
    tasks.find(t => t.id === id), [tasks]);

  const getTasksForFinding = useCallback((findingId: string) =>
    tasks.filter(t => t.findingId === findingId), [tasks]);

  const getTasksByAssignee = useCallback((assigneeId: string) =>
    tasks.filter(t => t.assignedTo === assigneeId), [tasks]);

  const getOpenTasks = useCallback(() =>
    tasks.filter(t => !['completed', 'rejected'].includes(t.status)), [tasks]);

  const getOverdueTasks = useCallback(() => {
    const now = new Date().toISOString();
    return tasks.filter(t =>
      t.dueDate && t.dueDate < now && !['completed', 'rejected'].includes(t.status)
    );
  }, [tasks]);

  // ===========================================================================
  // TASK ACTIONS
  // ===========================================================================

  const createTaskFromFinding = useCallback((
    findingId: string,
    taskPartial: Partial<Task>,
    userId: string,
    userRole: UserRole,
  ): ActionResult<Task> => {
    const finding = findings.find(f => f.id === findingId);
    if (!finding) return { success: false, error: 'Finding not found' };

    const payload = {
      title: taskPartial.title || `Task for: ${finding.title}`,
      findingId,
      assignedTo: taskPartial.assignedTo,
      assignedRole: taskPartial.assignedRole,
      priority: taskPartial.priority as string || 'medium',
      dueDate: taskPartial.dueDate,
      notes: taskPartial.description,
    };

    tasksApi.create(payload).then(res => {
      if (res.ok && res.data) {
        setTasks(prev => [...prev, dtoToTask(res.data!.task)]);
      }
    });

    return { success: true };
  }, [findings]);

  const updateTaskStatus = useCallback((
    taskId: string,
    newStatus: TaskStatus,
    userId: string,
    userRole: UserRole,
    note?: string,
  ): ActionResult => {
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    );

    tasksApi.updateStatus(taskId, newStatus, note).then(res => {
      if (!res.ok) refresh();
    });

    return { success: true };
  }, [refresh]);

  const completeTask = useCallback((
    taskId: string,
    userId: string,
    userRole: UserRole,
    outcome: string,
    outcomeType: string,
  ): ActionResult => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId ? { ...t, status: 'completed' as TaskStatus, outcome, outcomeType } : t
      )
    );

    tasksApi.complete(taskId, outcome, outcomeType).then(res => {
      if (!res.ok) refresh();
    });

    return { success: true };
  }, [refresh]);

  // ===========================================================================
  // FLEET READINESS (derived from real findings)
  // ===========================================================================

  const getFleetReadiness = useCallback((): FleetReadiness => {
    const openFindings = findings.filter(f => !['resolved', 'rejected', 'closed'].includes(f.status));
    const aircraftIds = [...new Set([
      ...findings.flatMap(f => f.tailNumbers),
      ...tasks.flatMap(t => t.tailNumbers || []),
    ])];

    const aircraftReadiness: AircraftReadiness[] = aircraftIds.map(tail => {
      const acFindings = openFindings.filter(f => f.tailNumbers.includes(tail));
      const acTasks = tasks.filter(t => (t.tailNumbers || []).includes(tail) && !['completed', 'cancelled'].includes(t.status));
      const hasS1 = acFindings.some(f => f.severity === 'S1');
      const hasS2 = acFindings.some(f => f.severity === 'S2');
      const status: 'ready' | 'degraded' | 'grounded' = hasS1 ? 'grounded' : hasS2 ? 'degraded' : 'ready';

      return {
        tailNumber: tail,
        status,
        statusHe: status === 'grounded' ? 'מושבת' : status === 'degraded' ? 'מוגבל' : 'מוכן',
        blockers: acFindings.filter(f => f.severity === 'S1').map(f => f.title),
        openFindings: acFindings.length,
        openTasks: acTasks.length,
      };
    });

    const groundedAircraft = aircraftReadiness.filter(a => a.status === 'grounded').length;
    const degradedAircraft = aircraftReadiness.filter(a => a.status === 'degraded').length;
    const readyAircraft = aircraftReadiness.filter(a => a.status === 'ready').length;
    const totalAircraft = aircraftReadiness.length;
    const readinessPercentage = totalAircraft === 0 ? 0 : Math.round((readyAircraft / totalAircraft) * 100);

    return {
      timestamp: new Date().toISOString(),
      totalAircraft,
      readyAircraft,
      degradedAircraft,
      groundedAircraft,
      readinessPercentage,
      aircraftStatus: aircraftReadiness,
      blockers: openFindings
        .filter(f => f.severity === 'S1')
        .flatMap(f => (f.tailNumbers.length ? f.tailNumbers : ['UNKNOWN']).map(tailNumber => ({
          id: `${f.id}:${tailNumber}`,
          tailNumber,
          severity: f.severity,
          description: f.description,
          descriptionHe: f.descriptionHe || f.titleHe,
          findingId: f.id,
          assignedTo: f.assignedTo,
          blockedSince: f.createdAt,
        }))),
      riskQueue: openFindings
        .filter(f => ['S1', 'S2'].includes(f.severity))
        .map(f => ({
          id: f.id,
          severity: f.severity,
          tailNumbers: f.tailNumbers,
          description: f.description,
          descriptionHe: f.descriptionHe || f.titleHe,
          findingId: f.id,
          status: f.status,
          assignedTo: f.assignedTo,
        })),
      accountability: [],
      emergencyMode,
      emergencyReason,
    };
  }, [findings, tasks, emergencyMode, emergencyReason]);

  const getBlockers = useCallback((): Blocker[] => {
    return findings
      .filter(f => f.severity === 'S1' && !['resolved', 'rejected', 'closed'].includes(f.status))
      .flatMap(f => (f.tailNumbers.length ? f.tailNumbers : ['UNKNOWN']).map(tailNumber => ({
        id: `${f.id}:${tailNumber}`,
        tailNumber,
        severity: f.severity,
        description: f.description,
        descriptionHe: f.descriptionHe || f.titleHe,
        findingId: f.id,
        assignedTo: f.assignedTo,
        blockedSince: f.createdAt,
      })));
  }, [findings]);

  const getRiskQueue = useCallback((): RiskItem[] => {
    return findings
      .filter(f => ['S1', 'S2'].includes(f.severity) && !['resolved', 'rejected', 'closed'].includes(f.status))
      .map(f => ({
        id: f.id,
        severity: f.severity,
        tailNumbers: f.tailNumbers,
        description: f.description,
        descriptionHe: f.descriptionHe || f.titleHe,
        findingId: f.id,
        status: f.status,
        assignedTo: f.assignedTo,
      }));
  }, [findings]);

  // ===========================================================================
  // EMERGENCY MODE
  // ===========================================================================

  const setEmergencyMode = useCallback((
    enabled: boolean,
    reason: string,
    userId: string,
    userRole: UserRole,
  ): ActionResult => {
    if (userRole !== 'commander') {
      return { success: false, error: 'Only commanders can toggle emergency mode', errorHe: 'רק מפקד יכול להפעיל מצב חירום' };
    }
    setEmergencyModeState(enabled);
    setEmergencyReasonState(enabled ? reason : undefined);
    return { success: true };
  }, []);

  // ===========================================================================
  // PERMISSIONS
  // ===========================================================================

  const canPerformAction = useCallback((action: string, userRole: UserRole): boolean => {
    const perms = ROLE_PERMISSIONS[userRole] || [];
    return perms.includes(action) || perms.includes('view_all');
  }, []);

  // ===========================================================================
  // INGESTION BRIDGE
  // Called by useDashboardData after rules execution on CSV data
  // ===========================================================================

  const ingestFindings = useCallback(async (newFindings: Partial<Finding>[]) => {
    if (newFindings.length === 0) return;

    const payloads = newFindings.map(f => ({
      title: f.title || 'Untitled Finding',
      titleHe: f.titleHe,
      summary: f.description,
      summaryHe: f.descriptionHe,
      severity: (f.severity || 'S3') as string,
      classification: f.category,
      sourceType: (f.evidence?.[0]?.sourceType || 'measured') as string,
      aircraftId: f.tailNumbers?.[0],
      flightId: f.dossierIds?.[0],
      ruleId: f.ruleId,
      generatedBy: 'rules-engine',
    }));

    const res = await findingsApi.bulkCreate(payloads);
    if (res.ok) {
      await refresh();
    }
  }, [refresh]);

  // ===========================================================================
  // LEGACY COMPAT
  // ===========================================================================

  const loadDemoData = useCallback(() => {
    console.error('[FlightDossierContext] Demo data is disabled. Connect the local server and load real data.');
    throw new Error('Demo mode is disabled. Use real data sources.');
  }, []);

  // ===========================================================================
  // VALUE
  // ===========================================================================

  const value: FlightDossierContextType = {
    dossiers,
    getDossier,
    getDossierByFlight,
    getDossiersByTail,

    findings,
    getFinding,
    getFindingsForDossier,
    getFindingsByTail,
    getFindingsBySeverity,
    getOpenFindings,
    getFilteredFindings,
    getAggregatedFindings,

    acknowledgeFinding,
    updateFindingStatus,
    assignFinding,

    tasks,
    getTask,
    getTasksForFinding,
    getTasksByAssignee,
    getOpenTasks,
    getOverdueTasks,

    createTaskFromFinding,
    updateTaskStatus,
    completeTask,

    getFleetReadiness,
    getBlockers,
    getRiskQueue,

    emergencyMode,
    emergencyReason,
    setEmergencyMode,

    auditLog,
    canPerformAction,
    ingestFindings,
    isInitialized,
    isServerConnected,
    refresh,
    loadDemoData,
  };

  return (
    <FlightDossierContext.Provider value={value}>
      {children}
    </FlightDossierContext.Provider>
  );
};

// =============================================================================
// HOOKS
// =============================================================================

export const useFlightDossier = () => {
  const ctx = useContext(FlightDossierContext);
  if (!ctx) throw new Error('useFlightDossier must be used within FlightDossierProvider');
  return ctx;
};

// =============================================================================
// DTO ADAPTERS — map backend DTOs to frontend UI types
// =============================================================================

function dtoToFinding(dto: FindingDto): Finding {
  const now = new Date().toISOString();
  return {
    id: dto.id,
    dossierIds: dto.dossierId ? [dto.dossierId] : [],
    severity: (dto.severity as SeverityLevel) || 'S3',
    confidence: {
      value: 85,
      factors: [],
      dataQuality: dto.sourceType === 'measured' ? 'complete' : 'partial',
      dataQualityHe: dto.sourceType === 'measured' ? 'מלא' : 'חלקי',
    },
    category: (dto.classification as any) || 'rule_violation',
    title: dto.title,
    titleHe: dto.titleHe || dto.title,
    description: dto.summary || '',
    descriptionHe: dto.summaryHe || dto.summary || '',
    technicalDetail: dto.summary || '',
    systemAffected: dto.classification || dto.ruleId || 'General',
    systemAffectedHe: dto.classification || dto.ruleId || 'כללי',
    tailNumbers: dto.aircraftId ? [dto.aircraftId] : [],
    scope: {
      type: 'single_flight',
      typeHe: 'טיסה בודדת',
      flightCount: 1,
      aircraftCount: dto.aircraftId ? 1 : 0,
    },
    recommendation: dto.reviewNotes || '',
    recommendationHe: dto.reviewNotes || '',
    requiredAction: {
      type: dto.severity === 'S1' ? 'immediate' : dto.severity === 'S2' ? 'before_next_sortie' : 'monitor',
      typeHe: dto.severity === 'S1' ? 'מיידי' : dto.severity === 'S2' ? 'לפני הגיחה הבאה' : 'ניטור',
      description: '',
      descriptionHe: '',
    },
    evidence: (dto.evidenceRefs || []).map((ref: string) => ({
      id: ref,
      type: 'parameter_chart' as any,
      title: ref,
      titleHe: ref,
      sourceType: 'measured' as any,
      sourceSystem: 'CSV',
      contentType: 'chart' as any,
    })),
    ruleId: dto.ruleId,
    status: mapStatus(dto.status),
    statusHistory: [],
    occurrences: 1,
    isRecurring: false,
    relatedFindingIds: dto.taskIds || [],
    createdAt: dto.createdAt || now,
    updatedAt: dto.updatedAt || now,
    createdBy: dto.generatedBy || 'system',
    assignedTo: dto.assignedTo,
    pilotNameLocked: false,
    commanderVisibilityOnly: dto.severity === 'S1',
  };
}

function dtoToTask(dto: TaskDto): Task {
  const now = new Date().toISOString();
  return {
    id: dto.id,
    findingId: dto.findingId || '',
    dossierIds: dto.dossierId ? [dto.dossierId] : [],
    tailNumbers: dto.aircraftId ? [dto.aircraftId] : [],
    title: dto.title,
    titleHe: dto.title,
    description: dto.notes || '',
    descriptionHe: dto.notes || '',
    assignedTo: dto.assignedTo || '',
    assignedRole: (dto.assignedRole as UserRole) || 'technician',
    assignedAt: dto.createdAt || now,
    assignedBy: dto.createdBy || 'system',
    dueType: dto.dueDate ? 'date' : 'before_sortie',
    dueTypeHe: dto.dueDate ? 'תאריך' : 'לפני הגיחה',
    status: (dto.status as TaskStatus) || 'open',
    dueDate: dto.dueDate,
    outcome: dto.outcome,
    outcomeHe: dto.outcome,
    statusHistory: [],
    createdAt: dto.createdAt || now,
    updatedAt: dto.updatedAt || now,
  };
}

function dtoToAuditEntry(dto: AuditEntryDto): AuditEntry {
  return {
    id: dto.id,
    timestamp: dto.timestamp,
    userId: dto.actorId || 'system',
    userName: dto.actorId || 'system',
    userRole: (dto.actorRole as UserRole) || 'technician',
    action: dto.action as AuditAction,
    actionHe: dto.action,
    targetType: dto.entityType as any,
    targetId: dto.entityId || '',
    previousValue: dto.oldValue,
    newValue: dto.newValue,
    note: dto.note,
    requiresApproval: dto.approvalRequired || false,
  };
}

function mapStatus(apiStatus: string): FindingStatus {
  // Map API statuses to UI statuses
  const map: Record<string, FindingStatus> = {
    new: 'new',
    acknowledged: 'acknowledged',
    under_review: 'in_progress',
    escalated: 'escalated',
    resolved: 'resolved',
    rejected: 'rejected',
    closed: 'closed',
    in_progress: 'in_progress',
  };
  return map[apiStatus] || 'new';
}
