import { useMemo } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { useFlightDossier } from '@/contexts/FlightDossierContext';
import { useAuth } from '@/contexts/AuthContext';
import type { MaintenanceInsight } from '@/lib/insights-engine';
import type { FindingStatus, SeverityLevel } from '@/types/core';

export interface DashboardStats {
  totalFlights: number;
  totalAlerts: number;
  totalInsights: number;
  criticalAlerts: number;
  criticalInsights: number;
  aircraftCount: number;
  aircraftTotal: number;
  aircraftAvailable: number;
  aircraftWithAlerts: number;
  aircraftInReview: number;
  systemHealthScore: number;
  topIssues: Array<{
    system: string;
    count: number;
    severity: string;
  }>;
}

const OPEN_STATUSES: FindingStatus[] = ['new', 'acknowledged', 'in_progress', 'escalated'];

function toInsightStatus(status: FindingStatus): MaintenanceInsight['status'] {
  switch (status) {
    case 'new':
      return 'new';
    case 'acknowledged':
      return 'in_progress';
    case 'in_progress':
      return 'in_progress';
    case 'escalated':
      return 'escalated';
    case 'resolved':
    case 'closed':
      return 'completed';
    case 'rejected':
      return 'completed';
    default:
      return 'new';
  }
}

function toSeverityLabel(severity: SeverityLevel): MaintenanceInsight['severity'] {
  switch (severity) {
    case 'S1':
      return 'critical';
    case 'S2':
      return 'high';
    case 'S3':
      return 'medium';
    case 'S4':
    default:
      return 'low';
  }
}

function toMaintenanceLevel(severity: SeverityLevel): MaintenanceInsight['maintenance_level'] {
  switch (severity) {
    case 'S1':
      return 'commander';
    case 'S2':
      return 'maintenance-chief';
    case 'S3':
    case 'S4':
    default:
      return 'technician';
  }
}

