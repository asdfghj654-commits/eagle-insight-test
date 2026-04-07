import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Activity,
  BarChart3,
  GitBranch,
  AlertTriangle,
  Database,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Search,
  Clock,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCSVData } from "@/contexts/CSVDataContext";
import { AiPanel } from "@/components/ai/AiPanel";
import { DataQualityPanel } from "@/components/portal/DataQualityPanel";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { CSVUpload } from "@/components/CSVUpload";
import { SignalsTab } from "@/components/portal/SignalsTab";
import { EventsTab } from "@/components/portal/EventsTab";
import { DistributionsTab } from "@/components/portal/DistributionsTab";
import { CorrelationsTab } from "@/components/portal/CorrelationsTab";
import { EvidenceTab } from "@/components/portal/EvidenceTab";
import { RuleComposerTab } from "@/components/portal/RuleComposerTab";
import { useNavigate } from "react-router-dom";

const SafetyBanner = () => {
  const { emergencyMode, emergencyReason, getFleetReadiness, findings } = useFlightDossier();
  const [riskMatrixOpen, setRiskMatrixOpen] = useState(false);
  const readiness = getFleetReadiness();

  const safetyStatus = useMemo(() => {
    if (emergencyMode) return 'danger';
    if (readiness.groundedAircraft > 0) return 'danger';
    if (readiness.degradedAircraft > 0) return 'caution';
    return 'safe';
  }, [emergencyMode, readiness]);

  const severityCounts = useMemo(() => ({
    S1: findings.filter((finding) => finding.severity === 'S1' && finding.status !== 'resolved').length,
    S2: findings.filter((finding) => finding.severity === 'S2' && finding.status !== 'resolved').length,
    S3: findings.filter((finding) => finding.severity === 'S3' && finding.status !== 'resolved').length,
    S4: findings.filter((finding) => finding.severity === 'S4' && finding.status !== 'resolved').length,
  }), [findings]);

  const getStatusColor = () => {
    switch (safetyStatus) {
      case 'safe': return 'bg-success text-success-foreground';
      case 'caution': return 'bg-warning text-warning-foreground';
      case 'danger': return 'bg-destructive text-destructive-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (safetyStatus) {
      case 'safe': return <ShieldCheck className="h-4 w-4" />;
      case 'caution': return <ShieldAlert className="h-4 w-4" />;
      case 'danger': return <Shield className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    if (emergencyMode) return `מצב חירום: ${emergencyReason || 'פעיל'}`;
    switch (safetyStatus) {
      case 'safe': return 'מצב בטיחות תקין';
      case 'caution': return `זהירות - ${readiness.degradedAircraft} מטוסים מוגבלים`;
      case 'danger': return `סיכון - ${readiness.groundedAircraft} מטוסים מושבתים`;
    }
  };

  return (
    <>
      <div className={`px-4 py-2 flex items-center ${getStatusColor()}`} dir="rtl">
        <div className="flex-1">
          {emergencyMode && (
            <Badge variant="secondary" className="animate-pulse bg-white/20">
              <AlertCircle className="h-3 w-3 mr-1" />
              מצב חירום פעיל
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 justify-center">
          {getStatusIcon()}
          <span className="font-medium">{getStatusText()}</span>
        </div>
        <div className="flex-1 flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 bg-white/20 hover:bg-white/30 text-white border-white/30"
            onClick={() => setRiskMatrixOpen(true)}
          >
            מטריצת סיכון
          </Button>
        </div>
      </div>

      <Dialog open={riskMatrixOpen} onOpenChange={setRiskMatrixOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>מטריצת סיכון - התפלגות חומרות</DialogTitle>
            <DialogDescription>סיכום ממצאים פתוחים לפי רמת חומרה</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-4">
            {[
              { label: 'S1 - קריטי', value: severityCounts.S1, color: 'text-red-600', bg: 'bg-red-100' },
              { label: 'S2 - משימתי', value: severityCounts.S2, color: 'text-orange-600', bg: 'bg-orange-100' },
              { label: 'S3 - נדחה', value: severityCounts.S3, color: 'text-yellow-600', bg: 'bg-yellow-100' },
              { label: 'S4 - מידע', value: severityCounts.S4, color: 'text-blue-600', bg: 'bg-blue-100' },
            ].map((item) => (
              <div key={item.label} className={`text-center p-4 rounded-lg border ${item.bg}`}>
                <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-sm font-medium">{item.label}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setRiskMatrixOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const PortalHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b bg-card">
      <SafetyBanner />
      <div className="px-4 py-2.5">
        <div className="grid grid-cols-3 items-center gap-3" dir="rtl">
          <div className="flex items-center gap-6 justify-start flex-row-reverse">
            <div className="flex items-center gap-3 flex-row-reverse">
              <div className="text-right">
                <h1 className="text-lg font-bold leading-tight">פורטל מגן דוד לאחזקה</h1>
                <p className="text-xs text-muted-foreground">סביבת תחקור הנדסית F-16</p>
              </div>
              <Settings className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-center flex-row-reverse">
            <Button variant="outline" onClick={() => navigate('/')} className="flex items-center gap-2 flex-row-reverse">
              <span>תובנות מערכת</span>
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/review')} className="flex items-center gap-2 flex-row-reverse">
              <span>תור אישורים</span>
              <ClipboardList className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4 justify-end flex-row-reverse">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.nameHe || user?.name || 'מהנדס'}</p>
              <p className="text-xs text-muted-foreground">{user?.rankHe || user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

type NavTab = 'research' | 'selections' | 'time' | 'quality';

const NAV_TABS: { id: NavTab; label: string; labelShort: string; icon: React.ElementType }[] = [
  { id: 'research',   label: 'תמונת מחקר',    labelShort: 'מחקר',   icon: Search   },
  { id: 'selections', label: 'בחירות שמורות', labelShort: 'בחירות', icon: Eye      },
  { id: 'time',       label: 'זמן נתונים',    labelShort: 'זמן',    icon: Clock    },
  { id: 'quality',    label: 'איכות נתונים',  labelShort: 'איכות',  icon: Activity },
];

const DataNavigator = () => {
  const { availableParameters, processedFlights, selectionSets, dataStats } = useCSVData();
  const [activeTab, setActiveTab] = useState<NavTab>('research');

  const topAircraft = useMemo(() => {
    const counts = new Map<string, number>();
    processedFlights.forEach((flight) => {
      counts.set(flight.tail_number, (counts.get(flight.tail_number) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((l, r) => r[1] - l[1]).slice(0, 5);
  }, [processedFlights]);

  return (
    <div
      className="w-72 flex-shrink-0 border-l bg-sidebar flex flex-col"
      style={{ height: 'calc(100vh - 120px)', position: 'sticky', top: '0' }}
      dir="rtl"
    >
      {/* AI panel pinned at top */}
      <div className="p-3 border-b flex-shrink-0">
        <AiPanel slot="investigation_assist" roleScope="engineer" compact={false} defaultOpen={true} />
      </div>

      {/* Vertical tabs + content */}
      <div className="flex flex-1 min-h-0">
        {/* Left tab strip */}
        <div className="w-14 border-r flex flex-col py-1 gap-0.5 bg-muted/20 flex-shrink-0" dir="ltr">
          {NAV_TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`flex flex-col items-center gap-1 px-1 py-3 text-center transition-colors rounded-md mx-1 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-[9px] leading-tight font-medium">{tab.labelShort}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0" dir="rtl">

          {/* ── תמונת מחקר ── */}
          {activeTab === 'research' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground pb-1 border-b">תמונת מחקר</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">טיסות</span>
                  <Badge variant="secondary" className="text-xs">{dataStats.flightCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">מטוסים</span>
                  <Badge variant="secondary" className="text-xs">{dataStats.aircraftCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">פרמטרים</span>
                  <Badge variant="secondary" className="text-xs">{dataStats.parameterCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">רשומות</span>
                  <Badge variant="secondary" className="text-xs">{dataStats.recordCount.toLocaleString()}</Badge>
                </div>
              </div>
              {topAircraft.length > 0 && (
                <div className="space-y-1 pt-2 border-t">
                  <div className="text-xs font-medium text-muted-foreground">זנבות בנתונים</div>
                  {topAircraft.map(([tail, count]) => (
                    <div key={tail} className="flex items-center justify-between text-xs">
                      <span className="font-mono">{tail}</span>
                      <span className="text-muted-foreground">{count} טיסות</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── בחירות שמורות ── */}
          {activeTab === 'selections' && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground pb-1 border-b flex items-center gap-1.5">
                בחירות שמורות
                {selectionSets.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">{selectionSets.length}</Badge>
                )}
              </div>
              {selectionSets.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-2">
                  גרור אזור בגרף האותות כדי לשמור בחירה
                </p>
              ) : (
                <div className="space-y-1.5 overflow-y-auto">
                  {selectionSets.map((set, idx) => (
                    <div key={set.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/60 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: set.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{set.name}</div>
                        <div className="text-muted-foreground text-[10px]">{set.data.length} נקודות</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── זמן נתונים ── */}
          {activeTab === 'time' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground pb-1 border-b">טווח זמן נתונים</div>
              {dataStats.dateRange ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">מ-</div>
                    <div className="font-mono mt-0.5">
                      {new Date(dataStats.dateRange.from).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">עד-</div>
                    <div className="font-mono mt-0.5">
                      {new Date(dataStats.dateRange.to).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="pt-1 border-t">
                    <div className="text-muted-foreground">משך כולל</div>
                    <div className="font-medium mt-0.5">
                      {Math.round((new Date(dataStats.dateRange.to).getTime() - new Date(dataStats.dateRange.from).getTime()) / 60000)} דקות
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">אין טווח זמן זמין</p>
              )}
            </div>
          )}

          {/* ── איכות נתונים ── */}
          {activeTab === 'quality' && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground pb-1 border-b">איכות נתונים</div>
              <DataQualityPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EngineeringWorkspace = () => {
  const { rawData, processedFlights, availableParameters, dataStats } = useCSVData();
  const [activeTab, setActiveTab] = useState("signals");

  const topParameters = useMemo(() => availableParameters.slice(0, 6), [availableParameters]);

  const handleJumpToTime = () => {
    setActiveTab("signals");
  };

  if (rawData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-center">ברוכים הבאים לפורטל מגן אחזקה</CardTitle>
            <CardDescription className="text-center">
              התחילו על ידי העלאת קובץ CSV עם נתוני טיסה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CSVUpload />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4" dir="rtl">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">טיסות לניתוח</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataStats.flightCount}</div>
            <div className="text-xs text-muted-foreground">{dataStats.aircraftCount} מטוסים שונים</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">רשומות פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataStats.recordCount}</div>
            <div className="text-xs text-muted-foreground">תצוגת מחקר מדוגמת לטעינה מהירה</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">פרמטרים למחקר</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataStats.parameterCount}</div>
            <div className="text-xs text-muted-foreground truncate">
              {topParameters.join(' | ')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">חלון זמן</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {dataStats.dateRange ? new Date(dataStats.dateRange.from).toLocaleString('he-IL') : 'לא זמין'}
            </div>
            <div className="text-xs text-muted-foreground">
              עד {dataStats.dateRange ? new Date(dataStats.dateRange.to).toLocaleString('he-IL') : 'לא זמין'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 gap-1 h-auto" dir="rtl">
          <TabsTrigger value="signals" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">אותות</span>
            <Activity className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="distributions" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">התפלגויות</span>
            <BarChart3 className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="correlations" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">קורלציות</span>
            <GitBranch className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">אירועים</span>
            <AlertTriangle className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">ראיות</span>
            <Database className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="composer" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">כללים</span>
            <Settings className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signals" className="mt-6">
          <SignalsTab />
        </TabsContent>
        <TabsContent value="distributions" className="mt-6">
          <DistributionsTab />
        </TabsContent>
        <TabsContent value="correlations" className="mt-6">
          <CorrelationsTab />
        </TabsContent>
        <TabsContent value="events" className="mt-6">
          <EventsTab onJumpToTime={handleJumpToTime} />
        </TabsContent>
        <TabsContent value="evidence" className="mt-6">
          <EvidenceTab />
        </TabsContent>
        <TabsContent value="composer" className="mt-6">
          <RuleComposerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const EngineeringPortalContent = () => {
  const { rawData } = useCSVData();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <PortalHeader />
      <main className="flex">
        <EngineeringWorkspace />
        {rawData.length > 0 && <DataNavigator />}
      </main>
    </div>
  );
};

const EngineeringPortal = () => <EngineeringPortalContent />;

export default EngineeringPortal;
