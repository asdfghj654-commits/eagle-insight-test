/**
 * Active Flights Component
 * 
 * PRODUCTION RULE: Active flights MUST be derived from:
 * - CSV uploaded data (processedFlights)
 * - Recent flight filtering
 * 
 * NO hardcoded flight data - show empty state if no data exists.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Plane, Timer, AlertTriangle } from "lucide-react";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useRecentFlights } from "@/hooks/useAvailableFlights";
import { EmptyState } from "@/components/ui/empty-state";

// Helper to format time from ISO string
const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

// Helper to determine flight status
const determineFlightStatus = (endTime: string, hasFindings: boolean): 'active' | 'waiting_blackbox' | 'completed' => {
  const now = new Date();
  const end = new Date(endTime);
  const hoursSinceEnd = (now.getTime() - end.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceEnd < 1) return 'active';
  if (hasFindings) return 'waiting_blackbox';
  return 'completed';
};

// Helper to determine flight type from phases
const determineFlightType = (phases: string[]): string => {
  if (phases.includes('maneuver')) return 'אימון קרבי - מהלכים מורכבים';
  if (phases.includes('holding')) return 'טיסה עם המתנה';
  if (phases.length >= 6) return 'טיסה מלאה - כל השלבים';
  return 'טיסה שגרתית';
};

export const ActiveFlights = () => {
  const { dataMode, hasRealData } = useCSVData();
  const { flights, hasFlights } = useRecentFlights(24); // Last 24 hours
  
  const [maintenanceStatus, setMaintenanceStatus] = useState<{[key: string]: string}>({});

  // PRODUCTION: Derive active flights from CSV data
  const activeFlights = useMemo(() => {
    if (!hasFlights) return [];
    
    return flights.slice(0, 10).map(f => ({
      id: f.flightId,
      flightCode: f.flightId,
      tailNumber: f.tailNumber,
      flightType: determineFlightType(f.phases),
      takeoffTime: formatTime(f.startTime),
      estimatedLanding: formatTime(f.endTime),
      status: determineFlightStatus(f.endTime, f.hasFindings),
      hasFindings: f.hasFindings,
      findingCount: f.findingCount,
    }));
  }, [flights, hasFlights]);

  const maintenanceStatusOptions = [
    { value: "under_maintenance", label: "בטיפול אחזקה", color: "bg-warning/10 text-warning border-warning/20" },
    { value: "waiting_commander", label: "ממתין לבדיקת ר\"צ", color: "bg-blue-100 text-blue-800 border-blue-200" },
    { value: "internal_stuck", label: "תקוע פנימי", color: "bg-destructive/10 text-destructive border-destructive/20" },
    { value: "completed", label: "בוצע", color: "bg-success/10 text-success border-success/20" }
  ];

  const updateMaintenanceStatus = (flightId: string, status: string) => {
    setMaintenanceStatus(prev => ({
      ...prev,
      [flightId]: status
    }));
  };

  const getStatusEffect = (status: string) => {
    if (status === "completed") {
      return "animate-bounce";
    }
    return "";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "👍";
      case "under_maintenance":
        return "🔧";
      case "waiting_commander":
        return "⏳";
      case "internal_stuck":
        return "⚠️";
      default:
        return "";
    }
  };

  const getFlightStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success border-success/20">פעיל</Badge>;
      case "waiting_blackbox":
        return <Badge className="bg-warning/10 text-warning border-warning/20">ממתין לניתוח</Badge>;
      case "completed":
        return <Badge variant="secondary">הושלם</Badge>;
      default:
        return <Badge variant="outline">לא ידוע</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          טיסות פעילות
          {activeFlights.length > 0 && (
            <Badge variant="outline">{activeFlights.length}</Badge>
          )}
          {/* PRODUCTION: Show data mode indicator */}
          {dataMode === 'demo' && (
            <Badge variant="secondary" className="text-xs">נתוני הדגמה</Badge>
          )}
        </CardTitle>
        <CardDescription>
          טיסות ממתינות ופעילות - תיקי טיסה ממתינים לניתוח
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PRODUCTION: Empty state when no active flights */}
        {activeFlights.length === 0 ? (
          <EmptyState
            icon={Plane}
            title="אין טיסות פעילות"
            description={
              hasRealData 
                ? "לא נמצאו טיסות מ-24 השעות האחרונות בנתונים"
                : "העלה קובץ CSV עם נתוני טיסה לצפייה בטיסות פעילות"
            }
          />
        ) : (
          activeFlights.map((flight) => (
            <div key={flight.id} className="flight-card border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    flight.status === "active" ? "bg-success animate-pulse" : "bg-warning"
                  }`}></div>
                  <div>
                    <h3 className="font-semibold text-foreground">{flight.flightCode}</h3>
                    <p className="text-sm text-muted-foreground">מטוס: {flight.tailNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {flight.hasFindings && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {flight.findingCount} ממצאים
                    </Badge>
                  )}
                  {getFlightStatusBadge(flight.status)}
                </div>
              </div>

              <div className="space-y-2 mt-3">
                <div className="text-sm">
                  <p className="font-medium text-foreground">אופי הטיסה:</p>
                  <p className="text-muted-foreground">{flight.flightType}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>המראה: {flight.takeoffTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span>נחיתה: {flight.estimatedLanding}</span>
                  </div>
                </div>
              </div>

            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
