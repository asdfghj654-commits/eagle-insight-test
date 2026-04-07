/**
 * useMyTasks Hook
 * 
 * PRODUCTION RULE: Tasks MUST be derived from canonical sources.
 * NO hardcoded mock data - return empty arrays if no data.
 */

import { useMemo } from 'react';
import { useFlightDossier } from '@/contexts/FlightDossierContext';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types/core';

interface MaintenanceTask {
  id: string;
  aircraft: string;
  flightCode: string;
  flightDate: string;
  title: string;
  technicalDescription: string;
  severity: 'critical' | 'medium' | 'low';
  requiredRank: 'technician' | 'maintenance-chief' | 'commander';
  system: string;
  status: string;
  isMyResponsibility: boolean;
  assignedTo?: string;
  findingId?: string;
}

interface TaskStats {
  completedThisWeek: number;
  escalatedThisWeek: number;
  awaitingParts: number;
}

interface MyTasksResult {
  // My pending tasks (assigned to me)
  myPendingTasks: MaintenanceTask[];
  
  // Tasks I created but assigned to others
  waitingForOthers: MaintenanceTask[];
  
  // Weekly statistics
  weeklyStats: TaskStats;
  
  // Data availability flags
  isEmpty: boolean;
  hasMyTasks: boolean;
  hasWaitingTasks: boolean;
  isLoading: boolean;
}

/**
 * Map severity level to display format
 */
const mapSeverity = (severity: string): 'critical' | 'medium' | 'low' => {
  switch (severity) {
    case 'S1': return 'critical';
    case 'S2': return 'medium';
    case 'S3': 
    case 'S4':
    default: return 'low';
  }
};

/**
 * Map user role to required rank
 */
const mapRequiredRank = (role: string | undefined): 'technician' | 'maintenance-chief' | 'commander' => {
  switch (role) {
    case 'commander': return 'commander';
    case 'engineer':
    case 'specialist': return 'maintenance-chief';
    default: return 'technician';
  }
};

/**
 * Map task status to Hebrew
 */
const mapStatusToHebrew = (status: string): string => {
  const statusMap: Record<string, string> = {
    'open': 'ממתין לטיפול',
    'in_progress': 'בטיפול',
    'awaiting_parts': 'ממתין לחלקים',
    'awaiting_approval': 'ממתין לאישור ר״צ',
    'completed': 'הושלם',
  };
  return statusMap[status] || status;
};

/**
 * Hook to get tasks for the current user
 */
export const useMyTasks = (): MyTasksResult => {
  const { user } = useAuth();
  const { tasks, findings, getTasksByAssignee } = useFlightDossier();
  
  const userId = user?.id || '';
  const userRole = user?.role || '';
  
  // Get tasks assigned to current user
  const myPendingTasks = useMemo((): MaintenanceTask[] => {
    if (!userId) return [];
    
    const assignedTasks = tasks.filter(t => 
      t.assignedTo === userId && 
      t.status !== 'completed'
    );
    
    return assignedTasks.map(task => {
      // Find associated finding if exists
      const finding = findings.find(f => f.id === task.findingId);
      
      return {
        id: task.id,
        aircraft: task.tailNumbers?.[0] || 'N/A',
        flightCode: task.dossierIds?.[0] || task.id,
        flightDate: task.createdAt?.split('T')[0] || '',
        title: task.titleHe || task.title || 'משימה',
        technicalDescription: task.descriptionHe || task.description || '',
        severity: finding ? mapSeverity(finding.severity) : 'medium',
        requiredRank: mapRequiredRank(task.assignedRole),
        system: finding?.systemAffectedHe || finding?.systemAffected || 'כללי',
        status: mapStatusToHebrew(task.status),
        isMyResponsibility: true,
        findingId: task.findingId,
      };
    });
  }, [tasks, findings, userId]);
  
  // Get tasks created by user but assigned to others
  const waitingForOthers = useMemo((): MaintenanceTask[] => {
    if (!userId) return [];
    
    // Filter tasks where:
    // - User created them OR is interested
    // - Assigned to someone else
    // - Not completed
    const othersTasks = tasks.filter(t => 
      t.assignedTo !== userId &&
      t.status !== 'completed' &&
      (t.status === 'awaiting_approval' || t.status === 'awaiting_parts')
    );
    
    return othersTasks.map(task => {
      const finding = findings.find(f => f.id === task.findingId);
      
      return {
        id: task.id,
        aircraft: task.tailNumbers?.[0] || 'N/A',
        flightCode: task.dossierIds?.[0] || task.id,
        flightDate: task.createdAt?.split('T')[0] || '',
        title: task.titleHe || task.title || 'משימה',
        technicalDescription: task.descriptionHe || task.description || '',
        severity: finding ? mapSeverity(finding.severity) : 'medium',
        requiredRank: mapRequiredRank(task.assignedRole),
        system: finding?.systemAffectedHe || finding?.systemAffected || 'כללי',
        status: mapStatusToHebrew(task.status),
        isMyResponsibility: false,
        assignedTo: task.assignedTo || 'לא מוקצה',
        findingId: task.findingId,
      };
    });
  }, [tasks, findings, userId]);
  
  // Calculate weekly statistics
  const weeklyStats = useMemo((): TaskStats => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString();
    
    // Count completed tasks this week
    const completedThisWeek = tasks.filter(t => 
      t.status === 'completed' &&
      t.completedAt &&
      t.completedAt >= oneWeekAgoStr
    ).length;
    
    // Count escalated (awaiting approval) this week
    const escalatedThisWeek = tasks.filter(t =>
      t.status === 'awaiting_approval' &&
      t.updatedAt &&
      t.updatedAt >= oneWeekAgoStr
    ).length;
    
    // Count awaiting parts
    const awaitingParts = tasks.filter(t =>
      t.status === 'awaiting_parts'
    ).length;
    
    return {
      completedThisWeek,
      escalatedThisWeek,
      awaitingParts,
    };
  }, [tasks]);
  
  const hasMyTasks = myPendingTasks.length > 0;
  const hasWaitingTasks = waitingForOthers.length > 0;
  const isEmpty = !hasMyTasks && !hasWaitingTasks;
  
  return {
    myPendingTasks,
    waitingForOthers,
    weeklyStats,
    isEmpty,
    hasMyTasks,
    hasWaitingTasks,
    isLoading: false, // Would come from context if async
  };
};

export default useMyTasks;
