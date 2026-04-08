import { useMemo } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { useFlightDossier } from '@/contexts/FlightDossierContext';
import { useAuth } from '@/contexts/AuthContext';
import type { MaintenanceInsight } from '@/lib/insights-engine';
import type { FindingStatus, SeverityLevel } from '@/types/core';
import type { ProcessedFlight, Rule } from '@/contexts/CSVDataContext';

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

function toRuleInsightSeverity(severity: Rule['severity']): MaintenanceInsight['severity'] {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
    default:
      return 'low';
  }
}

function toRuleMaintenanceLevel(severity: Rule['severity']): MaintenanceInsight['maintenance_level'] {
  switch (severity) {
    case 'critical':
      return 'commander';
    case 'high':
      return 'maintenance-chief';
    case 'medium':
    case 'low':
    default:
      return 'technician';
  }
}

function getFlightRecordsInScope(flight: ProcessedFlight, rule: Rule) {
  if (rule.scope.tailNumbers?.length && !rule.scope.tailNumbers.includes(flight.tail_number)) {
    return [];
  }

  return flight.records.filter((record) => {
    if (rule.scope.phases?.length && !rule.scope.phases.includes(record.phase)) {
      return false;
    }

    if (rule.scope.timeRange) {
      const ts = new Date(record.timestamp).getTime();
      const start = new Date(rule.scope.timeRange.start).getTime();
      const end = new Date(rule.scope.timeRange.end).getTime();
      if (Number.isFinite(start) && ts < start) return false;
      if (Number.isFinite(end) && ts > end) return false;
    }

    return true;
  });
}

function evaluateRuleCondition(records: ProcessedFlight['records'], condition: Rule['conditions'][number]) {
  const values = records
    .map((record) => ({ record, value: Number(record[condition.parameter]) }))
    .filter((entry) => Number.isFinite(entry.value));

  if (values.length === 0) {
    return { matched: false, occurrences: 0, detail: '' };
  }

  if (condition.type === 'pattern') {
    // Pattern conditions require AI/ML evaluation — not supported in client-side engine.
    // Return no-match so the rule is not spuriously triggered.
    return { matched: false, occurrences: 0, detail: `${condition.parameter}: pattern evaluation requires server` };
  }

  if (condition.type === 'range') {
    const min = condition.value?.min == null ? null : Number(condition.value.min);
    const max = condition.value?.max == null ? null : Number(condition.value.max);
    const matches = values.filter(({ value }) =>
      (min == null || value >= min) && (max == null || value <= max)
    );

    return {
      matched: matches.length > 0,
      occurrences: matches.length,
      detail: `${condition.parameter}: ${matches.length} התאמות בטווח ${min ?? '-∞'}-${max ?? '∞'}`,
    };
  }

  if (condition.type === 'consecutive') {
    const threshold = Number(condition.value);
    if (!Number.isFinite(threshold)) {
      return { matched: false, occurrences: 0, detail: '' };
    }

    let streak = 0;
    let best = 0;
    for (const { value } of values) {
      if (value > 0) {
        streak += 1;
        best = Math.max(best, streak);
      } else {
        streak = 0;
      }
    }

    return {
      matched: best >= threshold,
      occurrences: best,
      detail: `${condition.parameter}: רצף מרבי ${best} מול סף ${threshold}`,
    };
  }

  if (condition.type === 'delta') {
    const threshold = Number(condition.value);
    if (!Number.isFinite(threshold) || values.length < 2) {
      return { matched: false, occurrences: 0, detail: '' };
    }

    const deltas = values
      .slice(1)
      .map((entry, index) => Math.abs(entry.value - values[index].value))
      .filter((delta) => delta >= threshold);

    return {
      matched: deltas.length > 0,
      occurrences: deltas.length,
      detail: `${condition.parameter}: ${deltas.length} שינויים מעל ${threshold}`,
    };
  }

  if (condition.type === 'ratio') {
    const threshold = Number(condition.value);
    if (!Number.isFinite(threshold) || values.length === 0) {
      return { matched: false, occurrences: 0, detail: '' };
    }

    const baseline = values[0].value || 1;
    const matches = values.filter(({ value }) => Math.abs(value / baseline) >= threshold);
    return {
      matched: matches.length > 0,
      occurrences: matches.length,
      detail: `${condition.parameter}: יחס חריג ${matches.length} פעמים`,
    };
  }

  const threshold = Number(condition.value);
  if (!Number.isFinite(threshold)) {
    return { matched: false, occurrences: 0, detail: '' };
  }

  const operator = ((condition as Rule['conditions'][number] & { operator?: 'greater_than' | 'less_than' | 'equal' | 'between' }).operator) ?? 'greater_than';
  const matches = values.filter(({ value }) => {
    switch (operator) {
      case 'less_than':
        return value < threshold;
      case 'equal':
        return value === threshold;
      case 'between': {
        // If value is an object {min, max} or array [min, max], use range check
        const bv = condition.value;
        if (bv != null && typeof bv === 'object') {
          const bMin = Number(Array.isArray(bv) ? bv[0] : bv.min);
          const bMax = Number(Array.isArray(bv) ? bv[1] : bv.max);
          if (Number.isFinite(bMin) && Number.isFinite(bMax)) {
            return value >= bMin && value <= bMax;
          }
        }
        // Fallback: treat threshold as upper bound (value ≤ threshold)
        return value <= threshold;
      }
      case 'greater_than':
      default:
        return value > threshold;
    }
  });

  return {
    matched: matches.length > 0,
    occurrences: matches.length,
    detail: `${condition.parameter}: ${matches.length} חריגות מול ${operator} ${threshold}`,
  };
}

