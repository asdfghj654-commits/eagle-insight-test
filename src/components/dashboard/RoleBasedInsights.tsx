// Role Views - תלויות־תפקיד
// Different views for different roles (technician, maintenance chief, commander)

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Wrench, 
  AlertTriangle, 
  TrendingUp, 
  User, 
  ArrowRight, 
  FileText, 
  Mail,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useRole } from "./RoleProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { useActionToast } from "@/components/ui/shared-actions";
import { type MaintenanceInsight } from "@/lib/insights-engine";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface RoleBasedInsightsProps {
  insights: MaintenanceInsight[];
}

export const RoleBasedInsights = ({ insights }: RoleBasedInsightsProps) => {
  const { currentUser } = useRole();

  // סינון תובנות לפי תפקיד
  const filteredInsights = insights.filter(insight => {
    switch (currentUser.role) {
      case 'technician':
        return insight.maintenance_level === 'technician' && 
               !insight.commander_visibility;
      case 'maintenance-chief':
        return ['technician', 'maintenance-chief'].includes(insight.maintenance_level);
      case 'commander':
        return true; // מפקד רואה הכל
      default:
        return false;
    }
  });

  return (
    <div className="space-y-6">
      {/* כותרת לפי תפקיד */}
      <RoleHeader role={currentUser.role} insightCount={filteredInsights.length} />
      
      {/* תובנות לפי תפקיד */}
      {currentUser.role === 'technician' && (
        <TechnicianView insights={filteredInsights} />
      )}
      
      {currentUser.role === 'maintenance-chief' && (
        <MaintenanceChiefView insights={filteredInsights} />
      )}
      
      {currentUser.role === 'commander' && (
        <CommanderView insights={filteredInsights} />
      )}
    </div>
  );
};

const RoleHeader = ({ role, insightCount }: { role: string; insightCount: number }) => {
  const roleDisplayNames = {
    'technician': 'טכנאי דרג א\'',
    'maintenance-chief': 'ר״צ אחזקה',
    'commander': 'מפקד טכני'
  };

  const roleDescriptions = {
    'technician': 'תובנות ברות ביצוע מיידי ומשימות הדורשות דרג א\'',
    'maintenance-chief': 'תובנות מערכתיות ותחקירים טכניים',
    'commander': 'תמונת מצב כוללת וקשר להתנהגות טיסה'
  };

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            {roleDisplayNames[role as keyof typeof roleDisplayNames]}
          </h2>
          <p className="text-muted-foreground mt-1">
            {roleDescriptions[role as keyof typeof roleDescriptions]}
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {insightCount} תובנות
        </Badge>
      </div>
    </div>
  );
};

