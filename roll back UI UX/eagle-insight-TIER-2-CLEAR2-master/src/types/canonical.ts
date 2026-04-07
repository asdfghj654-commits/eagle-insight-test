/**
 * Canonical Data Types
 * 
 * These types represent the SINGLE SOURCE OF TRUTH for all data in the system.
 * All components must consume data through these canonical types.
 * 
 * PRODUCTION RULES:
 * 1. No component may define its own data structures for aircraft, flights, etc.
 * 2. All data must flow through the canonical data provider
 * 3. Classifications require rule authority
 */

import { SeverityLevel, FindingStatus, UserRole } from './core';

// =============================================================================
// AIRCRAFT
// =============================================================================

/**
 * Aircraft status - MUST be derived from rules, not hardcoded
 */
export type CanonicalAircraftStatus = 
  | 'unknown'           // Default when no rule determines status
  | 'available'         // Rule: all checks pass
  | 'in_maintenance'    // Rule: active work order
  | 'awaiting_parts'    // Rule: logistics block
  | 'grounded'          // Rule: S1 finding with grounding flag (REQUIRES AUTHORITY)
  | 'restricted';       // Rule: S2 finding limiting operations (REQUIRES AUTHORITY)

export interface CanonicalAircraft {
  tailNumber: string;
  model: string;
  status: CanonicalAircraftStatus;
  lastFlightDate: string | null;
  totalFlightHours: number;
  nextScheduledMaintenance: string | null;
  activeWorkOrderCount: number;
  openFindingCount: number;
  // Source tracking
  dataSource: 'integration' | 'csv' | 'derived';
  lastUpdated: string;
}

// =============================================================================
// FLIGHTS
// =============================================================================

export type FlightPhase = 
  | 'preflight'
  | 'taxi'
  | 'takeoff'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'approach'
  | 'landing'
  | 'postflight';

export interface CanonicalFlight {
  flightId: string;
  tailNumber: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  phases: FlightPhase[];
  hasProcessedTelemetry: boolean;
  findingCount: number;
  criticalFindingCount: number;
  pilotId: string | null;  // May be locked for privacy
  missionType: string | null;
  // Source tracking
  dataSource: 'integration' | 'csv' | 'derived';
  processedAt: string;
}

// =============================================================================
// TELEMETRY (BLACK BOX DATA)
// =============================================================================

export interface CanonicalTelemetryRecord {
  flightId: string;
  timestamp: string;
  phase: FlightPhase;
  parameters: Record<string, number>;
}

export interface TelemetryTimeline {
  flightId: string;
  tailNumber: string;
  startTime: string;
  endTime: string;
  recordCount: number;
  availableParameters: string[];
  phaseBreakdown: Record<FlightPhase, number>; // count per phase
}

// =============================================================================
// FINDINGS
// =============================================================================

/**
 * Finding classification - requires rule authority for operational classifications
 */
export type CanonicalFindingClassification =
  | null                  // No classification yet
  | 'observation'         // Baseline - always allowed (no rule needed)
  | 'candidate'           // Needs review - always allowed
  | 'confirmed'           // Rule-authorized finding
  | 'grounding'           // Rule-authorized + grounding policy (REQUIRES AUTHORITY)
  | 'critical';           // Rule-authorized + critical policy (REQUIRES AUTHORITY)

export interface CanonicalFinding {
  id: string;
  source: 'measured' | 'reported' | 'derived';
  severity: SeverityLevel;
  
  // Rule authority linkage
  ruleId: string | null;
  ruleVersion: number | null;
  
  status: FindingStatus;
  classification: CanonicalFindingClassification;
  
  // Content
  titleHe: string;
  titleEn: string;
  descriptionHe: string;
  descriptionEn: string;
  technicalDetail: string | null;
  
  // Scope
  tailNumbers: string[];
  flightIds: string[];
  systemAffected: string | null;
  
  // Recommendations
  recommendationHe: string | null;
  recommendationEn: string | null;
  requiredActionType: 'immediate' | 'before_next_sortie' | 'scheduled' | 'monitor' | null;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

// =============================================================================
// WORK ORDERS & MAINTENANCE
// =============================================================================

export type WorkOrderStatus = 
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_parts'
  | 'awaiting_approval'
  | 'completed'
  | 'cancelled';

export interface CanonicalWorkOrder {
  id: string;
  tailNumber: string;
  findingId: string | null;
  
  status: WorkOrderStatus;
  priority: 'routine' | 'priority' | 'urgent' | 'aog'; // AOG = Aircraft on Ground
  
  titleHe: string;
  descriptionHe: string;
  
  assignedTo: string | null;
  assignedRole: UserRole | null;
  
  dueType: 'before_sortie' | 'within_hours' | 'within_days' | 'scheduled';
  dueValue: number | null; // hours or days depending on dueType
  
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedBy: string | null;
  
  // Outcome tracking
  outcome: WorkOrderOutcome | null;
}

export type WorkOrderOutcome = 
  | 'fixed'
  | 'replaced'
  | 'nff'  // No Fault Found
  | 'deferred'
  | 'rejected';

// =============================================================================
// LOGISTICS / PARTS
// =============================================================================

export type PartAvailability = 
  | 'in_stock'
  | 'ordered'
  | 'backordered'
  | 'unavailable';

export interface CanonicalPartStatus {
  partNumber: string;
  partName: string;
  availability: PartAvailability;
  quantityInStock: number;
  quantityNeeded: number;
  eta: string | null;  // ISO date string
  linkedWorkOrderIds: string[];
  supplier: string | null;
  lastUpdated: string;
}

// =============================================================================
// RULES (AUTHORITY SOURCE)
// =============================================================================

export type RuleStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'deprecated';

export interface CanonicalRule {
  id: string;
  name: string;
  nameHe: string;
  description: string;
  descriptionHe: string;
  
  // Authority
  status: RuleStatus;
  isActive: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  
  // What this rule authorizes
  allowedClassifications: CanonicalFindingClassification[];
  groundingAuthorized: boolean;
  
  // Conditions
  conditions: RuleCondition[];
  scope: RuleScope;
  
  // Severity mapping
  severity: SeverityLevel;
  
  // Metadata
  createdAt: string;
  createdBy: string;
  version: number;
}

export interface RuleCondition {
  parameter: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between' | 'outside';
  value: number | [number, number];
  phase?: FlightPhase[];
  debounceSeconds?: number;
}

export interface RuleScope {
  tailNumbers?: string[];
  phases?: FlightPhase[];
  flightTypes?: string[];
}

// =============================================================================
// AGGREGATIONS & DERIVED DATA
// =============================================================================

export interface FleetReadinessSummary {
  totalAircraft: number;
  available: number;
  inMaintenance: number;
  awaitingParts: number;
  grounded: number;
  restricted: number;
  unknown: number;
  
  // Only populated if we have real data
  readinessPercentage: number | null;
  lastCalculated: string;
}

export interface DailyStats {
  date: string;
  flightsCompleted: number;
  flightHoursLogged: number;
  findingsGenerated: number;
  criticalFindings: number;
  workOrdersOpened: number;
  workOrdersClosed: number;
  
  // Computed only from actual data
  isComputed: boolean;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface DataValidationResult {
  isValid: boolean;
  errors: DataValidationError[];
  warnings: DataValidationWarning[];
  timestamp: string;
}

export interface DataValidationError {
  code: string;
  message: string;
  field?: string;
  value?: any;
}

export interface DataValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}
