// Flight File - תיק טיסה
// A comprehensive card for each flight with identifiers, mission type, telemetry summary, derived insights

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plane, 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Thermometer,
  Gauge,
  Zap,
  Target,
  Eye,
  Download,
  Share2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { type MaintenanceInsight } from "@/lib/insights-engine";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActionToast } from "@/components/ui/shared-actions";
import { useAuth } from "@/contexts/AuthContext";

export interface FlightFile {
  flight_id: string;
  tail: string;
  block_model: string;
  mission_type: 'training' | 'combat' | 'weather_hard';
  mission_code: string;
  date: string;
  duration_minutes: number;
  takeoff_time: string;
  landing_time: string;
  pilot_name: string;
  copilot_name?: string;
  weather_conditions: string;
  airfield_departure: string;
  airfield_arrival: string;
  
  // תקציר טלמטריה
  telemetry_summary: {
    max_g_load: number;
    max_speed_kts: number;
    max_altitude_ft: number;
    max_egt_celsius: number;
    min_hydraulic_pressure: number;
    max_brake_temp: number;
    fuel_consumed_lbs: number;
    engine_hours: number;
  };
  
  // תובנות שנגזרו
  insights: MaintenanceInsight[];
  
  // קישורים לספרות
  reference_docs: string[];
  
  // סטטוס טיפול
  maintenance_status: 'completed' | 'pending_review' | 'requires_action' | 'under_investigation';
  
  // היסטוריה קצרה (3 טיסות אחרונות)
  recent_history?: FlightFile[];
}

interface FlightFileSystemProps {
  flights: FlightFile[];
}

