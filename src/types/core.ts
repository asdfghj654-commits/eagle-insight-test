/**
 * Core Domain Types - Post-Flight Maintenance Intelligence
 * 
 * Based on PRD Vision: Every feature must answer 4 questions:
 * 1. מה חריג? (What's anomalous?)
 * 2. מה זה אומר על הגיחה הבאה? (What does it mean for next sortie?)
 * 3. מה צריך לעשות עכשיו? (What action is needed?)
 * 4. על בסיס איזו ראיה? (Based on what evidence?)
 */

// =============================================================================
// SEVERITY MODEL (S1-S4)
// =============================================================================

export type SeverityLevel = 'S1' | 'S2' | 'S3' | 'S4';

export const SEVERITY_CONFIG: Record<SeverityLevel, {
  label: string;
  labelHe: string;
  description: string;
  descriptionHe: string;
  color: string;
  bgColor: string;
  borderColor: string;
  impact: string;
  impactHe: string;
  responseTime: string;
  responseTimeHe: string;
}> = {
  S1: {
    label: 'Safety Critical',
    labelHe: 'קריטי בטיחות',
    description: 'Immediate safety risk - aircraft grounded',
    descriptionHe: 'סיכון בטיחותי מיידי - מטוס מושבת',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-500',
    impact: 'No-Go until resolved',
    impactHe: 'אסור לטוס עד לפתרון',
    responseTime: 'Immediate',
    responseTimeHe: 'מיידי',
  },
  S2: {
    label: 'Mission Critical',
    labelHe: 'קריטי משימה',
    description: 'Mission capability degraded',
    descriptionHe: 'פגיעה ביכולת משימתית',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-500',
    impact: 'Restricted operations',
    impactHe: 'הגבלות תפעוליות',
    responseTime: 'Before next sortie',
    responseTimeHe: 'לפני הגיחה הבאה',
  },
  S3: {
    label: 'Advisory',
    labelHe: 'ייעוץ',
    description: 'Requires attention, no immediate risk',
    descriptionHe: 'דורש תשומת לב, ללא סיכון מיידי',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-500',
    impact: 'Monitor & schedule',
    impactHe: 'ניטור ותכנון',
    responseTime: 'Within 48 hours',
    responseTimeHe: 'תוך 48 שעות',
  },
  S4: {
    label: 'Informational',
    labelHe: 'מידע',
    description: 'For awareness and trending',
    descriptionHe: 'למודעות ומעקב מגמות',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-500',
    impact: 'No action required',
    impactHe: 'אין צורך בפעולה',
    responseTime: 'As scheduled',
    responseTimeHe: 'לפי תכנית',
  },
};

// =============================================================================
// DATA SOURCE TYPES (Measured vs Reported)
// =============================================================================

export type DataSourceType = 'measured' | 'reported';

export const DATA_SOURCE_CONFIG: Record<DataSourceType, {
  label: string;
  labelHe: string;
  description: string;
  descriptionHe: string;
  icon: string;
  trustLevel: 'high' | 'medium' | 'low';
}> = {
  measured: {
    label: 'Measured (Auto)',
    labelHe: 'נמדד (אוטומטי)',
    description: 'From flight recorder / DVR / sensors',
    descriptionHe: 'מקופסה שחורה / DVR / חיישנים',
    icon: '📊',
    trustLevel: 'high',
  },
  reported: {
    label: 'Reported (Manual)',
    labelHe: 'מדווח (ידני)',
    description: 'Manually entered maintenance data',
    descriptionHe: 'נתוני אחזקה שהוזנו ידנית',
    icon: '✍️',
    trustLevel: 'medium',
  },
};

// =============================================================================
// CONFIDENCE & UNCERTAINTY
// =============================================================================

export interface ConfidenceScore {
  value: number; // 0-100
  factors: ConfidenceFactor[];
  dataQuality: 'complete' | 'partial' | 'missing';
  dataQualityHe: string;
}

