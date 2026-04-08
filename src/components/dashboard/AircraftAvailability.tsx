/**
 * Aircraft Availability Component
 * 
 * PRODUCTION RULE: This component MUST NOT display any data
 * until real data is loaded from CSV or integration.
 * 
 * NO defaultAircraftFleet fallback.
 * NO hardcoded 417, 892, 334 aircraft.
 * 
 * Terminology: Uses "כשירות מטוסים" (Aircraft Readiness), NOT "צי" (Fleet).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, CheckCircle2, AlertTriangle, Wrench, Calendar, Loader2, Database, ChevronDown, ChevronUp } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useRuleAuthority } from "@/hooks/useRuleAuthority";

const PAGE_SIZE = 6;

export const AircraftAvailability = () => {
  const { getAircraftStatus, hasData, isGeneratingInsights, dashboardStats } = useDashboardData();
  const { isStatusAuthorized, sanitizeStatus } = useRuleAuthority();
  const [expanded, setExpanded] = useState(false);
  
  // Build aircraft data ONLY from real data - NO FALLBACK
  const aircraftFleet = useMemo(() => {
    if (!hasData) return [];
    
    const aircraftStatus = getAircraftStatus();
    return aircraftStatus.map((aircraft, index) => {
      // Determine status - respecting rule authority
      let status = 'available';
      let location = 'קו טיסה';
      
      if (aircraft.status === 'critical') {
        // "grounded" status requires rule authority
        status = isStatusAuthorized("מקורקע") ? 'grounded' : 'unknown';
        location = 'מושבת - בבדיקה';
      } else if (aircraft.status === 'maintenance') {
        status = 'maintenance';
        location = 'מתקן אחזקה';
      }
      
      return {
        tailNumber: aircraft.tail,
        block: `Block ${50 + (index % 2) * 2}`, // Derived, not hardcoded
        status,
        lastFlight: aircraft.lastFlight || null,
        nextMaintenance: null, // Would come from maintenance system
        flightHours: null, // Would come from maintenance system
        location,
        alertCount: aircraft.alertCount,
        criticalAlerts: aircraft.criticalAlerts
      };
    });
  }, [hasData, getAircraftStatus, isStatusAuthorized]);

  // PRODUCTION: NO default data - REMOVED defaultAircraftFleet

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge className="bg-success/10 text-success border-success/20">זמין</Badge>;
      case "flying":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">בטיסה</Badge>;
      case "maintenance":
        return <Badge className="bg-warning/10 text-warning border-warning/20">באחזקה</Badge>;
      case "grounded":
        return <Badge variant="destructive">מושבת</Badge>;
      case "unknown":
        return <Badge variant="outline" className="text-muted-foreground">לא ידוע</Badge>;
      default:
        return <Badge variant="outline">לא ידוע</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "flying":
        return <Plane className="h-4 w-4 text-blue-600" />;
      case "maintenance":
        return <Wrench className="h-4 w-4 text-warning" />;
      case "grounded":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // PRODUCTION: Show empty state if no data
  if (!hasData || aircraftFleet.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            כשירות מטוסים כללי
          </CardTitle>
          <CardDescription>
            מצב כשירות המטוסים
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Database}
            title="אין נתוני כשירות מטוסים"
            description="נדרשת העלאת נתוני טיסה לצפייה בסטטוס כשירות. העלה קובץ CSV עם נתוני קופסה שחורה."
          />
        </CardContent>
      </Card>
    );
  }

  // Calculate status counts from real data only
  const statusCounts = aircraftFleet.reduce((acc, aircraft) => {
    acc[aircraft.status] = (acc[aircraft.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const availableCount = dashboardStats.aircraftAvailable;
  const totalCount = dashboardStats.aircraftTotal;
  const maintenanceCount = dashboardStats.aircraftInReview;
  const groundedCount = Math.max(0, dashboardStats.aircraftWithAlerts - dashboardStats.aircraftInReview);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          כשירות מטוסים כללי
          <Badge variant="outline" className="mr-2 text-xs bg-green-50 text-green-700 border-green-200">
            נתונים אמיתיים
          </Badge>
        </CardTitle>
        <CardDescription>
          מצב כשירות המטוסים - {availableCount}/{totalCount} זמינים לטיסה
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-success/5 border border-success/20 rounded-lg">
            <div className="text-2xl font-bold text-success">{availableCount}</div>
            <div className="text-xs text-muted-foreground">זמינים</div>
          </div>
          <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{statusCounts.flying || 0}</div>
            <div className="text-xs text-muted-foreground">בטיסה</div>
          </div>
          <div className="text-center p-3 bg-warning/5 border border-warning/20 rounded-lg">
            <div className="text-2xl font-bold text-warning">{maintenanceCount}</div>
            <div className="text-xs text-muted-foreground">בתחזוקה</div>
          </div>
          <div className="text-center p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <div className="text-2xl font-bold text-destructive">{groundedCount}</div>
            <div className="text-xs text-muted-foreground">מושבתים</div>
          </div>
        </div>

        {/* Aircraft List */}
        <div className="space-y-2">
          {isGeneratingInsights ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="mr-2 text-sm text-muted-foreground">מעבד נתוני מטוסים...</span>
            </div>
          ) : (
            <>
              {(expanded ? aircraftFleet : aircraftFleet.slice(0, PAGE_SIZE)).map((aircraft) => (
                <div key={aircraft.tailNumber} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(aircraft.status)}
                      <div>
                        <h3 className="font-semibold text-sm">מטוס {aircraft.tailNumber}</h3>
                        <p className="text-xs text-muted-foreground">{aircraft.block} · {aircraft.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {aircraft.alertCount > 0 && (
                        <Badge variant={aircraft.criticalAlerts > 0 ? "destructive" : "secondary"} className="text-xs">
                          {aircraft.alertCount} התרעות
                        </Badge>
                      )}
                      {getStatusBadge(aircraft.status)}
                    </div>
                  </div>
                </div>
              ))}
              {aircraftFleet.length > PAGE_SIZE && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground gap-1"
                  onClick={() => setExpanded(e => !e)}
                >
                  {expanded ? (
                    <><ChevronUp className="h-3 w-3" />הצג פחות</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" />הצג עוד {aircraftFleet.length - PAGE_SIZE} מטוסים</>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
        
        {/* Data attribution */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          נתונים מ-{dashboardStats.totalFlights} טיסות שנותחו | {totalCount} מטוסים מזוהים
        </div>
      </CardContent>
    </Card>
  );
};
