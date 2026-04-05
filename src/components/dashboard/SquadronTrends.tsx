/**
 * Squadron Trends Component
 * 
 * PRODUCTION RULE: Trends MUST be derived from real CSV data.
 * NO hardcoded trend patterns.
 * 
 * This component analyzes actual findings/insights to identify
 * recurring patterns. If no data exists, shows empty state.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, Plane, Database, Info } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMemo } from "react";

interface TrendPattern {
  id: string;
  category: string;
  type: string;
  pattern: string;
  occurrences: number;
  period: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const SquadronTrends = () => {
  const { insights, hasData, dashboardStats } = useDashboardData();
  
  // PRODUCTION: Derive trends from actual insights data
  const trends = useMemo((): TrendPattern[] => {
    if (!hasData || insights.length === 0) return [];
    
    // Group insights by system to identify patterns
    const systemCounts = new Map<string, { 
      count: number; 
      severity: string;
      examples: string[];
    }>();
    
    insights.forEach(insight => {
      const system = insight.system || 'כללי';
      const current = systemCounts.get(system) || { count: 0, severity: 'low', examples: [] };
      current.count++;
      if (insight.severity === 'critical') current.severity = 'critical';
      else if (insight.severity === 'high' && current.severity !== 'critical') current.severity = 'high';
      else if (insight.severity === 'medium' && current.severity === 'low') current.severity = 'medium';
      if (current.examples.length < 3) {
        current.examples.push(insight.title);
      }
      systemCounts.set(system, current);
    });
    
    // Convert to trend patterns (only systems with 2+ occurrences)
    const derivedTrends: TrendPattern[] = [];
    let id = 1;
    
    systemCounts.forEach((data, system) => {
      if (data.count >= 2) {
        derivedTrends.push({
          id: `trend-${id++}`,
          category: 'מערכת',
          type: system,
          pattern: data.examples[0] || `בעיות ב${system}`,
          occurrences: data.count,
          period: 'מהנתונים שהועלו',
          severity: data.severity as 'low' | 'medium' | 'high' | 'critical'
        });
      }
    });
    
    // Sort by occurrences
    return derivedTrends.sort((a, b) => b.occurrences - a.occurrences).slice(0, 5);
  }, [insights, hasData]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">קריטי</Badge>;
      case "high":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">גבוה</Badge>;
      case "medium":
        return <Badge className="bg-warning/10 text-warning border-warning/20">בינוני</Badge>;
      default:
        return <Badge variant="secondary">נמוך</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "סוג מטוס":
        return <Plane className="h-4 w-4 text-primary" />;
      case "עונתיות":
        return <Calendar className="h-4 w-4 text-accent" />;
      default:
        return <TrendingUp className="h-4 w-4 text-warning" />;
    }
  };

  // PRODUCTION: Show empty state if no data
  if (!hasData) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            מגמות אחזקה בטייסת
          </CardTitle>
          <CardDescription>
            זיהוי תובנות חוזרות לפי סוג מטוס, משימה ועונתיות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Database className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg">אין נתונים לניתוח מגמות</h3>
            <p className="text-muted-foreground mt-2">
              נדרשת העלאת נתוני טיסה לזיהוי מגמות חוזרות
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No patterns identified
  if (trends.length === 0) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            מגמות אחזקה בטייסת
          </CardTitle>
          <CardDescription>
            זיהוי תובנות חוזרות לפי סוג מטוס, משימה ועונתיות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Info className="h-12 w-12 mx-auto text-blue-500 mb-4" />
            <h3 className="font-semibold text-lg">לא זוהו מגמות חוזרות</h3>
            <p className="text-muted-foreground mt-2">
              נותחו {dashboardStats.totalFlights} טיסות - לא נמצאו דפוסים חוזרים
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          מגמות אחזקה בטייסת
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
            מנתונים אמיתיים
          </Badge>
        </CardTitle>
        <CardDescription>
          זיהוי תובנות חוזרות על בסיס {dashboardStats.totalFlights} טיסות שנותחו
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {trends.map((trend) => (
          <div
            key={trend.id}
            className="p-4 border border-border rounded-lg bg-card/50"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getCategoryIcon(trend.category)}
                <span className="font-medium">{trend.category}: {trend.type}</span>
                {getSeverityBadge(trend.severity)}
              </div>
              
              <div className="text-left">
                <span className="text-lg font-bold text-primary">{trend.occurrences}</span>
                <span className="text-sm text-muted-foreground mr-1">מופעים</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">{trend.pattern}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{trend.period}</span>
              </div>
            </div>
            
            <div className="mt-3 bg-muted/30 rounded p-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">שכיחות יחסית:</span>
                <div className="flex items-center gap-1">
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        trend.severity === 'critical' ? 'bg-destructive' :
                        trend.severity === 'high' ? 'bg-destructive/70' :
                        'bg-warning'
                      }`}
                      style={{ width: `${Math.min((trend.occurrences / Math.max(dashboardStats.totalInsights, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="font-medium">
                    {Math.round((trend.occurrences / Math.max(dashboardStats.totalInsights, 1)) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
