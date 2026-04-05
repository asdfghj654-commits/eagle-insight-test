import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMemo } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export const MaintenanceAlerts = () => {
  const { insights, isGeneratingInsights, hasData } = useDashboardData();

  // המרת תובנות להתרעות עם אייקונים מתאימים
  const alerts = useMemo(() => {
    return insights
      .filter(insight => ['critical', 'high', 'medium'].includes(insight.severity))
      .sort((a, b) => {
        // מיון לפי חומרה ואז לפי זמן
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.created_at - a.created_at;
      })
      .slice(0, 5) // הצג רק 5 התרעות ראשונות
      .map(insight => ({
        id: insight.insight_id,
        severity: insight.severity === 'critical' ? 'critical' : 
                  insight.severity === 'high' ? 'warning' : 'info',
        title: insight.title,
        description: insight.description + (insight.technical_detail ? ` - ${insight.technical_detail}` : ''),
        flightId: insight.flight_id,
        timestamp: new Date(insight.created_at).toLocaleTimeString('he-IL', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        icon: insight.severity === 'critical' ? AlertTriangle : 
              insight.severity === 'high' ? AlertCircle : Info,
        system: insight.system,
        tail: insight.tail
      }));
  }, [insights]);

  const displayAlerts = hasData ? alerts : [];

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "warning": return "default";
      default: return "default";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          התרעות אחזקה מטיסות שהסתיימו
          {hasData && alerts.length > 0 && (
            <Badge variant="destructive" className="mr-2">
              {alerts.filter(a => a.severity === 'critical').length} קריטיות
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {hasData 
            ? `${alerts.length} התרעות פעילות מניתוח נתוני קופסה שחורה`
            : 'התרעות דחופות מניתוח נתוני קופסה שחורה'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGeneratingInsights ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="mr-2 text-muted-foreground">מנתח נתונים...</span>
          </div>
        ) : displayAlerts.length > 0 ? (
          displayAlerts.map((alert) => (
            <Alert key={alert.id} variant={getSeverityVariant(alert.severity)}>
              <alert.icon className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{alert.title}</span>
                <div className="flex items-center gap-2">
                  {alert.tail && (
                    <Badge variant="secondary" className="text-xs">
                      מטוס {alert.tail}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {alert.flightId}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                </div>
              </AlertTitle>
              <AlertDescription className="mt-2">
                {alert.description}
              </AlertDescription>
            </Alert>
          ))
        ) : (
          <EmptyState
            icon={Info}
            title="אין התרעות פעילות"
            description="נדרשים נתוני טיסה כדי להציג התרעות."
          />
        )}
      </CardContent>
    </Card>
  );
};
