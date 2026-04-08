import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Plane, Wrench, Activity, Clock, AlertCircle } from "lucide-react";
import { SystemOverview } from "@/components/dashboard/SystemOverview";
import { FlightFiles } from "@/components/dashboard/FlightFiles";
import { MaintenanceAlerts } from "@/components/dashboard/MaintenanceAlerts";
import { ActiveFlights } from "@/components/dashboard/ActiveFlights";
import { TechnicalRecommendations } from "@/components/dashboard/TechnicalRecommendations";
import { FailureHistory } from "@/components/dashboard/FailureHistory";
import { FlightDataChart } from "@/components/dashboard/FlightDataChart";
import { ActiveRulesCard } from "@/components/dashboard/ActiveRulesCard";
import { RuleManagementTab } from "@/components/dashboard/RuleManagementTab";
import { useRole } from "@/components/dashboard/RoleProvider";
import { CSVUpload } from "@/components/CSVUpload";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useNavigate } from "react-router-dom";
import { DailyMaintenanceWorkload } from "@/components/dashboard/DailyMaintenanceWorkload";
import { SquadronStatusCard } from "@/components/dashboard/SquadronStatusCard";
import { CommanderRecommendations } from "@/components/dashboard/CommanderRecommendations";
import { OpenInvestigations } from "@/components/dashboard/OpenInvestigations";
import { Settings, CheckSquare } from "lucide-react";
import { FlightTechniqueAnalysis } from "@/components/dashboard/FlightTechniqueAnalysis";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { SquadronTrends } from "@/components/dashboard/SquadronTrends";
import { SystemExplanation } from "@/components/dashboard/SystemExplanation";
import { RoleSelector } from "@/components/dashboard/RoleSelector";
import { AircraftAvailability } from "@/components/dashboard/AircraftAvailability";
import { AIPredictions } from "@/components/dashboard/AIPredictions";
import { TechnicianMaintenanceView } from "@/components/dashboard/TechnicianMaintenanceView";
import { FleetAnalysisTab } from "@/components/dashboard/FleetAnalysisTab";
import { AiPanel } from "@/components/ai/AiPanel";
import { useCSVData } from "@/contexts/CSVDataContext";

const DashboardHeader = () => null;

const RoleVisibleAiPanel = ({ role }: { role: string }) => {
  const slot =
    role === "commander"
      ? "fleet_summary"
      : role === "specialist"
      ? "fleet_summary"
      : "investigation_assist";

  const roleScope =
    role === "technician"
      ? "technician"
      : role === "specialist"
      ? "specialist"
      : role === "commander"
      ? "commander"
      : "engineer";

  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
      <AiPanel slot={slot} roleScope={roleScope} defaultOpen={false} />
    </div>
  );
};

