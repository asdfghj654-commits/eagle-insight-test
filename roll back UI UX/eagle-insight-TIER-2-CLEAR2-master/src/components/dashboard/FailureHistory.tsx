/**
 * Failure History Component
 * 
 * PRODUCTION RULE: All data MUST be derived from canonical sources.
 * NO hardcoded mock data - show empty state if insufficient data.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, Line, Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { History, TrendingDown, TrendingUp, Clock, AlertTriangle, Database } from "lucide-react";
import { useFailureHistory } from "@/hooks/useFailureHistory";
import { EmptyState } from "@/components/ui/empty-state";
import { useCSVData } from "@/contexts/CSVDataContext";

export const FailureHistory = () => {
  const { dataMode } = useCSVData();
  const {
    flightHoursData,
    materialFatigueData,
    recentFailures,
    overallReliability,
    totalFlightHours,
    averageFailuresPerMonth,
    hasFlightData,
    hasFindingsData,
    isEmpty,
    isLoading,
    dateRange,
  } = useFailureHistory(6);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "text-red-600 bg-red-100";
      case "warning": return "text-orange-600 bg-orange-100";
      default: return "text-green-600 bg-green-100";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge variant="destructive">קריטי</Badge>;
      case "medium": return <Badge className="bg-orange-100 text-orange-800">בינוני</Badge>;
      default: return <Badge variant="secondary">קל</Badge>;
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
              <p className="text-muted-foreground">טוען נתוני היסטוריה...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // PRODUCTION: Show empty state if no data
  if (isEmpty) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={History}
              title="אין היסטוריית תקלות זמינה"
              description="נדרשים נתוני טיסות וממצאים להצגת היסטוריה. העלה קובץ CSV עם נתונים."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Mode Indicator */}
      {dataMode === 'demo' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
          <Badge variant="secondary" className="mb-1">נתוני הדגמה</Badge>
          <p className="text-xs text-muted-foreground">
            הנתונים המוצגים הם לצורכי הדגמה בלבד
          </p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">אחוז שמישות כולל</CardTitle>
          </CardHeader>
          <CardContent>
            {overallReliability !== null ? (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {overallReliability.toFixed(1)}%
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  חושב מנתונים בפועל
                </div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">אין נתונים מספיקים</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">שעות טיסה כולל</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFlightHours}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {dateRange ? `${dateRange.from} - ${dateRange.to}` : 'תקופה לא ידועה'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ממוצע תקלות חודשי</CardTitle>
          </CardHeader>
          <CardContent>
            {averageFailuresPerMonth !== null ? (
              <>
                <div className="text-2xl font-bold text-orange-600">
                  {averageFailuresPerMonth.toFixed(1)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingDown className="h-3 w-3" />
                  חושב מנתונים בפועל
                </div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">אין נתונים מספיקים</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Flight Hours vs Failures Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              שעות טיסה ותקלות לאורך זמן
            </CardTitle>
            <CardDescription>
              מעקב אחר מגמות תקלות יחסית לשעות טיסה
            </CardDescription>
          </CardHeader>
          <CardContent>
            {flightHoursData.length > 0 ? (
              <ChartContainer 
                config={{
                  flightHours: { label: "שעות טיסה", color: "hsl(var(--primary))" },
                  failures: { label: "תקלות", color: "hsl(var(--destructive))" },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={flightHoursData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="flightHours" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.3}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="failures" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <EmptyState
                  icon={Database}
                  title="אין נתונים לתרשים"
                  description="נדרשים נתוני טיסות להצגת גרף"
                  variant="subtle"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Material Fatigue Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              ניתוח התעייפות חומרים
            </CardTitle>
            <CardDescription>
              רמת שחיקה של רכיבים קריטיים
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {materialFatigueData.length > 0 ? (
              materialFatigueData.map((component, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{component.componentHe}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(component.status)}`}>
                        {component.usage}% / {component.threshold}%
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={component.usage} 
                    className="h-2" 
                  />
                  {component.usage >= component.threshold && (
                    <p className="text-xs text-red-600">⚠️ חריגה מסף הביטחון - נדרשת בדיקה</p>
                  )}
                </div>
              ))
            ) : (
              <EmptyState
                icon={AlertTriangle}
                title="אין נתוני רכיבים"
                description="נדרשים ממצאים לניתוח התעייפות"
                variant="subtle"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Failures */}
      <Card>
        <CardHeader>
          <CardTitle>תקלות אחרונות</CardTitle>
          <CardDescription>
            היסטוריית תקלות ומגמות אחזקה
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentFailures.length > 0 ? (
            <div className="space-y-3">
              {recentFailures.map((failure, index) => (
                <div key={failure.id || index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <p className="font-medium">{failure.component}</p>
                      <p className="text-muted-foreground">{failure.description}</p>
                    </div>
                  </div>
                  <div className="text-left space-y-1">
                    <div className="flex items-center gap-2">
                      {getSeverityBadge(failure.severity)}
                      <span className="text-xs text-muted-foreground">{failure.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {failure.impact}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="אין תקלות אחרונות"
              description="לא נמצאו תקלות בתקופה האחרונה"
              variant="info"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
