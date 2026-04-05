/**
 * Flight Files Component
 * 
 * PRODUCTION RULE: Flight files MUST be derived from:
 * - CSV uploaded data (processedFlights)
 * - Flight dossiers context
 * 
 * NO hardcoded flight data - show empty state if no data exists.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Folder, FileText, Clock, Plane, Eye, Share2, ExternalLink } from "lucide-react";
import { ActionButton, useActionToast } from "@/components/ui/shared-actions";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useAvailableFlights } from "@/hooks/useAvailableFlights";
import { EmptyState } from "@/components/ui/empty-state";
import { useRole } from "./RoleProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface FlightFile {
  flightCode: string;
  aircraft: string;
  missionCode: string;
  date: string;
  flightHours: string;
  type: string;
  status: string;
  maintenanceStatus: string;
  alerts: number;
  severity: string;
  specialFeatures: string[];
  fileCompleteness: number;
}

// Helper to format duration
const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
};

// Helper to determine maintenance status from findings
const computeMaintenanceStatus = (hasFindings: boolean, criticalCount: number): string => {
  if (criticalCount > 0) return 'נדרשת בדיקה דחופה';
  if (hasFindings) return 'ממתין לבדיקה';
  return 'טיפול אחזקה מושלם';
};

// Helper to determine severity color
const getSeverityFromCount = (criticalCount: number, totalCount: number): string => {
  if (criticalCount > 0) return 'high';
  if (totalCount > 2) return 'medium';
  if (totalCount > 0) return 'low';
  return 'none';
};

export const FlightFiles = () => {
  const { showSuccess, showInfo } = useActionToast();
  const navigate = useNavigate();
  const { currentUser } = useRole();
  const { hasRealData } = useCSVData();
  const { flights, hasFlights } = useAvailableFlights({ limit: 10 });
  
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<FlightFile | null>(null);
  // PRODUCTION: Export functionality disabled per NO EXPORT policy

  // PRODUCTION: Derive flight files from CSV data
  const flightFiles = useMemo((): FlightFile[] => {
    if (!hasFlights) return [];
    
    return flights.map(f => ({
      flightCode: f.flightId,
      aircraft: f.tailNumber,
      missionCode: `טיסה-${f.flightId.slice(-3)}`,
      date: f.startTime.split('T')[0],
      flightHours: formatDuration(f.durationMinutes),
      type: f.phases.includes('maneuver') ? 'אימון קרבי' : 'טיסה שגרתית',
      status: 'completed',
      maintenanceStatus: computeMaintenanceStatus(f.hasFindings, f.criticalFindingCount),
      alerts: f.findingCount,
      severity: getSeverityFromCount(f.criticalFindingCount, f.findingCount),
      specialFeatures: f.phases.slice(0, 3).map(p => p),
      fileCompleteness: Math.min(100, (f.recordCount / 100) * 100),
    }));
  }, [flights, hasFlights]);

  const getStatusBadge = (status: string) => {
    return <Badge variant="secondary">הושלם</Badge>;
  };

  const getMaintenanceStatusBadge = (maintenanceStatus: string) => {
    switch (maintenanceStatus) {
      case "נדרשת בדיקה דחופה":
        return <Badge variant="destructive">נדרשת בדיקה דחופה</Badge>;
      case "ממתין לבדיקה":
        return <Badge className="bg-warning/10 text-warning border-warning/20">ממתין לבדיקה</Badge>;
      case "טיפול אחזקה מושלם":
        return <Badge className="bg-success/10 text-success border-success/20">טיפול מושלם</Badge>;
      default:
        return <Badge variant="outline">{maintenanceStatus}</Badge>;
    }
  };

  const getAlertsBadge = (alerts: number, severity: string) => {
    if (alerts === 0) return null;
    
    const severityColors = {
      high: "bg-destructive text-destructive-foreground",
      medium: "bg-warning text-warning-foreground", 
      low: "bg-muted text-muted-foreground",
      none: "bg-muted text-muted-foreground"
    };
    
    return (
      <Badge className={severityColors[severity as keyof typeof severityColors] || "bg-muted"}>
        {alerts} ממצאים
      </Badge>
    );
  };

  // =============================================================================
  // ACTION HANDLERS
  // =============================================================================

  const handleViewFlight = (flight: FlightFile) => {
    setSelectedFlight(flight);
    setViewDialogOpen(true);
  };

  // PRODUCTION: Export functionality disabled per NO EXPORT policy
  // handleExportFlight removed - ייצוא לא זמין במערכת

  const handleShareFlight = (flight: FlightFile) => {
    const link = `${window.location.origin}/flight-dossiers/${flight.flightCode}`;
    navigator.clipboard.writeText(link);
    showInfo('קישור הועתק', 'הקישור הפנימי הועתק ללוח');
  };

  const handleOpenInPortal = () => {
    if (selectedFlight) {
      sessionStorage.setItem('flight_context', JSON.stringify(selectedFlight));
      navigate('/portal/magen-achzaka-david');
    }
    setViewDialogOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            תיקי טיסה
            {flightFiles.length > 0 && (
              <Badge variant="outline">{flightFiles.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            תיקים אישיים לכל טיסה עם תובנות אחזקתיות
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PRODUCTION: Empty state when no flights */}
          {flightFiles.length === 0 ? (
            <EmptyState
              icon={Folder}
              title="אין תיקי טיסה"
              description={
                hasRealData 
                  ? "לא נמצאו טיסות בנתונים שהועלו"
                  : "העלה קובץ CSV עם נתוני טיסה לצפייה בתיקים"
              }
            />
          ) : (
            flightFiles.map((flight) => (
              <div key={flight.flightCode} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">{flight.flightCode}</h3>
                      <p className="text-sm text-muted-foreground">{flight.date}</p>
                    </div>
                  </div>
                  {getStatusBadge(flight.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>שעות טיסה: {flight.flightHours}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <span>מטוס: {flight.aircraft} ({flight.missionCode})</span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">סוג טיסה: {flight.type}</p>
                  <div className="flex flex-wrap gap-2">
                    {flight.specialFeatures.map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">סטטוס אחזקה:</span>
                  {getMaintenanceStatusBadge(flight.maintenanceStatus)}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    {getAlertsBadge(flight.alerts, flight.severity)}
                  </div>
                  <div className="flex gap-2">
                    <ActionButton 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleShareFlight(flight)}
                      className="gap-1"
                    >
                      <Share2 className="h-3 w-3" />
                    </ActionButton>
                    {/* PRODUCTION: Export button removed - ייצוא לא זמין */}
                    <ActionButton 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewFlight(flight)}
                      className="gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      צפה בתיק
                    </ActionButton>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* View Flight Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              תיק טיסה - {selectedFlight?.flightCode}
            </DialogTitle>
            <DialogDescription>
              פרטי טיסה מלאים
            </DialogDescription>
          </DialogHeader>
          {selectedFlight && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">מטוס</Label>
                  <p className="font-medium">{selectedFlight.aircraft}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">תאריך</Label>
                  <p className="font-medium">{selectedFlight.date}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">שעות טיסה</Label>
                  <p className="font-medium">{selectedFlight.flightHours}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">סוג משימה</Label>
                  <p className="font-medium">{selectedFlight.type}</p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-muted-foreground">סטטוס אחזקה</Label>
                <div className="mt-1">{getMaintenanceStatusBadge(selectedFlight.maintenanceStatus)}</div>
              </div>
              
              {selectedFlight.alerts > 0 && (
                <div>
                  <Label className="text-muted-foreground">ממצאים</Label>
                  <div className="mt-1">{getAlertsBadge(selectedFlight.alerts, selectedFlight.severity)}</div>
                </div>
              )}
              
              <div>
                <Label className="text-muted-foreground">שלבי טיסה</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedFlight.specialFeatures.map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {/* PRODUCTION: Export button removed - ייצוא לא זמין במערכת */}
            {currentUser.role === 'engineer' && (
              <ActionButton onClick={handleOpenInPortal} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                פתח בפורטל הנדסי
              </ActionButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
