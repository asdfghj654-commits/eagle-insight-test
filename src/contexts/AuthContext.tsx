/**
 * Authentication Context — Eagle Insight Local MVP
 *
 * Real local authentication via the local server.
 * Falls back to demo mode (VITE_AUTH_MODE=demo) for development
 * when the local server is not running.
 *
 * Token stored in sessionStorage (survives page refresh, cleared on tab close).
 * No operational state is stored in localStorage.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserRole } from '@/types/core';
import { authApi, tokenStore, AuthUserDto, healthApi } from '@/lib/api-client';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthUser {
  id: string;
  personalNumber: string;
  name: string;
  nameHe: string;
  role: UserRole;
  roleHe: string;
  unit: string;
  unitHe: string;
  rank: string;
  rankHe: string;
  permissions: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  serverAvailable: boolean;

  login: (personalNumber: string, password: string) => Promise<LoginResult>;
  logout: () => void;

  hasPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  getDefaultRoute: () => string;

  isDevelopment: boolean;
  authMode: AuthMode;
  devLoginAs: (role: UserRole) => void; // dev only
}

interface LoginResult {
  success: boolean;
  error?: string;
  errorHe?: string;
}

type AuthMode = 'api' | 'demo' | 'disabled';

// =============================================================================
// DEMO USERS — used only when server is unavailable and authMode=demo
// =============================================================================

const DEMO_USERS_FALLBACK: Record<string, AuthUser & { password: string }> = {
  tech001: {
    id: 'tech001', personalNumber: '8234567',
    name: 'Yossi Cohen', nameHe: 'יוסי כהן',
    role: 'technician', roleHe: 'טכנאי מטוסים',
    unit: 'Squadron 117', unitHe: 'טייסת 117',
    rank: 'Staff Sergeant', rankHe: 'סמ"ר',
    permissions: ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task'],
    password: 'password',
  },
  spec001: {
    id: 'spec001', personalNumber: '7123456',
    name: 'David Levi', nameHe: 'דוד לוי',
    role: 'specialist', roleHe: 'ר"צ אחזקה',
    unit: 'Squadron 117', unitHe: 'טייסת 117',
    rank: 'First Lieutenant', rankHe: 'רס"ל',
    permissions: ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task', 'view_evidence', 'compare_flights', 'escalate_finding', 'triage', 'fleet_status', 'reports'],
    password: 'password',
  },
  eng001: {
    id: 'eng001', personalNumber: '6012345',
    name: 'Ron Avraham', nameHe: 'רון אברהם',
    role: 'engineer', roleHe: 'מהנדס אחזקה',
    unit: 'Technical Branch', unitHe: 'ענף טכני',
    rank: 'Lieutenant Colonel', rankHe: 'סא"ל',
    permissions: ['view_findings', 'ack_findings', 'add_notes', 'create_tasks', 'update_task_status', 'complete_task', 'view_evidence', 'compare_flights', 'escalate_finding', 'approve_rules', 'modify_thresholds', 'reject_findings', 'approve_finding_rejection', 'investigation', 'rule_management', 'review_queue'],
    password: 'password',
  },
  cmd001: {
    id: 'cmd001', personalNumber: '5001234',
    name: 'Moshe Israeli', nameHe: 'משה ישראלי',
    role: 'commander', roleHe: 'מפקד גף טכני',
    unit: 'Technical Branch HQ', unitHe: 'מפקדת גף טכני',
    rank: 'Colonel', rankHe: 'אל"מ',
    permissions: ['view_all', 'fleet_overview', 'emergency_mode', 'view_pilot_behavior', 'accountability_reports'],
    password: 'password',
  },
};

export const DEMO_USERS = DEMO_USERS_FALLBACK;

DEMO_USERS.tech001.unit = 'Squadron 201';
DEMO_USERS.tech001.unitHe = 'טייסת 201';
DEMO_USERS.spec001.unit = 'Squadron 201';
DEMO_USERS.spec001.unitHe = 'טייסת 201';
DEMO_USERS.cmd001.unit = 'Squadron 201';
DEMO_USERS.cmd001.unitHe = 'טייסת 201';

DEMO_USERS.cmd001.roleHe = 'קצין טכני';
DEMO_USERS.cmd001.rank = 'Major';
DEMO_USERS.cmd001.rankHe = 'רס"ן';

const PERSONAL_NUMBER_MAP: Record<string, string> = {
  '8234567': 'tech001', '7123456': 'spec001',
  '6012345': 'eng001',  '5001234': 'cmd001',
};

// =============================================================================
// CONFIG
// =============================================================================

const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  technician: '/tech/queue',
  specialist:  '/lead/fleet',
  engineer:    '/engineer/dashboard',
  commander:   '/commander',
};

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

function resolveAuthMode(): AuthMode {
  const env = import.meta.env.VITE_AUTH_MODE as string | undefined;
  if (env === 'api')      return 'api';
  if (env === 'demo')     return 'demo';
  if (env === 'disabled') return 'disabled';
  // Default: demo in dev (enables quick-login + fallback), api in production
  return import.meta.env.DEV ? 'demo' : 'api';
}

const authMode = resolveAuthMode();

// =============================================================================
// CONTEXT
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [usingDemoFallback, setUsingDemoFallback] = useState(false);

  // =========================================================================
  // Server availability check
  // =========================================================================

  useEffect(() => {
    const checkServer = async () => {
      const res = await healthApi.check();
      setServerAvailable(res.ok);
      if (!res.ok && isDevelopment) {
        console.warn('[Auth] Local server unavailable. Demo fallback active in dev mode.');
      }
    };
    checkServer();
  }, []);

  // =========================================================================
  // Session restore on mount
  // =========================================================================

  useEffect(() => {
    const restore = async () => {
      setIsLoading(true);
      try {
        // authMode=disabled: auto-login as technician (dev convenience)
        if (authMode === 'disabled') {
          const { password: _, ...u } = DEMO_USERS_FALLBACK['tech001'];
          setUser(u as AuthUser);
          return;
        }

        const token = tokenStore.get();
        if (!token) return;

        // Try to restore session from server
        const res = await authApi.me();
        if (res.ok && res.data?.user) {
          setUser(dtoToAuthUser(res.data.user));
        } else {
          // Token invalid/expired
          tokenStore.clear();
        }
      } catch {
        tokenStore.clear();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  // =========================================================================
  // Login
  // =========================================================================

  const login = useCallback(async (personalNumber: string, password: string): Promise<LoginResult> => {
    // authMode=disabled: auto-succeed
    if (authMode === 'disabled') {
      return { success: true };
    }

    // Try real API first
    const serverRes = await authApi.login(personalNumber, password);
    if (serverRes.ok && serverRes.data) {
      tokenStore.set(serverRes.data.token);
      setUser(dtoToAuthUser(serverRes.data.user));
      setServerAvailable(true);
      setUsingDemoFallback(false);
      return { success: true };
    }

    // If server unavailable and in dev mode, fall back to demo users
    if ((serverRes.status === 0 || !serverAvailable) && isDevelopment) {
      const userId = PERSONAL_NUMBER_MAP[personalNumber];
      const demoUser = userId ? DEMO_USERS_FALLBACK[userId] : undefined;
      if (demoUser && demoUser.password === password) {
        const { password: _, ...userData } = demoUser;
        setUser(userData as AuthUser);
        setUsingDemoFallback(true);
        console.warn('[Auth] Using demo fallback — server unavailable');
        return { success: true };
      }
    }

    return {
      success: false,
      error: serverRes.error ?? 'Login failed',
      errorHe: serverRes.errorHe ?? 'ההתחברות נכשלה',
    };
  }, [serverAvailable]);

  // =========================================================================
  // Logout
  // =========================================================================

  const logout = useCallback(async () => {
    if (!usingDemoFallback) {
      await authApi.logout().catch(() => {});
    }
    tokenStore.clear();
    setUser(null);
    setUsingDemoFallback(false);
  }, [usingDemoFallback]);

  // =========================================================================
  // Dev quick-login (only in dev when server unavailable)
  // =========================================================================

  const devLoginAs = useCallback((role: UserRole) => {
    if (!isDevelopment) return;
    const entry = Object.values(DEMO_USERS_FALLBACK).find(u => u.role === role);
    if (entry) {
      const { password: _, ...userData } = entry;
      setUser(userData as AuthUser);
      setUsingDemoFallback(true);
    }
  }, []);

  // =========================================================================
  // Permission helpers
  // =========================================================================

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission) || user.permissions.includes('view_all');
  }, [user]);

  const hasRole = useCallback((roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const arr = Array.isArray(roles) ? roles : [roles];
    return arr.includes(user.role);
  }, [user]);

  const getDefaultRoute = useCallback((): string => {
    if (!user) return '/login';
    return ROLE_DEFAULT_ROUTES[user.role] || '/';
  }, [user]);

  // =========================================================================
  // Context value
  // =========================================================================

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    serverAvailable,
    login,
    logout,
    hasPermission,
    hasRole,
    getDefaultRoute,
    isDevelopment,
    authMode,
    devLoginAs,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// =============================================================================
// Hooks
// =============================================================================

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// =============================================================================
// Route Guards
// =============================================================================

export const RequireAuth: React.FC<{ children: ReactNode; redirectTo?: string }> = ({
  children,
  redirectTo = '/login',
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl mb-4 mx-auto flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h2 className="text-lg font-semibold mb-1">Eagle Insight</h2>
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <p className="text-muted-foreground">מעביר לדף התחברות...</p>
        <meta httpEquiv="refresh" content={`0;url=${redirectTo}`} />
      </div>
    );
  }

  return <>{children}</>;
};

export const RequireRole: React.FC<{
  children: ReactNode;
  roles: UserRole | UserRole[];
  fallback?: ReactNode;
}> = ({ children, roles, fallback }) => {
  const { hasRole, isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  if (!hasRole(roles)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
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
// Helpers
// =============================================================================

function dtoToAuthUser(dto: AuthUserDto): AuthUser {
  return {
    id: dto.id,
    personalNumber: dto.personalNumber,
    name: dto.name,
    nameHe: dto.nameHe,
    role: dto.role as UserRole,
    roleHe: dto.roleHe,
    unit: dto.role === 'engineer' ? dto.unit : 'Squadron 201',
    unitHe: dto.role === 'engineer' ? dto.unitHe : 'טייסת 201',
    rank: dto.rank,
    rankHe: dto.rankHe,
    permissions: dto.permissions,
  };
}

// =============================================================================
// Exports
// =============================================================================

export { ROLE_DEFAULT_ROUTES };
export type { AuthUser, LoginResult, AuthMode };
