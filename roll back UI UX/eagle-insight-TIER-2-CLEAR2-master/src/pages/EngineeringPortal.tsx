import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  FileText, 
  CheckSquare,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Search,
  Clock,
  Plane,
  AlertCircle
} from "lucide-react";
import { useRole } from "@/components/dashboard/RoleProvider";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { CSVUpload } from "@/components/CSVUpload";
import { SignalsTab } from "@/components/portal/SignalsTab";
import { EventsTab } from "@/components/portal/EventsTab";
import { DistributionsTab } from "@/components/portal/DistributionsTab";
import { CorrelationsTab } from "@/components/portal/CorrelationsTab";
import { EvidenceTab } from "@/components/portal/EvidenceTab";
import { RuleComposerTab } from "@/components/portal/RuleComposerTab";
import { ReviewTab } from "@/components/portal/ReviewTab";
import { useNavigate } from "react-router-dom";

const SafetyBanner = () => {
  const { currentUser } = useRole();
  const { emergencyMode, emergencyReason, getFleetReadiness, findings } = useFlightDossier();
  const isCommander = currentUser.role === 'commander';
  const [riskMatrixOpen, setRiskMatrixOpen] = useState(false);
  
  // Derive safety status from fleet readiness - NOT a local toggle
  const readiness = getFleetReadiness();
  
  const safetyStatus = useMemo(() => {
    if (emergencyMode) return 'danger';
    if (readiness.groundedAircraft > 0) return 'danger';
    if (readiness.degradedAircraft > 0) return 'caution';
    return 'safe';
  }, [emergencyMode, readiness]);

  // Count findings by severity for risk matrix
  const severityCounts = useMemo(() => ({
    S1: findings.filter(f => f.severity === 'S1' && f.status !== 'resolved').length,
    S2: findings.filter(f => f.severity === 'S2' && f.status !== 'resolved').length,
    S3: findings.filter(f => f.severity === 'S3' && f.status !== 'resolved').length,
    S4: findings.filter(f => f.severity === 'S4' && f.status !== 'resolved').length,
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
          {/* Emergency indicator - visible to all when active */}
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
          {/* Risk Matrix - working button */}
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

      {/* Risk Matrix Dialog */}
      <Dialog open={riskMatrixOpen} onOpenChange={setRiskMatrixOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>מטריצת סיכון - התפלגות חומרות</DialogTitle>
            <DialogDescription>
              סיכום ממצאים פתוחים לפי רמת חומרה
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-4">
            <div className="text-center p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200">
              <div className="text-3xl font-bold text-red-600">{severityCounts.S1}</div>
              <div className="text-sm font-medium">S1 - קריטי</div>
              <div className="text-xs text-muted-foreground">השבתת מטוס</div>
            </div>
            <div className="text-center p-4 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-200">
              <div className="text-3xl font-bold text-orange-600">{severityCounts.S2}</div>
              <div className="text-sm font-medium">S2 - משימתי</div>
              <div className="text-xs text-muted-foreground">הגבלות טיסה</div>
            </div>
            <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-200">
              <div className="text-3xl font-bold text-yellow-600">{severityCounts.S3}</div>
              <div className="text-sm font-medium">S3 - נדחה</div>
              <div className="text-xs text-muted-foreground">טיפול מתוכנן</div>
            </div>
            <div className="text-center p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-600">{severityCounts.S4}</div>
              <div className="text-sm font-medium">S4 - מידעי</div>
              <div className="text-xs text-muted-foreground">מעקב</div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground text-center">
            סה"כ: {Object.values(severityCounts).reduce((a, b) => a + b, 0)} ממצאים פתוחים
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
  const { currentUser } = useRole();
  const navigate = useNavigate();

  return (
    <header className="border-b bg-card">
      <SafetyBanner />
      <div className="px-6 py-4">
        <div className="grid grid-cols-3 items-center gap-4" dir="rtl">
          {/* Left Section - Portal Name & Logo */}
          <div className="flex items-center gap-6 justify-start flex-row-reverse">
            <div className="flex items-center gap-3 flex-row-reverse">
              <div className="text-right">
                <h1 className="text-2xl font-bold">פורטל מגן דוד לאחזקה</h1>
                <p className="text-sm text-muted-foreground">סביבת תחקור הנדסית F-16</p>
              </div>
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div className="flex items-center gap-4 flex-row-reverse">
              <div className="w-14 h-14 bg-gradient-to-br from-accent to-primary rounded-lg flex items-center justify-center shadow-lg">
                <div className="text-white text-center">
                  <div className="text-lg font-bold">🔧</div>
                  <div className="text-xs">מגן</div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Section - Navigation Buttons */}
          <div className="flex items-center gap-3 justify-center flex-row-reverse">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 flex-row-reverse"
            >
              <span>תובנות אחזקה</span>
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/review')}
              className="flex items-center gap-2 flex-row-reverse"
            >
              <span>תור אישורים</span>
              <CheckSquare className="h-4 w-4" />
            </Button>
          </div>

          {/* Right Section - User & Time */}
          <div className="flex items-center gap-4 justify-end flex-row-reverse">
            <div className="text-center border-l pl-4">
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
            <div className="text-right">
              <p className="text-sm font-medium">מהנדס {currentUser.name} ({currentUser.id})</p>
              <p className="text-xs text-muted-foreground">{currentUser.rank}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const DataNavigator = () => {
  const { availableParameters, processedFlights, selectionSets } = useCSVData();

  return (
    <div className="w-80 border-l bg-sidebar p-4 space-y-6" dir="rtl">
      {/* Schema Browser */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            דפדפן סכימה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xs space-y-1">
            <div className="font-medium text-primary">🛩️ אוויניקה</div>
            <div className="mr-4 space-y-1">
              {availableParameters.filter(p => p.includes('aoa') || p.includes('altitude')).map(param => (
                <div key={param} className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  • {param}
                </div>
              ))}
            </div>
            <div className="font-medium">🔧 הידראוליות</div>
            <div className="mr-4 space-y-1">
              {availableParameters.filter(p => p.includes('hydraulic') || p.includes('pressure')).map(param => (
                <div key={param} className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  • {param}
                </div>
              ))}
            </div>
            <div className="font-medium">⚙️ מנועים</div>
            <div className="mr-4 space-y-1">
              {availableParameters.filter(p => p.includes('engine') || p.includes('temp') || p.includes('rpm')).map(param => (
                <div key={param} className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  • {param}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Inspector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            בוחן שדות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            בחר פרמטר לצפייה בפרטים
          </div>
        </CardContent>
      </Card>

      {/* Selection Sets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            בחירות שמורות
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {selectionSets.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              אין בחירות שמורות
            </div>
          ) : (
            selectionSets.map(set => (
              <div key={set.id} className="flex items-center gap-2 p-2 rounded bg-muted">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: set.color }}
                />
                <span className="text-xs font-medium">{set.name}</span>
                <Badge variant="outline" className="text-xs">{set.id}</Badge>
              </div>
            ))
          )}
          <div className="flex gap-1 mt-3">
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1">∪</Button>
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1">∩</Button>
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1">\</Button>
          </div>
        </CardContent>
      </Card>

      {/* Bookmarks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            סימניות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            אין סימניות שמורות
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const EngineeringWorkspace = () => {
  const { rawData, processedFlights, availableParameters } = useCSVData();
  const [activeTab, setActiveTab] = useState("signals");

  const handleJumpToTime = (timestamp: number, parameter: string) => {
    setActiveTab("signals");
    // Additional logic to jump to specific time in signals tab could be added here
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
    <div className="flex-1 p-6" dir="rtl">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 gap-1 h-auto" dir="rtl">
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
          <TabsTrigger value="review" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">סקירה</span>
            <CheckSquare className="h-4 w-4" />
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

        <TabsContent value="review" className="mt-6">
          <ReviewTab />
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

const EngineeringPortal = () => {
  return <EngineeringPortalContent />;
};

export default EngineeringPortal;