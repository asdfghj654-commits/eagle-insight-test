// Correlations Tab — scatter analysis with regression, confidence band, outlier detection
// UX pattern inspired by Streamlit Movies demo: scatter + side histograms + sigma slider +
// outlier-first review + top/bottom correlation pairs.
// Data source: Apache-2.0 / UW IDL inspiration for interaction grammar only.
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, BarChart, Bar,
} from 'recharts';
import { TrendingUp, Target, Activity, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { DataAdapter } from '@/lib/data-adapter';

// ─── Regression helpers ───────────────────────────────────────────────────────

interface RegressionResult {
  slope: number;
  intercept: number;
  stdDev: number;
  rSquared: number;
}

function computeLinearRegression(data: { x: number; y: number }[]): RegressionResult | null {
  const n = data.length;
  if (n < 3) return null;

  const sumX  = data.reduce((s, p) => s + p.x, 0);
  const sumY  = data.reduce((s, p) => s + p.y, 0);
  const sumXY = data.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = data.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const predictions = data.map(p => slope * p.x + intercept);
  const residuals   = data.map((p, i) => p.y - predictions[i]);
  const ssRes       = residuals.reduce((s, r) => s + r * r, 0);
  const stdDev      = Math.sqrt(ssRes / n);

  const meanY = sumY / n;
  const ssTot = data.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, stdDev, rSquared };
}

function buildHistogram(values: number[], bins = 20): { bin: string; count: number }[] {
  if (values.length === 0) return [];
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const step = (max - min) / bins || 1;
  const counts = Array(bins).fill(0);
  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    counts[idx]++;
  });
  return counts.map((count, i) => ({
    bin: (min + i * step).toFixed(1),
    count,
  }));
}

// ─── Pearson correlation ──────────────────────────────────────────────────────

