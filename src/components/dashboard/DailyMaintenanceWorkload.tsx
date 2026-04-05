import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Search, CheckCircle, Loader2 } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";

export const DailyMaintenanceWorkload = () => {
  const { dashboardStats, insights, isGeneratingInsights, hasData } = useDashboardData();
  
  // חישוב סטטיסטיקות מנתונים אמיתיים
  const todayStats = {
    totalInsights: dashboardStats.totalAlerts,
    criticalInsights: dashboardStats.criticalAlerts,
    openInvestigations: insights.filter(i => i.status === 'requires_investigation' || i.status === 'in_progress').length,
    treatedInsights: insights.filter(i => i.status === 'completed').length
  };

  // אם אין נתונים, הצג מצב ריק
  if (!hasData) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            לוח עומסי אחזקה יומי
          </CardTitle>
          <CardDescription>
            טען נתוני CSV כדי לראות סטטיסטיקות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>אין נתונים להצגה</p>
            <p className="text-sm">העלה קובץ CSV כדי להתחיל</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // אם בטעינה
  if (isGeneratingInsights) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            לוח עומסי אחזקה יומי
          </CardTitle>
          <CardDescription>מעבד נתונים...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          לוח עומסי אחזקה יומי
        </CardTitle>
        <CardDescription>
          תמונה יומית כוללת של כלל התובנות והטיפולים
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-primary">{todayStats.totalInsights}</p>
              <p className="text-sm text-muted-foreground">תובנות נוצרו</p>
            </div>
          </div>

          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-destructive">{todayStats.criticalInsights}</p>
              <p className="text-sm text-muted-foreground">קריטיות</p>
            </div>
          </div>

          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto bg-warning/10 rounded-full flex items-center justify-center">
              <Search className="h-6 w-6 text-warning" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-warning">{todayStats.openInvestigations}</p>
              <p className="text-sm text-muted-foreground">תחקירים פתוחים</p>
            </div>
          </div>

          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto bg-success/10 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-success">{todayStats.treatedInsights}</p>
              <p className="text-sm text-muted-foreground">טופלו</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