function createRuleInsight(rule: Rule, flight: ProcessedFlight, detail: string, occurrences: number): MaintenanceInsight {
  return {
    insight_id: `rule-${rule.id}-${flight.flight_id}`,
    flight_id: flight.flight_id,
    tail: flight.tail_number,
    system: rule.name,
    severity: toRuleInsightSeverity(rule.severity),
    type: 'rule_violation',
    title: rule.name,
    description: rule.description,
    technical_detail: detail,
    maintenance_level: toRuleMaintenanceLevel(rule.severity),
    recommended_action: rule.description,
    commander_visibility: rule.severity === 'critical',
    pilot_name_locked: true,
    pilot_name: undefined,
    created_at: new Date(rule.approvedAt || rule.createdAt).getTime(),
    status: 'new',
    occurrences,
    reference_doc: rule.id,
  };
}

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
  const { processedFlights, hasRealData, availableParameters, rules } = useCSVData();
  const {
    findings,
    updateFindingStatus,
  } = useFlightDossier();
  const { user } = useAuth();

  const findingInsights = useMemo<MaintenanceInsight[]>(() => {
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

  const ruleInsights = useMemo<MaintenanceInsight[]>(() => {
    const approvedRules = rules.filter((rule) => rule.isActive && rule.status === 'approved');

    return approvedRules.flatMap((rule) =>
      processedFlights.flatMap((flight) => {
        const scopedRecords = getFlightRecordsInScope(flight, rule);
        if (scopedRecords.length === 0 || rule.conditions.length === 0) {
          return [];
        }

        const evaluations = rule.conditions.map((condition) => evaluateRuleCondition(scopedRecords, condition));
        if (!evaluations.every((evaluation) => evaluation.matched)) {
          return [];
        }

        const occurrences = Math.max(...evaluations.map((evaluation) => evaluation.occurrences), 1);
        const detail = evaluations.map((evaluation) => evaluation.detail).filter(Boolean).join(' | ');
        return [createRuleInsight(rule, flight, detail, occurrences)];
      })
    );
  }, [processedFlights, rules]);

  const insights = useMemo<MaintenanceInsight[]>(
    () => [...findingInsights, ...ruleInsights].sort((left, right) => right.created_at - left.created_at),
    [findingInsights, ruleInsights],
  );

  const hasData = hasRealData || findings.length > 0;

  const dashboardStats = useMemo<DashboardStats>(() => {
    const aircraftTails = new Set([
      ...processedFlights.map((flight) => flight.tail_number),
      ...insights.map((insight) => insight.tail).filter(Boolean),
    ]);
    const openInsights = insights.filter((insight) => ['new', 'in_progress', 'escalated', 'requires_investigation'].includes(insight.status));
    const criticalOpenInsights = openInsights.filter((insight) => insight.severity === 'critical');
    const aircraftStatusMap = new Map<string, { alertCount: number; status: 'available' | 'review' | 'grounded' }>();

    for (const tail of aircraftTails) {
      aircraftStatusMap.set(tail, { alertCount: 0, status: 'available' });
    }

    for (const insight of openInsights) {
      for (const tail of [insight.tail]) {
        const current = aircraftStatusMap.get(tail) || { alertCount: 0, status: 'available' as const };
        current.alertCount += 1;
        if (insight.severity === 'critical') {
          current.status = 'grounded';
        } else if (insight.severity === 'high' && current.status === 'available') {
          current.status = 'review';
        }
        aircraftStatusMap.set(tail, current);
      }
    }

    const aircraftStatuses = Array.from(aircraftStatusMap.values());
    const aircraftWithAlerts = aircraftStatuses.filter((item) => item.alertCount > 0).length;
    const aircraftInReview = aircraftStatuses.filter((item) => item.status === 'review').length;
    const aircraftGrounded = aircraftStatuses.filter((item) => item.status === 'grounded').length;
    const totalAlerts = openInsights.length;
    const maxPossibleAlerts = Math.max(processedFlights.length * 3, 1);
    const systemHealthScore = Math.max(0, Math.round(100 - (totalAlerts / maxPossibleAlerts) * 100));

    const issueMap = new Map<string, { count: number; severity: string }>();
    for (const insight of openInsights) {
      const key = insight.system || 'General';
      const current = issueMap.get(key) || { count: 0, severity: 'low' };
      current.count += 1;
      current.severity = insight.severity;
      issueMap.set(key, current);
    }

    return {
      totalFlights: processedFlights.length,
      totalAlerts,
      totalInsights: insights.length,
      criticalAlerts: criticalOpenInsights.length,
      criticalInsights: criticalOpenInsights.length,
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
  }, [insights, processedFlights]);

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

    for (const insight of insights.filter((item) => ['new', 'in_progress', 'escalated', 'requires_investigation'].includes(item.status))) {
      for (const tail of [insight.tail]) {
        const existing = grouped.get(tail) || {
          tail,
          status: 'operational' as const,
          alertCount: 0,
          criticalAlerts: 0,
        };
        existing.alertCount += 1;
        if (insight.severity === 'critical') {
          existing.criticalAlerts += 1;
          existing.status = 'critical';
        } else if (insight.severity === 'high' && existing.status === 'operational') {
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
    ruleInsights,
    dashboardStats,
    isGeneratingInsights: false,
    hasData,
    availableParameters,
    rules,
    updateInsightStatus,
    getInsightsBySeverity,
    getInsightsBySystem,
    getRecentInsights,
    getAircraftStatus,
    generateInsightsFromFlights: async () => undefined,
    generateRuleInsights: async () => undefined,
  };
};