export const useDashboardData = () => {
  const { processedFlights, hasRealData, availableParameters } = useCSVData();
  const {
    findings,
    updateFindingStatus,
  } = useFlightDossier();
  const { user } = useAuth();

  const insights = useMemo<MaintenanceInsight[]>(() => {
    return findings.map((finding) => ({
      insight_id: finding.id,
      flight_id: finding.dossierIds[0] || '',
      tail: finding.tailNumbers[0] || 'UNKNOWN',
      system: finding.systemAffectedHe || finding.systemAffected || 'General',
      severity: toSeverityLabel(finding.severity),
      type: 'rule_violation',
      title: finding.titleHe || finding.title,
      description: finding.descriptionHe || finding.description,
      technical_detail: finding.technicalDetail || finding.description,
      maintenance_level: toMaintenanceLevel(finding.severity),
      recommended_action: finding.recommendationHe || finding.recommendation || '',
      commander_visibility: finding.severity === 'S1',
      pilot_name_locked: finding.pilotNameLocked,
      pilot_name: undefined,
      created_at: new Date(finding.createdAt).getTime(),
      status: toInsightStatus(finding.status),
      occurrences: finding.occurrences,
      pilot_behavior_context: finding.pilotBehaviorContext,
      reference_doc: finding.ruleId,
    }));
  }, [findings]);

  const dashboardStats = useMemo<DashboardStats>(() => {
    const aircraftTails = new Set(processedFlights.map((flight) => flight.tail_number));
    const openFindings = findings.filter((finding) => OPEN_STATUSES.includes(finding.status));
    const criticalOpenFindings = openFindings.filter((finding) => finding.severity === 'S1');
    const aircraftStatusMap = new Map<string, { alertCount: number; status: 'available' | 'review' | 'grounded' }>();

    for (const tail of aircraftTails) {
      aircraftStatusMap.set(tail, { alertCount: 0, status: 'available' });
    }

    for (const finding of openFindings) {
      for (const tail of finding.tailNumbers) {
        const current = aircraftStatusMap.get(tail) || { alertCount: 0, status: 'available' as const };
        current.alertCount += 1;
        if (finding.severity === 'S1') {
          current.status = 'grounded';
        } else if (finding.severity === 'S2' && current.status === 'available') {
          current.status = 'review';
        }
        aircraftStatusMap.set(tail, current);
      }
    }

    const aircraftStatuses = Array.from(aircraftStatusMap.values());
    const aircraftWithAlerts = aircraftStatuses.filter((item) => item.alertCount > 0).length;
    const aircraftInReview = aircraftStatuses.filter((item) => item.status === 'review').length;
    const aircraftGrounded = aircraftStatuses.filter((item) => item.status === 'grounded').length;
    const totalAlerts = openFindings.length;
    const maxPossibleAlerts = Math.max(processedFlights.length * 3, 1);
    const systemHealthScore = Math.max(0, Math.round(100 - (totalAlerts / maxPossibleAlerts) * 100));

    const issueMap = new Map<string, { count: number; severity: string }>();
    for (const finding of openFindings) {
      const key = finding.systemAffectedHe || finding.systemAffected || 'General';
      const current = issueMap.get(key) || { count: 0, severity: 'low' };
      current.count += 1;
      current.severity = toSeverityLabel(finding.severity);
      issueMap.set(key, current);
    }

    return {
      totalFlights: processedFlights.length,
      totalAlerts,
      totalInsights: totalAlerts,
      criticalAlerts: criticalOpenFindings.length,
      criticalInsights: criticalOpenFindings.length,
      aircraftCount: aircraftTails.size,
      aircraftTotal: aircraftTails.size,
      aircraftAvailable: Math.max(0, aircraftTails.size - aircraftInReview - aircraftGrounded),
      aircraftWithAlerts,
      aircraftInReview,
      systemHealthScore,
      topIssues: Array.from(issueMap.entries())
        .map(([system, value]) => ({ system, count: value.count, severity: value.severity }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 5),
    };
  }, [findings, processedFlights]);

  const getInsightsBySeverity = (severity: 'critical' | 'high' | 'medium' | 'low') => {
    return insights.filter((insight) => insight.severity === severity);
  };

  const getInsightsBySystem = (system: string) => {
    return insights.filter((insight) => insight.system === system);
  };

  const getRecentInsights = () => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return insights.filter((insight) => insight.created_at >= oneDayAgo);
  };

  const getAircraftStatus = () => {
    const grouped = new Map<string, {
      tail: string;
      status: 'operational' | 'maintenance' | 'critical';
      alertCount: number;
      criticalAlerts: number;
      lastFlight?: string;
    }>();

    for (const flight of processedFlights) {
      const existing = grouped.get(flight.tail_number);
      const lastFlight = existing?.lastFlight && existing.lastFlight > flight.endTime ? existing.lastFlight : flight.endTime;
      grouped.set(flight.tail_number, {
        tail: flight.tail_number,
        status: existing?.status || 'operational',
        alertCount: existing?.alertCount || 0,
        criticalAlerts: existing?.criticalAlerts || 0,
        lastFlight,
      });
    }

    for (const finding of findings.filter((item) => OPEN_STATUSES.includes(item.status))) {
      for (const tail of finding.tailNumbers) {
        const existing = grouped.get(tail) || {
          tail,
          status: 'operational' as const,
          alertCount: 0,
          criticalAlerts: 0,
        };
        existing.alertCount += 1;
        if (finding.severity === 'S1') {
          existing.criticalAlerts += 1;
          existing.status = 'critical';
        } else if (finding.severity === 'S2' && existing.status === 'operational') {
          existing.status = 'maintenance';
        }
        grouped.set(tail, existing);
      }
    }

    return Array.from(grouped.values());
  };

  const updateInsightStatus = (insightId: string, status: MaintenanceInsight['status'], role: string) => {
    const finding = findings.find((item) => item.id === insightId);
    if (!finding || !role || !user) {
      return;
    }

    const targetStatus: FindingStatus =
      status === 'new'
        ? 'new'
        : status === 'escalated'
          ? 'escalated'
          : status === 'completed'
            ? 'resolved'
            : 'in_progress';

    updateFindingStatus(insightId, targetStatus, user.id, user.role);
  };

  return {
    insights,
    ruleInsights: [],
    dashboardStats,
    isGeneratingInsights: false,
    hasData: hasRealData,
    availableParameters,
    rules: [],
    updateInsightStatus,
    getInsightsBySeverity,
    getInsightsBySystem,
    getRecentInsights,
    getAircraftStatus,
    generateInsightsFromFlights: async () => undefined,
    generateRuleInsights: async () => undefined,
  };
};