function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const meanX = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanY = y.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, sqX = 0, sqY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX, dy = y[i] - meanY;
    num += dx * dy; sqX += dx * dx; sqY += dy * dy;
  }
  const denom = Math.sqrt(sqX * sqY);
  return denom === 0 ? 0 : num / denom;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const CorrelationsTab: React.FC = () => {
  const { rawData, availableParameters, createSelectionSet } = useCSVData();

  const [correlationThreshold, setCorrelationThreshold] = useState([0.5]);
  const [sigmaThreshold,       setSigmaThreshold]       = useState([2.0]);
  const [regressionMode, setRegressionMode] = useState<'linear' | 'none'>('linear');
  const [selectedXParam, setSelectedXParam] = useState('');
  const [selectedYParam, setSelectedYParam] = useState('');

  // ── Correlation matrix ────────────────────────────────────────────────────
  const correlationMatrix = useMemo(() => {
    if (availableParameters.length < 2) return [];
    const paramData: Record<string, number[]> = {};
    availableParameters.forEach(p => {
      paramData[p] = rawData
        .map(r => { const v = r[p]; return typeof v === 'number' ? v : parseFloat(v); })
        .filter(v => !isNaN(v));
    });
    const matrix: { paramX: string; paramY: string; correlation: number; significant: boolean }[] = [];
    for (let i = 0; i < availableParameters.length; i++) {
      for (let j = i + 1; j < availableParameters.length; j++) {
        const px = availableParameters[i], py = availableParameters[j];
        if (paramData[px].length > 0 && paramData[py].length > 0) {
          const correlation = calculateCorrelation(paramData[px], paramData[py]);
          matrix.push({ paramX: px, paramY: py, correlation, significant: Math.abs(correlation) >= correlationThreshold[0] });
        }
      }
    }
    return matrix.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [rawData, availableParameters, correlationThreshold]);

  // ── Scatter data ──────────────────────────────────────────────────────────
  const rawScatterData = useMemo(() => {
    if (!selectedXParam || !selectedYParam) return [];
    const out: { x: number; y: number; flight_id: string; tail_number: string; phase: string }[] = [];
    rawData.forEach(r => {
      const xv = r[selectedXParam], yv = r[selectedYParam];
      const x = typeof xv === 'number' ? xv : parseFloat(xv);
      const y = typeof yv === 'number' ? yv : parseFloat(yv);
      if (!isNaN(x) && !isNaN(y))
        out.push({ x, y, flight_id: r.flight_id, tail_number: r.tail_number, phase: r.phase });
    });
    return out;
  }, [rawData, selectedXParam, selectedYParam]);

  // ── Regression ────────────────────────────────────────────────────────────
  const regression = useMemo(() =>
    regressionMode === 'linear' ? computeLinearRegression(rawScatterData) : null,
    [rawScatterData, regressionMode],
  );

  // Scatter with outlier flags
  const scatterData = useMemo(() => {
    if (!regression) return rawScatterData.map(p => ({ ...p, isOutlier: false, residual: 0 }));
    const sigma = sigmaThreshold[0] * regression.stdDev;
    return rawScatterData.map(p => {
      const predicted = regression.slope * p.x + regression.intercept;
      const residual  = Math.abs(p.y - predicted);
      return { ...p, isOutlier: residual > sigma, residual };
    });
  }, [rawScatterData, regression, sigmaThreshold]);

  const outlierCount  = useMemo(() => scatterData.filter(p => p.isOutlier).length, [scatterData]);
  const outlierPoints = useMemo(() => scatterData.filter(p => p.isOutlier).sort((a, b) => b.residual - a.residual).slice(0, 10), [scatterData]);

  // Regression line + confidence band
  const { regressionLineData, upperBandData, lowerBandData } = useMemo(() => {
    if (!regression || rawScatterData.length === 0)
      return { regressionLineData: [], upperBandData: [], lowerBandData: [] };
    const xs    = rawScatterData.map(d => d.x);
    const xMin  = Math.min(...xs), xMax = Math.max(...xs);
    const sigma = sigmaThreshold[0] * regression.stdDev;
    const pts   = Array.from({ length: 51 }, (_, i) => {
      const x = xMin + (i / 50) * (xMax - xMin);
      const y = regression.slope * x + regression.intercept;
      return { x, y, upper: y + sigma, lower: y - sigma };
    });
    return {
      regressionLineData: pts.map(p => ({ x: p.x, y: p.y })),
      upperBandData:      pts.map(p => ({ x: p.x, y: p.upper })),
      lowerBandData:      pts.map(p => ({ x: p.x, y: p.lower })),
    };
  }, [regression, rawScatterData, sigmaThreshold]);

  // Side histograms
  const xHistData = useMemo(() => buildHistogram(rawScatterData.map(d => d.x)), [rawScatterData]);
  const yHistData = useMemo(() => buildHistogram(rawScatterData.map(d => d.y)), [rawScatterData]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const corrColor = (c: number) => {
    const a = Math.abs(c);
    if (a >= 0.8) return 'text-red-500';
    if (a >= 0.6) return 'text-orange-500';
    if (a >= 0.4) return 'text-yellow-500';
    if (a >= 0.2) return 'text-blue-500';
    return 'text-muted-foreground';
  };
  const corrLabel = (c: number) => {
    const a = Math.abs(c);
    if (a >= 0.8) return 'חזק מאוד';
    if (a >= 0.6) return 'חזק';
    if (a >= 0.4) return 'בינוני';
    if (a >= 0.2) return 'חלש';
    return 'חלש מאוד';
  };

  const xLabel = DataAdapter.getParameterDisplayName(selectedXParam);
  const yLabel = DataAdapter.getParameterDisplayName(selectedYParam);

  const selectedCorr = correlationMatrix.find(
    c => (c.paramX === selectedXParam && c.paramY === selectedYParam) ||
         (c.paramX === selectedYParam && c.paramY === selectedXParam),
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-background border border-border p-3 rounded-lg shadow-lg text-xs space-y-1" dir="rtl">
        <div className="font-semibold text-muted-foreground mb-1">
          {d.isOutlier ? <span className="text-red-500">⚠ חריג</span> : 'נקודת נתון'}
        </div>
        <div><strong>טיסה:</strong> {d.flight_id}</div>
        <div><strong>זנב:</strong> {d.tail_number}</div>
        <div><strong>שלב:</strong> {d.phase}</div>
        <div><strong>{xLabel}:</strong> {typeof d.x === 'number' ? d.x.toFixed(3) : d.x}</div>
        <div><strong>{yLabel}:</strong> {typeof d.y === 'number' ? d.y.toFixed(3) : d.y}</div>
        {d.isOutlier && <div className="text-red-400"><strong>סטייה:</strong> {d.residual?.toFixed(3)}</div>}
      </div>
    );
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <TrendingUp className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium text-center">אין נתונים לקורלציות</h3>
        <p className="text-muted-foreground text-center">העלה נתונים מאושרים כדי לראות קורלציות בין פרמטרים</p>
      </div>
    );
  }

  const significantCorrs = correlationMatrix.filter(c => c.significant);

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Controls ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            הגדרות ניתוח
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Correlation threshold */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>סף קורלציה מינימלי</span>
                <span className="font-mono font-medium">{correlationThreshold[0].toFixed(1)}</span>
              </div>
              <Slider value={correlationThreshold} onValueChange={setCorrelationThreshold} min={0} max={1} step={0.05} />
            </div>
            {/* Sigma threshold */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>סף סיגמה (זיהוי חריגים)</span>
                <span className="font-mono font-medium">{sigmaThreshold[0].toFixed(1)}σ</span>
              </div>
              <Slider value={sigmaThreshold} onValueChange={setSigmaThreshold} min={0.5} max={4} step={0.1} />
            </div>
            {/* Regression mode */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">מצב ריגרסיה</div>
              <div className="flex rounded-md border overflow-hidden text-xs h-9">
                {(['linear', 'none'] as const).map(mode => (
                  <button
                    key={mode}
                    className={`flex-1 px-3 transition-colors ${
                      regressionMode === mode
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted'
                    }`}
                    onClick={() => setRegressionMode(mode)}
                  >
                    {mode === 'linear' ? 'רגרסיה לינארית' : 'ללא'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Top/Bottom correlation pairs ── */}
      {significantCorrs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top positive */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-primary" />
                קורלציות חזקות ביותר
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {significantCorrs.slice(0, 5).map(item => (
                  <button
                    key={`${item.paramX}-${item.paramY}`}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-right"
                    onClick={() => { setSelectedXParam(item.paramX); setSelectedYParam(item.paramY); }}
                  >
                    <div className="text-right min-w-0">
                      <div className="text-xs font-medium truncate">
                        {DataAdapter.getParameterDisplayName(item.paramX)} ↔ {DataAdapter.getParameterDisplayName(item.paramY)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{corrLabel(item.correlation)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                      <div className={`text-sm font-bold tabular-nums ${corrColor(item.correlation)}`}>
                        {item.correlation.toFixed(3)}
                      </div>
                      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${Math.abs(item.correlation) >= 0.8 ? 'bg-red-500' : Math.abs(item.correlation) >= 0.6 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                          style={{ width: `${Math.abs(item.correlation) * 100}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weakest / interesting */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                קורלציות חלשות ביותר (מעל הסף)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {[...significantCorrs].reverse().slice(0, 5).map(item => (
                  <button
                    key={`${item.paramX}-${item.paramY}-weak`}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-right"
                    onClick={() => { setSelectedXParam(item.paramX); setSelectedYParam(item.paramY); }}
                  >
                    <div className="text-right min-w-0">
                      <div className="text-xs font-medium truncate">
                        {DataAdapter.getParameterDisplayName(item.paramX)} ↔ {DataAdapter.getParameterDisplayName(item.paramY)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{corrLabel(item.correlation)}</div>
                    </div>
                    <div className={`text-sm font-bold tabular-nums flex-shrink-0 mr-2 ${corrColor(item.correlation)}`}>
                      {item.correlation.toFixed(3)}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {significantCorrs.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            לא נמצאו קורלציות מעל הסף {correlationThreshold[0].toFixed(1)}
          </CardContent>
        </Card>
      )}

      {/* ── Scatter analysis panel ── */}
      {selectedXParam && selectedYParam && (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold tabular-nums">{scatterData.length}</div>
                <div className="text-xs text-muted-foreground">נקודות נתון</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className={`text-2xl font-bold tabular-nums ${corrColor(selectedCorr?.correlation ?? 0)}`}>
                  {selectedCorr ? selectedCorr.correlation.toFixed(3) : '—'}
                </div>
                <div className="text-xs text-muted-foreground">מקדם קורלציה (r)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold tabular-nums">
                  {regression ? regression.rSquared.toFixed(3) : '—'}
                </div>
                <div className="text-xs text-muted-foreground">R² (מקדם דטרמינציה)</div>
              </CardContent>
            </Card>
            <Card className={outlierCount > 0 ? 'border-red-200 bg-red-50/30 dark:bg-red-900/10' : ''}>
              <CardContent className="pt-4 pb-3">
                <div className={`text-2xl font-bold tabular-nums ${outlierCount > 0 ? 'text-red-500' : ''}`}>
                  {outlierCount}
                </div>
                <div className="text-xs text-muted-foreground">חריגים ({sigmaThreshold[0].toFixed(1)}σ)</div>
              </CardContent>
            </Card>
          </div>

          {/* Main scatter chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {xLabel} vs {yLabel}
                </CardTitle>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary/50" />
                    תוך טווח
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                    חריגים ({outlierCount})
                  </span>
                  {regression && (
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-4 border-t border-primary" style={{ display: 'inline-block', width: 14, borderTop: '2px solid hsl(var(--primary))' }} />
                      רגרסיה
                    </span>
                  )}
                </div>
              </div>
              {regression && (
                <CardDescription className="text-[11px]">
                  y = {regression.slope.toFixed(3)}x + {regression.intercept.toFixed(3)} | σ = {regression.stdDev.toFixed(3)}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart margin={{ top: 10, right: 20, bottom: 40, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={['auto', 'auto']}
                      label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 11 }}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      domain={['auto', 'auto']}
                      label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 }}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Regression line */}
                    {regression && regressionMode === 'linear' && (
                      <Line
                        data={regressionLineData}
                        dataKey="y"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        dot={false}
                        type="linear"
                        isAnimationActive={false}
                        activeDot={false}
                        legendType="none"
                      />
                    )}
                    {/* Upper confidence bound */}
                    {regression && regressionMode === 'linear' && (
                      <Line
                        data={upperBandData}
                        dataKey="y"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        type="linear"
                        isAnimationActive={false}
                        activeDot={false}
                        legendType="none"
                        opacity={0.35}
                      />
                    )}
                    {/* Lower confidence bound */}
                    {regression && regressionMode === 'linear' && (
                      <Line
                        data={lowerBandData}
                        dataKey="y"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        type="linear"
                        isAnimationActive={false}
                        activeDot={false}
                        legendType="none"
                        opacity={0.35}
                      />
                    )}

                    {/* Scatter points colored by outlier status */}
                    <Scatter data={scatterData} isAnimationActive={false}>
                      {scatterData.map((p, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={p.isOutlier ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                          fillOpacity={p.isOutlier ? 0.85 : 0.45}
                          r={p.isOutlier ? 4 : 3}
                        />
                      ))}
                    </Scatter>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Side histograms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">
                  התפלגות — {xLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={xHistData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="bin" hide />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v: any) => [v, 'תדירות']}
                        labelFormatter={(l) => `ערך: ${l}`}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">
                  התפלגות — {yLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yHistData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="bin" hide />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v: any) => [v, 'תדירות']}
                        labelFormatter={(l) => `ערך: ${l}`}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Outlier table */}
          {outlierPoints.length > 0 && (
            <Card className="border-red-200 dark:border-red-800/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  נקודות חריגות ({outlierCount} מתוך {scatterData.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  נקודות מחוץ לרצועת {sigmaThreshold[0].toFixed(1)}σ סביב קו הרגרסיה — ממוינות לפי סטייה
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">#</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">זנב</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">שלב</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">{xLabel}</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">{yLabel}</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">סטייה</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {outlierPoints.map((p, i) => (
                        <tr key={i} className="hover:bg-red-50/30 dark:hover:bg-red-900/10">
                          <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2 font-mono">{p.tail_number}</td>
                          <td className="px-4 py-2">{p.phase}</td>
                          <td className="px-4 py-2 tabular-nums">{p.x.toFixed(3)}</td>
                          <td className="px-4 py-2 tabular-nums">{p.y.toFixed(3)}</td>
                          <td className="px-4 py-2 tabular-nums text-red-500 font-medium">{p.residual.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedXParam(''); setSelectedYParam(''); }}
              className="text-xs"
            >
              <Target className="h-3.5 w-3.5 ml-1" />
              נקה בחירה
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
