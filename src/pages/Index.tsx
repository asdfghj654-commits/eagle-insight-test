import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useNavigate } from "react-router-dom";
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

const DashboardHeader = () => {
  const { currentUser } = useRole();

  return (
    <header className="border-b bg-card">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between" dir="rtl">
          {/* Left Section - Logos & System Title */}
          <div className="flex items-center gap-6 justify-start">
            <div className="flex items-center gap-4">
              {/* Israeli Air Force Logo - closest to left edge */}
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-lg">
                <div className="text-white text-center">
                  <div className="text-lg font-bold">✈</div>
                  <div className="text-xs">IAF</div>
                </div>
              </div>
              {/* Equipment Squadron Logo */}
              <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center shadow-lg">
                <div className="text-white text-center">
                  <div className="text-lg font-bold">⚙</div>
                  <div className="text-xs">ציוד</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Plane className="h-8 w-8 text-primary" />
              <div className="text-right">
                <h1 className="text-2xl font-bold text-right">מערכת תובנות אחזקה F-16</h1>
                <p className="text-sm text-muted-foreground text-right">ניתוח נתוני קופסה שחורה ותובנות אחזקה</p>
              </div>
            </div>
          </div>

          {/* Right Section - User & Time */}
          <div className="flex items-center gap-4 justify-end">
            <div className="text-right">
              <p className="text-sm font-medium">שלום {currentUser.name} ({currentUser.id})</p>
              <p className="text-xs text-muted-foreground">{currentUser.rank}</p>
            </div>
            <div className="text-center border-r pr-4">
              <p className="text-lg font-mono font-bold" suppressHydrationWarning>
                {new Date().toLocaleTimeString('he-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString('he-IL')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const DashboardContent = () => {
  const { currentUser } = useRole();
  const navigate = useNavigate();
  const { insights, dashboardStats, hasData } = useDashboardData();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      {/* Main Dashboard */}
      <main className="container mx-auto px-4 py-6 space-y-6 font-plex" dir="rtl">
        {/* Portal Access */}
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
            <CSVUpload onUploadComplete={() => {
              console.log('CSV uploaded - dashboard will auto-update with real insights');
            }} />
          </CardContent>
        </Card>

        {/* Role Selector for Demo */}
        <RoleSelector />

        {/* System Explanation */}
        <SystemExplanation />

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
        <AiPanel
          slot={
            currentUser.role === 'commander'
              ? 'fleet_summary'
              : currentUser.role === 'specialist'
              ? 'fleet_summary'
              : 'investigation_assist'
          }
          roleScope={
            currentUser.role === 'technician' ? 'technician'
            : currentUser.role === 'specialist' ? 'specialist'
            : currentUser.role === 'commander' ? 'commander'
            : 'engineer'
          }
          defaultOpen={false}
        />

        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="alerts">התרעות אחזקה</TabsTrigger>
            <TabsTrigger value="active">תיקים מושלמים</TabsTrigger>
            <TabsTrigger value="recommendations">המלצות טכניות</TabsTrigger>
            <TabsTrigger value="rules">ניהול כללים</TabsTrigger>
            <TabsTrigger value="blackbox">נתוני קופסה שחורה</TabsTrigger>
            <TabsTrigger value="history">היסטוריה וניתוח</TabsTrigger>
            <TabsTrigger value="daily">סיכום יומי</TabsTrigger>
        {(currentUser.role === 'maintenance-chief' || currentUser.role === 'specialist' || currentUser.role === 'engineer') && (
          <TabsTrigger value="fleet">ניתוח צי</TabsTrigger>
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
                      <label className="text-sm font-medium text-right">בחר מטוס (מספר זנב):</label>
                      <select className="w-full p-2 border rounded-lg bg-background text-right">
                        <option value="">בחר מטוס...</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-right">תאריך טיסה:</label>
                      <input type="date" className="w-full p-2 border rounded-lg bg-background text-right" />
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
