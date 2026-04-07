// Correlations Tab — scatter analysis with regression, confidence band, outlier detection
// UX pattern inspired by Streamlit Movies demo: scatter + side histograms + sigma slider +
// outlier-first review + top/bottom correlation pairs.
// Data source: Apache-2.0 / UW IDL inspiration for interaction grammar only.
import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, BarChart, Bar,
} from 'recharts';
import { TrendingUp, Target, Activity, AlertTriangle, ArrowUpRight, ArrowDownRight, Search, MoreVertical } from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { DataAdapter } from '@/lib/data-adapter';
import { ChartToolbar, HelpTooltip, ProgressCell, FullscreenOverlay, FloatingSearchPopup, ColumnContextMenu, useColumnConfigs } from './ChartToolbar';

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

  // Toolbar state
  const [showTable,    setShowTable]    = useState(false);
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [fullscreen,   setFullscreen]   = useState(false);
  const [tableSortCol, setTableSortCol] = useState<'x'|'y'|'residual'|'tail'|'phase'>('residual');
  const [tableSortDir, setTableSortDir] = useState<'asc'|'desc'>('desc');
  const [selectedRow,  setSelectedRow]  = useState<number | null>(null);
  const [colMenuKey,   setColMenuKey]   = useState<string | null>(null);
  const [colMenuAnchor,setColMenuAnchor]= useState<HTMLElement | null>(null);
  const [outlierRow,   setOutlierRow]   = useState<number | null>(null);
  const [outlierColMenuKey, setOutlierColMenuKey] = useState<string | null>(null);
  const [outlierColMenuAnchor, setOutlierColMenuAnchor] = useState<HTMLElement | null>(null);
  const scatterChartRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  // Column configs for main scatter table
  const scatterColDefs = useMemo(() => [
    { key: 'tail', label: 'זנב' }, { key: 'phase', label: 'שלב' },
    { key: 'x', label: xLabel }, { key: 'y', label: yLabel },
    { key: 'residual', label: 'סטייה' }, { key: 'outlier', label: 'חריג?' },
  ], [xLabel, yLabel]);
  const colCfg = useColumnConfigs(scatterColDefs);

  // Column configs for outlier table
  const outlierColDefs = useMemo(() => [
    { key: 'tail', label: 'זנב' }, { key: 'phase', label: 'שלב' },
    { key: 'x', label: xLabel }, { key: 'y', label: yLabel }, { key: 'residual', label: 'סטייה' },
  ], [xLabel, yLabel]);
  const outlierColCfg = useColumnConfigs(outlierColDefs);

  // Search match indices for floating search popup
  const matchIndices = useMemo(() => {
    if (!searchQuery.trim() || !showSearch) return [];
    const q = searchQuery.toLowerCase();
    return tableData.reduce<number[]>((acc, r, i) => {
      if (r.tail_number?.toLowerCase().includes(q) || r.flight_id?.toLowerCase().includes(q) || r.phase?.toLowerCase().includes(q))
        acc.push(i);
      return acc;
    }, []);
  }, [tableData, searchQuery, showSearch]);

  // Table: sort only (floating search highlights in-place, no filter)
  const tableData = useMemo(() => {
    const rows = [...scatterData];
    rows.sort((a, b) => {
      const dir = tableSortDir === 'asc' ? 1 : -1;
      switch (tableSortCol) {
        case 'x': return dir * (a.x - b.x);
        case 'y': return dir * (a.y - b.y);
        case 'residual': return dir * (a.residual - b.residual);
        case 'tail': return dir * a.tail_number.localeCompare(b.tail_number);
        case 'phase': return dir * a.phase.localeCompare(b.phase);
        default: return 0;
      }
    });
    return rows;
  }, [scatterData, searchQuery, tableSortCol, tableSortDir]);

  const maxX = useMemo(() => Math.max(...scatterData.map(d => Math.abs(d.x)), 1), [scatterData]);
  const maxY = useMemo(() => Math.max(...scatterData.map(d => Math.abs(d.y)), 1), [scatterData]);
  const maxResidual = useMemo(() => Math.max(...scatterData.map(d => d.residual), 0.001), [scatterData]);

  const toggleTableSort = (col: typeof tableSortCol) => {
    if (tableSortCol === col) setTableSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTableSortCol(col); setTableSortDir('desc'); }
    setSelectedRow(null);
  };

  const navigateMatch = (dir: 'up' | 'down') => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIdx(prev => {
      const next = dir === 'down'
        ? (prev + 1) % matchIndices.length
        : (prev - 1 + matchIndices.length) % matchIndices.length;
      // Scroll to match row
      const row = tableContainerRef.current?.querySelector(`[data-row="${matchIndices[next]}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return next;
    });
  };
  const SortIcon: React.FC<{col: typeof tableSortCol}> = ({ col }) => {
    if (tableSortCol !== col) return <span className="opacity-30">↕</span>;
    return tableSortDir === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

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
    <TooltipProvider>
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
                <HelpTooltip text="מחושב על בסיס מקדם הקורלציה של פירסון בין כל זוג פרמטרים. ערך קרוב ל-1 מצביע על קשר לינארי חיובי חזק, ערך קרוב ל-0 מצביע על העדר קשר. לחץ על שורה לניתוח מפורט." />
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
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  נקודות נתון
                  <HelpTooltip text="מספר רשומות הנתונים שנכללו בניתוח, לאחר סינון ערכים חסרים בשני הפרמטרים הנבחרים." />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className={`text-2xl font-bold tabular-nums ${corrColor(selectedCorr?.correlation ?? 0)}`}>
                  {selectedCorr ? selectedCorr.correlation.toFixed(3) : '—'}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  מקדם קורלציה (r)
                  <HelpTooltip text="מקדם הקורלציה של פירסון. טווח: -1 עד 1. ערך קרוב ל-1 = קשר לינארי חיובי חזק; קרוב ל-0 = אין קשר; קרוב ל-(-1) = קשר שלילי חזק." />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold tabular-nums">
                  {regression ? regression.rSquared.toFixed(3) : '—'}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  R² (מקדם דטרמינציה)
                  <HelpTooltip text="R² מבטא את אחוז השונות ב-Y שמוסבר על ידי X לפי מודל הרגרסיה הלינארית. R²=1 = התאמה מושלמת; R²=0 = המודל אינו מסביר דבר." />
                </div>
              </CardContent>
            </Card>
            <Card className={outlierCount > 0 ? 'border-red-200 bg-red-50/30 dark:bg-red-900/10' : ''}>
              <CardContent className="pt-4 pb-3">
                <div className={`text-2xl font-bold tabular-nums ${outlierCount > 0 ? 'text-red-500' : ''}`}>
                  {outlierCount}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  חריגים ({sigmaThreshold[0].toFixed(1)}σ)
                  <HelpTooltip text={`נקודות שסטייתן מקו הרגרסיה עולה על ${sigmaThreshold[0].toFixed(1)} כפול סטיית התקן של השאריות. ניתן לשנות את הסף בהגדרות.`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main scatter chart / table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                    {xLabel} vs {yLabel}
                    <HelpTooltip text="הנקודות הכחולות הן ערכים בטווח הרגרסיה. נקודות אדומות הן חריגים — סטייתן מקו הרגרסיה עולה על הסף שהוגדר. הקו הכחול המלא הוא ממשוואת הרגרסיה, הקווים המקווקווים הם רצועת הביטחון ±σ." />
                    <span className="text-muted-foreground font-normal text-[11px]">
                      {showTable ? '— תצוגת טבלה' : '— תצוגת גרף'}
                    </span>
                  </CardTitle>
                  {regression && !showTable && (
                    <CardDescription className="text-[11px] mt-0.5">
                      y = {regression.slope.toFixed(3)}x + {regression.intercept.toFixed(3)} | σ = {regression.stdDev.toFixed(3)}
                    </CardDescription>
                  )}
                </div>

                {/* Chart toolbar */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!showTable && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-primary/50" />תוך טווח
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />חריגים ({outlierCount})
                      </span>
                    </div>
                  )}
                  {showTable && (
                    <button
                      onClick={() => { setShowSearch(v => !v); setSearchQuery(''); setCurrentMatchIdx(0); }}
                      className={`inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${showSearch ? 'bg-muted text-foreground' : ''}`}
                      title="חפש בטבלה (Ctrl+F)"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <ChartToolbar
                    chartRef={scatterChartRef}
                    csvData={scatterData.map(p => ({ זנב: p.tail_number, טיסה: p.flight_id, שלב: p.phase, [xLabel]: p.x, [yLabel]: p.y, סטייה: p.residual, חריג: p.isOutlier ? 'כן' : 'לא' }))}
                    exportFilename={`correlation_${selectedXParam}_${selectedYParam}`}
                    onToggleTable={() => { setShowTable(v => !v); setShowSearch(false); setSearchQuery(''); setSelectedRow(null); }}
                    showingTable={showTable}
                    onFullscreen={() => setFullscreen(true)}
                  />
                </div>
              </div>

            </CardHeader>

            <CardContent className="p-0">
              {!showTable ? (
                /* Chart view */
                <div className="h-80 px-4 pb-4 pt-2">
                  <div ref={scatterChartRef} className="h-full">

                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart margin={{ top: 10, right: 20, bottom: 40, left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis type="number" dataKey="x" domain={['auto', 'auto']}
                          label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 11 }}
                          tick={{ fontSize: 10 }} />
                        <YAxis type="number" dataKey="y" domain={['auto', 'auto']}
                          label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 }}
                          tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        {regression && regressionMode === 'linear' && (
                          <Line data={regressionLineData} dataKey="y" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} type="linear" isAnimationActive={false} activeDot={false} legendType="none" />
                        )}
                        {regression && regressionMode === 'linear' && (
                          <Line data={upperBandData} dataKey="y" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 3" dot={false} type="linear" isAnimationActive={false} activeDot={false} legendType="none" opacity={0.35} />
                        )}
                        {regression && regressionMode === 'linear' && (
                          <Line data={lowerBandData} dataKey="y" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 3" dot={false} type="linear" isAnimationActive={false} activeDot={false} legendType="none" opacity={0.35} />
                        )}
                        <Scatter data={scatterData} isAnimationActive={false}>
                          {scatterData.map((p, i) => (
                            <Cell key={`cell-${i}`} fill={p.isOutlier ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} fillOpacity={p.isOutlier ? 0.85 : 0.45} r={p.isOutlier ? 4 : 3} />
                          ))}
                        </Scatter>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                /* Table view — Excel-like with floating search, column context menu, row selection */
                <div className="relative">
                  <FloatingSearchPopup
                    isOpen={showSearch}
                    onClose={() => { setShowSearch(false); setSearchQuery(''); setCurrentMatchIdx(0); }}
                    value={searchQuery}
                    onChange={v => { setSearchQuery(v); setCurrentMatchIdx(0); }}
                    matchCount={matchIndices.length}
                    currentMatch={currentMatchIdx}
                    onNavigate={navigateMatch}
                    placeholder="חיפוש לפי זנב, טיסה, שלב…"
                  />
                  <div ref={tableContainerRef} className={`overflow-auto max-h-80 ${showSearch ? 'pt-10' : ''}`}>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur border-b z-10">
                        <tr>
                          <th className="px-3 py-2 text-right text-muted-foreground font-medium w-8">#</th>
                          {colCfg.visibleCols.map(col => (
                            <th key={col.key}
                              style={{ textAlign: colCfg.getAlign(col.key) }}
                              className="px-3 py-2 cursor-pointer hover:bg-muted/50 select-none group relative"
                              onClick={() => { if (col.key === 'tail') toggleTableSort('tail'); else if (col.key === 'phase') toggleTableSort('phase'); else if (col.key === 'x') toggleTableSort('x'); else if (col.key === 'y') toggleTableSort('y'); else if (col.key === 'residual') toggleTableSort('residual'); }}>
                              <span className="flex items-center gap-1 justify-end">
                                {col.key === 'residual' && <HelpTooltip text="המרחק של הנקודה מקו הרגרסיה. ערך גבוה = נקודה חריגה." />}
                                {colCfg.getLabel(col.key, col.label)}
                                {(['tail','phase','x','y','residual'] as const).includes(col.key as any) && <SortIcon col={col.key as any} />}
                                {colCfg.hasChanges(col.key) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                                <button
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity flex-shrink-0"
                                  onClick={e => { e.stopPropagation(); setColMenuKey(col.key); setColMenuAnchor(e.currentTarget); }}
                                  title="הגדרות עמודה"
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </button>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tableData.slice(0, 200).map((p, i) => {
                          const isMatch = matchIndices.includes(i);
                          const isCurrent = matchIndices[currentMatchIdx] === i;
                          return (
                            <tr
                              key={i}
                              data-row={i}
                              onClick={() => setSelectedRow(prev => prev === i ? null : i)}
                              className={`cursor-pointer transition-colors ${
                                selectedRow === i ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' :
                                isCurrent ? 'bg-amber-100/60 dark:bg-amber-900/30' :
                                isMatch ? 'bg-yellow-50/60 dark:bg-yellow-900/20' :
                                p.isOutlier ? 'bg-red-50/20 dark:bg-red-900/10 hover:bg-red-50/40' :
                                'hover:bg-muted/30'
                              }`}
                            >
                              <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                              {!colCfg.isHidden('tail') && <td style={{ textAlign: colCfg.getAlign('tail') }} className="px-3 py-1.5 font-mono">{p.tail_number}</td>}
                              {!colCfg.isHidden('phase') && <td style={{ textAlign: colCfg.getAlign('phase') }} className="px-3 py-1.5 text-muted-foreground">{p.phase}</td>}
                              {!colCfg.isHidden('x') && <td style={{ textAlign: colCfg.getAlign('x') }} className="px-3 py-1.5"><ProgressCell value={p.x} max={maxX} color="hsl(var(--primary))" precision={3} /></td>}
                              {!colCfg.isHidden('y') && <td style={{ textAlign: colCfg.getAlign('y') }} className="px-3 py-1.5"><ProgressCell value={p.y} max={maxY} color="hsl(142 76% 36%)" precision={3} /></td>}
                              {!colCfg.isHidden('residual') && <td style={{ textAlign: colCfg.getAlign('residual') }} className="px-3 py-1.5"><ProgressCell value={p.residual} max={maxResidual} color={p.isOutlier ? '#ef4444' : 'hsl(var(--muted-foreground))'} precision={3} /></td>}
                              {!colCfg.isHidden('outlier') && <td className="px-3 py-1.5">{p.isOutlier && <Badge variant="destructive" className="text-[10px] h-4 px-1">חריג</Badge>}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {tableData.length === 0 && <div className="py-8 text-center text-muted-foreground text-xs">אין נתונים</div>}
                    {tableData.length > 200 && <div className="px-4 py-2 text-xs text-muted-foreground border-t">מוצגות 200 מתוך {tableData.length} שורות</div>}
                  </div>
                  {/* Column context menu */}
                  {colMenuKey && (
                    <ColumnContextMenu
                      colKey={colMenuKey}
                      defaultLabel={scatterColDefs.find(c => c.key === colMenuKey)?.label ?? colMenuKey}
                      config={colCfg.configs[colMenuKey] ?? {}}
                      onUpdate={u => colCfg.updateColumn(colMenuKey, u)}
                      onReset={() => colCfg.resetColumn(colMenuKey)}
                      onSortAsc={['tail','phase','x','y','residual'].includes(colMenuKey) ? () => { setTableSortCol(colMenuKey as any); setTableSortDir('asc'); } : undefined}
                      onSortDesc={['tail','phase','x','y','residual'].includes(colMenuKey) ? () => { setTableSortCol(colMenuKey as any); setTableSortDir('desc'); } : undefined}
                      onClose={() => { setColMenuKey(null); setColMenuAnchor(null); }}
                      anchorEl={colMenuAnchor}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fullscreen overlay */}
          <FullscreenOverlay isOpen={fullscreen} onClose={() => setFullscreen(false)} title={`${xLabel} vs ${yLabel} — מסך מלא`}>
            <div className="h-[calc(100vh-120px)]">
              <div ref={scatterChartRef} className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart margin={{ top: 20, right: 40, bottom: 60, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis type="number" dataKey="x" domain={['auto','auto']} label={{ value: xLabel, position: 'insideBottom', offset: -20, fontSize: 13 }} tick={{ fontSize: 11 }} />
                    <YAxis type="number" dataKey="y" domain={['auto','auto']} label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 13 }} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    {regression && <Line data={regressionLineData} dataKey="y" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} type="linear" isAnimationActive={false} activeDot={false} legendType="none" />}
                    {regression && <Line data={upperBandData} dataKey="y" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="5 3" dot={false} type="linear" isAnimationActive={false} activeDot={false} legendType="none" opacity={0.4} />}
                    {regression && <Line data={lowerBandData} dataKey="y" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="5 3" dot={false} type="linear" isAnimationActive={false} activeDot={false} legendType="none" opacity={0.4} />}
                    <Scatter data={scatterData} isAnimationActive={false}>
                      {scatterData.map((p, i) => (<Cell key={i} fill={p.isOutlier ? '#ef4444' : 'hsl(var(--primary))'} fillOpacity={p.isOutlier ? 0.9 : 0.5} r={p.isOutlier ? 5 : 3.5} />))}
                    </Scatter>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FullscreenOverlay>

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
                <div className="overflow-x-auto relative">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground w-8">#</th>
                        {outlierColCfg.visibleCols.map(col => (
                          <th key={col.key}
                            style={{ textAlign: outlierColCfg.getAlign(col.key) }}
                            className="px-4 py-2 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none group">
                            <span className="flex items-center gap-1 justify-end">
                              {outlierColCfg.getLabel(col.key, col.label)}
                              {outlierColCfg.hasChanges(col.key) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                              <button
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                                onClick={e => { e.stopPropagation(); setOutlierColMenuKey(col.key); setOutlierColMenuAnchor(e.currentTarget); }}
                              ><MoreVertical className="h-3 w-3" /></button>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {outlierPoints.map((p, i) => (
                        <tr key={i}
                          onClick={() => setOutlierRow(prev => prev === i ? null : i)}
                          className={`cursor-pointer transition-colors ${outlierRow === i ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-red-50/30 dark:hover:bg-red-900/10'}`}>
                          <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                          {!outlierColCfg.isHidden('tail') && <td style={{ textAlign: outlierColCfg.getAlign('tail') }} className="px-4 py-2 font-mono">{p.tail_number}</td>}
                          {!outlierColCfg.isHidden('phase') && <td style={{ textAlign: outlierColCfg.getAlign('phase') }} className="px-4 py-2">{p.phase}</td>}
                          {!outlierColCfg.isHidden('x') && <td style={{ textAlign: outlierColCfg.getAlign('x') }} className="px-4 py-2 tabular-nums">{p.x.toFixed(3)}</td>}
                          {!outlierColCfg.isHidden('y') && <td style={{ textAlign: outlierColCfg.getAlign('y') }} className="px-4 py-2 tabular-nums">{p.y.toFixed(3)}</td>}
                          {!outlierColCfg.isHidden('residual') && <td style={{ textAlign: outlierColCfg.getAlign('residual') }} className="px-4 py-2 tabular-nums text-red-500 font-medium">{p.residual.toFixed(3)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Outlier column context menu */}
                  {outlierColMenuKey && (
                    <ColumnContextMenu
                      colKey={outlierColMenuKey}
                      defaultLabel={outlierColDefs.find(c => c.key === outlierColMenuKey)?.label ?? outlierColMenuKey}
                      config={outlierColCfg.configs[outlierColMenuKey] ?? {}}
                      onUpdate={u => outlierColCfg.updateColumn(outlierColMenuKey, u)}
                      onReset={() => outlierColCfg.resetColumn(outlierColMenuKey)}
                      onClose={() => { setOutlierColMenuKey(null); setOutlierColMenuAnchor(null); }}
                      anchorEl={outlierColMenuAnchor}
                    />
                  )}
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
    </TooltipProvider>
  );
};
