import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Database,
  Download,
  FileText,
  GitCompare,
  Radar,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { CSVUpload } from "@/components/CSVUpload";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DataAdapter } from "@/lib/data-adapter";
import { useAuth } from "@/contexts/AuthContext";

const REPORT_CONTEXT_FIELDS = [
  "pilot_name",
  "mission_type",
  "note",
  "notes",
  "remark",
  "remarks",
  "crew",
  "technician",
] as const;

const formatNumber = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "0";
  if (Math.abs(value) >= 1000) return value.toLocaleString("he-IL", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 100) return value.toFixed(0);
  return value.toFixed(1);
};

const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const ReportsPage = () => {
  const { processedFlights, availableParameters, hasRealData, dataStats, rules, createRule, updateRule, deleteRule } = useCSVData();
  const { insights, dashboardStats } = useDashboardData();
  const { user } = useAuth();

  const sortedFlights = useMemo(
    () => [...processedFlights].sort((left, right) => right.startTime.localeCompare(left.startTime)),
    [processedFlights],
  );

  const tailOptions = useMemo(
    () => Array.from(new Set(sortedFlights.map((flight) => flight.tail_number))).sort(),
    [sortedFlights],
  );

  const [selectedTail, setSelectedTail] = useState<string>("all");
  const [selectedFlightId, setSelectedFlightId] = useState<string>("");
  const [primaryParameter, setPrimaryParameter] = useState<string>("");
  const [secondaryParameter, setSecondaryParameter] = useState<string>("");
  const [rangeDrafts, setRangeDrafts] = useState<Record<string, { min: string; max: string }>>({});

  useEffect(() => {
    if (!hasRealData) {
      setSelectedFlightId("");
      return;
    }
    if (selectedTail !== "all" && !tailOptions.includes(selectedTail)) {
      setSelectedTail("all");
    }
  }, [hasRealData, selectedTail, tailOptions]);

  const filteredFlights = useMemo(() => {
    if (selectedTail === "all") return sortedFlights;
    return sortedFlights.filter((flight) => flight.tail_number === selectedTail);
  }, [selectedTail, sortedFlights]);

  useEffect(() => {
    if (!filteredFlights.length) {
      setSelectedFlightId("");
      return;
    }

    const stillExists = filteredFlights.some((flight) => flight.flight_id === selectedFlightId);
    if (!stillExists) {
      setSelectedFlightId(filteredFlights[0].flight_id);
    }
  }, [filteredFlights, selectedFlightId]);

  useEffect(() => {
    if (!availableParameters.length) {
      setPrimaryParameter("");
      setSecondaryParameter("");
      return;
    }

    if (!availableParameters.includes(primaryParameter)) {
      setPrimaryParameter(availableParameters[0]);
    }
  }, [availableParameters, primaryParameter]);

  useEffect(() => {
    if (!availableParameters.length) {
      setSecondaryParameter("");
      return;
    }

    if (!secondaryParameter || !availableParameters.includes(secondaryParameter) || secondaryParameter === primaryParameter) {
      const fallback = availableParameters.find((parameter) => parameter !== primaryParameter) ?? availableParameters[0];
      setSecondaryParameter(fallback);
    }
  }, [availableParameters, primaryParameter, secondaryParameter]);

  const selectedFlight = useMemo(
    () => filteredFlights.find((flight) => flight.flight_id === selectedFlightId) ?? null,
    [filteredFlights, selectedFlightId],
  );

  const selectedFlightInsights = useMemo(() => {
    if (!selectedFlight) return [];
    return insights.filter(
      (insight) =>
        insight.flight_id === selectedFlight.flight_id ||
        (!insight.flight_id && insight.tail === selectedFlight.tail_number),
    );
  }, [insights, selectedFlight]);

  const selectedFlightContext = useMemo(() => {
    if (!selectedFlight) {
      return {
        contextEntries: [] as Array<{ label: string; value: string }>,
        reportedSignalsCount: 0,
      };
    }

    const values = new Map<string, string>();
    for (const field of REPORT_CONTEXT_FIELDS) {
      const firstValue = selectedFlight.records
        .map((record) => record[field])
        .find((value) => typeof value === "string" && value.trim().length > 0);
      if (typeof firstValue === "string" && firstValue.trim()) {
        values.set(field, firstValue.trim());
      }
    }

    const labels: Record<string, string> = {
      pilot_name: "איש צוות אוויר",
      mission_type: "סוג משימה",
      note: "הערת צוות",
      notes: "הערות צוות",
      remark: "דיווח",
      remarks: "דיווחים",
      crew: "צוות",
      technician: "טכנאי מדווח",
    };

    return {
      reportedSignalsCount: values.size,
      contextEntries: Array.from(values.entries()).map(([field, value]) => ({
        label: labels[field] ?? field,
        value,
      })),
    };
  }, [selectedFlight]);

  const selectedFlightChartData = useMemo(() => {
    if (!selectedFlight || !primaryParameter) return [];

    return selectedFlight.records.map((record, index) => ({
      index: index + 1,
      timestamp: record.timestamp,
      time: new Date(record.timestamp).toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      phase: record.phase,
      primary: Number(record[primaryParameter] ?? 0),
      secondary: Number(record[secondaryParameter] ?? 0),
    }));
  }, [selectedFlight, primaryParameter, secondaryParameter]);

  const systemStats = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const insight of insights) {
      const key = insight.system || "כללי";
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [insights]);

  const severityStats = useMemo(() => {
    const order = ["critical", "high", "medium", "low"] as const;
    const labels: Record<(typeof order)[number], string> = {
      critical: "קריטי",
      high: "גבוה",
      medium: "בינוני",
      low: "נמוך",
    };

    return order.map((severity) => ({
      severity,
      label: labels[severity],
      count: insights.filter((insight) => insight.severity === severity).length,
    }));
  }, [insights]);

  const reportFlightRows = useMemo(() => {
    const flightsForStats = filteredFlights.slice(0, 12);
    return flightsForStats
      .map((flight) => {
        const primaryValues = flight.records
          .map((record) => Number(record[primaryParameter]))
          .filter((value) => Number.isFinite(value));

        const flightInsights = insights.filter(
          (insight) =>
            insight.flight_id === flight.flight_id ||
            (!insight.flight_id && insight.tail === flight.tail_number),
        );

        return {
          flightId: flight.flight_id,
          averagePrimary:
            primaryValues.length > 0
              ? primaryValues.reduce((sum, value) => sum + value, 0) / primaryValues.length
              : 0,
          insightCount: flightInsights.length,
        };
      })
      .reverse();
  }, [filteredFlights, insights, primaryParameter]);

  const exportSummary = useMemo(() => {
    const tailLabel = selectedTail === "all" ? "כלל הטייסת" : `מטוס ${selectedTail}`;
    const flightLabel = selectedFlight ? `טיסה ${selectedFlight.flight_id}` : "ללא טיסה נבחרת";
    return [
      `דוח תחזוקה מותאם`,
      `היקף: ${tailLabel}`,
      `מוקד: ${flightLabel}`,
      `פרמטר ראשי: ${DataAdapter.getParameterDisplayName(primaryParameter)}`,
      `פרמטר משני: ${DataAdapter.getParameterDisplayName(secondaryParameter)}`,
      `מספר טיסות מנותחות: ${filteredFlights.length}`,
      `מספר תובנות פתוחות: ${insights.length}`,
      `תובנות קריטיות: ${severityStats.find((item) => item.severity === "critical")?.count ?? 0}`,
    ].join("\n");
  }, [filteredFlights.length, insights.length, primaryParameter, secondaryParameter, selectedFlight, selectedTail, severityStats]);

  const handleExport = () => {
    const blob = new Blob([exportSummary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "technical-reports-summary.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const canEditRanges = user?.role === "engineer" || user?.role === "specialist" || user?.role === "commander";

  const signalRangeRules = useMemo(() => {
    return availableParameters.map((parameter) => {
      const rule = rules.find((item) => item.name === `SIGNAL_RANGE::${parameter}`);
      const minCondition = rule?.conditions.find((condition) => condition.type === "range" && condition.value?.min != null);
      const maxCondition = rule?.conditions.find((condition) => condition.type === "range" && condition.value?.max != null);

      return {
        parameter,
        rule,
        min: minCondition?.value?.min,
        max: maxCondition?.value?.max,
      };
    });
  }, [availableParameters, rules]);

  useEffect(() => {
    const nextDrafts: Record<string, { min: string; max: string }> = {};
    for (const item of signalRangeRules) {
      nextDrafts[item.parameter] = {
        min: item.min != null ? String(item.min) : "",
        max: item.max != null ? String(item.max) : "",
      };
    }
    setRangeDrafts(nextDrafts);
  }, [signalRangeRules]);

  const visibleSignalRows = useMemo(() => signalRangeRules, [signalRangeRules]);

  const setRangeDraft = (parameter: string, field: "min" | "max", value: string) => {
    setRangeDrafts((prev) => ({
      ...prev,
      [parameter]: {
        min: prev[parameter]?.min ?? "",
        max: prev[parameter]?.max ?? "",
        [field]: value,
      },
    }));
  };

  const saveSignalRangeRule = (parameter: string) => {
    const draft = rangeDrafts[parameter] ?? { min: "", max: "" };
    const min = draft.min.trim() === "" ? null : Number(draft.min);
    const max = draft.max.trim() === "" ? null : Number(draft.max);
    const existingRule = rules.find((item) => item.name === `SIGNAL_RANGE::${parameter}`);

    if ((min != null && Number.isNaN(min)) || (max != null && Number.isNaN(max))) {
      return;
    }

    if (min == null && max == null) {
      if (existingRule) {
        deleteRule(existingRule.id);
      }
      return;
    }

    const nextStatus = user?.role === "specialist" ? "pending-review" : "approved";
    const nextRule = {
      name: `SIGNAL_RANGE::${parameter}`,
      description: `גבולות מאושרים עבור ${DataAdapter.getParameterDisplayName(parameter)}`,
      conditions: [
        {
          parameter,
          type: "range" as const,
          value: { min, max },
        },
      ],
      scope: {},
      severity: "medium" as const,
      riskMatrix: { severity: 2, probability: 2 },
      status: nextStatus,
      isActive: nextStatus === "approved",
      createdBy: user?.id ?? "local-user",
    };

    if (existingRule) {
      updateRule(existingRule.id, nextRule);
      return;
    }

    createRule(nextRule);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <main className="container mx-auto px-4 py-6 space-y-6 font-plex">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">דוחות טכניים וגרפים מותאמים</h1>
            <p className="text-sm text-muted-foreground">
              סביבת עבודה לצוות הטכני למשיכת נתונים, בניית גרפים ייעודיים והשוואת מידע טכני מול דיווחי צוות אוויר.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            יצוא תקציר
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              משיכת נתונים
            </CardTitle>
            <CardDescription>
              העלאת קובץ CSV או רענון מאגר הטיסות המקומי לפני הפקת דוחות וגרפים.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CSVUpload onUploadComplete={() => undefined} />
          </CardContent>
        </Card>

        {!hasRealData ? (
          <EmptyState
            icon={FileText}
            title="אין נתונים זמינים להפקת דוחות"
            description="העלה קובץ CSV כדי לפתוח גרפים מותאמים, סטטיסטיקות תובנות והשוואה בין המידע הטכני לבין הקשר מדיווחי צוות האוויר."
            asCard
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">טיסות מנותחות</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dataStats.flightCount}</div>
                  <div className="text-xs text-muted-foreground">{dataStats.aircraftCount} מטוסים פעילים</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">תובנות פתוחות</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.totalInsights}</div>
                  <div className="text-xs text-muted-foreground">{dashboardStats.criticalInsights} קריטיות</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">בריאות מערכת</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.systemHealthScore}%</div>
                  <div className="text-xs text-muted-foreground">נגזר מהתפלגות ממצאים פעילים</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">חלון נתונים</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {dataStats.dateRange ? formatTimestamp(dataStats.dateRange.from) : "לא זמין"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    עד {dataStats.dateRange ? formatTimestamp(dataStats.dateRange.to) : "לא זמין"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {user?.role === "engineer" && <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radar className="h-5 w-5" />
                  מסננים וגרפים מותאמים
                </CardTitle>
                <CardDescription>
                  בחר מטוס, טיסה ושני פרמטרים כדי להרכיב דוח גרפי מותאם לצוות הטכני.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">מטוס</label>
                    <select
                      value={selectedTail}
                      onChange={(event) => setSelectedTail(event.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="all">כלל הטייסת</option>
                      {tailOptions.map((tail) => (
                        <option key={tail} value={tail}>
                          {tail}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">טיסה</label>
                    <select
                      value={selectedFlightId}
                      onChange={(event) => setSelectedFlightId(event.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {filteredFlights.map((flight) => (
                        <option key={flight.flight_id} value={flight.flight_id}>
                          {flight.flight_id} | מטוס {flight.tail_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">פרמטר ראשי</label>
                    <select
                      value={primaryParameter}
                      onChange={(event) => setPrimaryParameter(event.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {availableParameters.map((parameter) => (
                        <option key={parameter} value={parameter}>
                          {DataAdapter.getParameterDisplayName(parameter)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">פרמטר משני</label>
                    <select
                      value={secondaryParameter}
                      onChange={(event) => setSecondaryParameter(event.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {availableParameters.map((parameter) => (
                        <option key={parameter} value={parameter}>
                          {DataAdapter.getParameterDisplayName(parameter)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedFlight && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">טיסה {selectedFlight.flight_id}</Badge>
                    <Badge variant="outline">מטוס {selectedFlight.tail_number}</Badge>
                    <Badge variant="outline">{selectedFlight.records.length} רשומות</Badge>
                    <Badge variant="outline">{selectedFlight.phases.join(" | ")}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-end gap-2 text-right">
                  <Radar className="h-5 w-5" />
                  גבולות סיגנל מאושרים
                </CardTitle>
                <CardDescription className="text-right">
                  מינימום ומקסימום לכל סיגנל. אם לטווח אין ערכים, אפשר למחוק אותו.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleSignalRows.map((item) => {
                  const draft = rangeDrafts[item.parameter] ?? { min: "", max: "" };
                  return (
                    <div key={item.parameter} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,1.4fr)_140px_140px_180px] items-center">
                      <div className="text-right">
                        <div className="font-medium">{DataAdapter.getParameterDisplayName(item.parameter)}</div>
                        <div className="text-xs text-muted-foreground">{item.parameter}</div>
                      </div>
                      <Input
                        value={draft.min}
                        onChange={(event) => setRangeDraft(item.parameter, "min", event.target.value)}
                        placeholder="מינימום"
                        className="text-right"
                        disabled={!canEditRanges}
                      />
                      <Input
                        value={draft.max}
                        onChange={(event) => setRangeDraft(item.parameter, "max", event.target.value)}
                        placeholder="מקסימום"
                        className="text-right"
                        disabled={!canEditRanges}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant={item.rule?.status === "approved" ? "default" : "secondary"}>
                          {item.rule ? (item.rule.status === "approved" ? "מאושר" : "ממתין לאישור") : "לא הוגדר"}
                        </Badge>
                        {canEditRanges && (
                          <Button variant="outline" size="sm" onClick={() => saveSignalRangeRule(item.parameter)}>
                            {draft.min.trim() || draft.max.trim() ? "שמור טווח" : "מחק"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    גרף מותאם לפי טיסה
                  </CardTitle>
                  <CardDescription>
                    {DataAdapter.getParameterDisplayName(primaryParameter)}
                    {" מול "}
                    {DataAdapter.getParameterDisplayName(secondaryParameter)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedFlightChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart data={selectedFlightChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" minTickGap={24} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(value: number, _name: string, payload: any) => {
                            if (payload?.dataKey === "primary") {
                              return [
                                `${formatNumber(value)} ${DataAdapter.getParameterUnits(primaryParameter)}`,
                                DataAdapter.getParameterDisplayName(primaryParameter),
                              ];
                            }
                            return [
                              `${formatNumber(value)} ${DataAdapter.getParameterUnits(secondaryParameter)}`,
                              DataAdapter.getParameterDisplayName(secondaryParameter),
                            ];
                          }}
                          labelFormatter={(_label: string, payload: any) => {
                            const item = payload?.[0]?.payload;
                            return item ? `${item.time} | ${item.phase}` : "";
                          }}
                        />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="primary"
                          stroke="#2563eb"
                          dot={false}
                          strokeWidth={2}
                          name={DataAdapter.getParameterDisplayName(primaryParameter)}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="secondary"
                          stroke="#f97316"
                          dot={false}
                          strokeWidth={2}
                          name={DataAdapter.getParameterDisplayName(secondaryParameter)}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      icon={Activity}
                      title="אין נתונים לגרף הנבחר"
                      description="בחר טיסה ופרמטרים עם ערכים זמינים כדי להציג גרף מותאם."
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    סטטיסטיקת תובנות
                  </CardTitle>
                  <CardDescription>פיזור לפי חומרה בכלל הנתונים הפעילים</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={severityStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0f766e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    מגמות בין טיסות
                  </CardTitle>
                  <CardDescription>
                    ממוצע של הפרמטר הראשי לכל טיסה, לצד נפח תובנות.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportFlightRows.length > 0 ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={reportFlightRows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="flightId" hide />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="averagePrimary"
                          fill="#2563eb"
                          name={`ממוצע ${DataAdapter.getParameterDisplayName(primaryParameter)}`}
                        />
                        <Bar yAxisId="right" dataKey="insightCount" fill="#dc2626" name="מספר תובנות" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      icon={BarChart3}
                      title="אין מספיק טיסות להצגת מגמה"
                      description="העלה נתונים נוספים או שנה מסנן מטוס כדי לבנות סטטיסטיקה רוחבית."
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    מוקדי תקלה מובילים
                  </CardTitle>
                  <CardDescription>חלוקה לפי מערכת בממצאים הפעילים</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {systemStats.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.max((item.count / Math.max(systemStats[0]?.count ?? 1, 1)) * 100, 8)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5" />
                  השוואת מידע טכני מול דיווחי צוות אוויר
                </CardTitle>
                <CardDescription>
                  השוואה מבוססת טיסה נבחרת בין התובנות הטכניות, הקשר התפעולי והמידע המדווח ברשומות.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-medium">תמונת מצב טכנית</div>
                  <div className="text-3xl font-bold">{selectedFlightInsights.length}</div>
                  <div className="text-sm text-muted-foreground">תובנות משויכות לטיסה או למטוס הנבחר</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedFlightInsights.slice(0, 4).map((insight) => (
                      <Badge key={insight.insight_id} variant="outline">
                        {insight.system}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-medium">דיווחי צוות / הקשר מבצעי</div>
                  <div className="text-3xl font-bold">{selectedFlightContext.reportedSignalsCount}</div>
                  <div className="text-sm text-muted-foreground">שדות הקשר שנמצאו ברשומות הטיסה</div>
                  <div className="space-y-2 text-sm">
                    {selectedFlightContext.contextEntries.length > 0 ? (
                      selectedFlightContext.contextEntries.map((entry) => (
                        <div key={entry.label} className="flex items-start justify-between gap-3">
                          <span className="text-muted-foreground">{entry.label}</span>
                          <span className="font-medium text-right">{entry.value}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">לא זוהו שדות דיווח זמינים בטיסה זו.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-medium">חפיפה התנהגותית</div>
                  <div className="text-3xl font-bold">
                    {selectedFlightInsights.filter((insight) => insight.pilot_behavior_context?.trim()).length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    תובנות עם הקשר התנהגותי או תפעולי מתוך כלל התובנות המשויכות
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>טיסה: {selectedFlight?.flight_id ?? "לא נבחרה"}</div>
                    <div>מטוס: {selectedFlight?.tail_number ?? "לא נבחר"}</div>
                    <div>משימה: {selectedFlightContext.contextEntries.find((entry) => entry.label === "סוג משימה")?.value ?? "לא זמין"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default ReportsPage;
