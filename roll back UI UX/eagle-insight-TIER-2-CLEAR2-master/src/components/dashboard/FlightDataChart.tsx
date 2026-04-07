/**
 * Flight Data Chart Component
 * 
 * PRODUCTION RULE: This component MUST NOT display any data
 * until CSV is uploaded and a flight is selected.
 * 
 * NO hardcoded aircraft list.
 * NO hardcoded flight data.
 * NO mock insights.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Activity, Database, Plane, AlertCircle } from "lucide-react";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useAvailableAircraft } from "@/hooks/useAvailableAircraft";
import { useAvailableFlights } from "@/hooks/useAvailableFlights";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export const FlightDataChart = () => {
  const { hasRealData, rawData, dataMode } = useCSVData();
  const { tailNumbers, hasAircraft } = useAvailableAircraft();
  const [selectedAircraft, setSelectedAircraft] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Get flights for selected aircraft
  const { flights } = useAvailableFlights({ 
    tailNumber: selectedAircraft || undefined 
  });

  // Get unique dates for selected aircraft
  const availableDates = useMemo(() => {
    if (!selectedAircraft || flights.length === 0) return [];
    
    const dates = new Set<string>();
    flights.forEach(f => {
      const date = f.startTime.split('T')[0];
      dates.add(date);
    });
    return Array.from(dates).sort().reverse();
  }, [selectedAircraft, flights]);

  // Get telemetry data for selected aircraft and date
  const chartData = useMemo(() => {
    if (!selectedAircraft || !selectedDate || rawData.length === 0) return [];
    
    return rawData
      .filter(r => 
        r.tail_number === selectedAircraft && 
        r.timestamp.startsWith(selectedDate)
      )
      .map(r => ({
        time: new Date(r.timestamp).toLocaleTimeString('he-IL', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        altitude: r.altitude || 0,
        speed: r.airspeed || 0,
        engine_temp: r.engine_temp || 0,
        timestamp: r.timestamp,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [selectedAircraft, selectedDate, rawData]);

  // PRODUCTION: Show empty state if no data loaded
  if (!hasRealData) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              נתוני טיסה ותובנות - גרפים
            </CardTitle>
            <CardDescription>
              ניתוח גרפי של נתוני קופסה שחורה לפי מטוס ותאריך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Database}
              title="אין נתוני טיסה"
              description="העלה קובץ CSV עם נתוני קופסה שחורה לצפייה בגרפים. נתונים יופיעו לאחר העלאה וניתוח."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show data mode indicator
  const DataModeIndicator = () => (
    dataMode === 'demo' ? (
      <Badge variant="secondary" className="text-xs">נתוני הדגמה</Badge>
    ) : (
      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
        נתונים אמיתיים
      </Badge>
    )
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            נתוני טיסה ותובנות - גרפים
            <DataModeIndicator />
          </CardTitle>
          <CardDescription>
            ניתוח גרפי של נתוני קופסה שחורה לפי מטוס ותאריך
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">בחר מטוס (מספר זנב):</label>
              <select 
                value={selectedAircraft}
                onChange={(e) => {
                  setSelectedAircraft(e.target.value);
                  setSelectedDate(""); // Reset date when aircraft changes
                }}
                className="w-full p-2 border rounded-lg bg-background"
              >
                <option value="">בחר מטוס...</option>
                {tailNumbers.map((tail) => (
                  <option key={tail} value={tail}>
                    {tail}
                  </option>
                ))}
              </select>
              {!hasAircraft && (
                <p className="text-xs text-muted-foreground">
                  אין מטוסים בנתונים - העלה CSV
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">תאריך טיסה:</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={!selectedAircraft || availableDates.length === 0}
                className="w-full p-2 border rounded-lg bg-background disabled:opacity-50"
              >
                <option value="">
                  {!selectedAircraft 
                    ? "בחר מטוס תחילה" 
                    : availableDates.length === 0 
                      ? "אין תאריכים זמינים" 
                      : "בחר תאריך..."}
                </option>
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts - Only show if data is selected */}
      {chartData.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plane className="h-4 w-4" />
                גובה ומהירות - מטוס {selectedAircraft}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="altitude" 
                    stroke="#8884d8" 
                    name="גובה (רגל)"
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="speed" 
                    stroke="#82ca9d" 
                    name="מהירות (קמ/ש)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">טמפרטורת מנוע - מטוס {selectedAircraft}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="engine_temp" fill="#ff7c7c" name="טמפרטורה (°C)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : selectedAircraft && selectedDate ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={AlertCircle}
              title="אין נתונים לטיסה זו"
              description={`לא נמצאו נתוני טלמטריה עבור מטוס ${selectedAircraft} בתאריך ${selectedDate}`}
              variant="warning"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={Plane}
              title="בחר מטוס ותאריך"
              description="יש לבחור מטוס ותאריך טיסה לצפייה בנתונים"
              variant="info"
            />
          </CardContent>
        </Card>
      )}

      {/* Data attribution */}
      {chartData.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          מציג {chartData.length} נקודות נתונים | מטוס: {selectedAircraft} | תאריך: {selectedDate}
        </div>
      )}
    </div>
  );
};
