/**
 * RoleProvider - Unified with AuthContext
 * 
 * This provider wraps AuthContext to provide backward compatibility
 * with existing components that use useRole().
 * 
 * NO MORE ROLE SWITCHING - user identity comes from authentication only.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole as CoreUserRole } from '@/types/core';

// Legacy role type for backward compatibility
export type UserRole = 'commander' | 'maintenance-chief' | 'engineer' | 'technician' | 'specialist';

interface User {
  id: string;
  name: string;
  role: UserRole;
  rank: string;
  personalNumber: string;
}

interface RoleContextType {
  currentUser: User;
  // setUserRole is kept for backward compatibility but does nothing in production
  setUserRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

// Map AuthContext roles to legacy roles
const mapAuthRoleToLegacy = (authRole: CoreUserRole): UserRole => {
  switch (authRole) {
    case 'technician': return 'technician';
    case 'specialist': return 'maintenance-chief'; // ר"צ maps to maintenance-chief
    case 'engineer': return 'engineer';
    case 'commander': return 'commander';
    default: return 'technician';
  }
};

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // Convert AuthUser to legacy User format
  const currentUser: User = useMemo(() => {
    if (user && isAuthenticated) {
      return {
        id: user.personalNumber,
        name: user.nameHe,
        role: mapAuthRoleToLegacy(user.role),
        rank: user.roleHe,
        personalNumber: user.personalNumber,
      };
    }
    
    // Fallback for unauthenticated state (should never happen in protected routes)
    return {
      id: '0000000',
      name: 'אורח',
      role: 'technician' as UserRole,
      rank: 'לא מחובר',
      personalNumber: '0000000',
    };
  }, [user, isAuthenticated]);

  // setUserRole does nothing in production - kept for backward compatibility
  const setUserRole = (_role: UserRole) => {
    console.warn('setUserRole is deprecated. User identity comes from authentication only.');
  };

  return (
    <RoleContext.Provider value={{ currentUser, setUserRole }}>
      {children}
    </RoleContext.Provider>
  );
};