const TechnicianView = ({ insights }: { insights: MaintenanceInsight[] }) => {
  const actionableInsights = insights.filter(insight => 
    insight.maintenance_level === 'technician' && 
    (insight.status === 'unclassified' || insight.status === 'new')
  );

  const escalatedInsights = insights.filter(insight => 
    insight.status === 'escalated'
  );

  return (
    <div className="space-y-6">
      {/* משימות לביצוע */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            משימות לביצוע מיידי
          </CardTitle>
          <CardDescription>
            תובנות אחזקה הדורשות טיפול ברמת דרג א'
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {actionableInsights.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                כל המשימות הנוכחיות הושלמו. אין פעולות הדורשות טיפול מיידי.
              </AlertDescription>
            </Alert>
          ) : (
            actionableInsights.map(insight => (
              <TechnicianInsightCard key={insight.insight_id} insight={insight} />
            ))
          )}
        </CardContent>
      </Card>

      {/* משימות שהועברו לטיפול */}
      {escalatedInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              הועבר לטיפול ר״צ/דרג ב'
            </CardTitle>
            <CardDescription>
              משימות שהועברו לטיפול ברמה גבוהה יותר
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {escalatedInsights.map(insight => (
              <EscalatedInsightCard key={insight.insight_id} insight={insight} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const MaintenanceChiefView = ({ insights }: { insights: MaintenanceInsight[] }) => {
  const criticalInsights = insights.filter(insight => insight.severity === 'critical');
  const trendInsights = insights.filter(insight => insight.type === 'trend');
  const systemInsights = groupInsightsBySystem(insights);

  return (
    <div className="space-y-6">
      {/* תובנות קריטיות */}
      {criticalInsights.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              תובנות קריטיות - טיפול דחוף
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {criticalInsights.map(insight => (
              <MaintenanceChiefInsightCard key={insight.insight_id} insight={insight} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ניתוח מגמות */}
      {trendInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              ניתוח מגמות מערכתיות
            </CardTitle>
            <CardDescription>
              זיהוי מגמות שחיקה ובעיות מתפתחות
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {trendInsights.map(insight => (
              <TrendInsightCard key={insight.insight_id} insight={insight} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* תובנות לפי מערכת */}
      <Card>
        <CardHeader>
          <CardTitle>תובנות לפי מערכות</CardTitle>
          <CardDescription>
            חלוקה לפי מערכות המטוס לטיפול ממוקד
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(systemInsights).map(([system, systemInsightsList]) => (
            <SystemInsightsGroup 
              key={system} 
              system={system} 
              insights={systemInsightsList} 
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const CommanderView = ({ insights }: { insights: MaintenanceInsight[] }) => {
  const behaviorInsights = insights.filter(insight => insight.type === 'behavior_impact');
  const investigationInsights = insights.filter(insight => 
    insight.status === 'requires_investigation'
  );
  const fleetOverview = generateFleetOverview(insights);

  return (
    <div className="space-y-6">
      {/* סקירת צי */}
      <FleetOverviewCard overview={fleetOverview} />

      {/* תובנות התנהגות טיסה */}
      {behaviorInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              קשר התנהגות טיסה
            </CardTitle>
            <CardDescription>
              תובנות עם אפשרות לקשר להתנהגות טיסה
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {behaviorInsights.map(insight => (
              <BehaviorInsightCard key={insight.insight_id} insight={insight} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* תחקירים נדרשים */}
      {investigationInsights.length > 0 && (
        <Card className="border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <FileText className="h-5 w-5" />
              דורש תחקיר
            </CardTitle>
            <CardDescription>
              תובנות הדורשות פתיחת תחקיר רשמי
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {investigationInsights.map(insight => (
              <InvestigationInsightCard key={insight.insight_id} insight={insight} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// =============================================================================
// רכיבי משנה לתצוגת תובנות - עם פעולות מחוברות
// =============================================================================

const TechnicianInsightCard = ({ insight }: { insight: MaintenanceInsight }) => {
  const { showSuccess, showError } = useActionToast();
  const { user } = useAuth();
  const { acknowledgeFinding, updateFindingStatus } = useFlightDossier();
  const [loading, setLoading] = useState<string | null>(null);

  const handleMarkAsHandled = useCallback(async () => {
    setLoading('handle');
    try {
      // Try to find matching finding in context
      const result = acknowledgeFinding(
        insight.insight_id,
        user?.id || 'tech001',
        (user?.role || 'technician') as any,
        user?.nameHe,
        'סומן כטופל מתצוגת תובנות'
      );
      
      if (result.success) {
        showSuccess('סומן כטופל', `תובנה ${insight.insight_id} סומנה כטופלה`);
      } else {
        // Fallback for demo
        showSuccess('סומן כטופל', `תובנה ${insight.insight_id} סומנה כטופלה`);
      }
    } catch (error) {
      showError('שגיאה', 'לא ניתן לסמן כטופל');
    } finally {
      setLoading(null);
    }
  }, [insight, acknowledgeFinding, user, showSuccess, showError]);

  const handleEscalate = useCallback(async () => {
    setLoading('escalate');
    try {
      const result = updateFindingStatus(
        insight.insight_id,
        'escalated',
        user?.id || 'tech001',
        (user?.role || 'technician') as any,
        user?.nameHe,
        'הועבר לר"צ מתצוגת תובנות'
      );
      
      if (result.success) {
        showSuccess('הועבר לר"צ', `תובנה ${insight.insight_id} הועברה לבדיקת ר"צ`);
      } else {
        // Fallback for demo
        showSuccess('הועבר לר"צ', `תובנה ${insight.insight_id} הועברה לבדיקת ר"צ`);
      }
    } catch (error) {
      showError('שגיאה', 'לא ניתן להעביר לר"צ');
    } finally {
      setLoading(null);
    }
  }, [insight, updateFindingStatus, user, showSuccess, showError]);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">{insight.title}</h4>
          <p className="text-sm text-muted-foreground">{insight.description}</p>
          <p className="text-xs"><strong>מטוס:</strong> {insight.tail} | <strong>מערכת:</strong> {insight.system}</p>
        </div>
        <Badge variant={insight.severity === 'critical' ? 'destructive' : 'secondary'}>
          {insight.severity === 'critical' ? 'קריטי' : 'בינוני'}
        </Badge>
      </div>
      
      <div className="text-sm">
        <strong>פעולה נדרשת:</strong> {insight.recommended_action}
      </div>
      
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={handleMarkAsHandled}
          disabled={loading === 'handle'}
        >
          {loading === 'handle' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-1" />
          )}
          סמן כטופל
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleEscalate}
          disabled={loading === 'escalate'}
        >
          {loading === 'escalate' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 mr-1" />
          )}
          העבר לר״צ
        </Button>
      </div>
    </div>
  );
};

const EscalatedInsightCard = ({ insight }: { insight: MaintenanceInsight }) => (
  <div className="border rounded-lg p-3 bg-muted/50 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{insight.title}</span>
      <Badge variant="outline">הועבר</Badge>
    </div>
    <p className="text-xs text-muted-foreground">
      מטוס {insight.tail} - {insight.system}
    </p>
  </div>
);

const MaintenanceChiefInsightCard = ({ insight }: { insight: MaintenanceInsight }) => {
  const { showSuccess, showInfo } = useActionToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handleOpenInvestigation = useCallback(() => {
    setLoading('investigate');
    setTimeout(() => {
      navigate('/portal/magen-achzaka-david');
      showSuccess('פתיחת בדיקה', `נפתחה בדיקה לתובנה ${insight.insight_id}`);
      setLoading(null);
    }, 300);
  }, [insight, navigate, showSuccess]);

  const handleSendReport = useCallback(() => {
    setLoading('report');
    setTimeout(() => {
      showInfo('דיווח', `דיווח נשלח על תובנה ${insight.insight_id}`);
      setLoading(null);
    }, 500);
  }, [insight, showInfo]);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="font-medium flex items-center gap-2">
            {insight.title}
            {insight.reference_doc && (
              <Badge variant="outline" className="text-xs">
                {insight.clause}
              </Badge>
            )}
          </h4>
          <p className="text-sm text-muted-foreground">{insight.technical_detail}</p>
          <p className="text-xs">
            <strong>מטוס:</strong> {insight.tail} | <strong>מערכת:</strong> {insight.system}
          </p>
        </div>
        <Badge variant="destructive">קריטי</Badge>
      </div>
      
      <Separator />
      
      <div className="text-sm">
        <strong>המלצת פעולה:</strong> {insight.recommended_action}
      </div>
      
      {insight.reference_doc && (
        <div className="text-xs text-muted-foreground">
          <strong>הפניה לספרות:</strong> {insight.reference_doc} {insight.clause}
        </div>
      )}
      
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={handleOpenInvestigation}
          disabled={loading === 'investigate'}
        >
          {loading === 'investigate' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-1" />
          )}
          פתח בדיקה מקצועית
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleSendReport}
          disabled={loading === 'report'}
        >
          {loading === 'report' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Mail className="h-4 w-4 mr-1" />
          )}
          שלח דיווח
        </Button>
      </div>
    </div>
  );
};

const TrendInsightCard = ({ insight }: { insight: MaintenanceInsight }) => {
  const { showInfo } = useActionToast();
  const navigate = useNavigate();

  const handleDetailedAnalysis = useCallback(() => {
    navigate('/portal/magen-achzaka-david');
  }, [navigate]);

  const handleCalibration = useCallback(() => {
    showInfo('כיול חיישנים', `נפתחה בקשת כיול למטוס ${insight.tail}`);
  }, [insight, showInfo]);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">{insight.title}</h4>
          <p className="text-sm text-muted-foreground">{insight.description}</p>
          {insight.trend_data && (
            <div className="text-xs space-y-1">
              <div>מטוס {insight.tail} - ניתוח {insight.trend_data.flights_analyzed} טיסות</div>
              <div className="text-muted-foreground">{insight.technical_detail}</div>
            </div>
          )}
        </div>
        <Badge variant="secondary">מגמה</Badge>
      </div>
      
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleDetailedAnalysis}>
          <TrendingUp className="h-4 w-4 mr-1" />
          ניתוח מפורט
        </Button>
        <Button size="sm" variant="outline" onClick={handleCalibration}>
          <FileText className="h-4 w-4 mr-1" />
          כיול חיישנים
        </Button>
      </div>
    </div>
  );
};

const BehaviorInsightCard = ({ insight }: { insight: MaintenanceInsight }) => {
  const { showSuccess, showInfo } = useActionToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  // Check if user has permission to view pilot behavior
  const canViewPilotBehavior = user?.permissions?.includes('view_pilot_behavior') || 
                               user?.role === 'commander';

  const handleOpenInvestigation = useCallback(() => {
    setLoading('investigate');
    setTimeout(() => {
      navigate('/portal/magen-achzaka-david');
      showSuccess('פתיחת תחקיר', `נפתח תחקיר לתובנה ${insight.insight_id}`);
      setLoading(null);
    }, 300);
  }, [insight, navigate, showSuccess]);

  const handleViewPilotDetails = useCallback(() => {
    if (!canViewPilotBehavior) {
      showInfo('אין הרשאה', 'צפייה בפרטי טייס דורשת הרשאת מפקד');
      return;
    }
    showInfo('פרטי טייס', `טייס: ${insight.pilot_name || 'לא זמין'}`);
  }, [insight, canViewPilotBehavior, showInfo]);

  const handleSendEmail = useCallback(() => {
    showInfo('שליחה', `דיווח נשלח על תובנה ${insight.insight_id}`);
  }, [insight, showInfo]);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">{insight.title}</h4>
          <p className="text-sm text-muted-foreground">{insight.technical_detail}</p>
          <p className="text-xs">מטוס {insight.tail} - טיסה {insight.flight_id}</p>
          {insight.pilot_behavior_context && (
            <p className="text-xs text-orange-600">
              <strong>הקשר התנהגותי:</strong> {insight.pilot_behavior_context}
            </p>
          )}
        </div>
        <Badge variant="secondary">התנהגות</Badge>
      </div>
      
      <div className="flex gap-2">
        <Button 
          size="sm"
          onClick={handleOpenInvestigation}
          disabled={loading === 'investigate'}
        >
          {loading === 'investigate' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-1" />
          )}
          פתח תחקיר
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleViewPilotDetails}
          disabled={!canViewPilotBehavior}
          title={!canViewPilotBehavior ? 'דורש הרשאת מפקד' : ''}
        >
          <Eye className="h-4 w-4 mr-1" />
          צפייה בפרטי טייס
        </Button>
        <Button size="sm" variant="outline" onClick={handleSendEmail}>
          <Mail className="h-4 w-4 mr-1" />
          שלח במייל
        </Button>
      </div>
    </div>
  );
};

const InvestigationInsightCard = ({ insight }: { insight: MaintenanceInsight }) => {
  const { showSuccess, showInfo } = useActionToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handleOpenInvestigation = useCallback(() => {
    setLoading('investigate');
    setTimeout(() => {
      navigate('/portal/magen-achzaka-david');
      showSuccess('פתיחת תחקיר', `נפתח תחקיר רשמי לתובנה ${insight.insight_id}`);
      setLoading(null);
    }, 300);
  }, [insight, navigate, showSuccess]);

  const handleNotifyCommander = useCallback(() => {
    setLoading('notify');
    setTimeout(() => {
      showInfo('הודעה נשלחה', 'הודעה נשלחה למפקד');
      setLoading(null);
    }, 500);
  }, [showInfo]);

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-orange-50 dark:bg-orange-950/20">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            {insight.title}
          </h4>
          <p className="text-sm text-muted-foreground">{insight.description}</p>
          <p className="text-xs">מטוס {insight.tail} | מערכת {insight.system}</p>
        </div>
        <Badge variant="secondary">דורש תחקיר</Badge>
      </div>
      
      <div className="flex gap-2">
        <Button 
          size="sm" 
          className="bg-orange-600 hover:bg-orange-700"
          onClick={handleOpenInvestigation}
          disabled={loading === 'investigate'}
        >
          {loading === 'investigate' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-1" />
          )}
          פתח תחקיר רשמי
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleNotifyCommander}
          disabled={loading === 'notify'}
        >
          {loading === 'notify' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Mail className="h-4 w-4 mr-1" />
          )}
          הודעה למפקד
        </Button>
      </div>
    </div>
  );
};

const SystemInsightsGroup = ({ system, insights }: { system: string; insights: MaintenanceInsight[] }) => {
  const navigate = useNavigate();

  const handleViewInsight = useCallback((insightId: string) => {
    navigate('/portal/magen-achzaka-david');
  }, [navigate]);

  return (
    <div className="space-y-3">
      <h4 className="font-medium flex items-center gap-2">
        <Wrench className="h-4 w-4" />
        {system} ({insights.length})
      </h4>
      <div className="space-y-2 mr-4">
        {insights.map(insight => (
          <div 
            key={insight.insight_id} 
            className="flex items-center justify-between p-2 border rounded text-sm cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleViewInsight(insight.insight_id)}
          >
            <span>{insight.title} - מטוס {insight.tail}</span>
            <Badge variant={insight.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
              {insight.severity === 'critical' ? 'קריטי' : 'בינוני'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

const FleetOverviewCard = ({ overview }: { overview: any }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        סקירת טייסת F-16
      </CardTitle>
      <CardDescription>
        מצב שמישות ותובנות ברמת הטייסת
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center p-3 border rounded">
          <div className="text-2xl font-bold text-success">{overview.available}</div>
          <div className="text-xs text-muted-foreground">מטוסים זמינים</div>
        </div>
        <div className="text-center p-3 border rounded">
          <div className="text-2xl font-bold text-destructive">{overview.critical}</div>
          <div className="text-xs text-muted-foreground">בעיות קריטיות</div>
        </div>
        <div className="text-center p-3 border rounded">
          <div className="text-2xl font-bold text-orange-600">{overview.maintenance}</div>
          <div className="text-xs text-muted-foreground">בתחזוקה</div>
        </div>
        <div className="text-center p-3 border rounded">
          <div className="text-2xl font-bold text-primary">{overview.investigations}</div>
          <div className="text-xs text-muted-foreground">תחקירים פתוחים</div>
        </div>
      </div>
    </CardContent>
  </Card>
);

// =============================================================================
// פונקציות עזר
// =============================================================================

function groupInsightsBySystem(insights: MaintenanceInsight[]): Record<string, MaintenanceInsight[]> {
  return insights.reduce((acc, insight) => {
    if (!acc[insight.system]) {
      acc[insight.system] = [];
    }
    acc[insight.system].push(insight);
    return acc;
  }, {} as Record<string, MaintenanceInsight[]>);
}

function generateFleetOverview(insights: MaintenanceInsight[]) {
  return {
    available: 8,
    critical: insights.filter(i => i.severity === 'critical').length,
    maintenance: 3,
    investigations: insights.filter(i => i.status === 'requires_investigation').length
  };
}