export interface ConfidenceFactor {
  name: string;
  nameHe: string;
  impact: 'positive' | 'negative';
  weight: number;
  description?: string;
}

// =============================================================================
// USER ROLES & PERSONAS
// =============================================================================

export type UserRole = 
  | 'technician'        // דרג א׳ - קו
  | 'specialist'        // דרג ב׳ - מומחים/בדק  
  | 'engineer'          // דרג ד׳ - הנדסה
  | 'commander';        // מפקד גף טכני

export const USER_ROLE_CONFIG: Record<UserRole, {
  label: string;
  labelHe: string;
  rank: string;
  rankHe: string;
  uiGoal: string;
  uiGoalHe: string;
  permissions: string[];
}> = {
  technician: {
    label: 'Technician / Head of Line',
    labelHe: 'טכנאי / ר״צ קו',
    rank: 'Level A',
    rankHe: 'דרג א׳',
    uiGoal: 'Triage + Actions',
    uiGoalHe: 'מיון + פעולות',
    permissions: ['view_findings', 'ack_findings', 'create_tasks', 'add_notes'],
  },
  specialist: {
    label: 'Specialist / Inspector',
    labelHe: 'מומחה / בדק',
    rank: 'Level B',
    rankHe: 'דרג ב׳',
    uiGoal: 'Drill-down + Evidence + Compare',
    uiGoalHe: 'צלילה + ראיות + השוואה',
    permissions: ['view_findings', 'ack_findings', 'create_tasks', 'add_notes', 'view_evidence', 'compare_flights'],
  },
  engineer: {
    label: 'Engineer',
    labelHe: 'מהנדס',
    rank: 'Level D',
    rankHe: 'דרג ד׳',
    uiGoal: 'Investigation + Rule authoring + Governance',
    uiGoalHe: 'תחקור + כתיבת כללים + ממשל',
    permissions: ['view_findings', 'ack_findings', 'create_tasks', 'add_notes', 'view_evidence', 'compare_flights', 'author_rules', 'approve_rules', 'modify_thresholds'],
  },
  commander: {
    label: 'Technical Officer',
    labelHe: 'קצין טכני',
    labelHe: 'מפקד גף טכני',
    rank: 'Major',
    rankHe: 'רס"ן',
    rankHe: 'מפקד',
    labelHe: 'קצין טכני',
    rankHe: 'רס"ן',
    uiGoal: 'Fleet readiness + Risk ownership + Accountability',
    uiGoalHe: 'כשירות טייסת + בעלות סיכון + אחריותיות',
    permissions: ['view_all', 'fleet_overview', 'emergency_mode', 'accountability_reports'],
  },
};

// =============================================================================
// FLIGHT DOSSIER (תיק טיסה)
// =============================================================================

export interface FlightDossier {
  id: string;
  
  // Flight Identity
  flightId: string;
  tailNumber: string;
  squadron: string;
  
  // Time
  flightDate: string;
  takeoffTime: string;
  landingTime: string;
  durationMinutes: number;
  
  // Mission Context
  missionType: 'training' | 'operational' | 'test' | 'ferry';
  missionTypeHe: string;
  pilotId?: string; // Locked for privacy
  pilotNameLocked: boolean;
  
  // Summary — derived from findings, may not be populated for lightweight list DTOs
  summary?: FlightSummary;

  // Linked Objects
  findings: Finding[];
  evidence: Evidence[];
  maintenanceContext?: MaintenanceContext;
  tasks: Task[];

  // Status
  status: DossierStatus;
  readinessImpact?: ReadinessImpact;
  
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastReviewedBy?: string;
  lastReviewedAt?: string;
}

export type DossierStatus = 'new' | 'in_review' | 'findings_open' | 'all_resolved' | 'archived';

export interface FlightSummary {
  totalFindings: number;
  findingsBySeverity: Record<SeverityLevel, number>;
  criticalSystems: string[];
  recommendedActions: string[];
  nextSortieStatus: 'go' | 'conditional' | 'no_go';
  nextSortieStatusHe: string;
  confidenceScore?: ConfidenceScore; // only present when AI or rule engine has computed it
}

