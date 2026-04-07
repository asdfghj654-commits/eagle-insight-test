/**
 * Fleet Analysis Tab (Aircraft Readiness Analysis)
 * 
 * PRODUCTION RULE: This component MUST NOT display any mock data.
 * All aircraft information comes from real CSV data only.
 * 
 * Terminology: Uses "כשירות מטוסים" (Aircraft Readiness), NOT "צי" (Fleet).
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, LineChart, TrendingUp, Plane, Database, Info } from "lucide-react";
import { BarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCSVData } from "@/contexts/CSVDataContext";

export const FleetAnalysisTab = () => {
  const { hasData, getAircraftStatus, dashboardStats, insights } = useDashboardData();
  const { processedFlights } = useCSVData();
  const [selectedAircraft, setSelectedAircraft] = useState<string | null>(null);

  // Derive aircraft data from real CSV data
  const aircraftData = useMemo(() => {
    if (!hasData) return [];
    
    const status = getAircraftStatus();
    return status.map(aircraft => ({
      tail: aircraft.tail,
      status: aircraft.status === 'critical' ? 'grounded' : 
              aircraft.status === 'maintenance' ? 'maintenance' : 'operational',
      alertCount: aircraft.alertCount,
      criticalAlerts: aircraft.criticalAlerts,
      lastFlight: aircraft.lastFlight || null,
      // Count flights per aircraft
      flightCount: processedFlights.filter(f => f.tail_number === aircraft.tail).length
    }));
  }, [hasData, getAircraftStatus, processedFlights]);

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

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                רשימת מטוסים
                <Badge variant="outline" className="text-xs">
                  {aircraftData.length} מטוסים
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מספר זנב</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">טיסות</TableHead>
                    <TableHead className="text-right">התרעות</TableHead>
                    <TableHead className="text-right">קריטיות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aircraftData.map((aircraft) => (
                    <TableRow 
                      key={aircraft.tail}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedAircraft(aircraft.tail)}
                    >
                      <TableCell className="font-medium">{aircraft.tail}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(aircraft.status)}>
                          {getStatusLabel(aircraft.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{aircraft.flightCount}</TableCell>
                      <TableCell>{aircraft.alertCount}</TableCell>
                      <TableCell>
                        {aircraft.criticalAlerts > 0 ? (
                          <Badge variant="destructive">{aircraft.criticalAlerts}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
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
