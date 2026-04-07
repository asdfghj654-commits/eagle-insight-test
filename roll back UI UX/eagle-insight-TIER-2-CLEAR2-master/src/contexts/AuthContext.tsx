/**
 * Authentication Context
 * 
 * Provides:
 * - User authentication (login/logout)
 * - Session persistence (localStorage)
 * - Role-based access control
 * - Route guards
 * 
 * Users are stored per-role, each with their own identity.
 * No "role switching" in production - user logs in as themselves.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserRole } from '@/types/core';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthUser {
  id: string;
  personalNumber: string; // מספר אישי
  name: string;
  nameHe: string;
  role: UserRole;
  roleHe: string;
  unit: string;
  unitHe: string;
  rank: string;
  rankHe: string;
  permissions: string[];
  avatarUrl?: string;
}

interface AuthContextType {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (personalNumber: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  
  // Permission checking
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  
  // Route helpers
  getDefaultRoute: () => string;
  
  // Dev mode only
  isDevelopment: boolean;
  devLoginAs: (role: UserRole) => void;
}

interface LoginResult {
  success: boolean;
  error?: string;
  errorHe?: string;
}

// =============================================================================
// DEMO USERS (In production, this would come from a real auth system)
// =============================================================================

const DEMO_USERS: Record<string, AuthUser & { password: string }> = {
  // Technician - סמ"ר יוסי כהן
  'tech001': {
    id: 'tech001',
    personalNumber: '8234567',
    name: 'Yossi Cohen',
    nameHe: 'יוסי כהן',
    role: 'technician',
    roleHe: 'טכנאי מטוסים',
    unit: 'Squadron 117',
    unitHe: 'טייסת 117',
    rank: 'Staff Sergeant',
    rankHe: 'סמ"ר',
    permissions: ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task'],
    password: 'tech123',
  },
  
  // Specialist / Maintenance Lead - רס"ל דוד לוי (ר"צ)
  'spec001': {
    id: 'spec001',
    personalNumber: '7123456',
    name: 'David Levi',
    nameHe: 'דוד לוי',
    role: 'specialist',
    roleHe: 'ר"צ אחזקה',
    unit: 'Squadron 117',
    unitHe: 'טייסת 117',
    rank: 'First Lieutenant',
    rankHe: 'רס"ל',
    permissions: ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task', 'view_evidence', 'compare_flights', 'escalate_finding', 'triage', 'fleet_status', 'reports'],
    password: 'spec123',
  },
  
  // Engineer - סא"ל רון אברהם
  'eng001': {
    id: 'eng001',
    personalNumber: '6012345',
    name: 'Ron Avraham',
    nameHe: 'רון אברהם',
    role: 'engineer',
    roleHe: 'מהנדס אחזקה',
    unit: 'Technical Branch',
    unitHe: 'ענף טכני',
    rank: 'Lieutenant Colonel',
    rankHe: 'סא"ל',
    permissions: ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task', 'view_evidence', 'compare_flights', 'escalate_finding', 'approve_rules', 'modify_thresholds', 'reject_findings', 'approve_finding_rejection', 'investigation', 'rule_management', 'review_queue'],
    password: 'eng123',
  },
  
  // Commander - אל"מ משה ישראלי
  'cmd001': {
    id: 'cmd001',
    personalNumber: '5001234',
    name: 'Moshe Israeli',
    nameHe: 'משה ישראלי',
    role: 'commander',
    roleHe: 'מפקד גף טכני',
    unit: 'Technical Branch HQ',
    unitHe: 'מפקדת גף טכני',
    rank: 'Colonel',
    rankHe: 'אל"מ',
    permissions: ['view_all', 'fleet_overview', 'emergency_mode', 'view_pilot_behavior', 'accountability_reports'],
    password: 'cmd123',
  },
};

// Personal number to user ID mapping
const PERSONAL_NUMBER_MAP: Record<string, string> = {
  '8234567': 'tech001',
  '7123456': 'spec001',
  '6012345': 'eng001',
  '5001234': 'cmd001',
};

// =============================================================================
// DEFAULT ROUTES PER ROLE
// =============================================================================

const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  technician: '/tech/queue',
  specialist: '/lead/triage',
  engineer: '/portal/magen-achzaka-david',
  commander: '/commander',
};

// =============================================================================
// CONTEXT
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'eagle_insight_auth';
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

// =============================================================================
// PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // =============================================================================
  // SESSION PERSISTENCE
  // =============================================================================

  // Load session on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Validate the stored user still exists
          if (DEMO_USERS[parsed.id]) {
            // Refresh user data from source (in case permissions changed)
            const { password, ...userData } = DEMO_USERS[parsed.id];
            setUser(userData);
          }
        }
      } catch (error) {
        console.error('Failed to load auth session:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Save session on user change
  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: user.id }));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  // =============================================================================
  // LOGIN / LOGOUT
  // =============================================================================

  const login = useCallback(async (personalNumber: string, password: string): Promise<LoginResult> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find user by personal number
    const userId = PERSONAL_NUMBER_MAP[personalNumber];
    if (!userId) {
      return { 
        success: false, 
        error: 'User not found',
        errorHe: 'משתמש לא נמצא'
      };
    }

    const demoUser = DEMO_USERS[userId];
    if (!demoUser) {
      return { 
        success: false, 
        error: 'User not found',
        errorHe: 'משתמש לא נמצא'
      };
    }

    // Check password
    if (demoUser.password !== password) {
      return { 
        success: false, 
        error: 'Invalid password',
        errorHe: 'סיסמה שגויה'
      };
    }

    // Success - set user (without password)
    const { password: _, ...userData } = demoUser;
    setUser(userData);

    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  // =============================================================================
  // DEV MODE LOGIN (for quick testing)
  // =============================================================================

  const devLoginAs = useCallback((role: UserRole) => {
    if (!isDevelopment) {
      console.warn('devLoginAs is only available in development mode');
      return;
    }

    const userEntry = Object.entries(DEMO_USERS).find(([_, u]) => u.role === role);
    if (userEntry) {
      const { password: _, ...userData } = userEntry[1];
      setUser(userData);
    }
  }, []);

  // =============================================================================
  // PERMISSION CHECKING
  // =============================================================================

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission) || user.permissions.includes('view_all');
  }, [user]);

  const hasRole = useCallback((roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  }, [user]);

  // =============================================================================
  // ROUTE HELPERS
  // =============================================================================

  const getDefaultRoute = useCallback((): string => {
    if (!user) return '/login';
    return ROLE_DEFAULT_ROUTES[user.role] || '/';
  }, [user]);

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasPermission,
    hasRole,
    getDefaultRoute,
    isDevelopment,
    devLoginAs,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// =============================================================================
// HOOKS
// =============================================================================

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// =============================================================================
// ROUTE GUARDS (Components)
// =============================================================================

interface RequireAuthProps {
  children: ReactNode;
  redirectTo?: string;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  redirectTo = '/login' 
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setShouldRedirect(true);
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl mb-4 mx-auto flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h2 className="text-lg font-semibold mb-1">מגן דוד לאחזקה</h2>
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  if (shouldRedirect || !isAuthenticated) {
    // Use a more graceful redirect
    return (
      <div className="min-h-screen flex items-center justify-center bg-background animate-pulse" dir="rtl">
        <div className="text-center">
          <p className="text-muted-foreground">מעביר לדף התחברות...</p>
        </div>
        {/* Trigger redirect via meta refresh as fallback */}
        <meta httpEquiv="refresh" content={`0;url=${redirectTo}`} />
      </div>
    );
  }

  return <>{children}</>;
};

interface RequireRoleProps {
  children: ReactNode;
  roles: UserRole | UserRole[];
  fallback?: ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ 
  children, 
  roles,
  fallback 
}) => {
  const { hasRole, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  if (!hasRole(roles)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex items-center justify-center py-12" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-xl font-bold mb-2">אין הרשאה</h1>
          <p className="text-muted-foreground">אין לך הרשאה לצפות בדף זה</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// =============================================================================
// EXPORTS
// =============================================================================

export { DEMO_USERS, ROLE_DEFAULT_ROUTES };
export type { AuthUser, LoginResult };
