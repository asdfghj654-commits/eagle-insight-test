// Hook for connecting dashboard to real CSV data and insights
import { useState, useEffect, useMemo } from 'react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { DataAdapter } from '@/lib/data-adapter';
import { rulesEngine } from '@/lib/rules-engine';
import { insightsEngine, type MaintenanceInsight } from '@/lib/insights-engine';

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

export const useDashboardData = () => {
  const { rawData, processedFlights, availableParameters, rules } = useCSVData();
  const [insights, setInsights] = useState<MaintenanceInsight[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [ruleInsights, setRuleInsights] = useState<MaintenanceInsight[]>([]);

  // Generate insights when new data is available
  useEffect(() => {
    if (processedFlights.length > 0 && !isGeneratingInsights) {
      generateInsightsFromFlights();
    }
  }, [processedFlights.length]);

  // Generate rule-based insights when rules change
  useEffect(() => {
    if (processedFlights.length > 0 && rules.length > 0) {
      generateRuleInsights();
    }
  }, [processedFlights.length, rules.length]);

  const generateInsightsFromFlights = async () => {
    setIsGeneratingInsights(true);
    
    try {
      const allInsights: MaintenanceInsight[] = [];
      
      // Convert each flight to FlightData format and generate insights
      for (const flight of processedFlights) {
        const flightData = DataAdapter.csvToFlightData(flight);
        
        // Generate pilot name from flight ID or use default
        const pilotName = `טייס ${flight.flight_id.slice(-3)}`;
        
        // Generate insights for this flight
        const flightInsights = insightsEngine.generateInsights(flightData, pilotName);
        allInsights.push(...flightInsights);
      }
      
      setInsights(allInsights);
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const generateRuleInsights = async () => {
    if (rules.length === 0 || processedFlights.length === 0) {
      setRuleInsights([]);
      return;
    }

    try {
      const activeRules = rules.filter(rule => rule.isActive && rule.status === 'approved');
      const ruleBasedInsights: MaintenanceInsight[] = [];

      // Run rules on processed flight data
      for (const flight of processedFlights) {
        // Convert processed flight to rules engine format
        const flightData = {
          flight_id: flight.flight_id,
          tail: flight.tail_number,
          mission_type: 'training' as const,
          parameters: {} as Record<string, number[]>,
          timestamps: [] as number[],
          duration_min: 0
        };

        // Extract parameter data from flight records
        flight.records.forEach((record, index) => {
          flight.parameters.forEach(param => {
            if (!flightData.parameters[param]) {
              flightData.parameters[param] = [];
            }
            if (record[param] !== undefined) {
              flightData.parameters[param].push(Number(record[param]) || 0);
            }
          });
          flightData.timestamps.push(new Date(record.timestamp).getTime());
        });

        // Calculate duration
        if (flightData.timestamps.length > 0) {
          flightData.duration_min = (Math.max(...flightData.timestamps) - Math.min(...flightData.timestamps)) / (1000 * 60);
        }

        // Check rules against this flight
        const violations = rulesEngine.evaluateFlightData(flightData);
        
        // Convert violations to insights
        violations.forEach(violation => {
          const rule = activeRules.find(r => r.conditions.some(c => c.parameter === violation.parameter));
          if (rule) {
            const ruleInsight: MaintenanceInsight = {
              insight_id: `rule_${violation.rule_id}_${violation.flight_id}`,
              flight_id: violation.flight_id,
              tail: flight.tail_number,
              system: violation.parameter.split('_')[0] || 'general',
              severity: violation.severity as 'low' | 'medium' | 'high' | 'critical',
              type: 'rule_violation',
              title: `התעוררות כלל: ${rule.name}`,
              description: `${rule.description} - ערך: ${violation.actual_value}, סף: ${violation.threshold_value}`,
              technical_detail: `פרמטר: ${violation.parameter}, ערך בפועל: ${violation.actual_value}, ערך סף: ${violation.threshold_value}`,
              maintenance_level: 'technician',
              recommended_action: `בדיקת ${violation.parameter} בטיסה ${violation.flight_id}`,
              commander_visibility: violation.severity === 'critical',
              pilot_name_locked: false,
              pilot_name: `טייס ${flight.flight_id.slice(-3)}`,
              created_at: violation.timestamp,
              status: 'new'
            };
            ruleBasedInsights.push(ruleInsight);
          }
        });
      }

      setRuleInsights(ruleBasedInsights);
    } catch (error) {
      console.error('Error generating rule insights:', error);
      setRuleInsights([]);
    }
  };

  // Calculate dashboard statistics
  const dashboardStats = useMemo((): DashboardStats => {
    const aircraftTails = new Set(processedFlights.map(f => f.tail_number));
    const allInsights = [...insights, ...ruleInsights];
    const criticalCount = allInsights.filter(i => i.severity === 'critical').length;
    const totalAlerts = allInsights.length;
    
    // Get aircraft status for availability calculation
    const aircraftStatusMap = new Map<string, { status: string; alertCount: number }>();
    processedFlights.forEach(flight => {
      if (!aircraftStatusMap.has(flight.tail_number)) {
        aircraftStatusMap.set(flight.tail_number, { status: 'available', alertCount: 0 });
      }
    });
    
    allInsights.forEach(insight => {
      const aircraft = aircraftStatusMap.get(insight.tail);
      if (aircraft) {
        aircraft.alertCount++;
        if (insight.severity === 'critical') {
          aircraft.status = 'grounded';
        } else if (insight.severity === 'high' && aircraft.status === 'available') {
          aircraft.status = 'review';
        }
      }
    });
    
    const aircraftStatuses = Array.from(aircraftStatusMap.values());
    const aircraftWithAlerts = aircraftStatuses.filter(a => a.alertCount > 0).length;
    const aircraftInReview = aircraftStatuses.filter(a => a.status === 'review').length;
    const aircraftGrounded = aircraftStatuses.filter(a => a.status === 'grounded').length;
    const aircraftAvailable = aircraftTails.size - aircraftGrounded - aircraftInReview;
    
    // Calculate system health score (0-100)
    const maxPossibleAlerts = processedFlights.length * 3; // Max 3 alerts per flight
    const healthScore = Math.max(0, 100 - (totalAlerts / Math.max(maxPossibleAlerts, 1)) * 100);
    
    // Top issues by system
    const systemCounts = new Map<string, { count: number; severity: string }>();
    allInsights.forEach(insight => {
      const current = systemCounts.get(insight.system) || { count: 0, severity: 'low' };
      current.count++;
      if (insight.severity === 'critical' && current.severity !== 'critical') {
        current.severity = 'critical';
      } else if (insight.severity === 'high' && current.severity === 'low') {
        current.severity = 'high';
      }
      systemCounts.set(insight.system, current);
    });
    
    const topIssues = Array.from(systemCounts.entries())
      .map(([system, { count, severity }]) => ({ system, count, severity }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalFlights: processedFlights.length,
      totalAlerts,
      totalInsights: totalAlerts,
      criticalAlerts: criticalCount,
      criticalInsights: criticalCount,
      aircraftCount: aircraftTails.size,
      aircraftTotal: aircraftTails.size,
      aircraftAvailable: Math.max(0, aircraftAvailable),
      aircraftWithAlerts,
      aircraftInReview,
      systemHealthScore: Math.round(healthScore),
      topIssues
    };
  }, [processedFlights, insights, ruleInsights]);

  // Get insights by severity
  const getInsightsBySeverity = (severity: 'critical' | 'high' | 'medium' | 'low') => {
    const allInsights = [...insights, ...ruleInsights];
    return allInsights.filter(insight => insight.severity === severity);
  };

  // Get insights by system
  const getInsightsBySystem = (system: string) => {
    const allInsights = [...insights, ...ruleInsights];
    return allInsights.filter(insight => insight.system === system);
  };

  // Get recent insights (last 24 hours)
  const getRecentInsights = () => {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const allInsights = [...insights, ...ruleInsights];
    return allInsights.filter(insight => insight.created_at > oneDayAgo);
  };

  // Get aircraft status
  const getAircraftStatus = () => {
    const aircraftMap = new Map<string, {
      tail: string;
      status: 'operational' | 'maintenance' | 'critical';
      alertCount: number;
      criticalAlerts: number;
      lastFlight?: string;
    }>();

    processedFlights.forEach(flight => {
      if (!aircraftMap.has(flight.tail_number)) {
        aircraftMap.set(flight.tail_number, {
          tail: flight.tail_number,
          status: 'operational',
          alertCount: 0,
          criticalAlerts: 0,
          lastFlight: flight.endTime
        });
      }
    });

    const allInsights = [...insights, ...ruleInsights];
    allInsights.forEach(insight => {
      const aircraft = aircraftMap.get(insight.tail);
      if (aircraft) {
        aircraft.alertCount++;
        if (insight.severity === 'critical') {
          aircraft.criticalAlerts++;
          aircraft.status = 'critical';
        } else if (insight.severity === 'high' && aircraft.status === 'operational') {
          aircraft.status = 'maintenance';
        }
      }
    });

    return Array.from(aircraftMap.values());
  };

  return {
    insights: [...insights, ...ruleInsights],
    ruleInsights,
    dashboardStats,
    isGeneratingInsights,
    hasData: processedFlights.length > 0,
    availableParameters,
    rules,
    
    // Helper functions
    getInsightsBySeverity,
    getInsightsBySystem,
    getRecentInsights,
    getAircraftStatus,
    generateInsightsFromFlights,
    generateRuleInsights
  };
};