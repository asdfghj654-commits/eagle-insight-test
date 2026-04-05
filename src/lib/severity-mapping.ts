/**
 * Severity Mapping Utility
 * 
 * Maps between two severity systems:
 * - Core Domain (S1-S4): Used in FlightDossierContext and official classification
 * - Insights Engine (critical/high/medium/low): Used in CSV analysis and rule generation
 * 
 * This provides a single source of truth for severity classification.
 */

import { SeverityLevel } from '@/types/core';

// Insights engine severity type
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low';

// Bidirectional mapping
const SEVERITY_MAP: Record<InsightSeverity, SeverityLevel> = {
  critical: 'S1',
  high: 'S2',
  medium: 'S3',
  low: 'S4',
};

const REVERSE_MAP: Record<SeverityLevel, InsightSeverity> = {
  S1: 'critical',
  S2: 'high',
  S3: 'medium',
  S4: 'low',
};

/**
 * Convert insight severity to official S-level
 */
export function toSeverityLevel(insightSeverity: InsightSeverity): SeverityLevel {
  return SEVERITY_MAP[insightSeverity] || 'S4';
}

/**
 * Convert S-level to insight severity
 */
export function toInsightSeverity(severityLevel: SeverityLevel): InsightSeverity {
  return REVERSE_MAP[severityLevel] || 'low';
}

/**
 * Get Hebrew label for any severity
 */
export function getSeverityLabelHe(severity: SeverityLevel | InsightSeverity): string {
  const labels: Record<string, string> = {
    // S-levels
    S1: 'קריטי - השבתה',
    S2: 'משימתי - הגבלות',
    S3: 'נדחה - מעקב',
    S4: 'מידעי',
    // Insight levels
    critical: 'קריטי',
    high: 'גבוה',
    medium: 'בינוני',
    low: 'נמוך',
  };
  return labels[severity] || severity;
}

/**
 * Get color class for any severity
 */
export function getSeverityColor(severity: SeverityLevel | InsightSeverity): string {
  const colors: Record<string, string> = {
    S1: 'text-red-600 bg-red-100 border-red-200',
    S2: 'text-orange-600 bg-orange-100 border-orange-200',
    S3: 'text-yellow-600 bg-yellow-100 border-yellow-200',
    S4: 'text-blue-600 bg-blue-100 border-blue-200',
    critical: 'text-red-600 bg-red-100 border-red-200',
    high: 'text-orange-600 bg-orange-100 border-orange-200',
    medium: 'text-yellow-600 bg-yellow-100 border-yellow-200',
    low: 'text-blue-600 bg-blue-100 border-blue-200',
  };
  return colors[severity] || 'text-gray-600 bg-gray-100';
}

/**
 * Check if severity requires grounding
 */
export function requiresGrounding(severity: SeverityLevel | InsightSeverity): boolean {
  return severity === 'S1' || severity === 'critical';
}

/**
 * Check if severity requires immediate action
 */
export function requiresImmediateAction(severity: SeverityLevel | InsightSeverity): boolean {
  return severity === 'S1' || severity === 'S2' || severity === 'critical' || severity === 'high';
}

/**
 * Get action urgency level
 */
export function getUrgencyLevel(severity: SeverityLevel | InsightSeverity): 'immediate' | 'before_sortie' | 'scheduled' | 'monitor' {
  switch (severity) {
    case 'S1':
    case 'critical':
      return 'immediate';
    case 'S2':
    case 'high':
      return 'before_sortie';
    case 'S3':
    case 'medium':
      return 'scheduled';
    default:
      return 'monitor';
  }
}

/**
 * Normalize any severity to S-level
 */
export function normalizeSeverity(severity: string): SeverityLevel {
  if (['S1', 'S2', 'S3', 'S4'].includes(severity)) {
    return severity as SeverityLevel;
  }
  return toSeverityLevel(severity as InsightSeverity);
}
