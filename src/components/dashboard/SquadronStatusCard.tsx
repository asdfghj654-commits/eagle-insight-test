/**
 * Squadron Status Card Component
 * 
 * PRODUCTION RULE: This component MUST NOT display any data
 * until real data is loaded from CSV or integration.
 * 
 * NO defaultAircraftData fallback.
 * NO hardcoded 417, 892, 334 aircraft.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, AlertCircle, Loader2, Database } from "lucide-react";
import { useRole } from "./RoleProvider";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMemo } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useRuleAuthority } from "@/hooks/useRuleAuthority";

export const SquadronStatusCard = () => {
  const { currentUser } = useRole();
  const { getAircraftStatus, hasData, isGeneratingInsights, insights } = useDashboardData();
  const { sanitizeStatus, isStatusAuthorized } = useRuleAuthority();

  // Build aircraft data ONLY from real data - NO FALLBACK
  const aircraftData = useMemo(() => {
    if (!hasData) return [];
    
    const aircraftStatus = getAircraftStatus();
    return aircraftStatus.map(aircraft => {
      // Count open insights for this aircraft
      const openInsights = insights.filter(
        i => i.tail === aircraft.tail && ['new', 'in_progress', 'requires_investigation'].includes(i.status)
      ).length;
      
      // Determine status - MUST BE AUTHORIZED BY RULE
      let status = "זמין";
      let flights = "מוכן";
      
      if (aircraft.status === 'critical') {
        // "לא כשיר" requires rule authority
        status = isStatusAuthorized("לא כשיר") ? "לא כשיר" : "סטטוס לא ידוע";
        flights = isStatusAuthorized("מקורקע") ? "מקורקע" : "לא פעיל";
      } else if (aircraft.status === 'maintenance') {
        status = "בתחזוקה";
        flights = "מושבת";
      } else if (aircraft.alertCount > 0) {
        flights = "פעיל";
      }
      
      return {
        tailNumber: aircraft.tail,
        status,
        flights,
        openInsights,
        alertCount: aircraft.alertCount,
        criticalAlerts: aircraft.criticalAlerts
      };
    });
  }, [hasData, getAircraftStatus, insights, isStatusAuthorized]);

  // PRODUCTION: NO default data - only real data
  // REMOVED: defaultAircraftData array
  
  const displayAircraftData = aircraftData;

  // Summary calculations
  const availableCount = displayAircraftData.filter(a => a.status === "זמין").length;
  const totalCount = displayAircraftData.length;

  const getStatusBadge = (status: string) => {
    // Sanitize status through rule authority
    const displayStatus = sanitizeStatus(status);
    
    switch (displayStatus) {
      case "זמין":
        return <Badge className="bg-success/10 text-success border-success/20">זמין</Badge>;
      case "לא כשיר":
        return <Badge variant="destructive">לא כשיר</Badge>;
      case "בתחזוקה":
        return <Badge className="bg-warning/10 text-warning border-warning/20">בתחזוקה</Badge>;
      case "סטטוס לא ידוע":
        return <Badge variant="outline" className="text-muted-foreground">סטטוס לא ידוע</Badge>;
      default:
        return <Badge variant="secondary">{displayStatus}</Badge>;
    }
  };

  const getFlightsBadge = (flights: string) => {
    switch (flights) {
      case "פעיל":
        return <Badge className="bg-primary/10 text-primary border-primary/20">פעיל</Badge>;
      case "מקורקע":
        return <Badge variant="destructive">מקורקע</Badge>;
      case "מושבת":
        return <Badge className="bg-warning/10 text-warning border-warning/20">מושבת</Badge>;
      case "לא פעיל":
        return <Badge variant="outline" className="text-muted-foreground">לא פעיל</Badge>;
      default:
        return <Badge variant="outline">{flights}</Badge>;
    }
  };

  // Show only to commander
  if (currentUser.role !== 'commander') {
    return null;
  }

  // PRODUCTION: Show empty state if no data
  if (!hasData || displayAircraftData.length === 0) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-muted-foreground" />
            סטטוס טייסת
          </CardTitle>
          <CardDescription>
            מצב כלל המטוסים, טיסות פעילות ותובנות פתוחות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Database}
            title="אין נתוני טייסת"
            description="נדרשת העלאת נתוני טיסה לצפייה בסטטוס מטוסים. העלה קובץ CSV או המתן לקבלת נתונים מהמערכת."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-accent" />
          סטטוס טייסת - {currentUser.role === 'commander' ? 'מפקד טכני' : 'ר״צ אחזקה'}
          <Badge variant="outline" className="mr-2 text-xs bg-green-50 text-green-700 border-green-200">
            נתונים אמיתיים
          </Badge>
        </CardTitle>
        <CardDescription>
          מצב כלל המטוסים, טיסות פעילות ותובנות פתוחות
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isGeneratingInsights ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="mr-2 text-muted-foreground">מעבד נתונים...</span>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayAircraftData.map((aircraft) => (
                <div
                  key={aircraft.tailNumber}
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-card/50"
                >
                  <div className="flex items-center gap-3">
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-lg">{aircraft.tailNumber}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {getStatusBadge(aircraft.status)}
                    {getFlightsBadge(aircraft.flights)}
                    
                    {aircraft.openInsights > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium text-warning">
                          {aircraft.openInsights} תובנות
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">סה"כ מטוסים זמינים:</span>
                <span className={`font-medium ${
                  availableCount === totalCount ? 'text-success' : 
                  availableCount > totalCount / 2 ? 'text-warning' : 
                  'text-destructive'
                }`}>
                  {availableCount}/{totalCount}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