const DashboardContent = () => {
  const { currentUser } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const { insights, dashboardStats, hasData } = useDashboardData();
  const { rules } = useCSVData();

  const recentRuleUpdates = useMemo(() => rules
    .filter((rule) => rule.status === "approved" && rule.updatedAt)
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime())
    .slice(0, 3), [rules]);

  const getTabForPath = () => {
    switch (location.pathname) {
      case '/tech/my-tasks':
        return 'active';
      case '/lead/fleet':
        return currentUser.role === 'specialist' || currentUser.role === 'engineer' ? 'fleet' : 'alerts';
      case '/engineer/dashboard':
      case '/engineer/rules':
        return 'rules';
      default:
        return 'alerts';
    }
  };

  const [activeTab, setActiveTab] = useState(getTabForPath);

  useEffect(() => {
    setActiveTab(getTabForPath());
  }, [location.pathname, currentUser.role]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      {/* Main Dashboard */}
      <main className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
        <div className="hidden rounded-lg border border-border bg-muted/30 p-4">
          <div className="hidden">
            חשוב לזכור: מערכת זו היא כלי תומך בלבד ואינה מחליפה החלטה מקצועית. כל תובנה חייבת להיבדק על ידי איש מקצוע מוסמך לפני ביצוע פעולה כלשהי.
          </div>
        </div>

        {/* Portal Access */}
        {currentUser.role === 'engineer' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              פורטל מגן דוד לאחזקה
            </CardTitle>
            <CardDescription className="text-right">
              כניסה לסביבת התחקור ההנדסית המתקדמת
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-row-reverse">
              <Button
                onClick={() => navigate('/portal/magen-achzaka-david')}
                className="flex items-center gap-2 flex-row-reverse"
              >
                <Settings className="h-4 w-4" />
                כניסה לפורטל ההנדסי
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/review')}
                className="flex items-center gap-2 flex-row-reverse"
              >
                <CheckSquare className="h-4 w-4" />
                תור אישורים
              </Button>
            </div>
            <CSVUpload
              navigateToAfterUpload="/portal/data-research"
              onUploadComplete={() => {
                console.log('CSV uploaded - redirecting to data research');
              }}
            />
          </CardContent>
        </Card>
        )}

        {/* Role Selector for Demo */}
        <RoleSelector />

        {/* System Explanation */}
        <SystemExplanation />

        {/* AI Assistant - visible high in the role workflow */}
        <RoleVisibleAiPanel role={currentUser.role} />

        {recentRuleUpdates.length > 0 && (
          <Card className="border-warning/30 bg-warning/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-right">
                <AlertTriangle className="h-5 w-5 text-amber-700" />
                עדכוני כללים מאושרים
              </CardTitle>
              <CardDescription className="text-right">
                תפקידים רואים כאן את עדכוני הכללים האחרונים שאושרו או שונו לאחר אישור.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentRuleUpdates.map((rule) => (
                <div key={rule.id} className="flex items-start justify-between gap-3 rounded-lg border border-warning/20 bg-background/80 p-3" dir="rtl">
                  <div className="space-y-1 text-right">
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-sm text-muted-foreground">{rule.updateSummary || rule.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {rule.updatedBy ? `${rule.updatedBy} | ` : ""}
                      {rule.updatedAt ? new Date(rule.updatedAt).toLocaleString("he-IL") : ""}
                    </div>
                  </div>
                  <Badge variant="outline">עדכון כלל</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Role-based Dashboard */}
        {currentUser.role === 'technician' ? (
          <TechnicianMaintenanceView />
        ) : (
          <div className="space-y-6">
            {/* Top Row - Key Metrics */}
            <div className="grid gap-6 lg:grid-cols-2">
              <DailyMaintenanceWorkload />
              <SquadronStatusCard />
            </div>

            {/* Aircraft Availability and AI Predictions */}
            <div className="grid gap-6 lg:grid-cols-2">
              <AircraftAvailability />
              <AIPredictions />
            </div>

            {/* Commander Recommendations and Active Rules */}
            <div className="grid gap-6 lg:grid-cols-2">
              <CommanderRecommendations />
              <ActiveRulesCard />
            </div>

            {/* Insights Grid */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-right">תובנות אחזקה</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {hasData ?
                  insights.slice(0, 4).map((insight) => (
                    <InsightCard key={insight.insight_id} insight={{
                      id: insight.insight_id,
                      aircraft: insight.tail,
                      flightDate: new Date(insight.created_at).toISOString().split('T')[0],
                      title: insight.title,
                      description: insight.description,
                      technicalDescription: insight.technical_detail,
                      pilotBehaviorContext: insight.pilot_behavior_context,
                      severity: insight.severity,
                      requiredRank: insight.maintenance_level,
                      isRecurring: false,
                      pilotName: insight.pilot_name || 'לא זמין',
                      system: insight.system,
                      status: insight.status === 'new' ? 'חדש' : insight.status
                    }} />
                  )) :
                  <div className="col-span-2 py-8 text-center text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>העלה קובץ CSV לצפייה בתובנות אחזקה</p>
                  </div>
                }
              </div>
            </div>

            {/* Investigations and Analysis */}
            <div className="grid gap-6 lg:grid-cols-2">
              <OpenInvestigations />
              <SquadronTrends />
            </div>

            {/* Flight Technique Analysis - Commander Only */}
            <FlightTechniqueAnalysis />
          </div>
        )}

        {/* AI Assistant — role-scoped */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full h-auto flex-wrap gap-px overflow-x-auto justify-start">
            <TabsTrigger value="alerts">התרעות אחזקה</TabsTrigger>
            <TabsTrigger value="active">תיקים מושלמים</TabsTrigger>
            <TabsTrigger value="recommendations">המלצות טכניות</TabsTrigger>
            <TabsTrigger value="rules">ניהול כללים</TabsTrigger>
            <TabsTrigger value="blackbox">נתוני קופסה שחורה</TabsTrigger>
            <TabsTrigger value="history">היסטוריה וניתוח</TabsTrigger>
            <TabsTrigger value="daily">סיכום יומי</TabsTrigger>
        {(currentUser.role === 'maintenance-chief' || currentUser.role === 'specialist' || currentUser.role === 'engineer') && (
          <TabsTrigger value="fleet">ניתוח טייסת</TabsTrigger>
        )}
          </TabsList>

        <TabsContent value="alerts" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <MaintenanceAlerts />
            <FlightFiles />
          </div>
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          <ActiveFlights />
        </TabsContent>

        <TabsContent value="blackbox" className="mt-6">
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-row-reverse text-right">
                  <Activity className="h-5 w-5" />
                  נתוני קופסה שחורה - מבט מפורט
                </CardTitle>
              <CardDescription>
                ניתוח מפורט של נתונים מקופסה שחורה בצורת עץ לפי מערכות ורכיבים
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasData ? (
                <div className="py-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg">אין נתוני קופסה שחורה</h3>
                  <p className="text-muted-foreground mt-2">
                    העלה קובץ CSV עם נתוני טיסה לצפייה בניתוח מערכות
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">בחר מטוס (מספר זנב):</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר מטוס..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_placeholder" disabled>בחר מטוס...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">תאריך טיסה:</label>
                      <Input type="date" />
                    </div>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <div className="py-8 text-center text-muted-foreground">
                      <Plane className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>בחר מטוס ותאריך לצפייה בעץ נתוני מערכות</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          <TechnicalRecommendations />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RuleManagementTab />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="space-y-6">
            <FlightDataChart />
            <FailureHistory />
          </div>
        </TabsContent>

        <TabsContent value="daily" className="mt-6">
          <div className="space-y-6">
            {!hasData ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg">אין נתונים לסיכום יומי</h3>
                    <p className="text-muted-foreground mt-2">
                      נדרשת העלאת נתוני טיסה לחישוב סיכום יומי
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                   <CardHeader>
                     <CardTitle className="flex items-center gap-2 flex-row-reverse text-right">
                       <Clock className="h-5 w-5" />
                       סיכום תובנות סוף יום
                     </CardTitle>
                     <CardDescription className="text-right">מחושב מנתוני CSV</CardDescription>
                   </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="font-medium">טיסות שנותחו</span>
                        <Badge variant="secondary">{dashboardStats.totalFlights}</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <span className="font-medium">תובנות קריטיות</span>
                        <Badge variant="destructive">{dashboardStats.criticalInsights}</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-warning/5 border border-warning/20 rounded-lg">
                        <span className="font-medium">סה"כ תובנות</span>
                        <Badge className="bg-warning/10 text-warning border-warning/20">{dashboardStats.totalInsights}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                   <CardHeader>
                     <CardTitle className="flex items-center gap-2 flex-row-reverse text-right">
                       <Activity className="h-5 w-5" />
                       סטטוס כשירות מטוסים
                     </CardTitle>
                     <CardDescription className="text-right">מחושב מנתוני CSV</CardDescription>
                   </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-success/5 border border-success/20 rounded-lg">
                        <span className="font-medium">מטוסים זמינים</span>
                        <Badge className="bg-success/10 text-success border-success/20">
                          {dashboardStats.aircraftAvailable}/{dashboardStats.aircraftTotal}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <span className="font-medium">מטוסים עם התרעות</span>
                        <Badge variant="destructive">{dashboardStats.aircraftWithAlerts}</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-warning/5 border border-warning/20 rounded-lg">
                        <span className="font-medium">מטוסים בבדיקה</span>
                        <Badge className="bg-warning/10 text-warning border-warning/20">{dashboardStats.aircraftInReview}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {(currentUser.role === 'maintenance-chief' || currentUser.role === 'specialist' || currentUser.role === 'engineer') && (
          <TabsContent value="fleet" className="mt-6">
            <FleetAnalysisTab />
          </TabsContent>
        )}
        </Tabs>
      </main>
    </div>
  );
};

const Index = () => {
  return <DashboardContent />;
};

export default Index;