export interface ReadinessImpact {
  status: 'ready' | 'degraded' | 'grounded';
  statusHe: string;
  blockers: string[];
  conditions: string[];
  eta?: string; // Estimated time to ready
}

// =============================================================================
// FINDING / INSIGHT (ממצא)
// =============================================================================

export interface Finding {
  id: string;
  dossierIds: string[]; // Can span multiple flights/aircraft
  
  // Classification
  severity: SeverityLevel;
  confidence?: ConfidenceScore; // only present when computed — never hardcoded
  category: FindingCategory;
  
  // Content
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  technicalDetail: string;
  
  // System & Scope
  systemAffected: string;
  systemAffectedHe: string;
  tailNumbers: string[]; // Aggregation: multiple aircraft
  scope: FindingScope;
  
  // Recommendation & Action
  recommendation: string;
  recommendationHe: string;
  requiredAction: RequiredAction;
  
  // Evidence (the "why")
  evidence: EvidenceReference[];
  
  // Rule Reference (if generated by rule)
  ruleId?: string;
  ruleVersion?: number;
  
  // Status Lifecycle
  status: FindingStatus;
  statusHistory: StatusChange[];
  
  // Aggregation
  occurrences: number;
  isRecurring: boolean;
  relatedFindingIds: string[];
  
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string; // 'system' or user ID
  assignedTo?: string;
  
  // Privacy
  pilotBehaviorContext?: string;
  pilotNameLocked: boolean;
  commanderVisibilityOnly: boolean;
}

export type FindingCategory = 
  | 'rule_violation'     // חריגה מכלל
  | 'trend'              // מגמה
  | 'behavior_impact'    // השפעת התנהגות
  | 'recurring'          // תקלה חוזרת
  | 'anomaly'            // חריגה סטטיסטית
  | 'manual_observation'; // תצפית ידנית

export interface FindingScope {
  type: 'single_flight' | 'multi_flight' | 'multi_aircraft' | 'fleet_wide';
  typeHe: string;
  flightCount: number;
  aircraftCount: number;
  timeSpan?: { from: string; to: string };
}

export type FindingStatus = 
  | 'new'                // חדש
  | 'acknowledged'       // הוכר
  | 'in_progress'        // בטיפול
  | 'escalated'          // הוסלם
  | 'resolved'           // נפתר
  | 'rejected'           // נדחה
  | 'closed';            // נסגר

export const FINDING_STATUS_CONFIG: Record<FindingStatus, {
  label: string;
  labelHe: string;
  color: string;
  allowedTransitions: FindingStatus[];
  requiresNote: boolean;
  requiresApproval: boolean;
  approvalRole?: UserRole;
}> = {
  new: {
    label: 'New',
    labelHe: 'חדש',
    color: 'bg-blue-100 text-blue-800',
    allowedTransitions: ['acknowledged', 'rejected'],
    requiresNote: false,
    requiresApproval: false,
  },
  acknowledged: {
    label: 'Acknowledged',
    labelHe: 'הוכר',
    color: 'bg-purple-100 text-purple-800',
    allowedTransitions: ['in_progress', 'escalated', 'rejected'],
    requiresNote: false,
    requiresApproval: false,
  },
  in_progress: {
    label: 'In Progress',
    labelHe: 'בטיפול',
    color: 'bg-yellow-100 text-yellow-800',
    allowedTransitions: ['resolved', 'escalated'],
    requiresNote: true,
    requiresApproval: false,
  },
  escalated: {
    label: 'Escalated',
    labelHe: 'הוסלם',
    color: 'bg-orange-100 text-orange-800',
    allowedTransitions: ['in_progress', 'resolved'],
    requiresNote: true,
    requiresApproval: true,
    approvalRole: 'engineer',
  },
  resolved: {
    label: 'Resolved',
    labelHe: 'נפתר',
    color: 'bg-green-100 text-green-800',
    allowedTransitions: ['closed'],
    requiresNote: true,
    requiresApproval: false,
  },
  rejected: {
    label: 'Rejected',
    labelHe: 'נדחה',
    color: 'bg-gray-100 text-gray-800',
    allowedTransitions: ['closed'],
    requiresNote: true,
    requiresApproval: true,
    approvalRole: 'engineer',
  },
  closed: {
    label: 'Closed',
    labelHe: 'נסגר',
    color: 'bg-gray-200 text-gray-600',
    allowedTransitions: [],
    requiresNote: false,
    requiresApproval: false,
  },
};

