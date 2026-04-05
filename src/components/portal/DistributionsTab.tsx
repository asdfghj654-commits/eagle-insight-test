// Distributions Tab - Interactive histograms and outlier detection
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { BarChart3, Box, AlertTriangle, Target } from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { DataAdapter } from '@/lib/data-adapter';

export const DistributionsTab: React.FC = () => {
  const { rawData, processedFlights, availableParameters, createSelectionSet } = useCSVData();
  const [selectedParameter, setSelectedParameter] = useState<string>('');
  const [selectedFlight, setSelectedFlight] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [binCount, setBinCount] = useState([20]);
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);

  // Get parameter data for selected filters
  const parameterData = useMemo(() => {
    if (!selectedParameter) return [];

    let filteredData = rawData.filter(record => {
      const flightMatch = selectedFlight === 'all' || record.flight_id === selectedFlight;
      const phaseMatch = selectedPhase === 'all' || record.phase === selectedPhase;
      return flightMatch && phaseMatch && record[selectedParameter] !== undefined;
    });

    return filteredData
      .map(record => ({
        value: typeof record[selectedParameter] === 'number' 
          ? record[selectedParameter] 
          : parseFloat(record[selectedParameter]) || 0,
        flight_id: record.flight_id,
        tail_number: record.tail_number,
        phase: record.phase,
        timestamp: record.timestamp
      }))
      .filter(item => !isNaN(item.value));
  }, [rawData, selectedParameter, selectedFlight, selectedPhase]);

  // Calculate histogram data
  const histogramData = useMemo(() => {
    if (parameterData.length === 0) return [];

    const values = parameterData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / binCount[0];

    const bins = Array(binCount[0]).fill(0).map((_, i) => ({
      binStart: min + i * binSize,
      binEnd: min + (i + 1) * binSize,
      count: 0,
      binCenter: min + i * binSize + binSize / 2
    }));

    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), binCount[0] - 1);
      bins[binIndex].count++;
    });

    return bins.map(bin => ({
      range: `${bin.binStart.toFixed(1)}-${bin.binEnd.toFixed(1)}`,
      count: bin.count,
      binStart: bin.binStart,
      binEnd: bin.binEnd,
      binCenter: bin.binCenter
    }));
  }, [parameterData, binCount]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (parameterData.length === 0) return null;

    const values = parameterData.map(d => d.value).sort((a, b) => a - b);
    const n = values.length;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const std = Math.sqrt(variance);
    
    const q1 = values[Math.floor(n * 0.25)];
    const median = values[Math.floor(n * 0.5)];
    const q3 = values[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    
    // Outlier detection using IQR method
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const outliers = values.filter(v => v < lowerFence || v > upperFence);

    return {
      count: n,
      mean,
      std,
      min: values[0],
      max: values[n - 1],
      median,
      q1,
      q3,
      iqr,
      outliers: outliers.length,
      outlierPercentage: (outliers.length / n) * 100,
      lowerFence,
      upperFence
    };
  }, [parameterData]);

  // Get unique phases
  const phases = useMemo(() => {
    const phaseSet = new Set(rawData.map(r => r.phase));
    return Array.from(phaseSet);
  }, [rawData]);

  const handleBrushChange = (data: any) => {
    if (data && data.startIndex !== undefined && data.endIndex !== undefined) {
      const startBin = histogramData[data.startIndex];
      const endBin = histogramData[data.endIndex];
      setSelectedRange([startBin.binStart, endBin.binEnd]);
    }
  };

  const createSelectionFromRange = () => {
    if (!selectedRange || !selectedParameter) return;

    const [start, end] = selectedRange;
    const selectedData = parameterData.filter(d => d.value >= start && d.value <= end);

    const selectionId = createSelectionSet({
      name: `${DataAdapter.getParameterDisplayName(selectedParameter)} (${start.toFixed(1)}-${end.toFixed(1)})`,
      color: '#8B5CF6',
      description: `טווח ערכים: ${start.toFixed(2)} - ${end.toFixed(2)}`,
      type: 'value-range',
      data: selectedData,
      source: 'distributions',
      statistics: {
        count: selectedData.length,
        mean: selectedData.reduce((sum, d) => sum + d.value, 0) / selectedData.length,
        min: Math.min(...selectedData.map(d => d.value)),
        max: Math.max(...selectedData.map(d => d.value))
      }
    });

    console.log('Created selection set:', selectionId);
    setSelectedRange(null);
  };

  const createOutlierSelection = () => {
    if (!statistics || !selectedParameter) return;

    const outlierData = parameterData.filter(d => 
      d.value < statistics.lowerFence || d.value > statistics.upperFence
    );

    if (outlierData.length === 0) return;

    const selectionId = createSelectionSet({
      name: `${DataAdapter.getParameterDisplayName(selectedParameter)} - חריגים`,
      color: '#EF4444',
      description: `חריגים לפי שיטת IQR (${outlierData.length} נקודות)`,
      type: 'value-range',
      data: outlierData,
      source: 'distributions',
      statistics: {
        count: outlierData.length,
        outlierPercentage: statistics.outlierPercentage
      }
    });

    console.log('Created outlier selection set:', selectionId);
  };

  if (rawData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <BarChart3 className="h-5 w-5" />
            התפלגויות
          </CardTitle>
          <CardDescription className="text-right">
            לא נטענו נתונים. אנא העלה קובץ CSV כדי לראות התפלגויות פרמטרים
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <BarChart3 className="h-5 w-5" />
            בחירת פרמטר וסינונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" dir="rtl">
            <Select value={selectedParameter} onValueChange={setSelectedParameter}>
              <SelectTrigger>
                <SelectValue placeholder="בחר פרמטר" />
              </SelectTrigger>
              <SelectContent>
                {availableParameters.map(param => (
                  <SelectItem key={param} value={param}>
                    {DataAdapter.getParameterDisplayName(param)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedFlight} onValueChange={setSelectedFlight}>
              <SelectTrigger>
                <SelectValue placeholder="טיסה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הטיסות</SelectItem>
                {processedFlights.map(flight => (
                  <SelectItem key={flight.flight_id} value={flight.flight_id}>
                    {flight.flight_id} ({flight.tail_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger>
                <SelectValue placeholder="שלב טיסה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל השלבים</SelectItem>
                {phases.map(phase => (
                  <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm">בינים:</span>
              <Slider
                value={binCount}
                onValueChange={setBinCount}
                min={5}
                max={50}
                step={1}
                className="flex-1"
              />
              <span className="text-sm w-8">{binCount[0]}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedParameter && (
        <>
          {/* Statistics */}
          {statistics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-right">
                  <Box className="h-5 w-5" />
                  סטטיסטיקות - {DataAdapter.getParameterDisplayName(selectedParameter)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4" dir="rtl">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{statistics.count}</div>
                    <div className="text-sm text-muted-foreground">נקודות</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{statistics.mean.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">ממוצע</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{statistics.std.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">סטיית תקן</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{statistics.min.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">מינימום</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{statistics.max.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">מקסימום</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{statistics.median.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">חציון</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{statistics.outliers}</div>
                    <div className="text-sm text-muted-foreground">חריגים</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{statistics.outlierPercentage.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">אחוז חריגים</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 justify-end">
                  {statistics.outliers > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={createOutlierSelection}
                      className="flex items-center gap-2"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      יצור סט חריגים
                    </Button>
                  )}
                  
                  {selectedRange && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={createSelectionFromRange}
                      className="flex items-center gap-2"
                    >
                      <Target className="h-4 w-4" />
                      יצור סט מטווח נבחר
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histogram */}
          <Card>
            <CardHeader>
              <CardTitle className="text-right">היסטוגרמה</CardTitle>
              <CardDescription className="text-right">
                גרור על הגרף לבחור טווח ערכים ליצירת Selection Set
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="range" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={10}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [value, 'כמות']}
                      labelFormatter={(label) => `טווח: ${label}`}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      stroke="hsl(var(--primary))"
                      strokeWidth={1}
                    />
                    <Brush
                      dataKey="range"
                      height={30}
                      stroke="hsl(var(--primary))"
                      onChange={handleBrushChange}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {selectedRange && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-right">
                      טווח נבחר: {selectedRange[0].toFixed(2)} - {selectedRange[1].toFixed(2)}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      {parameterData.filter(d => d.value >= selectedRange[0] && d.value <= selectedRange[1]).length} נקודות
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};