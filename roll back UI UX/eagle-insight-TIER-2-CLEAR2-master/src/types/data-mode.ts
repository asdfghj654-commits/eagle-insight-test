/**
 * Data Mode Configuration
 * 
 * PRODUCTION RULE: Demo mode is DISABLED in production builds.
 * This file enforces the separation between development/demo and production data handling.
 */

export type DataMode = 'live' | 'demo';

export interface DataModeConfig {
  mode: DataMode;
  isDemoAllowed: boolean;
  lastDataSource: 'integration' | 'csv' | 'demo' | null;
  lastUpdateTimestamp: string | null;
}

// =============================================================================
// BUILD-TIME CONFIGURATION
// =============================================================================

/**
 * PRODUCTION_BUILD: True when NODE_ENV is 'production'
 * In production builds, demo functionality is completely disabled.
 */
export const PRODUCTION_BUILD = process.env.NODE_ENV === 'production';

/**
 * DEMO_MODE_ALLOWED: False in production, true in development
 * This gate prevents any demo data from being loaded in production.
 */
export const DEMO_MODE_ALLOWED = !PRODUCTION_BUILD;

/**
 * Log a warning if demo mode is attempted in production
 */
export const logDemoAttemptInProduction = (source: string): void => {
  if (PRODUCTION_BUILD) {
    console.error(
      `[PRODUCTION VIOLATION] Demo data loading attempted from ${source}. ` +
      `This action is BLOCKED in production builds.`
    );
  }
};

// =============================================================================
// STATUS LABELS REQUIRING RULE AUTHORITY
// =============================================================================

/**
 * These status labels MUST NOT appear in the UI unless there is an active,
 * approved rule that authorizes their use.
 */
export const REQUIRES_RULE_AUTHORITY: Record<string, string> = {
  // English -> Fallback
  'grounded': 'status_unknown',
  'critical': 'high_priority',
  'anomaly': 'observation',
  'blocking': 'open',
  'not_airworthy': 'under_review',
  'urgent': 'awaiting_review',
  
  // Hebrew -> Fallback
  'מקורקע': 'סטטוס לא ידוע',
  'קריטי': 'עדיפות גבוהה',
  'חריג': 'תצפית',
  'חסימה': 'פתוח',
  'לא כשיר': 'בבדיקה',
  'דחוף': 'ממתין לבדיקה',
};

/**
 * Status labels that are ALWAYS allowed (no rule required)
 */
export const ALWAYS_ALLOWED_STATUSES = [
  'unknown',
  'new',
  'open',
  'pending',
  'observation',
  'candidate',
  'in_progress',
  'completed',
  'closed',
  // Hebrew equivalents
  'לא ידוע',
  'חדש',
  'פתוח',
  'ממתין',
  'תצפית',
  'מועמד',
  'בביצוע',
  'הושלם',
  'סגור',
];

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export interface DataModeValidation {
  isValid: boolean;
  violations: string[];
  timestamp: string;
}

/**
 * Validate that the current data mode configuration is production-safe
 */
export const validateDataModeForProduction = (
  currentMode: DataMode,
  hasRealData: boolean
): DataModeValidation => {
  const violations: string[] = [];
  
  if (PRODUCTION_BUILD) {
    if (currentMode === 'demo') {
      violations.push('Demo mode is active in production build');
    }
    
    if (!hasRealData && currentMode === 'live') {
      // This is acceptable - show empty states
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Get the appropriate display mode badge text
 */
export const getDataModeBadge = (mode: DataMode): { text: string; variant: 'demo' | 'live' } | null => {
  if (mode === 'demo') {
    return { text: 'נתוני הדגמה', variant: 'demo' };
  }
  // In live mode, no badge needed
  return null;
};