export interface StatusChange {
  from: FindingStatus;
  to: FindingStatus;
  changedAt: string;
  changedBy: string;
  note?: string;
  approvedBy?: string;
}

export interface RequiredAction {
  type: 'immediate' | 'before_next_sortie' | 'scheduled' | 'monitor' | 'none';
  typeHe: string;
  description: string;
  descriptionHe: string;
  dueDate?: string;
  assignedRole?: UserRole;
}

// =============================================================================
// EVIDENCE (ראיות)
// =============================================================================

export interface Evidence {
  id: string;
  findingId: string;
  
  // Source Type
  sourceType: DataSourceType;
  sourceSystem: string; // e.g., 'DVR', 'CMMS', 'Manual Entry'
  
  // Content Type
  contentType: EvidenceContentType;
  
  // Data
  title: string;
  titleHe: string;
  description?: string;
  
  // Time Reference
  timestamp?: string;
  timeRange?: { from: string; to: string };
  flightPhase?: string;
  
  // Links
  dataReference: string; // Path to data / query / file
  snapshotData?: any; // Cached data for quick view
  
  // Metadata
  createdAt: string;
  createdBy: string;
}

export type EvidenceContentType = 
  | 'time_series'        // גרף זמן
  | 'event'              // אירוע נקודתי
  | 'threshold_violation' // חריגת סף
  | 'trend_analysis'     // ניתוח מגמה
  | 'photo'              // תמונה
  | 'document'           // מסמך
  | 'manual_note';       // הערה ידנית

export interface EvidenceReference {
  evidenceId: string;
  relevance: string; // Why this evidence supports the finding
  relevanceHe: string;
}

// =============================================================================
// MAINTENANCE CONTEXT (הקשר אחזקה)
// =============================================================================

export interface MaintenanceContext {
  // Pre-Flight
  preFlight?: {
    inspectionDate: string;
    inspectedBy: string;
    findings: string[];
    signedOff: boolean;
  };
  
  // Post-Flight
  postFlight?: {
    reportedIssues: ReportedIssue[];
    pilotComments?: string;
    crewChiefComments?: string;
  };
  
  // Related Maintenance
  recentMaintenance: MaintenanceAction[];
  openWorkOrders: WorkOrder[];
  
  // Component Status
  componentStatus: ComponentStatus[];
}

export interface ReportedIssue {
  id: string;
  description: string;
  descriptionHe: string;
  reportedBy: string;
  reportedAt: string;
  system: string;
  linkedFindingId?: string;
  status: 'open' | 'linked' | 'dismissed';
}

export interface MaintenanceAction {
  id: string;
  type: 'inspection' | 'repair' | 'replacement' | 'calibration' | 'test';
  typeHe: string;
  description: string;
  system: string;
  performedAt: string;
  performedBy: string;
  outcome: string;
  nextDue?: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  titleHe: string;
  status: 'open' | 'in_progress' | 'pending_parts' | 'completed';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  assignedTo?: string;
  dueDate?: string;
  linkedFindingIds: string[];
}

export interface ComponentStatus {
  componentId: string;
  name: string;
  nameHe: string;
  system: string;
  status: 'serviceable' | 'degraded' | 'unserviceable';
  hoursRemaining?: number;
  cyclesRemaining?: number;
  nextInspectionDue?: string;
}

// =============================================================================
// RULES (כללים)
// =============================================================================

export interface MaintenanceRule {
  id: string;
  
