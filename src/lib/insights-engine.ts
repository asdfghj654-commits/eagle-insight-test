// Insights Engine - מנוע תובנות 
// Generates maintenance insights from three layers: point deviations, trends, flight behavior

import { rulesEngine, type FlightData, type RuleViolation, type MaintenanceRule } from './rules-engine';

export interface MaintenanceInsight {
  insight_id: string;
  flight_id: string;
  tail: string;
  system: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'rule_violation' | 'trend' | 'behavior_impact';
  title: string;
  description: string;
  technical_detail: string;
  pilot_behavior_context?: string;
  maintenance_level: 'technician' | 'maintenance-chief' | 'commander';
  recommended_action: string;
  reference_doc?: string;
  clause?: string;
  commander_visibility: boolean;
  pilot_name_locked: boolean;
  pilot_name?: string;
  created_at: number;
  status: 'unclassified' | 'new' | 'in_progress' | 'escalated' | 'completed' | 'requires_investigation';
  occurrences?: number;
  trend_data?: TrendData;
  related_flights?: string[];
}

export interface TrendData {
  baseline: number;
  current: number;
  delta_percent: number;
  flights_analyzed: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
}

export interface FlightBehaviorPattern {
  pattern_type: 'aggressive_landing' | 'high_g_maneuvers' | 'rapid_acceleration' | 'excessive_braking';
  description: string;
  maintenance_impact: string;
  severity_multiplier: number;
}

export const BEHAVIOR_PATTERNS: Record<string, FlightBehaviorPattern> = {
  aggressive_landing: {
    pattern_type: 'aggressive_landing',
    description: 'נחיתה אגרסיבית - מהירות גבוהה ובלימה חדה',
    maintenance_impact: 'שחיקת בלמים וצמיגים מוגברת',
    severity_multiplier: 1.3
  },
  high_g_maneuvers: {
    pattern_type: 'high_g_maneuvers',
    description: 'תמרונים בעומסי G גבוהים',
    maintenance_impact: 'עומס מבני על המטוס',
    severity_multiplier: 1.5
  },
  rapid_acceleration: {
    pattern_type: 'rapid_acceleration',
    description: 'האצה חדה מעבר לנדרש',
    maintenance_impact: 'לחץ על מערכת המנוע',
    severity_multiplier: 1.2
  },
  excessive_braking: {
    pattern_type: 'excessive_braking',
    description: 'בלימות רצופות ומוגזמות',
    maintenance_impact: 'שחיקה מהירה של מערכת הבלמים',
    severity_multiplier: 1.4
  }
};

export class InsightsEngine {
  private flightHistory: Map<string, FlightData[]> = new Map(); // tail -> flights
  private insightHistory: MaintenanceInsight[] = [];

  // ייצור תובנות מטיסה
  generateInsights(flightData: FlightData, pilotName?: string): MaintenanceInsight[] {
    const insights: MaintenanceInsight[] = [];

    // שכבה 1: חריגות נקודתיות מול כללי הספרות
    const ruleViolations = rulesEngine.evaluateFlightData(flightData);
    for (const violation of ruleViolations) {
      const insight = this.createRuleViolationInsight(violation, flightData, pilotName);
      insights.push(insight);
    }

    // שכבה 2: ניתוח מגמות (דורש היסטוריה)
    this.updateFlightHistory(flightData);
    const trendInsights = this.analyzeTrends(flightData.tail, flightData);
    insights.push(...trendInsights);

    // שכבה 3: ניתוח התנהגות טיסה
    const behaviorInsights = this.analyzeFlightBehavior(flightData, pilotName);
    insights.push(...behaviorInsights);

    // דדופליקציה וממזוג תובנות דומות
    const deduplicatedInsights = this.deduplicateInsights(insights);

    // שמירת התובנות
    this.insightHistory.push(...deduplicatedInsights);

    return deduplicatedInsights;
  }

  private createRuleViolationInsight(
    violation: RuleViolation, 
    flightData: FlightData, 
    pilotName?: string
  ): MaintenanceInsight {
    const rule = rulesEngine.getRule(violation.rule_id);
    if (!rule) {
      throw new Error(`Rule not found: ${violation.rule_id}`);
    }

    return {
      insight_id: `INS-${violation.rule_id}-${flightData.flight_id}`,
      flight_id: flightData.flight_id,
      tail: flightData.tail,
      system: rule.system,
      severity: rule.severity,
      type: 'rule_violation',
      title: `חריגה ב${rule.system}`,
      description: rule.description,
      technical_detail: `${rule.parameter}: ${violation.actual_value} (סף: ${violation.threshold_value})`,
      maintenance_level: rule.required_rank,
      recommended_action: rule.recommended_action,
      reference_doc: rule.reference_doc,
      clause: rule.clause,
      commander_visibility: rule.required_rank === 'commander',
      pilot_name_locked: true,
      pilot_name: pilotName,
      created_at: Date.now(),
      status: 'new'
    };
  }

