import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, RotateCcw, Search, Loader2, CheckCircle, Mail, ArrowRight } from "lucide-react";
import { useRole } from "./RoleProvider";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMemo, useState } from "react";
import { ActionButton, useActionToast, EmptyState } from "@/components/ui/shared-actions";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { useAuth } from "@/contexts/AuthContext";

interface Recommendation {
  id: string;
  aircraft: string;
  type: "immediate" | "overdue" | "recurring";
  description: string;
  severity: string;
  lastFlight?: string;
  hours?: number;
  occurrences?: number;
  sourceType: "finding" | "derived-pattern";
  sourceFindingId?: string;
  provenance: string;
}

export const CommanderRecommendations = () => {
  const { currentUser } = useRole();
  const { user } = useAuth();
  const { insights, hasData, isGeneratingInsights } = useDashboardData();
  const { updateFindingStatus } = useFlightDossier();
  const { showSuccess, showInfo } = useActionToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const recommendations = useMemo(() => {
    if (!hasData || insights.length === 0) return [];

    const recs: Recommendation[] = [];

    const criticalInsights = insights.filter(
      (insight) => insight.severity === "critical" && (insight.status === "unclassified" || insight.status === "new")
    );

    criticalInsights.slice(0, 2).forEach((insight) => {
      recs.push({
        id: insight.insight_id,
        aircraft: insight.tail,
        type: "immediate",
        description: `בדיקה מיידית נדרשת - ${insight.title}`,
        severity: "critical",
        lastFlight: new Date(insight.created_at).toISOString().split("T")[0],
        sourceType: "finding",
        sourceFindingId: insight.insight_id,
        provenance: `מבוסס על ממצא persisted בחומרה ${insight.severity} במערכת ${insight.system}.`,
      });
    });

    const now = Date.now();
    const overdueInsights = insights.filter((insight) => {
      const hoursSinceCreation = (now - insight.created_at) / (1000 * 60 * 60);
      return (insight.status === "unclassified" || insight.status === "new") && hoursSinceCreation > 24;
    });

    overdueInsights.slice(0, 2).forEach((insight) => {
      const hoursSinceCreation = Math.round((now - insight.created_at) / (1000 * 60 * 60));
      recs.push({
        id: `${insight.insight_id}_overdue`,
        aircraft: insight.tail,
        type: "overdue",
        description: `ממצא פתוח מעל ${hoursSinceCreation} שעות - ${insight.title}`,
        severity: insight.severity === "critical" ? "critical" : "medium",
        hours: hoursSinceCreation,
        sourceType: "finding",
        sourceFindingId: insight.insight_id,
        provenance: `מבוסס על ממצא persisted שטרם נסגר במשך ${hoursSinceCreation} שעות.`,
      });
    });

    const systemCounts = new Map<string, { tails: Set<string>; count: number }>();
    insights.forEach((insight) => {
      const key = insight.system;
      const current = systemCounts.get(key) || { tails: new Set<string>(), count: 0 };
      current.tails.add(insight.tail);
      current.count += 1;
      systemCounts.set(key, current);
    });

    Array.from(systemCounts.entries())
      .filter(([, data]) => data.tails.size >= 2)
      .slice(0, 1)
      .forEach(([system, data]) => {
        recs.push({
          id: `recurring_${system}`,
          aircraft: Array.from(data.tails).join(", "),
          type: "recurring",
          description: `דפוס חוזר - בעיית ${system} במספר מטוסים`,
          severity: "high",
          occurrences: data.count,
          sourceType: "derived-pattern",
          provenance: `נגזר מאיגוד של ${data.count} ממצאים persisted במערכת ${system}. זו אינדיקציה לחקירה, לא קביעה אוטומטית.`,
        });
      });

    return recs;
  }, [hasData, insights]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">קריטי</Badge>;
      case "high":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">גבוה</Badge>;
      case "medium":
        return <Badge className="bg-warning/10 text-warning border-warning/20">בינוני</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "immediate":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "overdue":
        return <Clock className="h-4 w-4 text-warning" />;
      case "recurring":
        return <RotateCcw className="h-4 w-4 text-destructive" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const handleSendEmail = async (rec: Recommendation) => {
    setLoadingAction(`email-${rec.id}`);
    try {
      const subject = encodeURIComponent(`המלצה לבדיקה: מטוס ${rec.aircraft}`);
      const body = encodeURIComponent(
        `סוג: ${rec.type}\nמטוס: ${rec.aircraft}\nחומרה: ${rec.severity}\n\n${rec.description}\n\nמקור:\n${rec.provenance}`
      );
      window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
      showInfo("נפתח חלון מייל", "יש לאשר ידנית את שליחת ההודעה.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEscalate = async (rec: Recommendation) => {
    setLoadingAction(`escalate-${rec.id}`);
    try {
      if (!rec.sourceFindingId || !user) {
        showInfo("נדרש תחקיר אנושי", "אי אפשר להסלים דפוס נגזר ישירות. יש לפתוח או להמשיך תחקיר מסודר.");
        return;
      }

      const result = updateFindingStatus(
        rec.sourceFindingId,
        "escalated",
        user.id,
        user.role,
        `Escalated from commander recommendations: ${rec.description}`
      );

      if (result.success) {
        showSuccess("הממצא הוסלם", "סטטוס הממצא עודכן ל-escalated.");
      } else {
        showInfo("ההסלמה לא הושלמה", result.errorHe || "עדכון הסטטוס נכשל.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMarkAsTreated = async (rec: Recommendation) => {
    setLoadingAction(`treated-${rec.id}`);
    try {
      if (!rec.sourceFindingId || !user) {
        showInfo("אי אפשר לסגור דפוס נגזר", "רק ממצא persisted ניתן לסמן כטופל. עבור דפוס חוזר יש להשלים תחקיר.");
        return;
      }

      const result = updateFindingStatus(
        rec.sourceFindingId,
        "resolved",
        user.id,
        user.role,
        `Marked as treated from commander recommendations: ${rec.description}`
      );

      if (result.success) {
        showSuccess("הממצא סומן כטופל", "סטטוס הממצא עודכן ל-resolved.");
      } else {
        showInfo("העדכון לא הושלם", result.errorHe || "עדכון הסטטוס נכשל.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Card className="border-warning/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          המלצות לרמ״ד / מפקד
          {hasData && recommendations.length > 0 && (
            <Badge variant="secondary" className="mr-2">
              {recommendations.length} המלצות
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {hasData
            ? "ריכוז פעולות מוצעות. כל שורה מסמנת אם היא מבוססת על ממצא persisted או על דפוס נגזר."
            : "לא נטענו נתונים מאומתים, לכן לא נוצרו המלצות פעולה."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGeneratingInsights ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="mr-2 text-muted-foreground">מנתח נתונים...</span>
          </div>
        ) : recommendations.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="h-12 w-12 text-green-500" />}
            title="No Actionable Recommendations"
            titleHe="אין המלצות פעולה כרגע"
            description={hasData ? "No confirmed findings currently require commander attention" : "No confirmed operational data loaded"}
            descriptionHe={
              hasData ? "אין כרגע ממצאים מאושרים הדורשים תשומת לב פיקודית" : "לא נטענו נתונים תפעוליים מאומתים"
            }
            variant="no-data"
          />
        ) : (
          recommendations.map((rec) => (
            <div key={rec.id} className="p-4 border border-border rounded-lg bg-card/50 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getTypeIcon(rec.type)}
                  <span className="font-medium">מטוס {rec.aircraft}</span>
                  {getSeverityBadge(rec.severity)}
                  <Badge variant="outline">{rec.sourceType === "finding" ? "ממצא persisted" : "דפוס נגזר"}</Badge>
                </div>

                {rec.type === "overdue" && rec.hours && (
                  <span className="text-sm text-destructive font-medium">{rec.hours} שעות</span>
                )}

                {rec.type === "recurring" && rec.occurrences && (
                  <span className="text-sm text-warning font-medium">{rec.occurrences} מופעים</span>
                )}
              </div>

              <p className="text-sm text-muted-foreground">{rec.description}</p>
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">{rec.provenance}</div>

              <div className="flex gap-2 flex-wrap">
                {currentUser.role === "commander" && (
                  <ActionButton
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendEmail(rec)}
                    isLoading={loadingAction === `email-${rec.id}`}
                    loadingText=""
                    className="gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    שלח מייל
                  </ActionButton>
                )}

                {(currentUser.role === "maintenance-chief" || currentUser.role === "specialist") && (
                  <>
                    <ActionButton
                      size="sm"
                      className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20 gap-1"
                      onClick={() => handleEscalate(rec)}
                      isLoading={loadingAction === `escalate-${rec.id}`}
                      loadingText="מעביר..."
                      disabled={rec.sourceType !== "finding"}
                      disabledReasonHe="הסלמה ישירה זמינה רק עבור ממצא persisted, לא עבור דפוס נגזר."
                    >
                      <ArrowRight className="h-3 w-3" />
                      העבר לבדיקה מקצועית
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkAsTreated(rec)}
                      isLoading={loadingAction === `treated-${rec.id}`}
                      loadingText="מעדכן..."
                      className="gap-1"
                      disabled={rec.sourceType !== "finding"}
                      disabledReasonHe="סגירה זמינה רק עבור ממצא persisted."
                    >
                      <CheckCircle className="h-3 w-3" />
                      סמן כטופל
                    </ActionButton>
                  </>
                )}

                {currentUser.role === "technician" && (
                  <ActionButton
                    size="sm"
                    variant="outline"
                    disabled
                    disabledReasonHe="המלצות אלה דורשות אישור רמ״ד או רמ״ח."
                  >
                    דורש אישור בכיר
                  </ActionButton>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
