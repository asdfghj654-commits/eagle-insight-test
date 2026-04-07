/**
 * Flight Dossier Context
 * 
 * Manages the core domain objects:
 * - Flight Dossiers (תיק טיסה)
 * - Findings (ממצאים)
 * - Tasks (משימות)
 * 
 * Implements the PRD requirements:
 * - Status Lifecycle with audit trail
 * - Governance & Approval workflows
 * - Two sources of truth (Measured vs Reported)
 * - Role-based filtering
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  FlightDossier,
  Finding,
  FindingStatus,
  Task,
  TaskStatus,
  SeverityLevel,
  UserRole,
  StatusChange,
  TaskStatusChange,
  AuditEntry,
  AuditAction,
  FilterOptions,
  PaginatedResult,
  FINDING_STATUS_CONFIG,
  FleetReadiness,
  AircraftReadiness,
  Blocker,
  RiskItem,
} from '@/types/core';

// =============================================================================
// CONTEXT TYPES
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
  updateFindingStatus: (findingId: string, newStatus: FindingStatus, userId: string, userRole: UserRole, note?: string, approvedBy?: string) => ActionResult;
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
  completeTask: (taskId: string, userId: string, userRole: UserRole, outcome: string, outcomeType: TaskOutcomeType) => ActionResult;
  
  // Fleet Readiness (Commander View)
  getFleetReadiness: () => FleetReadiness;
  getBlockers: () => Blocker[];
  getRiskQueue: () => RiskItem[];
  
  // Emergency Mode
  emergencyMode: boolean;
  setEmergencyMode: (enabled: boolean, reason: string, userId: string, userRole: UserRole) => ActionResult;
  
  // Audit
  auditLog: AuditEntry[];
  
  // Permission Checking
  canPerformAction: (action: string, userRole: UserRole) => boolean;
  
  // Demo Data
  loadDemoData: () => void;
  isInitialized: boolean;
}

// Action Result type for proper error handling
interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  errorHe?: string;
  data?: T;
  requiresApproval?: boolean;
}

// Aggregated Finding for grouping similar issues
interface AggregatedFinding {
  key: string; // e.g., "LAND_001" or title hash
  title: string;
  titleHe: string;
  severity: SeverityLevel;
  findings: Finding[];
  tailNumbers: string[];
  totalOccurrences: number;
  latestOccurrence: string;
}

// Task Outcome Types for closed-loop tracking
type TaskOutcomeType = 
  | 'fixed'           // תוקן
  | 'replaced'        // הוחלף רכיב
  | 'nff'             // No Fault Found
  | 'deferred'        // נדחה לתחזוקה מתוכננת
  | 'rejected'        // נדחה - לא נדרשת פעולה
  | 'other';          // אחר

const TASK_OUTCOME_LABELS: Record<TaskOutcomeType, { label: string; labelHe: string }> = {
  fixed: { label: 'Fixed', labelHe: 'תוקן' },
  replaced: { label: 'Component Replaced', labelHe: 'הוחלף רכיב' },
  nff: { label: 'No Fault Found', labelHe: 'לא נמצאה תקלה' },
  deferred: { label: 'Deferred', labelHe: 'נדחה לתחזוקה מתוכננת' },
  rejected: { label: 'Rejected', labelHe: 'נדחה - לא נדרשת פעולה' },
  other: { label: 'Other', labelHe: 'אחר' },
};

// =============================================================================
// PERMISSIONS MATRIX
// =============================================================================

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  technician: [
    'view_findings',
    'ack_findings',
    'add_notes',
    'create_tasks',
    'update_task_status',
    'complete_task',
  ],
  specialist: [
    'view_findings',
    'ack_findings',
    'add_notes',
    'create_tasks',
    'update_task_status',
    'complete_task',
    'view_evidence',
    'compare_flights',
    'escalate_finding',
  ],
  engineer: [
    'view_findings',
    'ack_findings',
    'add_notes',
    'create_tasks',
    'update_task_status',
    'complete_task',
    'view_evidence',
    'compare_flights',
    'escalate_finding',
    'approve_rules',
    'modify_thresholds',
    'reject_findings',
    'approve_finding_rejection',
  ],
  commander: [
    'view_all',
    'fleet_overview',
    'emergency_mode',
    'view_pilot_behavior',
    'accountability_reports',
  ],
};

const FlightDossierContext = createContext<FlightDossierContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

interface FlightDossierProviderProps {
  children: ReactNode;
}

export const FlightDossierProvider: React.FC<FlightDossierProviderProps> = ({ children }) => {
  // State
  const [dossiers, setDossiers] = useState<FlightDossier[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [emergencyMode, setEmergencyModeState] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState<string>();
  const [isInitialized, setIsInitialized] = useState(false);

  // =============================================================================
  // PRODUCTION: NO AUTO-LOAD OF DEMO DATA
  // Demo data may only be loaded when explicitly requested
  // =============================================================================
  
  React.useEffect(() => {
    if (!isInitialized) {
      // PRODUCTION: Initialize with empty state - NO auto demo loading
      // Findings/tasks should come from CSV processing or explicit demo load
      setIsInitialized(true);
      console.log('FlightDossierContext initialized with empty state (production mode)');
    }
  }, [isInitialized]);

  // =============================================================================
  // AUDIT HELPER
  // =============================================================================
  
  const addAuditEntry = useCallback((
    action: AuditAction,
    targetType: AuditEntry['targetType'],
    targetId: string,
    userId: string,
    userRole: UserRole,
    userName: string,
    previousValue?: any,
    newValue?: any,
    note?: string,
    requiresApproval?: boolean,
    approvedBy?: string
  ) => {
    const entry: AuditEntry = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId,
      userName,
      userRole,
      action,
      actionHe: getActionHebrewLabel(action),
      targetType,
      targetId,
      previousValue,
      newValue,
      note,
      requiresApproval: requiresApproval || false,
      approvedBy,
      approvedAt: approvedBy ? new Date().toISOString() : undefined,
    };
    
    setAuditLog(prev => [entry, ...prev]);
  }, []);

  // =============================================================================
  // DOSSIER METHODS
  // =============================================================================
  
  const getDossier = useCallback((id: string) => {
    return dossiers.find(d => d.id === id);
  }, [dossiers]);

  const getDossierByFlight = useCallback((flightId: string) => {
    return dossiers.find(d => d.flightId === flightId);
  }, [dossiers]);

  const getDossiersByTail = useCallback((tailNumber: string) => {
    return dossiers.filter(d => d.tailNumber === tailNumber);
  }, [dossiers]);

  // =============================================================================
  // FINDING METHODS
  // =============================================================================
  
  const getFinding = useCallback((id: string) => {
    return findings.find(f => f.id === id);
  }, [findings]);

  const getFindingsForDossier = useCallback((dossierId: string) => {
    return findings.filter(f => f.dossierIds.includes(dossierId));
  }, [findings]);

  const getFindingsByTail = useCallback((tailNumber: string) => {
    return findings.filter(f => f.tailNumbers.includes(tailNumber));
  }, [findings]);

  const getFindingsBySeverity = useCallback((severity: SeverityLevel) => {
    return findings.filter(f => f.severity === severity);
  }, [findings]);

  const getOpenFindings = useCallback(() => {
    return findings.filter(f => 
      !['resolved', 'rejected', 'closed'].includes(f.status)
    );
  }, [findings]);

  const getFilteredFindings = useCallback((filters: FilterOptions) => {
    return findings.filter(f => {
      if (filters.tailNumbers?.length && !filters.tailNumbers.some(t => f.tailNumbers.includes(t))) {
        return false;
      }
      if (filters.severities?.length && !filters.severities.includes(f.severity)) {
        return false;
      }
      if (filters.statuses?.length && !filters.statuses.includes(f.status)) {
        return false;
      }
      if (filters.systems?.length && !filters.systems.includes(f.systemAffected)) {
        return false;
      }
      if (filters.assignedTo?.length && f.assignedTo && !filters.assignedTo.includes(f.assignedTo)) {
        return false;
      }
      if (!filters.showResolved && ['resolved', 'rejected', 'closed'].includes(f.status)) {
        return false;
      }
      return true;
    });
  }, [findings]);

  // =============================================================================
  // AGGREGATION - Group similar findings across aircraft
  // =============================================================================
  
  const getAggregatedFindings = useCallback((): AggregatedFinding[] => {
    const openFindings = findings.filter(f => !['resolved', 'rejected', 'closed'].includes(f.status));
    
    // Group by rule ID (if exists) or by title
    const groups = new Map<string, Finding[]>();
    
    for (const finding of openFindings) {
      const key = finding.ruleId || finding.title;
      const existing = groups.get(key) || [];
      existing.push(finding);
      groups.set(key, existing);
    }

    // Convert to aggregated findings
    const aggregated: AggregatedFinding[] = [];
    
    for (const [key, groupFindings] of groups) {
      // Get all unique tail numbers
      const tailNumbers = [...new Set(groupFindings.flatMap(f => f.tailNumbers))];
      
      // Find the highest severity in the group
      const severityOrder: SeverityLevel[] = ['S1', 'S2', 'S3', 'S4'];
      const highestSeverity = severityOrder.find(s => 
        groupFindings.some(f => f.severity === s)
      ) || 'S4';

      // Find latest occurrence
      const latestOccurrence = groupFindings.reduce((latest, f) => 
        f.createdAt > latest ? f.createdAt : latest, 
        groupFindings[0].createdAt
      );

      aggregated.push({
        key,
        title: groupFindings[0].title,
        titleHe: groupFindings[0].titleHe,
        severity: highestSeverity,
        findings: groupFindings,
        tailNumbers,
        totalOccurrences: groupFindings.length,
        latestOccurrence,
      });
    }

    // Sort by severity (S1 first) then by occurrences
    return aggregated.sort((a, b) => {
      const severityOrder: SeverityLevel[] = ['S1', 'S2', 'S3', 'S4'];
      const severityDiff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      if (severityDiff !== 0) return severityDiff;
      return b.totalOccurrences - a.totalOccurrences;
    });
  }, [findings]);

  // =============================================================================
  // PERMISSION CHECKING
  // =============================================================================

  const canPerformAction = useCallback((action: string, userRole: UserRole): boolean => {
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(action) || permissions.includes('view_all');
  }, []);

  // =============================================================================
  // FINDING ACTIONS (with role enforcement)
  // =============================================================================
  
  const acknowledgeFinding = useCallback((
    findingId: string, 
    userId: string, 
    userRole: UserRole,
    userName?: string,
    note?: string
  ): ActionResult => {
    // Permission check
    if (!canPerformAction('ack_findings', userRole)) {
      return { 
        success: false, 
        error: 'Permission denied: Cannot acknowledge findings',
        errorHe: 'אין הרשאה: לא ניתן להכיר ממצאים'
      };
    }

    const finding = findings.find(f => f.id === findingId);
    if (!finding) {
      return { success: false, error: 'Finding not found', errorHe: 'ממצא לא נמצא' };
    }
    
    if (finding.status !== 'new') {
      return { success: false, error: 'Finding already acknowledged', errorHe: 'ממצא כבר הוכר' };
    }

    const statusChange: StatusChange = {
      from: 'new',
      to: 'acknowledged',
      changedAt: new Date().toISOString(),
      changedBy: userName || userId,
      note,
    };

    setFindings(prev => prev.map(f => 
      f.id === findingId 
        ? { 
            ...f, 
            status: 'acknowledged' as FindingStatus,
            statusHistory: [...f.statusHistory, statusChange],
            updatedAt: new Date().toISOString(),
          }
        : f
    ));

    addAuditEntry('status_change', 'finding', findingId, userId, userRole, userName || userId, 'new', 'acknowledged', note);
    return { success: true };
  }, [findings, addAuditEntry, canPerformAction]);

  const updateFindingStatus = useCallback((
    findingId: string, 
    newStatus: FindingStatus, 
    userId: string, 
    userRole: UserRole,
    userName?: string,
    note?: string,
    approvedBy?: string
  ): ActionResult => {
    const finding = findings.find(f => f.id === findingId);
    if (!finding) {
      return { success: false, error: 'Finding not found', errorHe: 'ממצא לא נמצא' };
    }

    const config = FINDING_STATUS_CONFIG[finding.status];
    if (!config.allowedTransitions.includes(newStatus)) {
      return { 
        success: false, 
        error: `Invalid status transition: ${finding.status} -> ${newStatus}`,
        errorHe: `מעבר סטטוס לא חוקי: ${finding.status} -> ${newStatus}`
      };
    }

    const targetConfig = FINDING_STATUS_CONFIG[newStatus];
    
    // Check if rejection requires engineer approval
    if (newStatus === 'rejected' && !canPerformAction('reject_findings', userRole)) {
      return { 
        success: false, 
        error: 'Permission denied: Only engineers can reject findings',
        errorHe: 'אין הרשאה: רק מהנדסים יכולים לדחות ממצאים'
      };
    }

    // Check if escalation is allowed
    if (newStatus === 'escalated' && !canPerformAction('escalate_finding', userRole)) {
      return { 
        success: false, 
        error: 'Permission denied: Cannot escalate findings',
        errorHe: 'אין הרשאה: לא ניתן להסלים ממצאים'
      };
    }

    if (targetConfig.requiresApproval && !approvedBy) {
      return { 
        success: false, 
        requiresApproval: true,
        error: `Status ${newStatus} requires engineer approval`,
        errorHe: `סטטוס ${newStatus} דורש אישור מהנדס`
      };
    }

    if (targetConfig.requiresNote && !note) {
      return { 
        success: false, 
        error: `Status ${newStatus} requires a note`,
        errorHe: `סטטוס ${newStatus} דורש הערה`
      };
    }

    const statusChange: StatusChange = {
      from: finding.status,
      to: newStatus,
      changedAt: new Date().toISOString(),
      changedBy: userName || userId,
      note,
      approvedBy,
    };

    setFindings(prev => prev.map(f => 
      f.id === findingId 
        ? { 
            ...f, 
            status: newStatus,
            statusHistory: [...f.statusHistory, statusChange],
            updatedAt: new Date().toISOString(),
          }
        : f
    ));

    addAuditEntry('status_change', 'finding', findingId, userId, userRole, userName || userId, finding.status, newStatus, note, targetConfig.requiresApproval, approvedBy);
    return { success: true };
  }, [findings, addAuditEntry, canPerformAction]);

  const assignFinding = useCallback((
    findingId: string, 
    assigneeId: string, 
    userId: string,
    userRole: UserRole,
    userName?: string
  ): ActionResult => {
    if (!canPerformAction('ack_findings', userRole)) {
      return { 
        success: false, 
        error: 'Permission denied',
        errorHe: 'אין הרשאה'
      };
    }

    const finding = findings.find(f => f.id === findingId);
    if (!finding) {
      return { success: false, error: 'Finding not found', errorHe: 'ממצא לא נמצא' };
    }

    const previousAssignee = finding.assignedTo;
    
    setFindings(prev => prev.map(f => 
      f.id === findingId 
        ? { 
            ...f, 
            assignedTo: assigneeId,
            updatedAt: new Date().toISOString(),
          }
        : f
    ));

    addAuditEntry('assign', 'finding', findingId, userId, userRole, userName || userId, previousAssignee, assigneeId);
    return { success: true };
  }, [findings, addAuditEntry, canPerformAction]);

  // =============================================================================
  // TASK METHODS
  // =============================================================================
  
  const getTask = useCallback((id: string) => {
    return tasks.find(t => t.id === id);
  }, [tasks]);

  const getTasksForFinding = useCallback((findingId: string) => {
    return tasks.filter(t => t.findingId === findingId);
  }, [tasks]);

  const getTasksByAssignee = useCallback((assigneeId: string) => {
    return tasks.filter(t => t.assignedTo === assigneeId);
  }, [tasks]);

  const getOpenTasks = useCallback(() => {
    return tasks.filter(t => !['completed', 'cancelled'].includes(t.status));
  }, [tasks]);

  const getOverdueTasks = useCallback(() => {
    const now = new Date();
    return tasks.filter(t => {
      if (['completed', 'cancelled'].includes(t.status)) return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    });
  }, [tasks]);

  // =============================================================================
  // TASK ACTIONS (with role enforcement and structured outcomes)
  // =============================================================================
  
  const createTaskFromFinding = useCallback((
    findingId: string, 
    taskData: Partial<Task>, 
    userId: string,
    userRole: UserRole,
    userName?: string
  ): ActionResult<Task> => {
    if (!canPerformAction('create_tasks', userRole)) {
      return { 
        success: false, 
        error: 'Permission denied: Cannot create tasks',
        errorHe: 'אין הרשאה: לא ניתן ליצור משימות'
      };
    }

    const finding = findings.find(f => f.id === findingId);
    if (!finding) {
      return { success: false, error: 'Finding not found', errorHe: 'ממצא לא נמצא' };
    }

    const newTask: Task = {
      id: `TSK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      findingId,
      dossierIds: finding.dossierIds,
      tailNumbers: finding.tailNumbers,
      title: taskData.title || finding.title,
      titleHe: taskData.titleHe || finding.titleHe,
      description: taskData.description || finding.recommendation,
      descriptionHe: taskData.descriptionHe || finding.recommendationHe,
      assignedTo: taskData.assignedTo || (userName || userId),
      assignedRole: taskData.assignedRole || 'technician',
      assignedAt: new Date().toISOString(),
      assignedBy: userName || userId,
      dueType: taskData.dueType || 'before_sortie',
      dueTypeHe: taskData.dueTypeHe || 'לפני הגיחה הבאה',
      dueDate: taskData.dueDate,
      status: 'open',
      statusHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTasks(prev => [...prev, newTask]);
    addAuditEntry('create', 'task', newTask.id, userId, userRole, userName || userId);
    
    return { success: true, data: newTask };
  }, [findings, addAuditEntry, canPerformAction]);

  const updateTaskStatus = useCallback((
    taskId: string, 
    newStatus: TaskStatus, 
    userId: string, 
    userRole: UserRole,
    userName?: string,
    note?: string
  ): ActionResult => {
    if (!canPerformAction('update_task_status', userRole)) {
      return { 
        success: false, 
        error: 'Permission denied',
        errorHe: 'אין הרשאה'
      };
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found', errorHe: 'משימה לא נמצאה' };
    }

    const statusChange: TaskStatusChange = {
      from: task.status,
      to: newStatus,
      changedAt: new Date().toISOString(),
      changedBy: userName || userId,
      note,
    };

    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { 
            ...t, 
            status: newStatus,
            statusHistory: [...t.statusHistory, statusChange],
            updatedAt: new Date().toISOString(),
          }
        : t
    ));

    addAuditEntry('status_change', 'task', taskId, userId, userRole, userName || userId, task.status, newStatus, note);
    return { success: true };
  }, [tasks, addAuditEntry, canPerformAction]);

  const completeTask = useCallback((
    taskId: string, 
    userId: string, 
    userRole: UserRole,
    userName?: string,
    outcome?: string,
    outcomeType?: TaskOutcomeType
  ): ActionResult => {
    if (!canPerformAction('complete_task', userRole)) {
      return { 
        success: false, 
        error: 'Permission denied',
        errorHe: 'אין הרשאה'
      };
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found', errorHe: 'משימה לא נמצאה' };
    }

    // Build structured outcome
    const effectiveOutcomeType = outcomeType || 'fixed';
    const outcomeLabel = TASK_OUTCOME_LABELS[effectiveOutcomeType];
    const structuredOutcome = outcome ? `[${outcomeLabel.labelHe}] ${outcome}` : outcomeLabel.labelHe;

    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { 
            ...t, 
            status: 'completed' as TaskStatus,
            completedAt: new Date().toISOString(),
            completedBy: userName || userId,
            outcome: structuredOutcome,
            outcomeHe: structuredOutcome,
            updatedAt: new Date().toISOString(),
          }
        : t
    ));

    addAuditEntry('status_change', 'task', taskId, userId, userRole, userName || userId, task.status, 'completed', structuredOutcome);
    return { success: true };
  }, [tasks, addAuditEntry, canPerformAction]);

  // =============================================================================
  // FLEET READINESS
  // =============================================================================
  
  const getFleetReadiness = useCallback((): FleetReadiness => {
    const tailNumbers = [...new Set(dossiers.map(d => d.tailNumber))];
    
    const aircraftStatus: AircraftReadiness[] = tailNumbers.map(tail => {
      const tailFindings = findings.filter(f => f.tailNumbers.includes(tail) && !['resolved', 'rejected', 'closed'].includes(f.status));
      const tailTasks = tasks.filter(t => t.tailNumbers.includes(tail) && !['completed', 'cancelled'].includes(t.status));
      
      const hasS1 = tailFindings.some(f => f.severity === 'S1');
      const hasS2 = tailFindings.some(f => f.severity === 'S2');
      
      let status: AircraftReadiness['status'] = 'ready';
      let statusHe = 'מוכן';
      
      if (hasS1) {
        status = 'grounded';
        statusHe = 'מושבת';
      } else if (hasS2) {
        status = 'degraded';
        statusHe = 'מוגבל';
      }

      return {
        tailNumber: tail,
        status,
        statusHe,
        blockers: tailFindings.filter(f => f.severity === 'S1').map(f => f.titleHe),
        openFindings: tailFindings.length,
        openTasks: tailTasks.length,
      };
    });

    const readyCount = aircraftStatus.filter(a => a.status === 'ready').length;
    const degradedCount = aircraftStatus.filter(a => a.status === 'degraded').length;
    const groundedCount = aircraftStatus.filter(a => a.status === 'grounded').length;

    return {
      timestamp: new Date().toISOString(),
      totalAircraft: tailNumbers.length,
      readyAircraft: readyCount,
      degradedAircraft: degradedCount,
      groundedAircraft: groundedCount,
      readinessPercentage: tailNumbers.length > 0 ? Math.round((readyCount / tailNumbers.length) * 100) : 100,
      aircraftStatus,
      blockers: getBlockers(),
      riskQueue: getRiskQueue(),
      accountability: [],
      emergencyMode,
      emergencyReason,
    };
  }, [dossiers, findings, tasks, emergencyMode, emergencyReason]);

  const getBlockers = useCallback((): Blocker[] => {
    return findings
      .filter(f => f.severity === 'S1' && !['resolved', 'rejected', 'closed'].includes(f.status))
      .map(f => ({
        id: f.id,
        tailNumber: f.tailNumbers[0],
        severity: f.severity,
        description: f.description,
        descriptionHe: f.descriptionHe,
        findingId: f.id,
        assignedTo: f.assignedTo,
        blockedSince: f.createdAt,
      }));
  }, [findings]);

  const getRiskQueue = useCallback((): RiskItem[] => {
    return findings
      .filter(f => ['S1', 'S2'].includes(f.severity) && !['resolved', 'rejected', 'closed'].includes(f.status))
      .sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity < b.severity ? -1 : 1;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
      .map(f => ({
        id: f.id,
        severity: f.severity,
        tailNumbers: f.tailNumbers,
        description: f.description,
        descriptionHe: f.descriptionHe,
        findingId: f.id,
        status: f.status,
        assignedTo: f.assignedTo,
      }));
  }, [findings]);

  // =============================================================================
  // EMERGENCY MODE (Commander only)
  // =============================================================================
  
  const setEmergencyMode = useCallback((
    enabled: boolean, 
    reason: string, 
    userId: string,
    userRole: UserRole,
    userName?: string
  ): ActionResult => {
    // Only commanders can set emergency mode
    if (!canPerformAction('emergency_mode', userRole)) {
      return { 
        success: false, 
        error: 'Permission denied: Only commanders can activate emergency mode',
        errorHe: 'אין הרשאה: רק מפקדים יכולים להפעיל מצב חירום'
      };
    }

    if (!reason || reason.trim().length === 0) {
      return { 
        success: false, 
        error: 'Reason is required for emergency mode changes',
        errorHe: 'נדרשת סיבה לשינוי מצב חירום'
      };
    }

    setEmergencyModeState(enabled);
    setEmergencyReason(enabled ? reason : undefined);
    
    addAuditEntry(
      enabled ? 'emergency_mode_on' : 'emergency_mode_off',
      'system',
      'emergency_mode',
      userId,
      userRole,
      userName || userId,
      !enabled,
      enabled,
      reason
    );

    return { success: true };
  }, [addAuditEntry, canPerformAction]);

  // =============================================================================
  // REALISTIC DEMO DATA - מייצג מצב צי אמיתי
  // =============================================================================
  
  const loadRealisticDemoData = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fleet: 8 aircraft, realistic mix of statuses
    const fleetTails = ['101', '102', '103', '104', '105', '106', '107', '108'];
    
    const demoDossiers: FlightDossier[] = [
      // Aircraft 101 - Recent flight, S1 finding (GROUNDED)
      {
        id: 'DOS-101-001',
        flightId: 'FLT-101-2024-001',
        tailNumber: '101',
        squadron: '117',
        flightDate: today,
        takeoffTime: '06:30:00',
        landingTime: '08:15:00',
        durationMinutes: 105,
        missionType: 'training',
        missionTypeHe: 'אימון',
        pilotNameLocked: true,
        summary: {
          totalFindings: 2,
          findingsBySeverity: { S1: 1, S2: 1, S3: 0, S4: 0 },
          criticalSystems: ['הידראוליקה', 'מערכת נחיתה'],
          recommendedActions: ['בדיקת מערכת הידראולית', 'בדיקת צמיגים'],
          nextSortieStatus: 'no_go',
          nextSortieStatusHe: 'לא מאושר לטיסה',
          confidenceScore: { value: 94, factors: [], dataQuality: 'complete', dataQualityHe: 'מלא' },
        },
        findings: [],
        evidence: [],
        maintenanceContext: { 
          recentMaintenance: [
            { id: 'MA-001', type: 'inspection', typeHe: 'בדיקה', description: 'בדיקה תקופתית 100 שעות', system: 'כללי', performedAt: twoDaysAgo, performedBy: 'טכנאי כהן', outcome: 'תקין' }
          ], 
          openWorkOrders: [], 
          componentStatus: [] 
        },
        tasks: [],
        status: 'findings_open',
        readinessImpact: { 
          status: 'grounded', 
          statusHe: 'מושבת', 
          blockers: ['לחץ הידראולי מתחת לסף בטיחות'],
          conditions: [] 
        },
        createdAt: `${today}T08:30:00Z`,
        updatedAt: `${today}T08:30:00Z`,
        createdBy: 'system',
      },
      // Aircraft 102 - S2 finding (DEGRADED)
      {
        id: 'DOS-102-001',
        flightId: 'FLT-102-2024-001',
        tailNumber: '102',
        squadron: '117',
        flightDate: today,
        takeoffTime: '07:00:00',
        landingTime: '09:30:00',
        durationMinutes: 150,
        missionType: 'training',
        missionTypeHe: 'אימון',
        pilotNameLocked: true,
        summary: {
          totalFindings: 1,
          findingsBySeverity: { S1: 0, S2: 1, S3: 0, S4: 0 },
          criticalSystems: ['מערכת נחיתה'],
          recommendedActions: ['בדיקת מערכת בלמים'],
          nextSortieStatus: 'conditional',
          nextSortieStatusHe: 'מותנה',
          confidenceScore: { value: 88, factors: [], dataQuality: 'complete', dataQualityHe: 'מלא' },
        },
        findings: [],
        evidence: [],
        maintenanceContext: { recentMaintenance: [], openWorkOrders: [], componentStatus: [] },
        tasks: [],
        status: 'findings_open',
        readinessImpact: { 
          status: 'degraded', 
          statusHe: 'מוגבל', 
          blockers: [],
          conditions: ['בדיקת בלמים לפני גיחה'] 
        },
        createdAt: `${today}T09:45:00Z`,
        updatedAt: `${today}T09:45:00Z`,
        createdBy: 'system',
      },
      // Aircraft 103-108 - Clean flights (READY)
      ...['103', '104', '105', '106', '107', '108'].map((tail, idx) => ({
        id: `DOS-${tail}-001`,
        flightId: `FLT-${tail}-2024-001`,
        tailNumber: tail,
        squadron: '117',
        flightDate: idx < 3 ? today : yesterday,
        takeoffTime: `0${6 + idx}:00:00`,
        landingTime: `0${8 + idx}:00:00`,
        durationMinutes: 120,
        missionType: 'training' as const,
        missionTypeHe: 'אימון',
        pilotNameLocked: true,
        summary: {
          totalFindings: idx === 2 ? 1 : 0, // 105 has one S4 info
          findingsBySeverity: { S1: 0, S2: 0, S3: 0, S4: idx === 2 ? 1 : 0 },
          criticalSystems: [],
          recommendedActions: [],
          nextSortieStatus: 'go' as const,
          nextSortieStatusHe: 'מאושר לטיסה',
          confidenceScore: { value: 95, factors: [], dataQuality: 'complete' as const, dataQualityHe: 'מלא' },
        },
        findings: [],
        evidence: [],
        maintenanceContext: { recentMaintenance: [], openWorkOrders: [], componentStatus: [] },
        tasks: [],
        status: 'all_resolved' as const,
        readinessImpact: { 
          status: 'ready' as const, 
          statusHe: 'מוכן', 
          blockers: [],
          conditions: [] 
        },
        createdAt: `${idx < 3 ? today : yesterday}T10:00:00Z`,
        updatedAt: `${idx < 3 ? today : yesterday}T10:00:00Z`,
        createdBy: 'system',
      })),
    ];

    const demoFindings: Finding[] = [
      // S1 - Critical: Hydraulic pressure (Aircraft 101) - BLOCKER
      {
        id: 'FND-001',
        dossierIds: ['DOS-101-001'],
        severity: 'S1',
        confidence: { value: 96, factors: [], dataQuality: 'complete', dataQualityHe: 'מלא' },
        category: 'rule_violation',
        title: 'Hydraulic Pressure Below Safety Threshold',
        titleHe: 'לחץ הידראולי מתחת לסף בטיחות',
        description: 'Hydraulic system A pressure dropped to 2,450 PSI during landing phase, below the 2,800 PSI safety minimum.',
        descriptionHe: 'לחץ מערכת הידראולית A ירד ל-2,450 PSI בשלב הנחיתה, מתחת למינימום הבטיחות של 2,800 PSI.',
        technicalDetail: 'Parameter: hydraulic_pressure_a_psi | Value: 2,450 | Threshold: 2,800 | Duration: 12 sec | Phase: LAND',
        systemAffected: 'Hydraulics',
        systemAffectedHe: 'מערכת הידראולית',
        tailNumbers: ['101'],
        scope: { type: 'single_flight', typeHe: 'טיסה בודדת', flightCount: 1, aircraftCount: 1 },
        recommendation: 'GROUND AIRCRAFT. Inspect hydraulic system for leaks. Check pump operation and fluid levels. Do not fly until resolved.',
        recommendationHe: 'השבתת מטוס. בדיקת מערכת הידראולית לאיתור דליפות. בדיקת משאבה ורמות נוזל. אסור לטוס עד לפתרון.',
        requiredAction: {
          type: 'immediate',
          typeHe: 'מיידי',
          description: 'Ground aircraft until hydraulic inspection complete',
          descriptionHe: 'השבתת מטוס עד להשלמת בדיקת הידראוליקה',
        },
        evidence: [
          { evidenceId: 'EVD-001', relevance: 'Time-series showing pressure drop', relevanceHe: 'גרף זמן מראה ירידת לחץ' }
        ],
        ruleId: 'HYD_001',
        ruleVersion: 1,
        status: 'new',
        statusHistory: [],
        occurrences: 1,
        isRecurring: false,
        relatedFindingIds: [],
        createdAt: `${today}T08:30:00Z`,
        updatedAt: `${today}T08:30:00Z`,
        createdBy: 'system',
        pilotNameLocked: true,
        commanderVisibilityOnly: false,
      },
      // S2 - Mission Critical: Landing speed (Aircraft 101)
      {
        id: 'FND-002',
        dossierIds: ['DOS-101-001'],
        severity: 'S2',
        confidence: { value: 92, factors: [], dataQuality: 'complete', dataQualityHe: 'מלא' },
        category: 'rule_violation',
        title: 'Landing Speed Exceedance',
        titleHe: 'חריגת מהירות נחיתה',
        description: 'Landing speed recorded at 178 knots, exceeding the 165 knot training limit.',
        descriptionHe: 'מהירות נחיתה נרשמה ב-178 קשר, חריגה מהמגבלה של 165 קשר באימון.',
        technicalDetail: 'Parameter: landing_speed_kts | Value: 178 | Threshold: 165 | Context: Training',
        systemAffected: 'Landing Gear',
        systemAffectedHe: 'מערכת נחיתה',
        tailNumbers: ['101'],
        scope: { type: 'single_flight', typeHe: 'טיסה בודדת', flightCount: 1, aircraftCount: 1 },
        recommendation: 'Inspect brake assembly and tire wear. Check for flat spots.',
        recommendationHe: 'בדיקת מערכת בלמים ושחיקת צמיגים. בדיקת שטוחיות.',
        requiredAction: {
          type: 'before_next_sortie',
          typeHe: 'לפני הגיחה הבאה',
          description: 'Brake and tire inspection required',
          descriptionHe: 'נדרשת בדיקת בלמים וצמיגים',
        },
        evidence: [
          { evidenceId: 'EVD-002', relevance: 'Landing phase data snapshot', relevanceHe: 'צילום נתוני שלב נחיתה' }
        ],
        ruleId: 'LAND_001',
        ruleVersion: 1,
        status: 'acknowledged',
        statusHistory: [
          { from: 'new', to: 'acknowledged', changedAt: `${today}T09:00:00Z`, changedBy: 'רס"ל דוד', note: 'נלקח לטיפול' }
        ],
        occurrences: 1,
        isRecurring: false,
        relatedFindingIds: [],
        createdAt: `${today}T08:30:00Z`,
        updatedAt: `${today}T09:00:00Z`,
        createdBy: 'system',
        assignedTo: 'רס"ל דוד',
        pilotBehaviorContext: 'נחיתה עם רוח גב חזקה - ייתכן גורם חיצוני',
        pilotNameLocked: true,
        commanderVisibilityOnly: false,
      },
      // S2 - Mission Critical: Landing speed (Aircraft 102) - Same issue, different aircraft = AGGREGATION candidate
      {
        id: 'FND-003',
        dossierIds: ['DOS-102-001'],
        severity: 'S2',
        confidence: { value: 89, factors: [], dataQuality: 'complete', dataQualityHe: 'מלא' },
        category: 'rule_violation',
        title: 'Landing Speed Exceedance',
        titleHe: 'חריגת מהירות נחיתה',
        description: 'Landing speed recorded at 172 knots, exceeding the 165 knot training limit.',
        descriptionHe: 'מהירות נחיתה נרשמה ב-172 קשר, חריגה מהמגבלה של 165 קשר באימון.',
        technicalDetail: 'Parameter: landing_speed_kts | Value: 172 | Threshold: 165 | Context: Training',
        systemAffected: 'Landing Gear',
        systemAffectedHe: 'מערכת נחיתה',
        tailNumbers: ['102'],
        scope: { type: 'single_flight', typeHe: 'טיסה בודדת', flightCount: 1, aircraftCount: 1 },
        recommendation: 'Inspect brake assembly and tire wear.',
        recommendationHe: 'בדיקת מערכת בלמים ושחיקת צמיגים.',
        requiredAction: {
          type: 'before_next_sortie',
          typeHe: 'לפני הגיחה הבאה',
          description: 'Brake inspection required',
          descriptionHe: 'נדרשת בדיקת בלמים',
        },
        evidence: [],
        ruleId: 'LAND_001',
        ruleVersion: 1,
        status: 'new',
        statusHistory: [],
        occurrences: 1,
        isRecurring: true, // Same rule triggered on another aircraft
        relatedFindingIds: ['FND-002'],
        createdAt: `${today}T09:45:00Z`,
        updatedAt: `${today}T09:45:00Z`,
        createdBy: 'system',
        pilotNameLocked: true,
        commanderVisibilityOnly: false,
      },
      // S4 - Informational: Slight brake temp elevation (Aircraft 105)
      {
        id: 'FND-004',
        dossierIds: ['DOS-105-001'],
        severity: 'S4',
        confidence: { value: 78, factors: [], dataQuality: 'partial', dataQualityHe: 'חלקי' },
        category: 'trend',
        title: 'Brake Temperature Trending Higher',
        titleHe: 'מגמת עלייה בטמפרטורת בלמים',
        description: 'Brake temperature showing upward trend over last 5 flights. Currently within limits but worth monitoring.',
        descriptionHe: 'טמפרטורת בלמים מראה מגמת עלייה ב-5 טיסות אחרונות. עדיין בגבולות אך מומלץ מעקב.',
        technicalDetail: 'Trend: +8% over 5 flights | Current: 320°C | Limit: 400°C',
        systemAffected: 'Brakes',
        systemAffectedHe: 'מערכת בלמים',
        tailNumbers: ['105'],
        scope: { type: 'multi_flight', typeHe: 'מספר טיסות', flightCount: 5, aircraftCount: 1 },
        recommendation: 'Monitor on next 3 flights. Schedule brake inspection if trend continues.',
        recommendationHe: 'מעקב ב-3 טיסות הבאות. תכנון בדיקת בלמים אם מגמה נמשכת.',
        requiredAction: {
          type: 'monitor',
          typeHe: 'ניטור',
          description: 'Continue monitoring',
          descriptionHe: 'המשך ניטור',
        },
        evidence: [],
        status: 'new',
        statusHistory: [],
        occurrences: 1,
        isRecurring: false,
        relatedFindingIds: [],
        createdAt: `${today}T10:00:00Z`,
        updatedAt: `${today}T10:00:00Z`,
        createdBy: 'system',
        pilotNameLocked: true,
        commanderVisibilityOnly: false,
      },
    ];

    const demoTasks: Task[] = [
      // Task for FND-002 (already acknowledged)
      {
        id: 'TSK-001',
        findingId: 'FND-002',
        dossierIds: ['DOS-101-001'],
        tailNumbers: ['101'],
        title: 'Brake and Tire Inspection - Aircraft 101',
        titleHe: 'בדיקת בלמים וצמיגים - מטוס 101',
        description: 'Inspect brake pads, rotors, and tires for excessive wear due to high-speed landing.',
        descriptionHe: 'בדיקת רפידות בלמים, דיסקים וצמיגים לשחיקה מוגברת עקב נחיתה במהירות גבוהה.',
        assignedTo: 'סמ"ר יוסי',
        assignedRole: 'technician',
        assignedAt: `${today}T09:15:00Z`,
        assignedBy: 'רס"ל דוד',
        dueType: 'before_sortie',
        dueTypeHe: 'לפני הגיחה הבאה',
        status: 'in_progress',
        statusHistory: [
          { from: 'open', to: 'in_progress', changedAt: `${today}T09:30:00Z`, changedBy: 'סמ"ר יוסי', note: 'התחלתי בדיקה' }
        ],
        createdAt: `${today}T09:15:00Z`,
        updatedAt: `${today}T09:30:00Z`,
      },
    ];

    setDossiers(demoDossiers);
    setFindings(demoFindings);
    setTasks(demoTasks);
    setAuditLog([
      {
        id: 'AUD-001',
        timestamp: `${today}T09:00:00Z`,
        userId: 'רס"ל דוד',
        userName: 'רס"ל דוד',
        userRole: 'specialist',
        action: 'status_change',
        actionHe: 'שינוי סטטוס',
        targetType: 'finding',
        targetId: 'FND-002',
        previousValue: 'new',
        newValue: 'acknowledged',
        note: 'נלקח לטיפול',
        requiresApproval: false,
      },
      {
        id: 'AUD-002',
        timestamp: `${today}T09:15:00Z`,
        userId: 'רס"ל דוד',
        userName: 'רס"ל דוד',
        userRole: 'specialist',
        action: 'create',
        actionHe: 'יצירה',
        targetType: 'task',
        targetId: 'TSK-001',
        requiresApproval: false,
      },
    ]);
  }, []);

  // Keep the old loadDemoData for manual refresh
  const loadDemoData = useCallback(() => {
    loadRealisticDemoData();
  }, [loadRealisticDemoData]);

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================
  
  const value: FlightDossierContextType = {
    // Dossiers
    dossiers,
    getDossier,
    getDossierByFlight,
    getDossiersByTail,
    
    // Findings
    findings,
    getFinding,
    getFindingsForDossier,
    getFindingsByTail,
    getFindingsBySeverity,
    getOpenFindings,
    getFilteredFindings,
    getAggregatedFindings,
    
    // Finding Actions
    acknowledgeFinding,
    updateFindingStatus,
    assignFinding,
    
    // Tasks
    tasks,
    getTask,
    getTasksForFinding,
    getTasksByAssignee,
    getOpenTasks,
    getOverdueTasks,
    
    // Task Actions
    createTaskFromFinding,
    updateTaskStatus,
    completeTask,
    
    // Fleet Readiness
    getFleetReadiness,
    getBlockers,
    getRiskQueue,
    
    // Emergency Mode
    emergencyMode,
    setEmergencyMode,
    
    // Audit
    auditLog,
    
    // Permission Checking
    canPerformAction,
    
    // Demo Data
    loadDemoData,
    isInitialized,
  };

  return (
    <FlightDossierContext.Provider value={value}>
      {children}
    </FlightDossierContext.Provider>
  );
};

// =============================================================================
// HOOK
// =============================================================================

export const useFlightDossier = () => {
  const context = useContext(FlightDossierContext);
  if (context === undefined) {
    throw new Error('useFlightDossier must be used within a FlightDossierProvider');
  }
  return context;
};

// =============================================================================
// HELPERS
// =============================================================================

function getActionHebrewLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    create: 'יצירה',
    update: 'עדכון',
    delete: 'מחיקה',
    status_change: 'שינוי סטטוס',
    approve: 'אישור',
    reject: 'דחייה',
    assign: 'הקצאה',
    escalate: 'הסלמה',
    threshold_change: 'שינוי סף',
    rule_activate: 'הפעלת כלל',
    rule_pause: 'השהיית כלל',
    emergency_mode_on: 'הפעלת מצב חירום',
    emergency_mode_off: 'כיבוי מצב חירום',
  };
  return labels[action] || action;
}

export default FlightDossierContext;