export const FlightFileSystem = ({ flights }: FlightFileSystemProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            תיקי טיסה F-16
          </CardTitle>
          <CardDescription>
            מרכז המידע המלא לכל טיסה - נתונים, תובנות והפניות לספרות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {flights.map(flight => (
              <FlightFileCard key={flight.flight_id} flight={flight} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FlightFileCard = ({ flight }: { flight: FlightFile }) => {
  const criticalInsights = flight.insights.filter(insight => insight.severity === 'critical');
  const hasIssues = flight.insights.length > 0;
  const navigate = useNavigate();
  const { showSuccess, showInfo } = useActionToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleViewFull = useCallback(() => {
    setLoading('view');
    setTimeout(() => {
      navigate('/portal/magen-achzaka-david');
      setLoading(null);
    }, 200);
  }, [navigate]);

  const handleExport = useCallback(() => {
    setLoading('export');
    setTimeout(() => {
      // Create CSV data
      const csvContent = `flight_id,tail,date,duration,max_g,max_speed,status
${flight.flight_id},${flight.tail},${flight.date},${flight.duration_minutes},${flight.telemetry_summary.max_g_load},${flight.telemetry_summary.max_speed_kts},${flight.maintenance_status}`;
      
      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flight_${flight.flight_id}_data.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showSuccess('ייצוא נתונים', `נתוני טיסה ${flight.flight_id} יוצאו בהצלחה`);
      setLoading(null);
    }, 500);
  }, [flight, showSuccess]);

  const handleShare = useCallback(() => {
    setLoading('share');
    setTimeout(() => {
      // Copy link to clipboard
      const shareLink = `${window.location.origin}/portal/magen-achzaka-david?flight=${flight.flight_id}`;
      navigator.clipboard.writeText(shareLink).then(() => {
        showInfo('שיתוף', 'קישור לתיק הטיסה הועתק ללוח');
      }).catch(() => {
        showInfo('שיתוף', `קישור לשיתוף: ${shareLink}`);
      });
      setLoading(null);
    }, 300);
  }, [flight, showInfo]);

  const handleMarkHandled = useCallback(() => {
    setLoading('handled');
    setTimeout(() => {
      showSuccess('סומן כטופל', `תיק טיסה ${flight.flight_id} סומן כטופל על ידי ${user?.nameHe || 'משתמש'}`);
      setLoading(null);
    }, 500);
  }, [flight, showSuccess, user]);

  return (
    <Card className={`transition-all ${hasIssues ? 'border-orange-200 bg-orange-50/30 dark:bg-orange-950/10' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{flight.flight_id}</h3>
              <Badge variant="outline">מטוס {flight.tail}</Badge>
              <Badge variant="secondary">{flight.block_model}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{flight.date}</span>
              <span>{flight.duration_minutes} דקות</span>
              <span>{flight.mission_code}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MaintenanceStatusBadge status={flight.maintenance_status} />
            {criticalInsights.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {criticalInsights.length} קריטי
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">סיכום</TabsTrigger>
            <TabsTrigger value="telemetry">טלמטריה</TabsTrigger>
            <TabsTrigger value="insights">תובנות</TabsTrigger>
            <TabsTrigger value="history">היסטוריה</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <FlightSummary flight={flight} />
          </TabsContent>

          <TabsContent value="telemetry" className="mt-4">
            <TelemetrySummary telemetry={flight.telemetry_summary} />
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            <InsightsSummary insights={flight.insights} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <FlightHistory flight={flight} />
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleViewFull}
              disabled={loading === 'view'}
            >
              {loading === 'view' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              צפייה מלאה
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleExport}
              disabled={loading === 'export'}
            >
              {loading === 'export' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              ייצא נתונים
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleShare}
              disabled={loading === 'share'}
            >
              {loading === 'share' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-1" />
              )}
              שיתוף
            </Button>
          </div>
          
          {hasIssues && (
            <Button 
              size="sm"
              onClick={handleMarkHandled}
              disabled={loading === 'handled'}
            >
              {loading === 'handled' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              סמן כטופל
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const FlightSummary = ({ flight }: { flight: FlightFile }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">אופי משימה</div>
        <Badge variant="outline">{getMissionTypeDisplay(flight.mission_type)}</Badge>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">תנאי מזג אוויר</div>
        <div className="text-sm text-muted-foreground">{flight.weather_conditions}</div>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">מסלול</div>
        <div className="text-sm text-muted-foreground">
          {flight.airfield_departure} ← {flight.airfield_arrival}
        </div>
      </div>
    </div>
    
    <Separator />
    
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">זמן המראה</div>
        <div className="text-sm text-muted-foreground">{flight.takeoff_time}</div>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">זמן נחיתה</div>
        <div className="text-sm text-muted-foreground">{flight.landing_time}</div>
      </div>
    </div>

    {flight.reference_docs.length > 0 && (
      <>
        <Separator />
        <div className="space-y-2">
          <div className="text-sm font-medium">הפניות לספרות רלוונטית</div>
          <div className="space-y-1">
            {flight.reference_docs.map((doc, index) => (
              <Badge key={index} variant="outline" className="text-xs mr-2">
                {doc}
              </Badge>
            ))}
          </div>
        </div>
      </>
    )}
  </div>
);

const TelemetrySummary = ({ telemetry }: { telemetry: FlightFile['telemetry_summary'] }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <TelemetryCard
        icon={<Target className="h-4 w-4" />}
        label="עומס G מקסימלי"
        value={`${telemetry.max_g_load}G`}
        status={telemetry.max_g_load > 7 ? 'warning' : 'normal'}
      />
      <TelemetryCard
        icon={<Gauge className="h-4 w-4" />}
        label="מהירות מקסימלית"
        value={`${telemetry.max_speed_kts} קשר`}
        status="normal"
      />
      <TelemetryCard
        icon={<TrendingUp className="h-4 w-4" />}
        label="גובה מקסימלי"
        value={`${telemetry.max_altitude_ft.toLocaleString()} רגל`}
        status="normal"
      />
      <TelemetryCard
        icon={<Thermometer className="h-4 w-4" />}
        label="טמפ' גזי פליטה"
        value={`${telemetry.max_egt_celsius}°C`}
        status={telemetry.max_egt_celsius > 650 ? 'critical' : 'normal'}
      />
    </div>
    
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <TelemetryCard
        icon={<Zap className="h-4 w-4" />}
        label="לחץ הידראולי מינימלי"
        value={`${telemetry.min_hydraulic_pressure} PSI`}
        status={telemetry.min_hydraulic_pressure < 2800 ? 'critical' : 'normal'}
      />
      <TelemetryCard
        icon={<Thermometer className="h-4 w-4" />}
        label="טמפ' בלמים מקסימלית"
        value={`${telemetry.max_brake_temp}°C`}
        status={telemetry.max_brake_temp > 400 ? 'warning' : 'normal'}
      />
      <TelemetryCard
        icon={<Gauge className="h-4 w-4" />}
        label="צריכת דלק"
        value={`${telemetry.fuel_consumed_lbs.toLocaleString()} ליברות`}
        status="normal"
      />
      <TelemetryCard
        icon={<Clock className="h-4 w-4" />}
        label="שעות מנוע"
        value={`${telemetry.engine_hours} שעות`}
        status="normal"
      />
    </div>
  </div>
);

const TelemetryCard = ({ 
  icon, 
  label, 
  value, 
  status 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  status: 'normal' | 'warning' | 'critical'; 
}) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'critical':
        return 'border-destructive bg-destructive/5 text-destructive';
      case 'warning':
        return 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950/20';
      default:
        return 'border-border bg-card';
    }
  };

  return (
    <div className={`p-3 border rounded-lg text-center space-y-2 ${getStatusStyles()}`}>
      <div className="flex items-center justify-center">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
};

const InsightsSummary = ({ insights }: { insights: MaintenanceInsight[] }) => {
  if (insights.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          לא זוהו תובנות אחזקה מיוחדות בטיסה זו. כל הפרמטרים בטווח התקין.
        </AlertDescription>
      </Alert>
    );
  }

  const criticalInsights = insights.filter(i => i.severity === 'critical');
  const highInsights = insights.filter(i => i.severity === 'high');
  const mediumInsights = insights.filter(i => i.severity === 'medium');

  return (
    <div className="space-y-4">
      {criticalInsights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            תובנות קריטיות ({criticalInsights.length})
          </h4>
          <div className="space-y-2">
            {criticalInsights.map(insight => (
              <InsightCard key={insight.insight_id} insight={insight} />
            ))}
          </div>
        </div>
      )}
      
      {highInsights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-orange-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            תובנות חשובות ({highInsights.length})
          </h4>
          <div className="space-y-2">
            {highInsights.map(insight => (
              <InsightCard key={insight.insight_id} insight={insight} />
            ))}
          </div>
        </div>
      )}
      
      {mediumInsights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            תובנות נוספות ({mediumInsights.length})
          </h4>
          <div className="space-y-2">
            {mediumInsights.map(insight => (
              <InsightCard key={insight.insight_id} insight={insight} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const InsightCard = ({ insight }: { insight: MaintenanceInsight }) => (
  <div className="border rounded p-3 space-y-2">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <div className="text-sm font-medium">{insight.title}</div>
        <div className="text-xs text-muted-foreground">{insight.description}</div>
        <div className="text-xs">
          <strong>מערכת:</strong> {insight.system} | <strong>דרג נדרש:</strong> {getRankDisplay(insight.maintenance_level)}
        </div>
      </div>
      <Badge variant={getSeverityVariant(insight.severity)}>
        {getSeverityDisplay(insight.severity)}
      </Badge>
    </div>
    
    <div className="text-xs">
      <strong>פעולה מומלצת:</strong> {insight.recommended_action}
    </div>
    
    {insight.reference_doc && (
      <div className="text-xs text-muted-foreground">
        <strong>הפניה:</strong> {insight.reference_doc} {insight.clause}
      </div>
    )}
  </div>
);

const FlightHistory = ({ flight }: { flight: FlightFile }) => {
  if (!flight.recent_history || flight.recent_history.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          אין היסטוריה זמינה עבור מטוס {flight.tail}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">3 טיסות אחרונות - מטוס {flight.tail}</h4>
      <div className="space-y-3">
        {flight.recent_history.map(historyFlight => (
          <div key={historyFlight.flight_id} className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">{historyFlight.flight_id}</div>
              <div className="text-xs text-muted-foreground">{historyFlight.date}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              {historyFlight.mission_code} | {historyFlight.duration_minutes} דקות
            </div>
            {historyFlight.insights.length > 0 && (
              <div className="text-xs">
                <span className="text-orange-600">
                  {historyFlight.insights.length} תובנות
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const MaintenanceStatusBadge = ({ status }: { status: FlightFile['maintenance_status'] }) => {
  const statusConfig = {
    completed: { label: 'הושלם', variant: 'secondary' as const, icon: CheckCircle },
    pending_review: { label: 'ממתין לסקירה', variant: 'outline' as const, icon: Clock },
    requires_action: { label: 'דורש פעולה', variant: 'destructive' as const, icon: AlertTriangle },
    under_investigation: { label: 'בתחקיר', variant: 'secondary' as const, icon: Eye }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// פונקציות עזר

function getMissionTypeDisplay(type: string): string {
  const types = {
    'training': 'אימון',
    'combat': 'מבצע',
    'weather_hard': 'מז״א קשה'
  };
  return types[type as keyof typeof types] || type;
}

function getRankDisplay(rank: string): string {
  const ranks = {
    'technician': 'טכנאי',
    'maintenance-chief': 'ר״צ',
    'commander': 'מפקד'
  };
  return ranks[rank as keyof typeof ranks] || rank;
}

function getSeverityDisplay(severity: string): string {
  const severities = {
    'critical': 'קריטי',
    'high': 'גבוה',
    'medium': 'בינוני',
    'low': 'נמוך'
  };
  return severities[severity as keyof typeof severities] || severity;
}

function getSeverityVariant(severity: string) {
  switch (severity) {
    case 'critical':
      return 'destructive' as const;
    case 'high':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}