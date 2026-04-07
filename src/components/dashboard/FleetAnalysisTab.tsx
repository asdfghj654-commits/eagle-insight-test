/**
 * Fleet Analysis Tab (Aircraft Readiness Analysis)
 * 
 * PRODUCTION RULE: This component MUST NOT display any mock data.
 * All aircraft information comes from real CSV data only.
 * 
 * Terminology: Uses "כשירות מטוסים" (Aircraft Readiness), NOT "צי" (Fleet).
 */

// Fleet Analysis Tab — aircraft readiness with ranked tables, progress bars, top/bottom patterns
// UX pattern: pinned identity column, progress-style alert counts, top-critical callout
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Plane, Database, Info, AlertTriangle, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { BarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCSVData } from "@/contexts/CSVDataContext";

type AircraftSortCol = 'tail' | 'status' | 'flights' | 'alerts' | 'critical';
type SortDir = 'asc' | 'desc';

export const FleetAnalysisTab = () => {
  const { hasData, getAircraftStatus, dashboardStats, insights } = useDashboardData();
  const { processedFlights } = useCSVData();
  const [selectedAircraft, setSelectedAircraft] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<AircraftSortCol>('critical');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: AircraftSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: AircraftSortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp   className="h-3 w-3 ml-1 text-primary inline" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary inline" />;
  };

  // Derive aircraft data from real CSV data
  const aircraftData = useMemo(() => {
    if (!hasData) return [];
    const status = getAircraftStatus();
    return status.map(aircraft => ({
      tail: aircraft.tail,
      status: aircraft.status === 'critical' ? 'grounded' :
              aircraft.status === 'maintenance' ? 'maintenance' : 'operational',
      alertCount:    aircraft.alertCount,
      criticalAlerts: aircraft.criticalAlerts,
      lastFlight:    aircraft.lastFlight || null,
      flightCount:   processedFlights.filter(f => f.tail_number === aircraft.tail).length,
    }));
  }, [hasData, getAircraftStatus, processedFlights]);

  const maxAlerts   = useMemo(() => Math.max(1, ...aircraftData.map(a => a.alertCount)),   [aircraftData]);
  const maxCritical = useMemo(() => Math.max(1, ...aircraftData.map(a => a.criticalAlerts)), [aircraftData]);

  const sortedAircraftData = useMemo(() => {
    return [...aircraftData].sort((a, b) => {
      let cmp = 0;
      const statusOrder = { grounded: 0, maintenance: 1, operational: 2 };
      switch (sortCol) {
        case 'tail':     cmp = a.tail.localeCompare(b.tail); break;
        case 'status':   cmp = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]; break;
        case 'flights':  cmp = a.flightCount - b.flightCount; break;
        case 'alerts':   cmp = a.alertCount - b.alertCount; break;
        case 'critical': cmp = a.criticalAlerts - b.criticalAlerts; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [aircraftData, sortCol, sortDir]);

  const topCritical = useMemo(() =>
    [...aircraftData].sort((a, b) => b.criticalAlerts - a.criticalAlerts).filter(a => a.criticalAlerts > 0).slice(0, 3),
    [aircraftData],
  );

  // Derive fault history from insights
  const faultHistory = useMemo(() => {
    if (!selectedAircraft || !hasData) return [];
    
    return insights
      .filter(i => i.tail === selectedAircraft)
      .map(i => ({
        date: new Date(i.created_at).toLocaleDateString('he-IL'),
        system: i.system || 'כללי',
        severity: i.severity,
        description: i.title
      }))
      .slice(0, 10);
  }, [selectedAircraft, insights, hasData]);

  // Chart data - alerts by system
  const chartData = useMemo(() => {
    if (!hasData) return [];
    
    const systemCounts = new Map<string, number>();
    insights.forEach(i => {
      const system = i.system || 'כללי';
      systemCounts.set(system, (systemCounts.get(system) || 0) + 1);
    });
    
    return Array.from(systemCounts.entries())
      .map(([system, count]) => ({ system, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [insights, hasData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-success text-success-foreground';
      case 'maintenance': return 'bg-warning text-warning-foreground';
      case 'grounded': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'operational': return 'תקין';
      case 'maintenance': return 'בתחזוקה';
      case 'grounded': return 'מושבת';
      default: return 'לא ידוע';
    }
  };

  // PRODUCTION: Show empty state if no data
  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            ניתוח כשירות מטוסים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Database className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-xl">אין נתוני כשירות מטוסים</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              נדרשת העלאת נתוני טיסה מקופסה שחורה לניתוח כשירות מטוסים.
              <br />
              העלה קובץ CSV דרך פורטל המהנדס.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{aircraftData.length}</div>
              <div className="text-sm text-muted-foreground">מטוסים מזוהים</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-success">
                {aircraftData.filter(a => a.status === 'operational').length}
              </div>
              <div className="text-sm text-muted-foreground">תקינים</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">
                {aircraftData.filter(a => a.status === 'maintenance').length}
              </div>
              <div className="text-sm text-muted-foreground">בתחזוקה</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-destructive">
                {aircraftData.filter(a => a.status === 'grounded').length}
              </div>
              <div className="text-sm text-muted-foreground">מושבתים</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <Plane className="h-4 w-4" />
            רשימת מטוסים
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            ניתוח גרפי
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Top critical callout */}
          {topCritical.length > 0 && (
            <Card className="border-red-200 bg-red-50/20 dark:bg-red-900/10 dark:border-red-800/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  מטוסים עם ממצאים קריטיים
                </CardTitle>
                <CardDescription className="text-xs">דורשים טיפול מיידי</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-red-100 dark:divide-red-900/30">
                  {topCritical.map((a, i) => (
                    <div key={a.tail} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-red-50/30"
                      onClick={() => setSelectedAircraft(a.tail)}>
                      <span className="text-xs font-bold text-red-400 w-4">#{i + 1}</span>
                      <span className="font-mono text-sm font-semibold flex-1">{a.tail}</span>
                      <Badge variant="destructive" className="text-xs">{a.criticalAlerts} קריטי</Badge>
                      <Badge variant="outline" className="text-xs">{a.alertCount} סה"כ</Badge>
                      <Badge className={`text-xs ${getStatusColor(a.status)}`}>{getStatusLabel(a.status)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main aircraft table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  כל המטוסים
                  <Badge variant="outline" className="text-xs">{aircraftData.length}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">לחץ על עמודה למיון · לחץ על שורה לפרטים</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-right w-8 text-muted-foreground">#</TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none" onClick={() => handleSort('tail')}>
                      <span className="flex items-center justify-end">זנב <SortIcon col="tail" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none" onClick={() => handleSort('status')}>
                      <span className="flex items-center justify-end">סטטוס <SortIcon col="status" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none" onClick={() => handleSort('flights')}>
                      <span className="flex items-center justify-end">טיסות <SortIcon col="flights" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none w-40" onClick={() => handleSort('alerts')}>
                      <span className="flex items-center justify-end">התרעות <SortIcon col="alerts" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none w-36" onClick={() => handleSort('critical')}>
                      <span className="flex items-center justify-end">קריטיות <SortIcon col="critical" /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAircraftData.map((aircraft, idx) => (
                    <TableRow
                      key={aircraft.tail}
                      className={`cursor-pointer hover:bg-muted/40 ${selectedAircraft === aircraft.tail ? 'bg-muted/60 border-r-2 border-r-primary' : ''}`}
                      onClick={() => setSelectedAircraft(aircraft.tail === selectedAircraft ? null : aircraft.tail)}
                    >
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {aircraft.criticalAlerts > 0
                            ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                            : <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                          <span className="font-mono font-semibold text-sm">{aircraft.tail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getStatusColor(aircraft.status)}`}>
                          {getStatusLabel(aircraft.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{aircraft.flightCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-sm w-6 text-right">{aircraft.alertCount}</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-orange-400 transition-all"
                              style={{ width: `${(aircraft.alertCount / maxAlerts) * 100}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {aircraft.criticalAlerts > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums text-sm w-6 text-right text-red-500 font-medium">{aircraft.criticalAlerts}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-red-500 transition-all"
                                style={{ width: `${(aircraft.criticalAlerts / maxCritical) * 100}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Fault History for Selected Aircraft */}
          {selectedAircraft && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  היסטוריית תקלות - מטוס {selectedAircraft}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {faultHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">תאריך</TableHead>
                        <TableHead className="text-right">מערכת</TableHead>
                        <TableHead className="text-right">חומרה</TableHead>
                        <TableHead className="text-right">תיאור</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faultHistory.map((fault, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{fault.date}</TableCell>
                          <TableCell>{fault.system}</TableCell>
                          <TableCell>
                            <Badge variant={fault.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {fault.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{fault.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2" />
                    <p>אין תקלות מתועדות למטוס זה</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>התראות לפי מערכת</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="system" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="מספר התראות" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>אין נתונים מספיקים לתרשים</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Attribution */}
      <div className="text-xs text-muted-foreground text-center">
        נתונים מ-{dashboardStats.totalFlights} טיסות שנותחו | {dashboardStats.totalInsights} תובנות זוהו
      </div>
    </div>
  );
};