  // Identity
  name: string;
  nameHe: string;
  description: string;
  descriptionHe: string;
  
  // Classification
  type: 'baseline' | 'engineer';
  typeHe: string;
  category: string;
  system: string;
  
  // Logic
  parameter: string;
  condition: RuleCondition;
  thresholds: RuleThreshold[];
  context: RuleContext[];
  
  // Output
  severityMapping: SeverityLevel;
  recommendedAction: string;
  recommendedActionHe: string;
  
  // Reference
  referenceDoc?: string;
  clause?: string;
  
  // Governance
  status: RuleStatus;
  version: number;
  versionHistory: RuleVersion[];
  
  // Metrics
  lastRun?: string;
  matchedCount: number;
  impactedAircraft: string[];
  falsePositiveRate?: number;
  
  // Audit
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
}

export type RuleStatus = 
  | 'draft'              // טיוטה
  | 'pending_approval'   // ממתין לאישור
  | 'active'             // פעיל
  | 'paused'             // מושהה
  | 'deprecated';        // יצא משימוש

export const RULE_STATUS_CONFIG: Record<RuleStatus, {
  label: string;
  labelHe: string;
  color: string;
  canEdit: boolean;
  canActivate: boolean;
  requiresApproval: boolean;
}> = {
  draft: {
    label: 'Draft',
    labelHe: 'טיוטה',
    color: 'bg-gray-100 text-gray-800',
    canEdit: true,
    canActivate: false,
    requiresApproval: true,
  },
  pending_approval: {
    label: 'Pending Approval',
    labelHe: 'ממתין לאישור',
    color: 'bg-yellow-100 text-yellow-800',
    canEdit: false,
    canActivate: false,
    requiresApproval: true,
  },
  active: {
    label: 'Active',
    labelHe: 'פעיל',
    color: 'bg-green-100 text-green-800',
    canEdit: false,
    canActivate: false,
    requiresApproval: true,
  },
  paused: {
    label: 'Paused',
    labelHe: 'מושהה',
    color: 'bg-orange-100 text-orange-800',
    canEdit: true,
    canActivate: true,
    requiresApproval: false,
  },
  deprecated: {
    label: 'Deprecated',
    labelHe: 'יצא משימוש',
    color: 'bg-red-100 text-red-800',
    canEdit: false,
    canActivate: false,
    requiresApproval: true,
  },
};

export interface RuleCondition {
  type: 'greater_than' | 'less_than' | 'between' | 'equals' | 'not_equals' | 'trend' | 'consecutive';
  operator: string;
  duration?: number; // For time-based conditions
  consecutiveCount?: number;
}

export interface RuleThreshold {
  value: number | [number, number];
  unit: string;
  context?: string;
}

export type RuleContext = 'training' | 'operational' | 'test' | 'all';

export interface RuleVersion {
  version: number;
  changedAt: string;
  changedBy: string;
  changeType: 'created' | 'modified' | 'threshold_change' | 'status_change';
  changeDescription: string;
  previousValues?: Record<string, any>;
  approvedBy?: string;
}

// =============================================================================
// TASK (משימה)
// =============================================================================

export interface Task {
  id: string;
  
  // Link
  findingId: string;
  dossierIds: string[];
  tailNumbers: string[];
  
  // Content
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  
  // Assignment
  assignedTo: string;
  assignedRole: UserRole;
  assignedAt: string;
  assignedBy: string;
  
  // Timeline
  dueType: 'before_sortie' | 'date' | 'hours' | 'cycles';
  dueTypeHe: string;
  dueDate?: string;
  dueHours?: number;
  dueCycles?: number;
  
  // Status
  status: TaskStatus;
  statusHistory: TaskStatusChange[];
  
