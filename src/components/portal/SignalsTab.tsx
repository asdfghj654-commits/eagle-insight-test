import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCSVData } from "@/contexts/CSVDataContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Brush } from 'recharts';
import { SelectionSetsPanel } from './SelectionSetsPanel';
import { StatsBar } from './StatsBar';
import { PhaseBandsToggle } from './PhaseBandsToggle';
import { EnvelopeToggle } from './EnvelopeToggle';
import { GraphEditor } from './GraphEditor';
import { FullScreenModal } from './FullScreenModal';
import { getParameterCategory, PARAMETER_CATEGORIES, getParameterLabel, formatParameterValue } from '@/lib/parameter-categories';
import { DataAdapter } from '@/lib/data-adapter';
import { Activity, Layers, Target, Maximize2, ChevronDown, Settings, Info } from 'lucide-react';

const PARAMETER_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(220, 70%, 50%)',
  'hsl(120, 60%, 50%)',
  'hsl(280, 60%, 50%)',
];

export const SignalsTab: React.FC = memo(() => {
  const {
    processedFlights,
    availableParameters,
    selectionSets,
    createSelectionSet,
  } = useCSVData();

  const parameterPriority = useMemo(
    () =>
      [...availableParameters].sort((left, right) => {
        const leftScore = getParameterCategory(left) === 'other' ? 1 : 0;
        const rightScore = getParameterCategory(right) === 'other' ? 1 : 0;
        return leftScore - rightScore || left.localeCompare(right);
      }),
    [availableParameters],
  );

  const [selectedParameters, setSelectedParameters] = useState<string[]>(parameterPriority.slice(0, 4));
  const [selectedFlight, setSelectedFlight] = useState<string>('all');
  const [brushDomain, setBrushDomain] = useState<[number, number] | null>(null);
  const [showPhaseBands, setShowPhaseBands] = useState(true);
  const [showEnvelopes, setShowEnvelopes] = useState(true);
  const [showGraphEditor, setShowGraphEditor] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);

  useEffect(() => {
    setSelectedParameters((current) => {
      const validCurrent = current.filter((parameter) => availableParameters.includes(parameter));
      if (validCurrent.length > 0) {
        return validCurrent;
      }
      return parameterPriority.slice(0, 4);
    });
  }, [availableParameters, parameterPriority]);

  const chartData = useMemo(() => {
    if (selectedParameters.length === 0 || processedFlights.length === 0) return [];

    const allDataPoints: any[] = [];

    processedFlights
      .filter((flight) => selectedFlight === 'all' || flight.flight_id === selectedFlight)
      .forEach((flight) => {
        flight.records.forEach((record) => {
          const timestamp = new Date(record.timestamp).getTime();
          if (isNaN(timestamp)) return;

          const dataPoint: any = {
            timestamp,
            flight_id: record.flight_id,
            phase: record.phase,
          };

          selectedParameters.forEach((param) => {
            const value = record[param];
            if (value !== undefined && value !== null) {
              const numericValue = typeof value === 'number' ? value : parseFloat(value);
              dataPoint[param] = isNaN(numericValue) ? null : numericValue;
            } else {
              dataPoint[param] = null;
            }
          });

          allDataPoints.push(dataPoint);
        });
      });

    return allDataPoints.sort((a, b) => a.timestamp - b.timestamp);
  }, [processedFlights, selectedFlight, selectedParameters]);

  const categorizedParameters = useMemo(() => {
    const categories: Record<string, string[]> = {};
    availableParameters.forEach((param) => {
      const category = getParameterCategory(param);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(param);
    });
    return categories;
  }, [availableParameters]);

  const handleParameterToggle = useCallback((parameter: string) => {
    setSelectedParameters((prev) => {
      if (prev.includes(parameter)) {
        return prev.filter((item) => item !== parameter);
      }
      return prev.length < 10 ? [...prev, parameter] : prev;
    });
  }, []);

  const handleBrushChange = useCallback((brushData: any) => {
    if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      const start = chartData[brushData.startIndex]?.timestamp;
      const end = chartData[brushData.endIndex]?.timestamp;
      if (start && end) {
        setBrushDomain([start, end]);

        const selectedData = chartData.slice(brushData.startIndex, brushData.endIndex + 1);
        const startTime = new Date(start);
        const endTime = new Date(end);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));
        const durationText =
          durationMinutes < 60
            ? `${durationMinutes} דק`
            : `${Math.floor(durationMinutes / 60)}:${(durationMinutes % 60).toString().padStart(2, '0')} שע`;

        createSelectionSet({
          name: `טווח: ${startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}-${endTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (${startTime.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}) | ${durationText}`,
          color: PARAMETER_COLORS[0],
          type: 'time-range',
          data: selectedData,
          source: 'signals',
        });
      }
    }
  }, [chartData, createSelectionSet]);

  const formatTimestamp = useCallback((tickItem: any) => new Date(tickItem).toLocaleTimeString('he-IL'), []);

  if (processedFlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Activity className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium text-center">אין נתוני טיסה זמינים</h3>
        <p className="text-muted-foreground text-center">העלה נתונים מאושרים כדי לראות גרפים וסיגנלים</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger>
                <PhaseBandsToggle enabled={showPhaseBands} onToggle={setShowPhaseBands} />
              </TooltipTrigger>
              <TooltipContent>
                <p>הצג רצועות שלבי טיסה על הגרף</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <EnvelopeToggle enabled={showEnvelopes} onToggle={setShowEnvelopes} />
              </TooltipTrigger>
              <TooltipContent>
                <p>הצג מעטפות תפעוליות</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <Activity className="h-3 w-3 mr-1" />
              {chartData.length} נקודות
            </Badge>
            <Badge variant="outline">
              <Layers className="h-3 w-3 mr-1" />
              {selectedFlight === 'all' ? processedFlights.length : 1} טיסות
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-9 space-y-4">
            <Card>
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        פרמטרים מוצגים ({selectedParameters.length}/10)
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>בחר עד 10 פרמטרים להצגה בו זמנית</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3" dir="rtl">
                      <span className="text-sm font-medium">מיקוד טיסה</span>
                      <select
                        value={selectedFlight}
                        onChange={(event) => setSelectedFlight(event.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="all">כל הטיסות</option>
                        {processedFlights.map((flight) => (
                          <option key={flight.flight_id} value={flight.flight_id}>
                            {flight.flight_id} | {flight.tail_number}
                          </option>
                        ))}
                      </select>
                    </div>

                    {Object.entries(categorizedParameters).map(([categoryKey, params]) => {
                      const category = PARAMETER_CATEGORIES[categoryKey];
                      return (
                        <div key={categoryKey} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <category.icon className="h-4 w-4" style={{ color: category.color }} />
                            <span className="text-sm font-medium">{category.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {params.filter((param) => selectedParameters.includes(param)).length}/{params.length}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 mr-6">
                            {params.map((param) => (
                              <div key={param} className="flex items-center gap-1">
                                <Checkbox
                                  checked={selectedParameters.includes(param)}
                                  onCheckedChange={() => handleParameterToggle(param)}
                                  className="h-4 w-4"
                                />
                                <Button
                                  variant={selectedParameters.includes(param) ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleParameterToggle(param)}
                                  className="text-xs max-w-[220px] truncate"
                                  title={DataAdapter.getParameterDisplayName(param)}
                                  style={selectedParameters.includes(param) ? {
                                    backgroundColor: PARAMETER_COLORS[selectedParameters.indexOf(param)],
                                    borderColor: PARAMETER_COLORS[selectedParameters.indexOf(param)],
                                  } : {}}
                                >
                                  {DataAdapter.getParameterDisplayName(param)}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    גרפים מסונכרנים
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowGraphEditor(true)}>
                      <Settings className="h-4 w-4" />
                      עריכה מתקדמת
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowFullScreen(true)}>
                      <Maximize2 className="h-4 w-4" />
                      מסך מלא
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedParameters.length > 0 ? (
                  <div className="h-96 cursor-pointer transition-all hover:shadow-lg rounded-lg" onClick={() => setShowGraphEditor(true)}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="signals">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={formatTimestamp}
                          type="number"
                          scale="time"
                          domain={brushDomain || ['dataMin', 'dataMax']}
                        />
                        <YAxis />
                        <ChartTooltip
                          labelFormatter={(value) => `זמן: ${new Date(value).toLocaleString('he-IL')}`}
                          formatter={(value: any, name: string) => [formatParameterValue(name, value), getParameterLabel(name, false)]}
                          contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                        />

                        {selectedParameters.map((param, index) => (
                          <Line
                            key={param}
                            type="monotone"
                            dataKey={param}
                            stroke={PARAMETER_COLORS[index % PARAMETER_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                          />
                        ))}

                        <Brush
                          dataKey="timestamp"
                          height={30}
                          stroke="hsl(var(--primary))"
                          onChange={handleBrushChange}
                          tickFormatter={formatTimestamp}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-96 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>בחר פרמטרים להצגה מהרשימה למעלה</p>
                      <p className="text-sm mt-1">ניתן לבחור עד 10 פרמטרים בו-זמנית</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <StatsBar
              data={brushDomain ? chartData.filter((item) => item.timestamp >= brushDomain[0] && item.timestamp <= brushDomain[1]) : chartData}
              parameters={selectedParameters}
            />
          </div>

          <div className="col-span-3">
            <SelectionSetsPanel />
          </div>
        </div>

        <GraphEditor
          isOpen={showGraphEditor}
          onClose={() => setShowGraphEditor(false)}
          initialData={chartData}
          initialParameters={selectedParameters}
        />

        <FullScreenModal
          isOpen={showFullScreen}
          onClose={() => setShowFullScreen(false)}
          data={chartData}
          parameters={selectedParameters}
          colors={PARAMETER_COLORS}
          title="גרפים מסונכרנים"
        />
      </div>
    </TooltipProvider>
  );
});
