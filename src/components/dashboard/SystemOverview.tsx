import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCSVData } from "@/contexts/CSVDataContext";
import { EmptyState } from "@/components/ui/empty-state";

export const SystemOverview = () => {
  const { dashboardStats, hasData } = useDashboardData();
  const { dataStats } = useCSVData();
  const lastUpdate = dataStats.lastUploadTimestamp
    ? new Date(dataStats.lastUploadTimestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : '—';

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">סטטוס מערכת</CardTitle>
          <CardDescription>אין נתונים זמינים</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Activity}
            title="אין נתונים למערכת"
            description="העלה קובץ CSV כדי להציג מדדים בזמן אמת."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">טיסות פעילות</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{dashboardStats.totalFlights}</div>
          <p className="text-xs text-muted-foreground">
            טיסות שנותחו
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">התרעות קריטיות</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{dashboardStats.criticalInsights}</div>
          <p className="text-xs text-muted-foreground">
            דורשות טיפול מיידי
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">אחזקה מתוכננת</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{dashboardStats.totalAlerts}</div>
          <p className="text-xs text-muted-foreground">
            תובנות פתוחות
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">עדכון אחרון</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{lastUpdate}</div>
          <p className="text-xs text-muted-foreground">
            נתוני קופסה שחורה
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
