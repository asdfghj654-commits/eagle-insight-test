/**
 * Rule Authority Guard Component
 * 
 * PRODUCTION RULE: This component prevents unauthorized status labels
 * and classifications from being displayed in the UI.
 * 
 * Usage:
 * <RuleAuthorityGuard 
 *   requiredClassification="grounding"
 *   fallback={<Badge variant="outline">סטטוס לא ידוע</Badge>}
 * >
 *   <Badge variant="destructive">מקורקע</Badge>
 * </RuleAuthorityGuard>
 */

import React from 'react';
import { useRuleAuthority } from '@/hooks/useRuleAuthority';
import { CanonicalFindingClassification } from '@/types/canonical';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

// =============================================================================
// CLASSIFICATION GUARD
// =============================================================================

interface RuleAuthorityGuardProps {
  /**
   * The classification that requires authorization
   */
  requiredClassification: CanonicalFindingClassification;
  
  /**
   * Content to render if authorized
   */
  children: React.ReactNode;
  
  /**
   * Fallback content if not authorized
   */
  fallback?: React.ReactNode;
  
  /**
   * Callback when access is blocked
   */
  onBlocked?: (reason: string) => void;
}

export const RuleAuthorityGuard: React.FC<RuleAuthorityGuardProps> = ({
  requiredClassification,
  children,
  fallback = null,
  onBlocked,
}) => {
  const { canClassify, getAuthorityFor } = useRuleAuthority();
  
  const isAuthorized = canClassify(requiredClassification);
  
  React.useEffect(() => {
    if (!isAuthorized && onBlocked) {
      const authority = getAuthorityFor(requiredClassification);
      onBlocked(
        authority 
          ? `Rule ${authority.id} does not authorize classification: ${requiredClassification}`
          : `No active rule authorizes classification: ${requiredClassification}`
      );
    }
  }, [isAuthorized, requiredClassification, onBlocked, getAuthorityFor]);
  
  if (!isAuthorized) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

// =============================================================================
// STATUS GUARD
// =============================================================================

interface StatusGuardProps {
  /**
   * The status string to check
   */
  status: string;
  
  /**
   * Content to render if authorized
   */
  children: React.ReactNode;
  
  /**
   * Fallback content if not authorized
   */
  fallback?: React.ReactNode;
}

export const StatusGuard: React.FC<StatusGuardProps> = ({
  status,
  children,
  fallback,
}) => {
  const { isStatusAuthorized, sanitizeStatus } = useRuleAuthority();
  
  if (!isStatusAuthorized(status)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    // Default fallback: show sanitized status
    const sanitized = sanitizeStatus(status);
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {sanitized}
      </Badge>
    );
  }
  
  return <>{children}</>;
};

// =============================================================================
// GROUNDING GUARD
// =============================================================================

interface GroundingGuardProps {
  /**
   * Content to render if grounding is authorized
   */
  children: React.ReactNode;
  
  /**
   * Fallback content if grounding is not authorized
   */
  fallback?: React.ReactNode;
  
  /**
   * Show warning message when blocked
   */
  showWarning?: boolean;
}

export const GroundingGuard: React.FC<GroundingGuardProps> = ({
  children,
  fallback,
  showWarning = false,
}) => {
  const { canGround } = useRuleAuthority();
  
  if (!canGround()) {
    if (showWarning) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>אין כלל פעיל שמאשר קרקוע</span>
        </div>
      );
    }
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

// =============================================================================
// ACTION GUARD
// =============================================================================

interface ActionGuardProps {
  /**
   * The action being attempted
   * Examples: 'ground:aircraft', 'classify:critical', 'close:finding'
   */
  action: string;
  
  /**
   * User role attempting the action
   */
  userRole?: string;
  
  /**
   * Content to render if action is authorized
   */
  children: React.ReactNode;
  
  /**
   * Fallback content if action is not authorized
   */
  fallback?: React.ReactNode;
  
  /**
   * Callback when action is blocked
   */
  onBlocked?: (reason: string) => void;
}

export const ActionGuard: React.FC<ActionGuardProps> = ({
  action,
  userRole,
  children,
  fallback,
  onBlocked,
}) => {
  const { canClassify, canGround, activeRules } = useRuleAuthority();
  
  const isAuthorized = React.useMemo(() => {
    // Parse action type
    if (action.startsWith('ground:')) {
      return canGround();
    }
    
    if (action.startsWith('classify:')) {
      const classification = action.split(':')[1] as CanonicalFindingClassification;
      return canClassify(classification);
    }
    
    // For other actions, check if there's any active rule
    // This is a simplified check - production would need more granular checks
    return activeRules.length > 0;
  }, [action, canClassify, canGround, activeRules]);
  
  React.useEffect(() => {
    if (!isAuthorized && onBlocked) {
      onBlocked(`Action "${action}" requires rule authority`);
    }
  }, [isAuthorized, action, onBlocked]);
  
  if (!isAuthorized) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

// =============================================================================
// AUTHORIZED STATUS BADGE
// =============================================================================

interface AuthorizedStatusBadgeProps {
  status: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  className?: string;
}

/**
 * A Badge that automatically sanitizes its content based on rule authority
 */
export const AuthorizedStatusBadge: React.FC<AuthorizedStatusBadgeProps> = ({
  status,
  variant = 'default',
  className,
}) => {
  const { sanitizeStatus, isStatusAuthorized } = useRuleAuthority();
  
  const displayStatus = sanitizeStatus(status);
  const isOriginal = isStatusAuthorized(status);
  
  // If status was sanitized, use a muted variant
  const effectiveVariant = isOriginal ? variant : 'outline';
  
  return (
    <Badge variant={effectiveVariant} className={className}>
      {displayStatus}
    </Badge>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export default RuleAuthorityGuard;