  // Completion
  completedAt?: string;
  completedBy?: string;
  outcome?: string;
  outcomeHe?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 
  | 'open'               // פתוח
  | 'in_progress'        // בביצוע
  | 'pending_parts'      // ממתין לחלקים
  | 'pending_approval'   // ממתין לאישור
  | 'completed'          // הושלם
  | 'cancelled';         // בוטל

export const TASK_STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  labelHe: string;
  color: string;
  icon: string;
}> = {
  open: {
    label: 'Open',
    labelHe: 'פתוח',
    color: 'bg-blue-100 text-blue-800',
    icon: '📋',
  },
  in_progress: {
    label: 'In Progress',
    labelHe: 'בביצוע',
    color: 'bg-yellow-100 text-yellow-800',
    icon: '🔧',
  },
  pending_parts: {
    label: 'Pending Parts',
    labelHe: 'ממתין לחלקים',
    color: 'bg-orange-100 text-orange-800',
    icon: '📦',
  },
  pending_approval: {
    label: 'Pending Approval',
    labelHe: 'ממתין לאישור',
    color: 'bg-purple-100 text-purple-800',
    icon: '✍️',
  },
  completed: {
    label: 'Completed',
    labelHe: 'הושלם',
    color: 'bg-green-100 text-green-800',
    icon: '✅',
  },
  cancelled: {
    label: 'Cancelled',
    labelHe: 'בוטל',
    color: 'bg-gray-100 text-gray-800',
    icon: '❌',
  },
};

export interface TaskStatusChange {
  from: TaskStatus;
  to: TaskStatus;
  changedAt: string;
  changedBy: string;
  note?: string;
}

// =============================================================================
// FLEET READINESS (כשירות צי - Commander View)
// =============================================================================

export interface FleetReadiness {
  timestamp: string;
  
  // Overall Status
  totalAircraft: number;
  readyAircraft: number;
  degradedAircraft: number;
  groundedAircraft: number;
  
  // Percentage
  readinessPercentage: number;
  
  // Details per Aircraft
  aircraftStatus: AircraftReadiness[];
  
  // Top Blockers
  blockers: Blocker[];
  
  // Risk Queue
  riskQueue: RiskItem[];
  
  // Accountability
  accountability: AccountabilityItem[];
  
  // Emergency Mode
  emergencyMode: boolean;
  emergencyReason?: string;
}

export interface AircraftReadiness {
  tailNumber: string;
  status: 'ready' | 'degraded' | 'grounded';
  statusHe: string;
  blockers: string[];
  openFindings: number;
  openTasks: number;
  lastFlight?: string;
  nextScheduledMaintenance?: string;
  eta?: string; // If not ready, when will it be
}

export interface Blocker {
  id: string;
  tailNumber: string;
  severity: SeverityLevel;
  description: string;
  descriptionHe: string;
  findingId: string;
  assignedTo?: string;
  eta?: string;
  blockedSince: string;
}

export interface RiskItem {
  id: string;
  severity: SeverityLevel;
  tailNumbers: string[];
  description: string;
  descriptionHe: string;
  findingId: string;
  status: FindingStatus;
  assignedTo?: string;
  dueDate?: string;
}

export interface AccountabilityItem {
  userId: string;
  userName: string;
  role: UserRole;
  openTasks: number;
  overdueTasks: number;
  avgResolutionTime: number; // Hours
  findingsOwned: number;
}

// =============================================================================
// AUDIT & GOVERNANCE
// =============================================================================

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  
  // Action
  action: AuditAction;
  actionHe: string;
  
  // Target
  targetType: 'finding' | 'rule' | 'task' | 'dossier' | 'system';
  targetId: string;
  
  // Details
  previousValue?: any;
  newValue?: any;
  note?: string;
  
  // Approval
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

export type AuditAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'escalate'
  | 'threshold_change'
  | 'rule_activate'
  | 'rule_pause'
  | 'emergency_mode_on'
  | 'emergency_mode_off';

// =============================================================================
// HELPER TYPES
// =============================================================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface FilterOptions {
  tailNumbers?: string[];
  squadrons?: string[];
  dateRange?: { from: string; to: string };
  severities?: SeverityLevel[];
  statuses?: FindingStatus[];
  systems?: string[];
  assignedTo?: string[];
  showResolved?: boolean;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}