  private updateFlightHistory(flightData: FlightData): void {
    const tailHistory = this.flightHistory.get(flightData.tail) || [];
    tailHistory.push(flightData);
    
    // שמירת 10 טיסות אחרונות בלבד
    if (tailHistory.length > 10) {
      tailHistory.shift();
    }
    
    this.flightHistory.set(flightData.tail, tailHistory);
  }

  private analyzeTrends(tail: string, currentFlight: FlightData): MaintenanceInsight[] {
    const insights: MaintenanceInsight[] = [];
    const history = this.flightHistory.get(tail) || [];
    
    if (history.length < 3) {
      return insights; // לא מספיק נתונים למגמה
    }

    // ניתוח מגמות לפרמטרים קריטיים
    const criticalParams = ['egt_celsius', 'hydraulic_pressure_psi', 'brake_temp_celsius'];
    
    for (const param of criticalParams) {
      const trend = this.calculateTrend(history, param);
      if (trend && this.isTrendSignificant(trend)) {
        const insight = this.createTrendInsight(currentFlight, param, trend);
        insights.push(insight);
      }
    }

    return insights;
  }

  private calculateTrend(flights: FlightData[], parameter: string): TrendData | null {
    const values = flights
      .map(flight => {
        const paramData = flight.parameters[parameter];
        return paramData ? paramData.reduce((a, b) => a + b, 0) / paramData.length : null;
      })
      .filter(val => val !== null) as number[];

    if (values.length < 3) return null;

    const baseline = values.slice(0, -2).reduce((a, b) => a + b, 0) / (values.length - 2);
    const recent = values.slice(-2).reduce((a, b) => a + b, 0) / 2;
    const delta_percent = ((recent - baseline) / baseline) * 100;

    return {
      baseline,
      current: recent,
      delta_percent,
      flights_analyzed: values.length,
      trend_direction: delta_percent > 5 ? 'increasing' : delta_percent < -5 ? 'decreasing' : 'stable'
    };
  }

  private isTrendSignificant(trend: TrendData): boolean {
    return Math.abs(trend.delta_percent) > 10; // שינוי של יותר מ-10%
  }

  private createTrendInsight(
    flightData: FlightData, 
    parameter: string, 
    trend: TrendData
  ): MaintenanceInsight {
    const parameterDisplayNames: Record<string, string> = {
      'egt_celsius': 'טמפרטורת גזי פליטה',
      'hydraulic_pressure_psi': 'לחץ הידראולי',
      'brake_temp_celsius': 'טמפרטורת בלמים'
    };

    const systemMap: Record<string, string> = {
      'egt_celsius': 'מנוע',
      'hydraulic_pressure_psi': 'הידראוליקה',
      'brake_temp_celsius': 'בלמים'
    };

    const paramName = parameterDisplayNames[parameter] || parameter;
    const system = systemMap[parameter] || 'כללי';

    return {
      insight_id: `TRD-${flightData.flight_id}-${parameter}`,
      flight_id: flightData.flight_id,
      tail: flightData.tail,
      system,
      severity: Math.abs(trend.delta_percent) > 20 ? 'high' : 'medium',
      type: 'trend',
      title: `מגמה ב${paramName}`,
      description: `${trend.trend_direction === 'increasing' ? 'עלייה' : 'ירידה'} של ${Math.abs(trend.delta_percent).toFixed(1)}% ב${paramName}`,
      technical_detail: `ממוצע נוכחי: ${trend.current.toFixed(1)}, בייסליין: ${trend.baseline.toFixed(1)} (${trend.flights_analyzed} טיסות)`,
      maintenance_level: 'maintenance-chief',
      recommended_action: `בדיקת ${system} וכיול חיישנים`,
      commander_visibility: false,
      pilot_name_locked: false,
      created_at: Date.now(),
      status: 'new',
      trend_data: trend
    };
  }

  private analyzeFlightBehavior(flightData: FlightData, pilotName?: string): MaintenanceInsight[] {
    const insights: MaintenanceInsight[] = [];

    // בדיקת דפוסי התנהגות
    const behaviorPatterns = this.detectBehaviorPatterns(flightData);
    
    for (const pattern of behaviorPatterns) {
      const insight = this.createBehaviorInsight(flightData, pattern, pilotName);
      insights.push(insight);
    }

    return insights;
  }

