import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Brush } from 'recharts';
import { useCSVData } from "@/contexts/CSVDataContext";
import { Settings, Palette, TrendingUp, Save, X, Plus, AlertCircle } from 'lucide-react';
import { getParameterCategory, PARAMETER_CATEGORIES, getParameterLabel, formatParameterValue } from '@/lib/parameter-categories';
import { getSeriesColor } from '@/lib/chart-colors';

interface GraphEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: any[];
  initialParameters: string[];
}

const PARAMETER_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(220, 70%, 50%)',
  'hsl(120, 60%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(30, 80%, 55%)',
  'hsl(180, 65%, 45%)',
  'hsl(350, 75%, 55%)',
  'hsl(60, 70%, 50%)',
];

export const GraphEditor: React.FC<GraphEditorProps> = ({
  isOpen,
  onClose,
  initialData,
  initialParameters
}) => {
  const { availableParameters, createSelectionSet } = useCSVData();
  const [selectedParameters, setSelectedParameters] = useState<string[]>(initialParameters);
  const [yAxisMode, setYAxisMode] = useState<'single' | 'normalized' | 'dual'>('normalized');
  const [secondaryYParams, setSecondaryYParams] = useState<string[]>([]);
  const [overlayParams, setOverlayParams] = useState<string[]>([]);
  const [lineStyles, setLineStyles] = useState<Record<string, { width: number; type: 'solid' | 'dashed' | 'dotted' }>>({});
  const [brushDomain, setBrushDomain] = useState<[number, number] | null>(null);

  // Check if parameter has data - prevents empty layers
  const hasDataForParameter = useCallback((param: string): boolean => {
    return initialData.some(point => 
      point[param] !== null && 
      point[param] !== undefined &&
      !isNaN(parseFloat(point[param]))
    );
  }, [initialData]);

  // Categorize parameters
  const categorizedParams = useMemo(() => {
    const categories: Record<string, string[]> = {};
    availableParameters.forEach(param => {
      const category = getParameterCategory(param);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(param);
    });
    return categories;
  }, [availableParameters]);

  // Per-param min/max for normalization (0-100 scale)
  const paramRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number }> = {};
    [...selectedParameters, ...overlayParams].forEach(param => {
      const vals = initialData
        .map(d => d[param])
        .filter((v): v is number => v != null && typeof v === 'number' && isFinite(v));
      if (vals.length > 0) {
        ranges[param] = { min: Math.min(...vals), max: Math.max(...vals) };
      }
    });
    return ranges;
  }, [initialData, selectedParameters, overlayParams]);

  // Enhanced chart data with all parameters
  const chartData = useMemo(() => {
    if (!initialData.length) return [];
    return initialData.map(point => {
      const enhanced = { ...point };
      [...selectedParameters, ...overlayParams].forEach(param => {
        if (enhanced[param] === undefined) enhanced[param] = null;

        // Add normalized version
        if (yAxisMode === 'normalized' && enhanced[param] != null && paramRanges[param]) {
          const { min, max } = paramRanges[param];
          const span = max - min || 1;
          enhanced[`${param}__norm`] = ((enhanced[param] - min) / span) * 100;
        }
      });
      return enhanced;
    }).filter(point => point.timestamp);
  }, [initialData, selectedParameters, overlayParams, yAxisMode, paramRanges]);

  const handleParameterToggle = (parameter: string, isOverlay = false) => {
    if (isOverlay) {
      setOverlayParams(prev => 
        prev.includes(parameter) 
          ? prev.filter(p => p !== parameter)
          : [...prev, parameter]
      );
    } else {
      setSelectedParameters(prev => {
        if (prev.includes(parameter)) {
          return prev.filter(p => p !== parameter);
        } else {
          return prev.length < 10 ? [...prev, parameter] : prev;
        }
      });
    }
  };

  const handleSecondaryYToggle = (parameter: string) => {
    setSecondaryYParams(prev =>
      prev.includes(parameter)
        ? prev.filter(p => p !== parameter)
        : [...prev, parameter]
    );
  };

  const getParameterColor = (param: string, index: number): string => {
    return PARAMETER_COLORS[index % PARAMETER_COLORS.length];
  };

  const handleBrushChange = (brushData: any) => {
    if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      const start = chartData[brushData.startIndex]?.timestamp;
      const end = chartData[brushData.endIndex]?.timestamp;
      if (start && end) {
        setBrushDomain([start, end]);
        
        // Create selection set from brush
        const selectedData = chartData.slice(brushData.startIndex, brushData.endIndex + 1);
        const startTime = new Date(start);
        const endTime = new Date(end);
        
        createSelectionSet({
          name: `עריכת גרף: ${startTime.toLocaleDateString('he-IL')} ${startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}-${endTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
          color: PARAMETER_COLORS[0],
          type: 'time-range',
          data: selectedData,
          source: 'signals'
        });
      }
    }
  };

  const formatTimestamp = (tickItem: any) => {
    return new Date(tickItem).toLocaleTimeString('he-IL');
  };

  const allDisplayedParams = [...selectedParameters, ...overlayParams];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            עורך גרפים מתקדם
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-12 gap-6">
          {/* Parameters Panel */}
          <div className="col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  פרמטרים עיקריים ({selectedParameters.length}/10)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(categorizedParams).map(([categoryKey, params]) => {
                  const category = PARAMETER_CATEGORIES[categoryKey];
                  return (
                    <div key={categoryKey} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <category.icon className="h-4 w-4" style={{ color: category.color }} />
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      <div className="space-y-1 mr-6">
                        {params.map((param) => {
                          const hasData = hasDataForParameter(param);
                          return (
                            <TooltipProvider key={param}>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedParameters.includes(param)}
                                  onCheckedChange={() => handleParameterToggle(param)}
                                  disabled={!hasData && !selectedParameters.includes(param)}
                                  className="h-4 w-4"
                                />
                                <span className={`text-xs ${!hasData ? 'opacity-50' : ''}`}>
                                  {getParameterLabel(param, true)}
                                </span>
                                {!hasData && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertCircle className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>אין נתונים זמינים לפרמטר זה</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {yAxisMode === 'dual' && selectedParameters.includes(param) && (
                                  <Checkbox
                                    checked={secondaryYParams.includes(param)}
                                    onCheckedChange={() => handleSecondaryYToggle(param)}
                                    className="h-3 w-3"
                                  />
                                )}
                              </div>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  שכבות נוספות ({overlayParams.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {availableParameters.map((param) => (
                  <div key={param} className="flex items-center gap-2">
                    <Checkbox
                      checked={overlayParams.includes(param)}
                      onCheckedChange={() => handleParameterToggle(param, true)}
                      className="h-4 w-4"
                    />
                    <span className="text-xs opacity-70">{param}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  הגדרות תצוגה
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium">מצב צירים:</label>
                  <Select value={yAxisMode} onValueChange={(value: 'single' | 'normalized' | 'dual') => setYAxisMode(value)}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normalized">מנורמל 0-100% (מומלץ)</SelectItem>
                      <SelectItem value="single">ציר Y יחיד (ערכים מוחלטים)</SelectItem>
                      <SelectItem value="dual">2 צירי Y</SelectItem>
                    </SelectContent>
                  </Select>
                  {yAxisMode === 'normalized' && (
                    <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                      כל פרמטר מוצג כ-% מהטווח שלו — מאפשר השוואה בין פרמטרים בסקאלות שונות
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graph Area */}
          <div className="col-span-9 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    גרף אינטראקטיבי מותאם
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {allDisplayedParams.map((param, index) => (
                      <Badge 
                        key={param}
                        variant="outline"
                        style={{ 
                          borderColor: getParameterColor(param, index),
                          color: getParameterColor(param, index)
                        }}
                        className="text-xs"
                      >
                        {param}
                        {secondaryYParams.includes(param) && " (Y2)"}
                        {overlayParams.includes(param) && " (שכבה)"}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {allDisplayedParams.length > 0 ? (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="timestamp"
                          tickFormatter={formatTimestamp}
                          type="number"
                          scale="time"
                          domain={brushDomain || ['dataMin', 'dataMax']}
                        />
                        <YAxis
                          yAxisId="left"
                          domain={yAxisMode === 'normalized' ? [0, 100] : ['auto', 'auto']}
                          tickFormatter={yAxisMode === 'normalized' ? (v) => `${v}%` : undefined}
                          label={yAxisMode === 'normalized' ? { value: '% טווח', angle: -90, position: 'insideLeft', fontSize: 10 } : undefined}
                        />
                        {yAxisMode === 'dual' && <YAxis yAxisId="right" orientation="right" />}

                        <ChartTooltip
                          labelFormatter={(value) => `זמן: ${new Date(value).toLocaleString('he-IL')}`}
                          formatter={(value: any, name: string) => {
                            // Strip __norm suffix for display
                            const realParam = name.endsWith('__norm') ? name.replace('__norm', '') : name;
                            if (yAxisMode === 'normalized') {
                              const range = paramRanges[realParam];
                              const rawVal = range ? range.min + ((value / 100) * (range.max - range.min)) : value;
                              return [`${Number(rawVal).toFixed(2)} (${Number(value).toFixed(1)}%)`, getParameterLabel(realParam, false)];
                            }
                            return [formatParameterValue(realParam, value), getParameterLabel(realParam, false)];
                          }}
                          contentStyle={{ direction: 'rtl', textAlign: 'right' }}
                        />

                        {allDisplayedParams.map((param, index) => {
                          const dataKey = yAxisMode === 'normalized' ? `${param}__norm` : param;
                          return (
                            <Line
                              key={param}
                              yAxisId={secondaryYParams.includes(param) ? 'right' : 'left'}
                              type="monotone"
                              dataKey={dataKey}
                              name={param}
                              stroke={getParameterColor(param, index)}
                              strokeWidth={overlayParams.includes(param) ? 1 : 2}
                              strokeDasharray={overlayParams.includes(param) ? '5,5' : '0'}
                              dot={false}
                              connectNulls={false}
                              opacity={overlayParams.includes(param) ? 0.6 : 1}
                            />
                          );
                        })}
                        
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
                    בחר פרמטרים להצגה מהפאנל הימני
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 ml-1" />
                סגור
              </Button>
              <Button onClick={onClose}>
                <Save className="h-4 w-4 ml-1" />
                שמור תצוגה
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};