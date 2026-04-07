import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, RotateCcw, Search, Loader2, CheckCircle, Mail, ArrowRight } from "lucide-react";
import { useRole } from "./RoleProvider";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMemo, useState } from "react";
import { ActionButton, useActionToast, EmptyState } from "@/components/ui/shared-actions";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface Recommendation {
  id: string;
  aircraft: string;
  type: 'immediate' | 'overdue' | 'recurring';
  description: string;
  severity: string;
  lastFlight?: string;
  hours?: number;
  occurrences?: number;
}

export const CommanderRecommendations = () => {
  const { currentUser } = useRole();
  const { user } = useAuth();
  const { insights, hasData, isGeneratingInsights } = useDashboardData();
  const { showSuccess, showInfo } = useActionToast();
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  // יצירת המלצות מנתונים אמיתיים
  const recommendations = useMemo(() => {
    if (!hasData || insights.length === 0) return [];
    
    const recs: Recommendation[] = [];
    
    // 1. המלצות מיידיות - תובנות קריטיות
    const criticalInsights = insights.filter(i => i.severity === 'critical' && i.status === 'new');
    criticalInsights.slice(0, 2).forEach(insight => {
      recs.push({
        id: insight.insight_id,
        aircraft: insight.tail,
        type: 'immediate',
        description: `בדיקה מיידית נדרשת - ${insight.title}`,
        severity: 'critical',
        lastFlight: new Date(insight.created_at).toISOString().split('T')[0]
      });
    });
    
    // 2. תובנות שלא טופלו (מעל X שעות)
    const now = Date.now();
    const overdueInsights = insights.filter(i => {
      const hoursSinceCreation = (now - i.created_at) / (1000 * 60 * 60);
      return i.status === 'new' && hoursSinceCreation > 24;
    });
    overdueInsights.slice(0, 2).forEach(insight => {
      const hoursSinceCreation = Math.round((now - insight.created_at) / (1000 * 60 * 60));
      recs.push({
        id: insight.insight_id + '_overdue',
        aircraft: insight.tail,
        type: 'overdue',
        description: `תובנה לא טופלה מעל ${hoursSinceCreation} שעות - ${insight.title}`,
        severity: insight.severity === 'critical' ? 'critical' : 'medium',
        hours: hoursSinceCreation
      });
    });
    
    // 3. תובנות חוזרות - אותה מערכת במספר מטוסים
    const systemCounts = new Map<string, { tails: Set<string>; count: number }>();
    insights.forEach(insight => {
      const key = insight.system;
      const current = systemCounts.get(key) || { tails: new Set(), count: 0 };
      current.tails.add(insight.tail);
      current.count++;
      systemCounts.set(key, current);
    });
    
    Array.from(systemCounts.entries())
      .filter(([_, data]) => data.tails.size >= 2)
      .slice(0, 1)
      .forEach(([system, data]) => {
        recs.push({
          id: `recurring_${system}`,
          aircraft: Array.from(data.tails).join(', '),
          type: 'recurring',
          description: `תובנה חוזרת - בעיית ${system} במספר מטוסים`,
          severity: 'high',
          occurrences: data.count
        });
      });
    
    return recs;
  }, [insights, hasData]);

  // המלצות ברירת מחדל
  const defaultRecommendations: Recommendation[] = [
    {
      id: "demo-1",
      aircraft: "-",
      type: "immediate" as const,
      description: "טען נתונים כדי לראות המלצות מבוססות ניתוח",
      severity: "info"
    }
  ];

  const displayRecommendations = hasData && recommendations.length > 0 ? recommendations : defaultRecommendations;

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

  // =============================================================================
  // ACTION HANDLERS
  // =============================================================================

  const handleOpenInvestigation = async (rec: Recommendation) => {
    setLoadingAction(`investigate-${rec.id}`);
    try {
      // Store context for investigation
      sessionStorage.setItem('investigation_context', JSON.stringify({
        sourceId: rec.id,
        aircraft: rec.aircraft,
        description: rec.description,
        severity: rec.severity,
        type: rec.type,
      }));
      showSuccess('פותח תחקיר', 'מעביר לפורטל הנדסי');
      navigate('/portal/magen-achzaka-david');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendEmail = async (rec: Recommendation) => {
    setLoadingAction(`email-${rec.id}`);
    try {
      const subject = encodeURIComponent(`המלצה דחופה: מטוס ${rec.aircraft}`);
      const body = encodeURIComponent(
        `המלצה מסוג: ${rec.type === 'immediate' ? 'מיידי' : rec.type === 'overdue' ? 'חריגת זמן' : 'תובנה חוזרת'}\n` +
        `מטוס: ${rec.aircraft}\n` +
        `חומרה: ${rec.severity}\n\n` +
        `תיאור:\n${rec.description}`
      );
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      showInfo('נפתח חלון מייל', 'העתק את הפרטים ושלח');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEscalate = async (rec: Recommendation) => {
    setLoadingAction(`escalate-${rec.id}`);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      showSuccess('הועבר לבדיקה מקצועית', `המלצה ${rec.id} הועברה`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMarkAsTreated = async (rec: Recommendation) => {
    setLoadingAction(`treated-${rec.id}`);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      showSuccess('סומן כטופל', 'ההמלצה עודכנה');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Card className="border-warning/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          המלצות לר״צ / מפקד
          {hasData && recommendations.length > 0 && (
            <Badge variant="secondary" className="mr-2">
              {recommendations.length} המלצות
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {hasData 
            ? 'ריכוז המלצות פעולה מבוססות ניתוח נתונים'
            : 'ריכוז המלצות פעולה דחופות ותובנות הדורשות טיפול מיידי'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGeneratingInsights ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="mr-2 text-muted-foreground">מנתח נתונים...</span>
          </div>
        ) : displayRecommendations.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="h-12 w-12 text-green-500" />}
            title="No Urgent Recommendations"
            titleHe="אין המלצות דחופות כרגע"
            description="All insights have been addressed"
            descriptionHe="כל התובנות טופלו"
            variant="no-data"
          />
        ) : (
          displayRecommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-4 border border-border rounded-lg bg-card/50 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getTypeIcon(rec.type)}
                  <span className="font-medium">מטוס {rec.aircraft}</span>
                  {getSeverityBadge(rec.severity)}
                </div>
                
                {rec.type === "overdue" && rec.hours && (
                  <span className="text-sm text-destructive font-medium">
                    {rec.hours} שעות
                  </span>
                )}
                
                {rec.type === "recurring" && rec.occurrences && (
                  <span className="text-sm text-warning font-medium">
                    {rec.occurrences} פעמים
                  </span>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">{rec.description}</p>
              
              <div className="flex gap-2 flex-wrap">
                {currentUser.role === 'commander' && (
                  <>
                    <ActionButton 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleOpenInvestigation(rec)}
                      isLoading={loadingAction === `investigate-${rec.id}`}
                      loadingText="פותח..."
                      className="gap-1"
                    >
                      <Search className="h-3 w-3" />
                      פתח תחקיר
                    </ActionButton>
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
                  </>
                )}
                
                {(currentUser.role === 'maintenance-chief' || currentUser.role === 'specialist') && (
                  <>
                    <ActionButton 
                      size="sm" 
                      className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20 gap-1"
                      onClick={() => handleEscalate(rec)}
                      isLoading={loadingAction === `escalate-${rec.id}`}
                      loadingText="מעביר..."
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
                    >
                      <CheckCircle className="h-3 w-3" />
                      סמן כטופל
                    </ActionButton>
                  </>
                )}
                
                {currentUser.role === 'technician' && (
                  <ActionButton 
                    size="sm" 
                    variant="outline" 
                    disabled
                    disabledReasonHe="נדרש אישור ר״צ לטיפול בהמלצה זו"
                  >
                    דרוש אישור ר״צ
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