  private detectBehaviorPatterns(flightData: FlightData): FlightBehaviorPattern[] {
    const patterns: FlightBehaviorPattern[] = [];

    // נחיתה אגרסיבית
    const landingSpeed = flightData.parameters['landing_speed_kts'];
    const brakeTemp = flightData.parameters['brake_temp_celsius'];
    if (landingSpeed && brakeTemp) {
      const maxLandingSpeed = Math.max(...landingSpeed);
      const maxBrakeTemp = Math.max(...brakeTemp);
      
      if (maxLandingSpeed > 165 && maxBrakeTemp > 300) {
        patterns.push(BEHAVIOR_PATTERNS.aggressive_landing);
      }
    }

    // תמרונים בעומסי G גבוהים
    const gLoad = flightData.parameters['g_load'];
    if (gLoad) {
      const maxG = Math.max(...gLoad);
      const highGCount = gLoad.filter(g => g > 6.0).length;
      
      if (maxG > 7.0 || highGCount > 5) {
        patterns.push(BEHAVIOR_PATTERNS.high_g_maneuvers);
      }
    }

    // בלימות מוגזמות
    if (brakeTemp) {
      const brakeEvents = brakeTemp.filter(temp => temp > 250).length;
      if (brakeEvents > 3) {
        patterns.push(BEHAVIOR_PATTERNS.excessive_braking);
      }
    }

    return patterns;
  }

  private createBehaviorInsight(
    flightData: FlightData, 
    pattern: FlightBehaviorPattern, 
    pilotName?: string
  ): MaintenanceInsight {
    return {
      insight_id: `BEH-${flightData.flight_id}-${pattern.pattern_type}`,
      flight_id: flightData.flight_id,
      tail: flightData.tail,
      system: 'התנהגות טיסה',
      severity: pattern.severity_multiplier > 1.4 ? 'high' : 'medium',
      type: 'behavior_impact',
      title: pattern.description,
      description: `התנהגות טיסה שעלולה להשפיע על האחזקה`,
      technical_detail: pattern.maintenance_impact,
      pilot_behavior_context: pattern.description,
      maintenance_level: 'commander',
      recommended_action: 'תחקיר התנהגות טיסה והשפעה על מערכות',
      commander_visibility: true,
      pilot_name_locked: true,
      pilot_name: pilotName,
      created_at: Date.now(),
      status: 'requires_investigation'
    };
  }

  private deduplicateInsights(insights: MaintenanceInsight[]): MaintenanceInsight[] {
    const uniqueInsights = new Map<string, MaintenanceInsight>();

    for (const insight of insights) {
      const key = `${insight.system}_${insight.type}_${insight.tail}`;
      const existing = uniqueInsights.get(key);

      if (!existing) {
        uniqueInsights.set(key, insight);
      } else {
        // מיזוג תובנות דומות
        existing.occurrences = (existing.occurrences || 1) + 1;
        existing.description += ` (${existing.occurrences} אירועים)`;
        if (insight.severity === 'critical' || existing.severity === 'critical') {
          existing.severity = 'critical';
        }
      }
    }

    return Array.from(uniqueInsights.values());
  }

  // קבלת תובנות לפי תפקיד
  getInsightsForRole(role: string, tailFilter?: string): MaintenanceInsight[] {
    return this.insightHistory.filter(insight => {
      const roleMatch = this.matchesRole(insight, role);
      const tailMatch = !tailFilter || insight.tail === tailFilter;
      return roleMatch && tailMatch;
    });
  }

  private matchesRole(insight: MaintenanceInsight, role: string): boolean {
    switch (role) {
      case 'technician':
        return insight.maintenance_level === 'technician';
      case 'maintenance-chief':
        return ['technician', 'maintenance-chief'].includes(insight.maintenance_level);
      case 'commander':
        return true; // מפקד רואה הכל
      default:
        return false;
    }
  }

  // עדכון סטטוס תובנה
  updateInsightStatus(insightId: string, status: MaintenanceInsight['status']): boolean {
    const insight = this.insightHistory.find(ins => ins.insight_id === insightId);
    if (insight) {
      insight.status = status;
      return true;
    }
    return false;
  }

  // קבלת תובנות פתוחות
  getOpenInsights(): MaintenanceInsight[] {
    return this.insightHistory.filter(insight => 
      ['new', 'in_progress', 'requires_investigation'].includes(insight.status)
    );
  }
}

// יצירת מופע גלובלי של מנוע התובנות
export const insightsEngine = new InsightsEngine();
