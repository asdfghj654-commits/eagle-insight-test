/**
 * useRuleAuthority Hook
 * 
 * PRODUCTION RULE: The system MUST NOT display operational classifications
 * unless there is a corresponding active, approved rule that authorizes them.
 * 
 * This hook provides functions to check if a classification/status is authorized.
 */

import { useMemo, useCallback } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { 
  CanonicalFindingClassification, 
  CanonicalRule 
} from '@/types/canonical';
import {
  REQUIRES_RULE_AUTHORITY,
  ALWAYS_ALLOWED_STATUSES,
} from '@/types/data-mode';

interface RuleAuthorityResult {
  // Active rules that can authorize classifications
  activeRules: CanonicalRule[];
  
  // Check if a classification is allowed by any active rule
  canClassify: (classification: CanonicalFindingClassification) => boolean;
  
  // Check if grounding is authorized by any active rule
  canGround: () => boolean;
  
  // Get the rule that authorizes a specific classification
  getAuthorityFor: (classification: CanonicalFindingClassification) => CanonicalRule | null;
  
  // Check if a status label is authorized to be displayed
  isStatusAuthorized: (status: string) => boolean;
  
  // Sanitize a status to its authorized form
  sanitizeStatus: (status: string) => string;
  
  // Get all currently authorized classifications
  authorizedClassifications: CanonicalFindingClassification[];
}

/**
 * Hook to check rule authority for status labels and classifications
 */
export const useRuleAuthority = (): RuleAuthorityResult => {
  const { rules } = useCSVData();
  
  // Filter to only active, approved rules
  const activeRules = useMemo(() => {
    return (rules || []).filter(r => 
      r.status === 'approved' && r.isActive
    ) as CanonicalRule[];
  }, [rules]);
  
  // Build set of all authorized classifications from active rules
  const authorizedClassifications = useMemo(() => {
    const classifications = new Set<CanonicalFindingClassification>();
    
    // Always allowed classifications
    classifications.add('observation');
    classifications.add('candidate');
    classifications.add(null);
    
    // Classifications from active rules
    activeRules.forEach(rule => {
      if (rule.allowedClassifications) {
        rule.allowedClassifications.forEach(c => classifications.add(c));
      }
    });
    
    return Array.from(classifications);
  }, [activeRules]);
  
  // Check if a classification is authorized
  const canClassify = useCallback((
    classification: CanonicalFindingClassification
  ): boolean => {
    // null and baseline classifications are always allowed
    if (classification === null) return true;
    if (classification === 'observation') return true;
    if (classification === 'candidate') return true;
    
    // Check if any active rule authorizes this classification
    return activeRules.some(rule => 
      rule.allowedClassifications?.includes(classification)
    );
  }, [activeRules]);
  
  // Check if grounding is authorized by any active rule
  const canGround = useCallback((): boolean => {
    return activeRules.some(rule => rule.groundingAuthorized);
  }, [activeRules]);
  
  // Get the specific rule that authorizes a classification
  const getAuthorityFor = useCallback((
    classification: CanonicalFindingClassification
  ): CanonicalRule | null => {
    if (!classification) return null;
    if (classification === 'observation' || classification === 'candidate') {
      return null; // These don't need rule authority
    }
    
    return activeRules.find(rule => 
      rule.allowedClassifications?.includes(classification)
    ) || null;
  }, [activeRules]);
  
  // Check if a status string is authorized to be displayed
  const isStatusAuthorized = useCallback((status: string): boolean => {
    const normalized = status.toLowerCase();
    
    // Always allowed statuses
    if (ALWAYS_ALLOWED_STATUSES.includes(normalized)) {
      return true;
    }
    
    // Check if this status requires authority
    if (REQUIRES_RULE_AUTHORITY[normalized]) {
      // Check if any active rule authorizes this status
      return activeRules.some(rule => {
        // Check if rule's severity/classification maps to this status
        if (normalized === 'critical' || normalized === 'קריטי') {
          return rule.severity === 'S1' && rule.isActive;
        }
        if (normalized === 'grounded' || normalized === 'מקורקע') {
          return rule.groundingAuthorized && rule.isActive;
        }
        // Default: check if rule has matching allowed classification
        return rule.allowedClassifications?.some(c => 
          c?.toLowerCase() === normalized
        );
      });
    }
    
    // Status not in restricted list, allow it
    return true;
  }, [activeRules]);
  
  // Sanitize a status to its authorized form
  const sanitizeStatus = useCallback((status: string): string => {
    const normalized = status.toLowerCase();
    
    // Check if this status is already authorized
    if (isStatusAuthorized(status)) {
      return status;
    }
    
    // Return the fallback status
    return REQUIRES_RULE_AUTHORITY[normalized] || status;
  }, [isStatusAuthorized]);
  
  return {
    activeRules,
    canClassify,
    canGround,
    getAuthorityFor,
    isStatusAuthorized,
    sanitizeStatus,
    authorizedClassifications,
  };
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get Hebrew label for a status, respecting rule authority
 */
export const getAuthorizedStatusLabel = (
  status: string,
  activeRules: CanonicalRule[]
): { label: string; isAuthorized: boolean } => {
  const normalized = status.toLowerCase();
  
  // Check if status requires authority
  const fallback = REQUIRES_RULE_AUTHORITY[normalized];
  if (!fallback) {
    return { label: status, isAuthorized: true };
  }
  
  // Check if authorized
  const isAuthorized = activeRules.some(rule => {
    if (normalized === 'critical' || normalized === 'קריטי') {
      return rule.severity === 'S1' && rule.isActive;
    }
    if (normalized === 'grounded' || normalized === 'מקורקע') {
      return rule.groundingAuthorized && rule.isActive;
    }
    return false;
  });
  
  return {
    label: isAuthorized ? status : fallback,
    isAuthorized,
  };
};

/**
 * Check if a finding can be classified as grounding
 */
export const canApplyGroundingClassification = (
  activeRules: CanonicalRule[]
): boolean => {
  return activeRules.some(rule => 
    rule.groundingAuthorized && 
    rule.status === 'approved' && 
    rule.isActive
  );
};

/**
 * Get all rules that authorize a specific action
 */
export const getRulesAuthorizingAction = (
  action: string,
  activeRules: CanonicalRule[]
): CanonicalRule[] => {
  switch (action) {
    case 'ground':
      return activeRules.filter(r => r.groundingAuthorized);
    case 'classify:critical':
      return activeRules.filter(r => 
        r.allowedClassifications?.includes('critical')
      );
    case 'classify:grounding':
      return activeRules.filter(r => 
        r.allowedClassifications?.includes('grounding')
      );
    default:
      return [];
  }
};

export default useRuleAuthority;
