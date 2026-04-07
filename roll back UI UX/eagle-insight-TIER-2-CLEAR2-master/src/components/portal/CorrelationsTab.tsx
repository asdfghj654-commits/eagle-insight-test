// Correlations Tab - Correlation matrix and scatter plots
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Target, Activity } from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { DataAdapter } from '@/lib/data-adapter';
import { DemoDataButton } from './DemoDataButton';

export const CorrelationsTab: React.FC = () => {
  const { rawData, availableParameters, createSelectionSet } = useCSVData();
  const [correlationThreshold, setCorrelationThreshold] = useState([0.5]);
  const [selectedXParam, setSelectedXParam] = useState<string>('');
  const [selectedYParam, setSelectedYParam] = useState<string>('');
  const [selectedPoints, setSelectedPoints] = useState<any[]>([]);

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (x: number[], y: number[]): number => {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      sumSqX += deltaX * deltaX;
      sumSqY += deltaY * deltaY;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  };

  // Calculate correlation matrix
  const correlationMatrix = useMemo(() => {
    if (availableParameters.length < 2) return [];

    const matrix: Array<{
      paramX: string;
      paramY: string;
      correlation: number;
      significant: boolean;
    }> = [];

    // Get numeric data for all parameters
    const parameterData: Record<string, number[]> = {};
    availableParameters.forEach(param => {
      parameterData[param] = rawData
        .map(record => {
          const value = record[param];
          return typeof value === 'number' ? value : parseFloat(value) || 0;
        })
        .filter(val => !isNaN(val));
    });

    // Calculate pairwise correlations
    for (let i = 0; i < availableParameters.length; i++) {
      for (let j = i + 1; j < availableParameters.length; j++) {
        const paramX = availableParameters[i];
        const paramY = availableParameters[j];
        
        const dataX = parameterData[paramX];
        const dataY = parameterData[paramY];
        
        if (dataX.length > 0 && dataY.length > 0) {
          const correlation = calculateCorrelation(dataX, dataY);
          
          matrix.push({
            paramX,
            paramY,
            correlation,
            significant: Math.abs(correlation) >= correlationThreshold[0]
          });
        }
      }
    }

    return matrix.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [rawData, availableParameters, correlationThreshold]);

  // Get scatter plot data
  const scatterData = useMemo(() => {
    if (!selectedXParam || !selectedYParam) return [];

    const data: Array<{
      x: number;
      y: number;
      flight_id: string;
      tail_number: string;
      timestamp: string;
      phase: string;
    }> = [];

    rawData.forEach(record => {
      const xValue = record[selectedXParam];
      const yValue = record[selectedYParam];
      
      const xNum = typeof xValue === 'number' ? xValue : parseFloat(xValue);
      const yNum = typeof yValue === 'number' ? yValue : parseFloat(yValue);
      
      if (!isNaN(xNum) && !isNaN(yNum)) {
        data.push({
          x: xNum,
          y: yNum,
          flight_id: record.flight_id,
          tail_number: record.tail_number,
          timestamp: record.timestamp,
          phase: record.phase
        });
      }
    });

    return data;
  }, [rawData, selectedXParam, selectedYParam]);

  const getCorrelationColor = (correlation: number): string => {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'text-red-500';
    if (abs >= 0.6) return 'text-orange-500';
    if (abs >= 0.4) return 'text-yellow-500';
    if (abs >= 0.2) return 'text-blue-500';
    return 'text-gray-500';
  };

  const getCorrelationStrength = (correlation: number): string => {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'חזק מאוד';
    if (abs >= 0.6) return 'חזק';
    if (abs >= 0.4) return 'בינוני';
    if (abs >= 0.2) return 'חלש';
    return 'חלש מאוד';
  };

  const handleCorrelationClick = (paramX: string, paramY: string) => {
    setSelectedXParam(paramX);
    setSelectedYParam(paramY);
  };

  const createScatterSelection = () => {
    if (selectedPoints.length === 0 || !selectedXParam || !selectedYParam) return;

    const selectionId = createSelectionSet({
      name: `${DataAdapter.getParameterDisplayName(selectedXParam)} vs ${DataAdapter.getParameterDisplayName(selectedYParam)}`,
      color: '#10B981',
      description: `נקודות נבחרות מגרף פיזור (${selectedPoints.length} נקודות)`,
      type: 'lasso',
      data: selectedPoints,
      source: 'correlations',
      statistics: {
        count: selectedPoints.length
      }
    });

    console.log('Created scatter selection set:', selectionId);
    setSelectedPoints([]);
  };

  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <TrendingUp className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium text-center">אין נתונים לקורלציות</h3>
        <p className="text-muted-foreground text-center">טען נתוני דמו כדי לראות קורלציות בין פרמטרים</p>
        <DemoDataButton variant="default" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <Activity className="h-5 w-5" />
            הגדרות קורלציה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4" dir="rtl">
            <span className="text-sm">סף קורלציה מינימלי:</span>
            <Slider
              value={correlationThreshold}
              onValueChange={setCorrelationThreshold}
              min={0}
              max={1}
              step={0.1}
              className="flex-1 max-w-48"
            />
            <span className="text-sm w-12">{correlationThreshold[0].toFixed(1)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Correlation Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right">מטריצת קורלציות</CardTitle>
          <CardDescription className="text-right">
            לחץ על קורלציה כדי לפתוח גרף פיזור. רק קורלציות מעל הסף מוצגות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {correlationMatrix
              .filter(item => item.significant)
              .slice(0, 20) // Show top 20 correlations
              .map((item, index) => (
              <div
                key={`${item.paramX}-${item.paramY}`}
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleCorrelationClick(item.paramX, item.paramY)}
              >
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium">
                      {DataAdapter.getParameterDisplayName(item.paramX)} ↔ {DataAdapter.getParameterDisplayName(item.paramY)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      קורלציה {getCorrelationStrength(item.correlation)}
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${getCorrelationColor(item.correlation)}`}>
                    {item.correlation.toFixed(3)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.correlation > 0 ? 'חיובית' : 'שלילית'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {correlationMatrix.filter(item => item.significant).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו קורלציות מעל הסף שנבחר
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scatter Plot */}
      {selectedXParam && selectedYParam && (
        <Card>
          <CardHeader>
            <CardTitle className="text-right">גרף פיזור</CardTitle>
            <CardDescription className="text-right">
              {DataAdapter.getParameterDisplayName(selectedXParam)} vs {DataAdapter.getParameterDisplayName(selectedYParam)}
              <br />
              קורלציה: {correlationMatrix
                .find(item => 
                  (item.paramX === selectedXParam && item.paramY === selectedYParam) ||
                  (item.paramX === selectedYParam && item.paramY === selectedXParam)
                )?.correlation.toFixed(3) || 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  data={scatterData}
                  margin={{ top: 20, right: 30, bottom: 40, left: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name={DataAdapter.getParameterDisplayName(selectedXParam)}
                    label={{ 
                      value: DataAdapter.getParameterDisplayName(selectedXParam), 
                      position: 'insideBottom', 
                      offset: -10 
                    }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name={DataAdapter.getParameterDisplayName(selectedYParam)}
                    label={{ 
                      value: DataAdapter.getParameterDisplayName(selectedYParam), 
                      angle: -90, 
                      position: 'insideLeft' 
                    }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      typeof value === 'number' ? value.toFixed(3) : value,
                      name === 'x' ? DataAdapter.getParameterDisplayName(selectedXParam) : 
                      name === 'y' ? DataAdapter.getParameterDisplayName(selectedYParam) : name
                    ]}
                    labelFormatter={() => ''}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                            <div className="space-y-1 text-right">
                              <div><strong>טיסה:</strong> {data.flight_id}</div>
                              <div><strong>זנב:</strong> {data.tail_number}</div>
                              <div><strong>שלב:</strong> {data.phase}</div>
                              <div><strong>{DataAdapter.getParameterDisplayName(selectedXParam)}:</strong> {data.x.toFixed(3)}</div>
                              <div><strong>{DataAdapter.getParameterDisplayName(selectedYParam)}:</strong> {data.y.toFixed(3)}</div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter 
                    name="Data Points" 
                    data={scatterData} 
                    fill="hsl(var(--primary))"
                    opacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="flex gap-2 mt-4 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedXParam('');
                  setSelectedYParam('');
                }}
              >
                נקה בחירה
              </Button>
              
              {selectedPoints.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={createScatterSelection}
                  className="flex items-center gap-2"
                >
                  <Target className="h-4 w-4" />
                  יצור סט מנקודות נבחרות ({selectedPoints.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};