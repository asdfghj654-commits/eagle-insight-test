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

const PORTAL_TEXT = {
  title: "\u05E4\u05D5\u05E8\u05D8\u05DC \u05DE\u05D2\u05DF \u05D3\u05D5\u05D3 \u05DC\u05D0\u05D7\u05D6\u05E7\u05D4",
  systemInsights: "\u05EA\u05D5\u05D1\u05E0\u05D5\u05EA \u05DE\u05E2\u05E8\u05DB\u05EA",
  approvalsQueue: "\u05EA\u05D5\u05E8 \u05D0\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD",
  researchFull: "\u05EA\u05DE\u05D5\u05E0\u05EA \u05DE\u05D7\u05E7\u05E8",
  researchShort: "\u05DE\u05D7\u05E7\u05E8",
  selectionsFull: "\u05D1\u05D7\u05D9\u05E8\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA",
  selectionsShort: "\u05D1\u05D7\u05D9\u05E8\u05D5\u05EA",
  timeFull: "\u05D6\u05DE\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD",
  timeShort: "\u05D6\u05DE\u05DF",
  qualityFull: "\u05D0\u05D9\u05DB\u05D5\u05EA \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD",
  qualityShort: "\u05D0\u05D9\u05DB\u05D5\u05EA",
} as const;

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
    if (emergencyMode) {
      return `\u05DE\u05E6\u05D1 \u05D7\u05D9\u05E8\u05D5\u05DD: ${emergencyReason || "\u05E4\u05E2\u05D9\u05DC"}`;
    }
    switch (safetyStatus) {
      case 'safe': return "\u05DE\u05E6\u05D1 \u05D1\u05D8\u05D9\u05D7\u05D5\u05EA \u05EA\u05E7\u05D9\u05DF";
      case 'caution': return `\u05D6\u05D4\u05D9\u05E8\u05D5\u05EA - ${readiness.degradedAircraft} \u05DE\u05D8\u05D5\u05E1\u05D9\u05DD \u05DE\u05D5\u05D2\u05D1\u05DC\u05D9\u05DD`;
      case 'danger': return `\u05E1\u05D9\u05DB\u05D5\u05DF - ${readiness.groundedAircraft} \u05DE\u05D8\u05D5\u05E1\u05D9\u05DD \u05DE\u05D5\u05E9\u05D1\u05EA\u05D9\u05DD`;
    }
  };

  return (
    <>
      <div className={`px-4 py-2 flex items-center ${getStatusColor()}`} dir="rtl">
        <div className="flex-1">
          {emergencyMode && (
            <Badge variant="secondary" className="animate-pulse bg-white/20">
              <AlertCircle className="h-3 w-3 mr-1" />
              {"\u05DE\u05E6\u05D1 \u05D7\u05D9\u05E8\u05D5\u05DD \u05E4\u05E2\u05D9\u05DC"}
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
            {"\u05DE\u05D8\u05E8\u05D9\u05E6\u05EA \u05E1\u05D9\u05DB\u05D5\u05DF"}
          </Button>
        </div>
      </div>

      <Dialog open={riskMatrixOpen} onOpenChange={setRiskMatrixOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{"\u05DE\u05D8\u05E8\u05D9\u05E6\u05EA \u05E1\u05D9\u05DB\u05D5\u05DF - \u05D4\u05EA\u05E4\u05DC\u05D2\u05D5\u05EA \u05D7\u05D5\u05DE\u05E8\u05D5\u05EA"}</DialogTitle>
            <DialogDescription>{"\u05E1\u05D9\u05DB\u05D5\u05DD \u05DE\u05DE\u05E6\u05D0\u05D9\u05DD \u05E4\u05EA\u05D5\u05D7\u05D9\u05DD \u05DC\u05E4\u05D9 \u05E8\u05DE\u05EA \u05D7\u05D5\u05DE\u05E8\u05D4"}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-4">
            {[
              { label: 'S1 - \u05E7\u05E8\u05D9\u05D8\u05D9', value: severityCounts.S1, color: 'text-red-600', bg: 'bg-red-100' },
              { label: 'S2 - \u05DE\u05E9\u05D9\u05DE\u05EA\u05D9', value: severityCounts.S2, color: 'text-orange-600', bg: 'bg-orange-100' },
              { label: 'S3 - \u05E0\u05D3\u05D7\u05D4', value: severityCounts.S3, color: 'text-yellow-600', bg: 'bg-yellow-100' },
              { label: 'S4 - \u05DE\u05D9\u05D3\u05E2', value: severityCounts.S4, color: 'text-blue-600', bg: 'bg-blue-100' },
            ].map((item) => (
              <div key={item.label} className={`text-center p-4 rounded-lg border ${item.bg}`}>
                <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-sm font-medium">{item.label}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setRiskMatrixOpen(false)}>{"\u05E1\u05D2\u05D5\u05E8"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const PortalHeader = () => {
  const navigate = useNavigate();
  const portalTitle = "\u05DE\u05D2\u05DF \u05D3\u05D5\u05D3 \u05DC\u05D0\u05D7\u05D6\u05E7\u05D4";
  const portalSubtitle = "\u05E1\u05D1\u05D9\u05D1\u05EA \u05EA\u05D7\u05E7\u05D5\u05E8 \u05D4\u05E0\u05D3\u05E1\u05D9\u05EA -\u05DE\u05D9\u05E6\u05D5\u05D9 \u05DE\u05D9\u05D3\u05E2 \u05D0\u05D7\u05D6\u05E7\u05EA\u05D9";

  return (
    <header className="border-b border-border/70 bg-card/95 shadow-sm backdrop-blur">
      <SafetyBanner />
      <div className="px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4" dir="rtl">
          <div className="ml-auto inline-flex w-fit items-center gap-3 justify-end rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 shadow-sm">
            <div className="shrink-0 text-right leading-tight">
              <p className="text-lg font-bold tracking-tight text-foreground">{portalTitle}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{portalSubtitle}</p>
            </div>
          </div>

          <div className="mx-auto flex items-center gap-2 justify-center flex-row-reverse">
            <Button variant="outline" onClick={() => navigate('/')} className="flex items-center gap-2 flex-row-reverse">
              <span>{PORTAL_TEXT.systemInsights}</span>
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/review')} className="flex items-center gap-2 flex-row-reverse">
              <span>{PORTAL_TEXT.approvalsQueue}</span>
              <ClipboardList className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

type NavTab = 'research' | 'selections' | 'time' | 'quality';

const NAV_TABS: { id: NavTab; label: string; labelShort: string; icon: React.ElementType }[] = [
  { id: 'research', label: PORTAL_TEXT.researchFull, labelShort: PORTAL_TEXT.researchShort, icon: Search },
  { id: 'selections', label: PORTAL_TEXT.selectionsFull, labelShort: PORTAL_TEXT.selectionsShort, icon: Eye },
  { id: 'time', label: PORTAL_TEXT.timeFull, labelShort: PORTAL_TEXT.timeShort, icon: Clock },
  { id: 'quality', label: PORTAL_TEXT.qualityFull, labelShort: PORTAL_TEXT.qualityShort, icon: Activity },
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
        <div className="w-16 border-r flex flex-col py-1 gap-0.5 bg-muted/20 flex-shrink-0" dir="ltr">
          {NAV_TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-md mx-1 px-1.5 py-3 text-center transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="max-w-full whitespace-normal break-words text-[10px] leading-snug font-medium">
                  {tab.labelShort}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto rounded-r-3xl border border-border/70 bg-gradient-to-b from-card via-card to-muted/20 p-3 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.45)] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          dir="rtl"
        >

          {/* ג”€ג”€ ׳×׳׳•׳ ׳× ׳׳—׳§׳¨ ג”€ג”€ */}
          {activeTab === 'research' && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm">
                <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">{"\u05EA\u05DE\u05D5\u05E0\u05EA \u05DE\u05D7\u05E7\u05E8"}</div>
                <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{"\u05D8\u05D9\u05E1\u05D5\u05EA"}</span>
                  <Badge variant="secondary" className="text-xs">{dataStats.flightCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{"\u05DE\u05D8\u05D5\u05E1\u05D9\u05DD"}</span>
                  <Badge variant="secondary" className="text-xs">{dataStats.aircraftCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{"\u05E4\u05E8\u05DE\u05D8\u05E8\u05D9\u05DD"}</span>
                  <Badge variant="secondary" className="text-xs">{dataStats.parameterCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{"\u05E8\u05E9\u05D5\u05DE\u05D5\u05EA"}</span>
                  <Badge variant="secondary" className="text-xs">{dataStats.recordCount.toLocaleString()}</Badge>
                </div>
              </div>
              {topAircraft.length > 0 && (
                <div className="space-y-1 pt-2 border-t">
                  <div className="text-xs font-medium text-muted-foreground">{"\u05D6\u05E0\u05D1\u05D5\u05EA \u05D1\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD"}</div>
                  {topAircraft.map(([tail, count]) => (
                    <div key={tail} className="flex items-center justify-between text-xs">
                      <span className="font-medium tracking-tight text-foreground">{tail}</span>
                      <span className="text-muted-foreground">{count} {"\u05D8\u05D9\u05E1\u05D5\u05EA"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ג”€ג”€ ׳‘׳—׳™׳¨׳•׳× ׳©׳׳•׳¨׳•׳× ג”€ג”€ */}
          {activeTab === 'selections' && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm">
                <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {"\u05D1\u05D7\u05D9\u05E8\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA"}
                  {selectionSets.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">{selectionSets.length}</Badge>
                )}
              </div>
              {selectionSets.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-2">
                  {"\u05D2\u05E8\u05D5\u05E8 \u05D0\u05D6\u05D5\u05E8 \u05D1\u05D2\u05E8\u05E3 \u05D4\u05D0\u05D5\u05EA\u05D5\u05EA \u05DB\u05D3\u05D9 \u05DC\u05E9\u05DE\u05D5\u05E8 \u05D1\u05D7\u05D9\u05E8\u05D4"}
                </p>
              ) : (
                <div className="space-y-1.5 overflow-y-auto">
                  {selectionSets.map((set, idx) => (
                    <div key={set.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/60 text-xs">
                      <div className="flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-1.5 py-1 flex-shrink-0">
                        <div className="h-3 w-3 rounded-sm border border-white/80 shadow-sm" style={{ backgroundColor: set.color }} />
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">בגרף</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{set.name}</div>
                        <div className="text-muted-foreground text-[10px]">{set.data.length} {"\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ג”€ג”€ ׳–׳׳ ׳ ׳×׳•׳ ׳™׳ ג”€ג”€ */}
          {activeTab === 'time' && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm">
                <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">{"\u05D8\u05D5\u05D5\u05D7 \u05D6\u05DE\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD"}</div>
                {dataStats.dateRange ? (
                  <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm">
                    <div className="mb-1 text-[11px] font-semibold tracking-wide text-primary/80">{"\u05DE-"}</div>
                    <div className="text-sm font-semibold tracking-tight tabular-nums text-foreground">
                      {new Date(dataStats.dateRange.from).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm">
                    <div className="mb-1 text-[11px] font-semibold tracking-wide text-primary/80">{"\u05E2\u05D3-"}</div>
                    <div className="text-sm font-semibold tracking-tight tabular-nums text-foreground">
                      {new Date(dataStats.dateRange.to).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 shadow-sm">
                    <div className="mb-1 text-[11px] font-semibold tracking-wide text-primary">{"\u05DE\u05E9\u05DA \u05DB\u05D5\u05DC\u05DC"}</div>
                    <div className="text-lg font-bold text-primary">
                      {Math.round((new Date(dataStats.dateRange.to).getTime() - new Date(dataStats.dateRange.from).getTime()) / 60000)} <span className="text-sm font-medium">{"\u05D3\u05E7\u05D5\u05EA"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{"\u05D0\u05D9\u05DF \u05D8\u05D5\u05D5\u05D7 \u05D6\u05DE\u05DF \u05D6\u05DE\u05D9\u05DF"}</p>
              )}
            </div>
          )}

          {/* ג”€ג”€ ׳׳™׳›׳•׳× ׳ ׳×׳•׳ ׳™׳ ג”€ג”€ */}
          {activeTab === 'quality' && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm">
                <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">{"\u05D0\u05D9\u05DB\u05D5\u05EA \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD"}</div>
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
            <CardTitle className="text-center">{"\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05E4\u05D5\u05E8\u05D8\u05DC \u05DE\u05D2\u05DF \u05D0\u05D7\u05D6\u05E7\u05D4"}</CardTitle>
            <CardDescription className="text-center">
              {"\u05D4\u05EA\u05D7\u05D9\u05DC\u05D5 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D4\u05E2\u05DC\u05D0\u05EA \u05E7\u05D5\u05D1\u05E5 CSV \u05E2\u05DD \u05E0\u05EA\u05D5\u05E0\u05D9 \u05D8\u05D9\u05E1\u05D4"}
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
            <CardTitle className="text-sm">{"\u05D8\u05D9\u05E1\u05D5\u05EA \u05DC\u05E0\u05D9\u05EA\u05D5\u05D7"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataStats.flightCount}</div>
            <div className="text-xs text-muted-foreground">{dataStats.aircraftCount} {"\u05DE\u05D8\u05D5\u05E1\u05D9\u05DD \u05E9\u05D5\u05E0\u05D9\u05DD"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{"\u05E8\u05E9\u05D5\u05DE\u05D5\u05EA \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataStats.recordCount}</div>
            <div className="text-xs text-muted-foreground">{"\u05EA\u05E6\u05D5\u05D2\u05EA \u05DE\u05D7\u05E7\u05E8 \u05DE\u05D3\u05D5\u05D2\u05DE\u05EA \u05DC\u05D8\u05E2\u05D9\u05E0\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{"\u05E4\u05E8\u05DE\u05D8\u05E8\u05D9\u05DD \u05DC\u05DE\u05D7\u05E7\u05E8"}</CardTitle>
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
            <CardTitle className="text-sm">{"\u05D7\u05DC\u05D5\u05DF \u05D6\u05DE\u05DF"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataStats.dateRange ? (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 shadow-sm">
                  <div className="text-[11px] font-semibold tracking-wide text-primary/80">{"\u05DE-"}</div>
                  <div className="mt-1 text-sm font-semibold tracking-tight tabular-nums text-foreground">
                    {new Date(dataStats.dateRange.from).toLocaleString('he-IL')}
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 shadow-sm">
                  <div className="text-[11px] font-semibold tracking-wide text-primary/80">{"\u05E2\u05D3"}</div>
                  <div className="mt-1 text-sm font-semibold tracking-tight tabular-nums text-foreground">
                    {new Date(dataStats.dateRange.to).toLocaleString('he-IL')}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                {"\u05DC\u05D0 \u05D6\u05DE\u05D9\u05DF"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 gap-1 h-auto" dir="rtl">
          <TabsTrigger value="signals" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">{"\u05D0\u05D5\u05EA\u05D5\u05EA"}</span>
            <Activity className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="distributions" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">{"\u05D4\u05EA\u05E4\u05DC\u05D2\u05D5\u05D9\u05D5\u05EA"}</span>
            <BarChart3 className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="correlations" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">{"\u05E7\u05D5\u05E8\u05DC\u05E6\u05D9\u05D5\u05EA"}</span>
            <GitBranch className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">{"\u05D0\u05D9\u05E8\u05D5\u05E2\u05D9\u05DD"}</span>
            <AlertTriangle className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">{"\u05E8\u05D0\u05D9\u05D5\u05EA"}</span>
            <Database className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="composer" className="flex items-center gap-2 flex-row-reverse p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="text-sm">{"\u05DB\u05DC\u05DC\u05D9\u05DD"}</span>
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
