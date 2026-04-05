// Rules Engine - מנוע כללי־סף (ספרות אחזקה)
// Based on maintenance literature thresholds and triggers
// 
// PRD Requirements:
// - Baseline Rules: כללי יסוד מערכתיים
// - Engineer Rules: כללים שהמהנדס מנסח
// - Governance: Engineer approval required
// - Versioning: Change tracking with rollback
// - Metrics: last run, matched count, impacted aircraft

import { SeverityLevel } from '@/types/core';

// =============================================================================
// LEGACY SEVERITY MAPPING (for backwards compatibility)
// =============================================================================

export type LegacySeverity = 'critical' | 'high' | 'medium' | 'low';

export const LEGACY_TO_S_SEVERITY: Record<LegacySeverity, SeverityLevel> = {
  critical: 'S1',
  high: 'S2',
  medium: 'S3',
  low: 'S4',
};

export const S_TO_LEGACY_SEVERITY: Record<SeverityLevel, LegacySeverity> = {
  S1: 'critical',
  S2: 'high',
  S3: 'medium',
  S4: 'low',
};

// =============================================================================
// RULE STATUS & GOVERNANCE
// =============================================================================

export type RuleStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'deprecated';
export type RuleType = 'baseline' | 'engineer';

export interface RuleVersion {
  version: number;
  changedAt: string;
  changedBy: string;
  changeType: 'created' | 'modified' | 'threshold_change' | 'status_change';
  changeDescription: string;
  previousThreshold?: number | [number, number];
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

// =============================================================================
// MAIN RULE INTERFACE
// =============================================================================

export interface MaintenanceRule {
  rule_id: string;
  
  // Classification
  type: RuleType;
  system: string;
  systemHe: string;
  parameter: string;
  
  // Thresholds
  threshold_type: 'greater_than' | 'less_than' | 'band' | 'trend' | 'consecutive';
  threshold_value: number | [number, number];
  unit?: string;
  
  // Context
  context: 'training' | 'combat' | 'weather_hard' | 'all';
  
  // Reference
  reference_doc: string;
  clause: string;
  
  // Severity (supports both legacy and new S1-S4)
  severity: LegacySeverity;
  severityS: SeverityLevel;
  
  // Access Control
  required_rank: 'technician' | 'maintenance-chief' | 'commander';
  
  // Content
  description: string;
  descriptionHe: string;
  recommended_action: string;
  recommended_actionHe: string;
  
