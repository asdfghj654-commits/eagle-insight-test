import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export const SystemOverview = () => {
  const systemStats = {
    activeFlights: 3,
    criticalAlerts: 2,
    pendingMaintenance: 5,
    lastUpdate: "14:32"
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">טיסות פעילות</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemStats.activeFlights}</div>
          <p className="text-xs text-muted-foreground">
            מטוסי F-16 בטיסה
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">התרעות קריטיות</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{systemStats.criticalAlerts}</div>
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
          <div className="text-2xl font-bold">{systemStats.pendingMaintenance}</div>
          <p className="text-xs text-muted-foreground">
            משימות אחזקה ממתינות
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">עדכון אחרון</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemStats.lastUpdate}</div>
          <p className="text-xs text-muted-foreground">
            נתוני קופסה שחורה
          </p>
        </CardContent>
      </Card>
    </div>
  );
};