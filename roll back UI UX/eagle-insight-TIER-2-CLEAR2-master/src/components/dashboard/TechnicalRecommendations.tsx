/**
 * Technical Recommendations Component
 * 
 * PRODUCTION RULE: Recommendations MUST come from:
 * - Rules engine findings
 * - Insights engine analysis
 * - CSV-derived data
 * 
 * NO fallback demo data - show empty state if no findings exist.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Power, User, Wrench, Zap, Settings, ShieldCheck, Database } from "lucide-react";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useMemo } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export const TechnicalRecommendations = () => {
  const { findings, getOpenFindings } = useFlightDossier();
  const { hasRealData, dataMode } = useCSVData();
  
  // PRODUCTION: Convert findings to recommendations - NO FALLBACK DEMO DATA
  const recommendations = useMemo(() => {
    const openFindings = getOpenFindings();
    
    // NO FALLBACK - return empty array if no real findings
    if (openFindings.length === 0) {
      return [];
    }
    
    return openFindings.slice(0, 5).map((finding, idx) => ({
      id: idx + 1,
      flightId: finding.dossierIds[0] || `FND-${idx}`,
      severity: finding.severity === 'S1' ? 'critical' : finding.severity === 'S2' ? 'warning' : 'info',
      title: finding.titleHe,
      description: finding.descriptionHe,
      groundingRequired: finding.severity === 'S1',
      inspectionRequired: finding.requiredAction?.descriptionHe || 'בדיקה נדרשת',
      priority: finding.severity === 'S1' ? 'גבוהה' : finding.severity === 'S2' ? 'בינונית' : 'נמוכה',
      problematicSystems: [finding.systemAffectedHe || 'מערכת לא מזוהה'],
      dataSource: `קופסה שחורה - ${finding.ruleId || 'זיהוי אוטומטי'}`,
      insightMethod: finding.technicalDetail || 'ניתוח נתוני טיסה',
      riskLevel: finding.severity === 'S1' ? 'high' : finding.severity === 'S2' ? 'medium' : 'low',
      tailNumber: finding.tailNumbers[0] || 'N/A',
      flightData: {
        anomaly: finding.technicalDetail || finding.descriptionHe,
        normalRange: 'לפי מפרט יצרן',
        detectedValue: 'חריגה זוהתה',
        consequence: finding.recommendationHe || 'נדרשת בדיקה'
      }
    }));
  }, [findings, getOpenFindings]);

  const getInspectionIcon = (inspection: string) => {
    if (inspection.includes("מבנה")) return <Wrench className="h-4 w-4" />;
    if (inspection.includes("חשמל")) return <Zap className="h-4 w-4" />;
    if (inspection.includes("בקרה")) return <Settings className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "גבוהה": return "text-destructive-foreground border-destructive/20 bg-destructive/5";
      case "בינונית": return "text-warning-foreground border-warning/20 bg-warning/5";
      default: return "text-primary-foreground border-primary/20 bg-primary/5";
    }
  };

  const getRiskBadge = (risk: string, grounding: boolean) => {
    if (grounding) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <Power className="h-3 w-3" />
        השבתה נדרשת
      </Badge>;
    }
    
    switch (risk) {
      case "high": return <Badge variant="destructive">סיכון גבוה</Badge>;
      case "medium": return <Badge className="bg-warning/10 text-warning border-warning/20">סיכון בינוני</Badge>;
      default: return <Badge variant="secondary">סיכון נמוך</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          המלצות טכניות
          {recommendations.length > 0 && (
            <Badge variant="outline">{recommendations.length} פעילות</Badge>
          )}
          {/* PRODUCTION: Show data mode indicator */}
          {dataMode === 'demo' && (
            <Badge variant="secondary" className="text-xs">נתוני הדגמה</Badge>
          )}
        </CardTitle>
        <CardDescription>
          המלצות מומחים לטכנאים על פי תובנות אחזקה
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PRODUCTION: Empty state when no recommendations */}
        {recommendations.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="אין המלצות טכניות פעילות"
            description={
              hasRealData 
                ? "הנתונים נותחו ולא נמצאו חריגות הדורשות המלצות. המטוסים במצב תקין."
                : "העלה קובץ CSV עם נתוני טיסה לביצוע ניתוח וקבלת המלצות."
            }
            variant={hasRealData ? "info" : "default"}
          />
        ) : (
          recommendations.map((rec) => (
            <div key={rec.id} className={`border rounded-lg p-4 space-y-3 ${getPriorityColor(rec.priority)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-foreground" />
                  <div>
                    <h3 className="font-semibold text-foreground">{rec.title}</h3>
                    <p className="text-sm text-muted-foreground">{rec.flightId} | זנב: {rec.tailNumber}</p>
                  </div>
                </div>
                {getRiskBadge(rec.riskLevel, rec.groundingRequired)}
              </div>

              <p className="text-sm text-foreground">{rec.description}</p>

              {/* Flight Data Analysis */}
              <div className="bg-background/50 border rounded-lg p-3 space-y-2">
                <p className="font-medium text-sm text-destructive">ניתוח נתוני טיסה:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-foreground">
                  <div><strong>חריגה זוהתה:</strong> {rec.flightData.anomaly}</div>
                  <div><strong>ערך תקין:</strong> {rec.flightData.normalRange}</div>
                  <div><strong>ערך נמדד:</strong> {rec.flightData.detectedValue}</div>
                  <div><strong>השלכה:</strong> {rec.flightData.consequence}</div>
                </div>
              </div>

              {/* Data Source & Method */}
              <div className="bg-muted/50 border rounded-lg p-3 space-y-2">
                <p className="font-medium text-sm text-foreground">איך התקבלה התובנה:</p>
                <div className="text-xs space-y-1 text-foreground">
                  <p><strong>מקור נתונים:</strong> {rec.dataSource}</p>
                  <p><strong>שיטת זיהוי:</strong> {rec.insightMethod}</p>
                </div>
              </div>

              {/* Problematic Systems */}
              <div className="space-y-2">
                <p className="font-medium text-sm text-foreground">מערכות ורכיבים בעייתיים:</p>
                <div className="flex flex-wrap gap-1">
                  {rec.problematicSystems.map((system, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {system}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {getInspectionIcon(rec.inspectionRequired)}
                  <div>
                    <p className="font-medium text-foreground">בדיקה נדרשת</p>
                    <p className="text-muted-foreground">{rec.inspectionRequired}</p>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-foreground">עדיפות</p>
                  <Badge variant="outline">{rec.priority}</Badge>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-current/20">
                <Button variant="outline" size="sm" className="text-xs">
                  צפה בנתוני טיסה מלאים
                </Button>
                <Button variant="default" size="sm" className="text-xs">
                  התחל בדיקה
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