  // Governance
  status: RuleStatus;
  version: number;
  versionHistory: RuleVersion[];
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  
  // Metrics
  metrics: RuleMetrics;
}

export interface FlightData {
  flight_id: string;
  tail: string;
  mission_type: 'training' | 'combat' | 'weather_hard';
  parameters: Record<string, number[]>;
  timestamps: number[];
  duration_min: number;
}

export interface RuleViolation {
  rule_id: string;
  flight_id: string;
  parameter: string;
  actual_value: number;
  threshold_value: number | [number, number];
  severity: string;
  severityS: SeverityLevel;
  timestamp: number;
  duration_sec?: number;
}

// =============================================================================
// DEFAULT RULE TEMPLATE
// =============================================================================

const createDefaultMetrics = (): RuleMetrics => ({
  matchedCount: 0,
  impactedAircraft: [],
  falsePositiveCount: 0,
});

const createDefaultVersionHistory = (createdBy: string): RuleVersion[] => [{
  version: 1,
  changedAt: new Date().toISOString(),
  changedBy: createdBy,
  changeType: 'created',
  changeDescription: 'Initial rule creation',
}];

// =============================================================================
// ערכי סף מהספרות האחזקתית - MAINTENANCE RULES
// =============================================================================

export const MAINTENANCE_RULES: MaintenanceRule[] = [
  {
    rule_id: "HYD_001",
    type: 'baseline',
    system: "הידראוליות",
    systemHe: "מערכת הידראולית",
    parameter: "hydraulic_pressure_psi",
    threshold_type: "less_than",
    threshold_value: 2800,
    unit: "PSI",
    context: "all",
    reference_doc: "T.O. 1F-16A-2-70JG-00-1",
    clause: "§2.3.1",
    severity: "critical",
    severityS: "S1",
    required_rank: "maintenance-chief",
    description: "Hydraulic pressure below safety threshold",
    descriptionHe: "לחץ הידראוליים מתחת לרף הביטחוני",
    recommended_action: "Inspect hydraulic system and repair leaks",
    recommended_actionHe: "בדיקת מערכת הידראוליות ותיקון דליפות",
    status: 'active',
    version: 1,
    versionHistory: createDefaultVersionHistory('system'),
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
    approvedBy: 'chief_engineer',
    approvedAt: '2024-01-01T00:00:00Z',
    metrics: createDefaultMetrics(),
  },
  {
    rule_id: "ENG_001", 
    type: 'baseline',
    system: "מנוע",
    systemHe: "מנוע",
    parameter: "egt_celsius",
    threshold_type: "greater_than",
    threshold_value: 650,
    unit: "°C",
    context: "all",
    reference_doc: "T.O. 1F-16A-2-70JG-00-1",
    clause: "§4.1.2",
    severity: "critical",
    severityS: "S1",
    required_rank: "maintenance-chief",
    description: "Exhaust gas temperature exceeds limit",
    descriptionHe: "טמפרטורת גזי פליטה גבוהה מהמותר",
    recommended_action: "Engine inspection and sensor calibration",
    recommended_actionHe: "בדיקת מנוע וכיול חיישנים",
    status: 'active',
    version: 1,
    versionHistory: createDefaultVersionHistory('system'),
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
    approvedBy: 'chief_engineer',
    approvedAt: '2024-01-01T00:00:00Z',
    metrics: createDefaultMetrics(),
  },
  {
    rule_id: "LAND_001",
    type: 'baseline',
    system: "נחיתה",
    systemHe: "מערכת נחיתה",
    parameter: "landing_speed_kts",
    threshold_type: "greater_than", 
    threshold_value: 165,
    unit: "קשר",
    context: "training",
    reference_doc: "T.O. 1F-16A-1",
    clause: "§3.2.5",
    severity: "high",
    severityS: "S2",
    required_rank: "maintenance-chief",
    description: "Landing speed exceeds recommended limit for training",
    descriptionHe: "מהירות נחיתה גבוהה מהמומלץ באימון",
    recommended_action: "Inspect brake system and tire wear",
    recommended_actionHe: "בדיקת מערכת בלמים ועמידת צמיגים",
    status: 'active',
    version: 1,
    versionHistory: createDefaultVersionHistory('system'),
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
    approvedBy: 'chief_engineer',
    approvedAt: '2024-01-01T00:00:00Z',
    metrics: createDefaultMetrics(),
  },
  {
    rule_id: "GLOAD_001",
    type: 'baseline',
    system: "מבנה",
    systemHe: "מבנה מטוס",
    parameter: "g_load",
    threshold_type: "greater_than",
    threshold_value: 7.5,
    unit: "G",
    context: "training",
    reference_doc: "T.O. 1F-16A-1",
    clause: "§2.1.3",
    severity: "high", 
    severityS: "S2",
    required_rank: "commander",
    description: "G-load exceeds training limit",
    descriptionHe: "עומס G גבוה מהמותר באימון",
    recommended_action: "Aircraft structure inspection and flight behavior debrief",
    recommended_actionHe: "בדיקת מבנה מטוס ותחקיר התנהגות טיסה",
    status: 'active',
    version: 1,
    versionHistory: createDefaultVersionHistory('system'),
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
    approvedBy: 'chief_engineer',
    approvedAt: '2024-01-01T00:00:00Z',
    metrics: createDefaultMetrics(),
  },
  {
    rule_id: "BRAKE_001",
    type: 'baseline',
    system: "בלמים",
    systemHe: "מערכת בלמים",
    parameter: "brake_temp_celsius", 
    threshold_type: "greater_than",
    threshold_value: 400,
    unit: "°C",
    context: "all",
    reference_doc: "T.O. 1F-16A-2-70JG-00-1",
    clause: "§5.3.1",
    severity: "medium",
    severityS: "S3",
    required_rank: "technician",
    description: "Brake temperature elevated",
    descriptionHe: "טמפרטורת בלמים גבוהה",
    recommended_action: "Cool brake system and perform visual inspection",
    recommended_actionHe: "קירור מערכת בלמים וביצוע בדיקת חזותית",
    status: 'active',
    version: 1,
    versionHistory: createDefaultVersionHistory('system'),
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
    approvedBy: 'chief_engineer',
    approvedAt: '2024-01-01T00:00:00Z',
    metrics: createDefaultMetrics(),
  },
  {
    rule_id: "FUEL_001",
    type: 'baseline',
    system: "דלק",
    systemHe: "מערכת דלק",
    parameter: "fuel_flow_pph",
    threshold_type: "band",
    threshold_value: [800, 12000],
    unit: "PPH",
    context: "all",
    reference_doc: "T.O. 1F-16A-2-70JG-00-1", 
    clause: "§6.2.1",
    severity: "medium",
    severityS: "S3",
    required_rank: "technician",
    description: "Fuel flow outside normal range",
    descriptionHe: "זרימת דלק מחוץ לטווח התקין",
    recommended_action: "Inspect fuel system and pumps",
    recommended_actionHe: "בדיקת מערכת דלק ומשאבות",
    status: 'active',
    version: 1,
    versionHistory: createDefaultVersionHistory('system'),
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
    approvedBy: 'chief_engineer',
    approvedAt: '2024-01-01T00:00:00Z',
    metrics: createDefaultMetrics(),
  }
];

export class RulesEngine {
  private rules: MaintenanceRule[];

  constructor(rules: MaintenanceRule[] = MAINTENANCE_RULES) {
    this.rules = rules;
  }

  // =============================================================================
  // RULE EVALUATION
  // =============================================================================

  // בדיקת חריגות מול כללי הספרות
  evaluateFlightData(flightData: FlightData): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const rule of this.rules) {
      // Skip non-active rules
      if (rule.status !== 'active') {
        continue;
      }

      if (rule.context !== 'all' && rule.context !== flightData.mission_type) {
        continue;
      }

      const parameterData = flightData.parameters[rule.parameter];
      if (!parameterData || parameterData.length === 0) {
        continue;
      }

      const violation = this.checkRuleViolation(rule, parameterData, flightData);
      if (violation) {
        // Update rule metrics
        this.updateRuleMetrics(rule.rule_id, flightData.tail, flightData.flight_id);
        
        violations.push({
          ...violation,
          flight_id: flightData.flight_id,
          severityS: rule.severityS,
        });
      }
    }

    return violations;
  }

  private checkRuleViolation(
    rule: MaintenanceRule, 
    data: number[], 
    flightData: FlightData
  ): Omit<RuleViolation, 'flight_id' | 'severityS'> | null {
    
    switch (rule.threshold_type) {
      case 'greater_than':
        const maxValue = Math.max(...data);
        if (maxValue > (rule.threshold_value as number)) {
          const violationIndex = data.indexOf(maxValue);
          return {
            rule_id: rule.rule_id,
            parameter: rule.parameter,
            actual_value: maxValue,
            threshold_value: rule.threshold_value,
            severity: rule.severity,
            timestamp: flightData.timestamps[violationIndex] || Date.now()
          };
        }
        break;

      case 'less_than':
        const minValue = Math.min(...data);
        if (minValue < (rule.threshold_value as number)) {
          const violationIndex = data.indexOf(minValue);
          return {
            rule_id: rule.rule_id,
            parameter: rule.parameter,
            actual_value: minValue,
            threshold_value: rule.threshold_value,
            severity: rule.severity,
            timestamp: flightData.timestamps[violationIndex] || Date.now()
          };
        }
        break;

      case 'band':
        const [minThreshold, maxThreshold] = rule.threshold_value as [number, number];
        const outOfBandValue = data.find(val => val < minThreshold || val > maxThreshold);
        if (outOfBandValue !== undefined) {
          const violationIndex = data.indexOf(outOfBandValue);
          return {
            rule_id: rule.rule_id,
            parameter: rule.parameter,
            actual_value: outOfBandValue,
            threshold_value: rule.threshold_value,
            severity: rule.severity,
            timestamp: flightData.timestamps[violationIndex] || Date.now()
          };
        }
        break;

      case 'consecutive':
        // בדיקה לאירועים רצופים
        const threshold = rule.threshold_value as number;
        let consecutiveCount = 0;
        for (const value of data) {
          if (value > threshold) {
            consecutiveCount++;
            if (consecutiveCount >= 3) { // 3 אירועים רצופים
              return {
                rule_id: rule.rule_id,
                parameter: rule.parameter,
                actual_value: value,
                threshold_value: rule.threshold_value,
                severity: rule.severity,
                timestamp: Date.now(),
                duration_sec: consecutiveCount * 10 // הנחה של 10 שניות לכל דגימה
              };
            }
          } else {
            consecutiveCount = 0;
          }
        }
        break;
    }

    return null;
  }

  // =============================================================================
  // RULE METRICS
  // =============================================================================

  private updateRuleMetrics(ruleId: string, tail: string, flightId: string): void {
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (rule) {
      rule.metrics.lastRun = new Date().toISOString();
      rule.metrics.matchedCount++;
      rule.metrics.lastMatchedFlightId = flightId;
      if (!rule.metrics.impactedAircraft.includes(tail)) {
        rule.metrics.impactedAircraft.push(tail);
      }
    }
  }

  // =============================================================================
  // RULE CRUD OPERATIONS
  // =============================================================================

  // קבלת כלל לפי מזהה
  getRule(ruleId: string): MaintenanceRule | undefined {
    return this.rules.find(rule => rule.rule_id === ruleId);
  }

  // קבלת כללים לפי מערכת
  getRulesBySystem(system: string): MaintenanceRule[] {
    return this.rules.filter(rule => rule.system === system);
  }

  // קבלת כללים לפי סטטוס
  getRulesByStatus(status: RuleStatus): MaintenanceRule[] {
    return this.rules.filter(rule => rule.status === status);
  }

  // קבלת כללים פעילים בלבד
  getActiveRules(): MaintenanceRule[] {
    return this.rules.filter(rule => rule.status === 'active');
  }

  // קבלת כל הכללים
  getAllRules(): MaintenanceRule[] {
    return [...this.rules];
  }

  // =============================================================================
  // GOVERNANCE - RULE CREATION & MODIFICATION
  // =============================================================================

  // הוספת כלל חדש (Draft)
  addRule(rule: Omit<MaintenanceRule, 'status' | 'version' | 'versionHistory' | 'metrics' | 'createdAt'>): MaintenanceRule {
    const newRule: MaintenanceRule = {
      ...rule,
      status: 'draft',
      version: 1,
      versionHistory: [{
        version: 1,
        changedAt: new Date().toISOString(),
        changedBy: rule.createdBy,
        changeType: 'created',
        changeDescription: 'Initial rule creation',
      }],
      createdAt: new Date().toISOString(),
      metrics: {
        matchedCount: 0,
        impactedAircraft: [],
        falsePositiveCount: 0,
      },
    };
    
    this.rules.push(newRule);
    return newRule;
  }

  // עדכון כלל קיים (requires approval for threshold changes)
  updateRule(
    ruleId: string, 
    updates: Partial<MaintenanceRule>, 
    changedBy: string,
    changeDescription: string
  ): { success: boolean; requiresApproval: boolean; rule?: MaintenanceRule } {
    const index = this.rules.findIndex(rule => rule.rule_id === ruleId);
    if (index === -1) {
      return { success: false, requiresApproval: false };
    }

    const existingRule = this.rules[index];
    
    // Check if this is a threshold change
    const isThresholdChange = updates.threshold_value !== undefined && 
      JSON.stringify(updates.threshold_value) !== JSON.stringify(existingRule.threshold_value);
    
    // Determine if approval is required
    const requiresApproval = isThresholdChange || 
      updates.severity !== undefined ||
      updates.severityS !== undefined;

    // Create new version entry
    const newVersion: RuleVersion = {
      version: existingRule.version + 1,
      changedAt: new Date().toISOString(),
      changedBy,
      changeType: isThresholdChange ? 'threshold_change' : 'modified',
      changeDescription,
      previousThreshold: isThresholdChange ? existingRule.threshold_value : undefined,
    };

    // Update rule
    const updatedRule: MaintenanceRule = {
      ...existingRule,
      ...updates,
      version: newVersion.version,
      versionHistory: [...existingRule.versionHistory, newVersion],
      status: requiresApproval ? 'pending_approval' : existingRule.status,
    };

    this.rules[index] = updatedRule;

    return { success: true, requiresApproval, rule: updatedRule };
  }

  // =============================================================================
  // GOVERNANCE - APPROVAL WORKFLOW
  // =============================================================================

  // Submit rule for approval
  submitForApproval(ruleId: string, submittedBy: string): boolean {
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (!rule || rule.status !== 'draft') {
      return false;
    }

    rule.status = 'pending_approval';
    rule.versionHistory.push({
      version: rule.version,
      changedAt: new Date().toISOString(),
      changedBy: submittedBy,
      changeType: 'status_change',
      changeDescription: 'Submitted for approval',
    });

    return true;
  }

  // Approve rule (Engineer only)
  approveRule(ruleId: string, approvedBy: string): boolean {
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (!rule || rule.status !== 'pending_approval') {
      return false;
    }

    rule.status = 'active';
    rule.approvedBy = approvedBy;
    rule.approvedAt = new Date().toISOString();
    
    // Update the last version entry with approval info
    const lastVersion = rule.versionHistory[rule.versionHistory.length - 1];
    lastVersion.approvedBy = approvedBy;
    lastVersion.approvedAt = rule.approvedAt;

    rule.versionHistory.push({
      version: rule.version,
      changedAt: new Date().toISOString(),
      changedBy: approvedBy,
      changeType: 'status_change',
      changeDescription: 'Rule approved and activated',
      approvedBy,
      approvedAt: rule.approvedAt,
    });

    return true;
  }

  // Reject rule
  rejectRule(ruleId: string, rejectedBy: string, reason: string): boolean {
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (!rule || rule.status !== 'pending_approval') {
      return false;
    }

    rule.status = 'draft';
    rule.versionHistory.push({
      version: rule.version,
      changedAt: new Date().toISOString(),
      changedBy: rejectedBy,
      changeType: 'status_change',
      changeDescription: `Rejected: ${reason}`,
    });

    return true;
  }

  // Pause rule
  pauseRule(ruleId: string, pausedBy: string, reason: string): boolean {
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (!rule || rule.status !== 'active') {
      return false;
    }

    rule.status = 'paused';
    rule.versionHistory.push({
      version: rule.version,
      changedAt: new Date().toISOString(),
      changedBy: pausedBy,
      changeType: 'status_change',
      changeDescription: `Paused: ${reason}`,
    });

    return true;
  }

  // Resume paused rule
  resumeRule(ruleId: string, resumedBy: string): boolean {
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (!rule || rule.status !== 'paused') {
      return false;
    }

    rule.status = 'active';
    rule.versionHistory.push({
      version: rule.version,
      changedAt: new Date().toISOString(),
      changedBy: resumedBy,
      changeType: 'status_change',
      changeDescription: 'Rule resumed',
    });

    return true;
  }

  // Deprecate rule
  deprecateRule(ruleId: string, deprecatedBy: string, reason: string): boolean {
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (!rule) {
      return false;
    }

    rule.status = 'deprecated';
    rule.versionHistory.push({
      version: rule.version,
      changedAt: new Date().toISOString(),
      changedBy: deprecatedBy,
      changeType: 'status_change',
      changeDescription: `Deprecated: ${reason}`,
    });

    return true;
  }

  // =============================================================================
  // RULE METRICS & REPORTING
  // =============================================================================

  // Get rules with no hits (for review)
  getRulesWithNoHits(): MaintenanceRule[] {
    return this.rules.filter(r => r.status === 'active' && r.metrics.matchedCount === 0);
  }

  // Get high-impact rules
  getHighImpactRules(): MaintenanceRule[] {
    return this.rules
      .filter(r => r.status === 'active')
      .sort((a, b) => b.metrics.matchedCount - a.metrics.matchedCount)
      .slice(0, 10);
  }

  // Report false positive
  reportFalsePositive(ruleId: string): void {
    const rule = this.rules.find(r => r.rule_id === ruleId);
    if (rule) {
      rule.metrics.falsePositiveCount++;
    }
  }
}

// יצירת מופע גלובלי של מנוע הכללים
export const rulesEngine = new RulesEngine();