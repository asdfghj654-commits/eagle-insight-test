// Distributions Tab - Histogram + Joint Distribution (scatter + regression + confidence band)
import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush,
  ComposedChart, Scatter, Line, Cell,
} from 'recharts';
import { BarChart3, Box, AlertTriangle, Target, TrendingUp, GitBranch, Search, MoreVertical } from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';
import { DataAdapter } from '@/lib/data-adapter';
import { ChartToolbar, HelpTooltip, ProgressCell, FullscreenOverlay, exportCSV, FloatingSearchPopup, ColumnContextMenu, useColumnConfigs } from './ChartToolbar';

// ── Regression helpers ─────────────────────────────────────────────
function computeLinearRegression(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const { x, y } of pts) { sx += x; sy += y; sxy += x * y; sxx += x * x; }
  const denom = n * sxx - sx * sx;
  const slope = denom ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  const residuals = pts.map(({ x, y }) => y - (slope * x + intercept));
  const meanR = residuals.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(residuals.reduce((a, r) => a + (r - meanR) ** 2, 0) / n);
  const ssTot = pts.reduce((a, { y }) => a + (y - sy / n) ** 2, 0);
  const ssRes = residuals.reduce((a, r) => a + r ** 2, 0);
  const rSquared = ssTot ? 1 - ssRes / ssTot : 0;
  const r = Math.sign(slope) * Math.sqrt(Math.max(0, rSquared));
  return { slope, intercept, stdDev, rSquared, r, residuals };
}

function buildHistogram(values: number[], bins: number) {
  if (values.length === 0) return [];
  const min = Math.min(...values), max = Math.max(...values);
  const w = (max - min) / bins || 1;
  return Array.from({ length: bins }, (_, i) => {
    const center = min + i * w + w / 2;
    const count = values.filter(v => v >= min + i * w && v < min + (i + 1) * w).length;
    return { center: parseFloat(center.toFixed(3)), count };
  });
}

export const DistributionsTab: React.FC = () => {
  const { rawData, processedFlights, availableParameters, createSelectionSet } = useCSVData();

  // Shared filters
  const [selectedFlight, setSelectedFlight] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [binCount, setBinCount] = useState([20]);

  // Mode
  const [mode, setMode] = useState<'histogram' | 'joint'>('histogram');

  // Histogram mode
  const [selectedParameter, setSelectedParameter] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);

  // Joint mode
  const [xParam, setXParam] = useState<string>('');
  const [yParam, setYParam] = useState<string>('');
  const [sigmaThreshold, setSigmaThreshold] = useState([2.0]);
  const [showRegression, setShowRegression] = useState(true);

  // Toolbar state
  const [showHistTable, setShowHistTable]   = useState(false);
  const [showJointTable, setShowJointTable] = useState(false);
  const [histSearch,    setHistSearch]      = useState('');
  const [showHistSearch, setShowHistSearch] = useState(false);
  const [histCurrentMatch, setHistCurrentMatch] = useState(0);
  const [histSelectedRow, setHistSelectedRow]   = useState<number | null>(null);
  const [jointSelectedRow, setJointSelectedRow] = useState<number | null>(null);
  const [histColMenuKey, setHistColMenuKey]     = useState<string | null>(null);
  const [histColMenuAnchor, setHistColMenuAnchor] = useState<HTMLElement | null>(null);
  const [jointColMenuKey, setJointColMenuKey]   = useState<string | null>(null);
  const [jointColMenuAnchor, setJointColMenuAnchor] = useState<HTMLElement | null>(null);
  const [histFullscreen, setHistFullscreen] = useState(false);
  const [jointFullscreen, setJointFullscreen] = useState(false);
  const histChartRef  = useRef<HTMLDivElement>(null);
  const jointChartRef = useRef<HTMLDivElement>(null);
  const histTableRef  = useRef<HTMLDivElement>(null);

  const phases = useMemo(() => Array.from(new Set(rawData.map(r => r.phase))), [rawData]);

  // Column configs for histogram table
  const histColDefs = [{ key: 'range', label: 'טווח' }, { key: 'count', label: 'כמות' }];
  const histColCfg = useColumnConfigs(histColDefs);

  // Column configs for joint table (labels depend on params, computed inline)
  const jointColDefs = useMemo(() => [
    { key: 'x', label: DataAdapter.getParameterDisplayName(xParam) || 'X' },
    { key: 'y', label: DataAdapter.getParameterDisplayName(yParam) || 'Y' },
    { key: 'outlier', label: 'חריג?' },
  ], [xParam, yParam]);
  const jointColCfg = useColumnConfigs(jointColDefs);

  // Histogram search match indices
  const histMatchIndices = useMemo(() => {
    if (!histSearch.trim() || !showHistSearch) return [];
    const q = histSearch.toLowerCase();
    return histogramData.reduce<number[]>((acc, b, i) => {
      if (b.range.toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [histogramData, histSearch, showHistSearch]);

  const navigateHistMatch = (dir: 'up' | 'down') => {
    if (histMatchIndices.length === 0) return;
    setHistCurrentMatch(prev => {
      const next = dir === 'down'
        ? (prev + 1) % histMatchIndices.length
        : (prev - 1 + histMatchIndices.length) % histMatchIndices.length;
      const row = histTableRef.current?.querySelector(`[data-row="${histMatchIndices[next]}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return next;
    });
  };

  const filteredRaw = useMemo(() =>
    rawData.filter(r =>
      (selectedFlight === 'all' || r.flight_id === selectedFlight) &&
      (selectedPhase === 'all' || r.phase === selectedPhase)
    ), [rawData, selectedFlight, selectedPhase]);

  // ── Histogram mode computations ────────────────────────────────────
  const parameterData = useMemo(() => {
    if (!selectedParameter) return [];
    return filteredRaw
      .map(r => ({ value: typeof r[selectedParameter] === 'number' ? r[selectedParameter] : parseFloat(r[selectedParameter]) || 0, flight_id: r.flight_id, tail_number: r.tail_number, phase: r.phase, timestamp: r.timestamp }))
      .filter(item => !isNaN(item.value));
  }, [filteredRaw, selectedParameter]);

  const histogramData = useMemo(() => {
    if (parameterData.length === 0) return [];
    const values = parameterData.map(d => d.value);
    const min = Math.min(...values), max = Math.max(...values);
    const w = (max - min) / binCount[0];
    return Array.from({ length: binCount[0] }, (_, i) => ({
      range: `${(min + i * w).toFixed(1)}-${(min + (i + 1) * w).toFixed(1)}`,
      count: 0, binStart: min + i * w, binEnd: min + (i + 1) * w,
    })).map(bin => ({
      ...bin,
      count: values.filter(v => v >= bin.binStart && v < bin.binEnd).length,
    }));
  }, [parameterData, binCount]);

  const statistics = useMemo(() => {
    if (parameterData.length === 0) return null;
    const values = parameterData.map(d => d.value).sort((a, b) => a - b);
    const n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    const q1 = values[Math.floor(n * 0.25)], q3 = values[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr, upperFence = q3 + 1.5 * iqr;
    const outliers = values.filter(v => v < lowerFence || v > upperFence);
    return { count: n, mean, std, min: values[0], max: values[n - 1], median: values[Math.floor(n * 0.5)], outliers: outliers.length, outlierPercentage: (outliers.length / n) * 100, lowerFence, upperFence };
  }, [parameterData]);

  // ── Joint mode computations ────────────────────────────────────────
  const jointPoints = useMemo(() => {
    if (!xParam || !yParam) return [];
    return filteredRaw
      .map(r => {
        const x = typeof r[xParam] === 'number' ? r[xParam] : parseFloat(r[xParam]);
        const y = typeof r[yParam] === 'number' ? r[yParam] : parseFloat(r[yParam]);
        return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
      })
      .filter(Boolean) as { x: number; y: number }[];
  }, [filteredRaw, xParam, yParam]);

  const regression = useMemo(() => computeLinearRegression(jointPoints), [jointPoints]);

  const enrichedScatter = useMemo(() => {
    if (!regression) return jointPoints.map(p => ({ ...p, isOutlier: false }));
    const threshold = sigmaThreshold[0] * regression.stdDev;
    return jointPoints.map((pt, i) => ({
      ...pt,
      isOutlier: Math.abs(regression.residuals[i]) > threshold,
    }));
  }, [jointPoints, regression, sigmaThreshold]);

  const regressionLineData = useMemo(() => {
    if (!regression || jointPoints.length === 0) return [];
    const xs = jointPoints.map(p => p.x);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const sigma = sigmaThreshold[0] * regression.stdDev;
    return Array.from({ length: 51 }, (_, i) => {
      const x = xMin + (i / 50) * (xMax - xMin);
      const y = regression.slope * x + regression.intercept;
      return { x, y, upper: y + sigma, lower: y - sigma };
    });
  }, [jointPoints, regression, sigmaThreshold]);

  const xHistData = useMemo(() => buildHistogram(jointPoints.map(p => p.x), binCount[0]), [jointPoints, binCount]);
  const yHistData = useMemo(() => buildHistogram(jointPoints.map(p => p.y), binCount[0]).reverse(), [jointPoints, binCount]);

  const outlierCount = enrichedScatter.filter(p => p.isOutlier).length;

  // ── Handlers ──────────────────────────────────────────────────────
  const handleBrushChange = (data: any) => {
    if (data?.startIndex !== undefined && data?.endIndex !== undefined) {
      setSelectedRange([histogramData[data.startIndex]?.binStart, histogramData[data.endIndex]?.binEnd]);
    }
  };

  const createSelectionFromRange = () => {
    if (!selectedRange || !selectedParameter) return;
    const [start, end] = selectedRange;
    const sel = parameterData.filter(d => d.value >= start && d.value <= end);
    createSelectionSet({ name: `${DataAdapter.getParameterDisplayName(selectedParameter)} (${start.toFixed(1)}-${end.toFixed(1)})`, color: '#8B5CF6', type: 'value-range', data: sel, source: 'distributions', statistics: { count: sel.length, mean: sel.reduce((s, d) => s + d.value, 0) / sel.length, min: Math.min(...sel.map(d => d.value)), max: Math.max(...sel.map(d => d.value)) } });
    setSelectedRange(null);
  };

  const createOutlierSelection = () => {
    if (!statistics || !selectedParameter) return;
    const outlierData = parameterData.filter(d => d.value < statistics.lowerFence || d.value > statistics.upperFence);
    if (outlierData.length === 0) return;
    createSelectionSet({ name: `${DataAdapter.getParameterDisplayName(selectedParameter)} - חריגים`, color: '#EF4444', type: 'value-range', data: outlierData, source: 'distributions', statistics: { count: outlierData.length, outlierPercentage: statistics.outlierPercentage } });
  };

  if (rawData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <BarChart3 className="h-5 w-5" /> התפלגויות
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-4" dir="rtl">
      {/* Mode toggle */}
      <div className="flex gap-2 items-center">
        <Button variant={mode === 'histogram' ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setMode('histogram')}>
          <BarChart3 className="h-3.5 w-3.5" /> היסטוגרמה
        </Button>
        <Button variant={mode === 'joint' ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setMode('joint')}>
          <GitBranch className="h-3.5 w-3.5" /> התפלגות משותפת
        </Button>
      </div>

      {/* Shared filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {mode === 'histogram' ? (
              <Select value={selectedParameter} onValueChange={setSelectedParameter}>
                <SelectTrigger><SelectValue placeholder="בחר פרמטר" /></SelectTrigger>
                <SelectContent>{availableParameters.map(p => <SelectItem key={p} value={p}>{DataAdapter.getParameterDisplayName(p)}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <>
                <Select value={xParam} onValueChange={setXParam}>
                  <SelectTrigger><SelectValue placeholder="פרמטר X" /></SelectTrigger>
                  <SelectContent>{availableParameters.map(p => <SelectItem key={p} value={p}>{DataAdapter.getParameterDisplayName(p)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={yParam} onValueChange={setYParam}>
                  <SelectTrigger><SelectValue placeholder="פרמטר Y" /></SelectTrigger>
                  <SelectContent>{availableParameters.map(p => <SelectItem key={p} value={p}>{DataAdapter.getParameterDisplayName(p)}</SelectItem>)}</SelectContent>
                </Select>
              </>
            )}
            <Select value={selectedFlight} onValueChange={setSelectedFlight}>
              <SelectTrigger><SelectValue placeholder="טיסה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הטיסות</SelectItem>
                {processedFlights.map(f => <SelectItem key={f.flight_id} value={f.flight_id}>{f.flight_id} ({f.tail_number})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger><SelectValue placeholder="שלב" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל השלבים</SelectItem>
                {phases.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── HISTOGRAM MODE ── */}
      {mode === 'histogram' && selectedParameter && (
        <>
          {statistics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-right text-sm">
                  <Box className="h-4 w-4" /> סטטיסטיקות — {DataAdapter.getParameterDisplayName(selectedParameter)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-center" dir="rtl">
                  {([
                    ['נקודות', statistics.count, 'מספר רשומות הנתונים שנכללו בחישוב, לאחר סינון ערכים חסרים.'],
                    ['ממוצע', statistics.mean.toFixed(2), 'ממוצע חשבוני של כל הערכים.'],
                    ['סטיית תקן', statistics.std.toFixed(2), 'שורש ממוצע הסטיות הריבועיות מהממוצע — מדד לפיזור הנתונים.'],
                    ['מינימום', statistics.min.toFixed(2), 'הערך הקטן ביותר בפרמטר הנבחר.'],
                    ['מקסימום', statistics.max.toFixed(2), 'הערך הגדול ביותר בפרמטר הנבחר.'],
                    ['חציון', statistics.median.toFixed(2), 'הערך האמצעי — 50% מהנתונים מתחתיו, 50% מעליו.'],
                    ['חריגים', statistics.outliers, 'נקודות החורגות מ-1.5×IQR מעל Q3 או מתחת ל-Q1 (שיטת IQR).'],
                    ['% חריגים', statistics.outlierPercentage.toFixed(1) + '%', 'אחוז הנקודות החריגות מתוך סך הנתונים.'],
                  ] as [string, string|number, string][]).map(([label, val, help]) => (
                    <div key={label}>
                      <div className="text-xl font-bold">{val}</div>
                      <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground">
                        {label}
                        <HelpTooltip text={help} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4 justify-end">
                  {statistics.outliers > 0 && (
                    <Button variant="outline" size="sm" onClick={createOutlierSelection} className="gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> יצור סט חריגים
                    </Button>
                  )}
                  {selectedRange && (
                    <Button variant="default" size="sm" onClick={createSelectionFromRange} className="gap-1.5">
                      <Target className="h-3.5 w-3.5" /> יצור סט מטווח נבחר
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm text-right flex items-center gap-1.5">
                    היסטוגרמה
                    <HelpTooltip text="היסטוגרמה מחלקת את הערכים לתאים (bins) ומציגה את תדירות כל טווח. גרור על הגרף לבחירת טווח ליצירת Selection Set." />
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>בינים:</span>
                    <Slider value={binCount} onValueChange={setBinCount} min={5} max={50} step={1} className="w-20" />
                    <span className="w-5">{binCount[0]}</span>
                  </div>
                  {showHistTable && (
                    <button onClick={() => { setShowHistSearch(v => !v); setHistSearch(''); setHistCurrentMatch(0); }} className={`inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${showHistSearch ? 'bg-muted' : ''}`} title="חפש בטבלה">
                      <Search className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <ChartToolbar
                    chartRef={histChartRef}
                    csvData={histogramData.map(b => ({ טווח: b.range, כמות: b.count, מתחיל: b.binStart, מסתיים: b.binEnd }))}
                    exportFilename={`histogram_${selectedParameter}`}
                    onToggleTable={() => { setShowHistTable(v => !v); setShowHistSearch(false); }}
                    showingTable={showHistTable}
                    onFullscreen={() => setHistFullscreen(true)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!showHistTable ? (
                <div className="h-72 px-4 pb-4 pt-2">
                  <div ref={histChartRef} className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogramData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="range" angle={-40} textAnchor="end" height={60} fontSize={9} />
                        <YAxis fontSize={10} />
                        <Tooltip formatter={(v) => [v, 'כמות']} labelFormatter={(l) => `טווח: ${l}`} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" strokeWidth={1} />
                        <Brush dataKey="range" height={28} stroke="hsl(var(--primary))" onChange={handleBrushChange} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                /* Table view of histogram bins — with floating search, column menu, row selection */
                <div className="relative">
                  <FloatingSearchPopup
                    isOpen={showHistSearch}
                    onClose={() => { setShowHistSearch(false); setHistSearch(''); setHistCurrentMatch(0); }}
                    value={histSearch}
                    onChange={v => { setHistSearch(v); setHistCurrentMatch(0); }}
                    matchCount={histMatchIndices.length}
                    currentMatch={histCurrentMatch}
                    onNavigate={navigateHistMatch}
                    placeholder="חיפוש לפי טווח…"
                  />
                  <div ref={histTableRef} className={`overflow-auto max-h-72 ${showHistSearch ? 'pt-10' : ''}`}>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur border-b">
                        <tr>
                          <th className="px-3 py-2 text-right text-muted-foreground font-medium w-8">#</th>
                          {histColCfg.visibleCols.map(col => (
                            <th key={col.key} style={{ textAlign: histColCfg.getAlign(col.key) }}
                              className="px-3 py-2 text-muted-foreground font-medium cursor-pointer hover:bg-muted/50 select-none group">
                              <span className="flex items-center gap-1 justify-end">
                                {histColCfg.getLabel(col.key, col.label)}
                                {histColCfg.hasChanges(col.key) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                                <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                                  onClick={e => { e.stopPropagation(); setHistColMenuKey(col.key); setHistColMenuAnchor(e.currentTarget); }}
                                ><MoreVertical className="h-3 w-3" /></button>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {histogramData.map((b, i) => {
                          const isMatch = histMatchIndices.includes(i);
                          const isCurrent = histMatchIndices[histCurrentMatch] === i;
                          return (
                            <tr key={i} data-row={i}
                              onClick={() => setHistSelectedRow(p => p === i ? null : i)}
                              className={`cursor-pointer transition-colors ${
                                histSelectedRow === i ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' :
                                isCurrent ? 'bg-amber-100/60 dark:bg-amber-900/30' :
                                isMatch ? 'bg-yellow-50/60 dark:bg-yellow-900/20' :
                                'hover:bg-muted/30'
                              }`}>
                              <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                              {!histColCfg.isHidden('range') && <td style={{ textAlign: histColCfg.getAlign('range') }} className="px-3 py-1.5 font-mono">{b.range}</td>}
                              {!histColCfg.isHidden('count') && <td style={{ textAlign: histColCfg.getAlign('count') }} className="px-3 py-1.5">
                                <ProgressCell value={b.count} max={Math.max(...histogramData.map(x => x.count), 1)} color="hsl(var(--primary))" precision={0} />
                              </td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {histColMenuKey && (
                    <ColumnContextMenu
                      colKey={histColMenuKey}
                      defaultLabel={histColDefs.find(c => c.key === histColMenuKey)?.label ?? histColMenuKey}
                      config={histColCfg.configs[histColMenuKey] ?? {}}
                      onUpdate={u => histColCfg.updateColumn(histColMenuKey, u)}
                      onReset={() => histColCfg.resetColumn(histColMenuKey)}
                      onClose={() => { setHistColMenuKey(null); setHistColMenuAnchor(null); }}
                      anchorEl={histColMenuAnchor}
                    />
                  )}
                </div>
              )}
              {selectedRange && !showHistTable && (
                <div className="mx-4 mb-3 p-2 bg-muted rounded-lg flex items-center justify-between text-sm">
                  <Badge variant="secondary">טווח נבחר: {selectedRange[0].toFixed(2)} – {selectedRange[1].toFixed(2)}</Badge>
                  <span className="text-muted-foreground text-xs">{parameterData.filter(d => d.value >= selectedRange[0] && d.value <= selectedRange[1]).length} נקודות</span>
                </div>
              )}
            </CardContent>
          </Card>

          <FullscreenOverlay isOpen={histFullscreen} onClose={() => setHistFullscreen(false)} title={`היסטוגרמה — ${DataAdapter.getParameterDisplayName(selectedParameter)}`}>
            <div className="h-[calc(100vh-140px)]" ref={histChartRef}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 10, right: 40, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" angle={-40} textAnchor="end" height={80} fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => [v, 'כמות']} labelFormatter={(l) => `טווח: ${l}`} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FullscreenOverlay>
        </>
      )}

      {/* ── JOINT DISTRIBUTION MODE ── */}
      {mode === 'joint' && (
        <>
          {/* Controls row */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">סף σ:</span>
              <Slider value={sigmaThreshold} onValueChange={setSigmaThreshold} min={0.5} max={4} step={0.1} className="w-28" />
              <span className="font-mono w-8">{sigmaThreshold[0].toFixed(1)}σ</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">בינים:</span>
              <Slider value={binCount} onValueChange={setBinCount} min={5} max={40} step={1} className="w-24" />
              <span className="w-6">{binCount[0]}</span>
            </div>
            <Button variant={showRegression ? 'default' : 'outline'} size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setShowRegression(v => !v)}>
              <TrendingUp className="h-3 w-3" /> רגרסיה
            </Button>
          </div>

          {/* Metric cards */}
          {regression && jointPoints.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'נקודות', value: jointPoints.length.toLocaleString(), color: '' },
                { label: 'קורלציה r', value: regression.r.toFixed(3), color: Math.abs(regression.r) > 0.7 ? 'text-green-500' : Math.abs(regression.r) > 0.4 ? 'text-yellow-500' : 'text-red-400' },
                { label: 'R²', value: regression.rSquared.toFixed(3), color: regression.rSquared > 0.5 ? 'text-green-500' : 'text-muted-foreground' },
                { label: 'חריגים', value: `${outlierCount} (${((outlierCount / jointPoints.length) * 100).toFixed(1)}%)`, color: outlierCount > 0 ? 'text-red-400' : 'text-green-500' },
              ].map(({ label, value, color }) => (
                <Card key={label}>
                  <CardContent className="pt-3 pb-3 text-center">
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Chart area: top X histogram + left Y histogram + center scatter */}
          {xParam && yParam && jointPoints.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm text-right flex items-center gap-1.5">
                    {DataAdapter.getParameterDisplayName(yParam)} לעומת {DataAdapter.getParameterDisplayName(xParam)}
                    <HelpTooltip text="גרף פיזור משותף עם קו רגרסיה ורצועת ביטחון ±σ. נקודות אדומות הן חריגים. ההיסטוגרמות בצדדים מציגות את ההתפלגות השולית של כל פרמטר." />
                  </CardTitle>
                  <ChartToolbar
                    chartRef={jointChartRef}
                    csvData={enrichedScatter.map(p => ({ [DataAdapter.getParameterDisplayName(xParam)]: p.x, [DataAdapter.getParameterDisplayName(yParam)]: p.y, חריג: p.isOutlier ? 'כן' : 'לא' }))}
                    exportFilename={`joint_${xParam}_${yParam}`}
                    onToggleTable={() => setShowJointTable(v => !v)}
                    showingTable={showJointTable}
                    onFullscreen={() => setJointFullscreen(true)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {showJointTable ? (
                  /* Joint distribution table — with column menu + row selection */
                  <div className="relative overflow-auto max-h-96">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur border-b">
                        <tr>
                          <th className="px-3 py-2 text-right text-muted-foreground font-medium w-8">#</th>
                          {jointColCfg.visibleCols.map(col => (
                            <th key={col.key} style={{ textAlign: jointColCfg.getAlign(col.key) }}
                              className="px-3 py-2 font-medium text-muted-foreground min-w-[120px] cursor-pointer hover:bg-muted/50 select-none group">
                              <span className="flex items-center gap-1 justify-end">
                                {jointColCfg.getLabel(col.key, col.label)}
                                {jointColCfg.hasChanges(col.key) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                                <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                                  onClick={e => { e.stopPropagation(); setJointColMenuKey(col.key); setJointColMenuAnchor(e.currentTarget); }}
                                ><MoreVertical className="h-3 w-3" /></button>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {enrichedScatter.slice(0, 300).map((p, i) => (
                          <tr key={i} data-row={i}
                            onClick={() => setJointSelectedRow(prev => prev === i ? null : i)}
                            className={`cursor-pointer transition-colors ${
                              jointSelectedRow === i ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' :
                              p.isOutlier ? 'bg-red-50/20 dark:bg-red-900/10 hover:bg-red-50/40' :
                              'hover:bg-muted/30'
                            }`}>
                            <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                            {!jointColCfg.isHidden('x') && <td style={{ textAlign: jointColCfg.getAlign('x') }} className="px-3 py-1.5">
                              <ProgressCell value={p.x} max={Math.max(...enrichedScatter.map(d => Math.abs(d.x)), 1)} color="hsl(var(--primary))" precision={3} />
                            </td>}
                            {!jointColCfg.isHidden('y') && <td style={{ textAlign: jointColCfg.getAlign('y') }} className="px-3 py-1.5">
                              <ProgressCell value={p.y} max={Math.max(...enrichedScatter.map(d => Math.abs(d.y)), 1)} color="hsl(142 76% 36%)" precision={3} />
                            </td>}
                            {!jointColCfg.isHidden('outlier') && <td className="px-3 py-1.5">
                              {p.isOutlier && <span className="text-red-500 font-medium">⚠ חריג</span>}
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {enrichedScatter.length > 300 && <div className="px-4 py-2 text-xs text-muted-foreground border-t">מוצגות 300 מתוך {enrichedScatter.length} שורות</div>}
                    {jointColMenuKey && (
                      <ColumnContextMenu
                        colKey={jointColMenuKey}
                        defaultLabel={jointColDefs.find(c => c.key === jointColMenuKey)?.label ?? jointColMenuKey}
                        config={jointColCfg.configs[jointColMenuKey] ?? {}}
                        onUpdate={u => jointColCfg.updateColumn(jointColMenuKey, u)}
                        onReset={() => jointColCfg.resetColumn(jointColMenuKey)}
                        onClose={() => { setJointColMenuKey(null); setJointColMenuAnchor(null); }}
                        anchorEl={jointColMenuAnchor}
                      />
                    )}
                  </div>
                ) : (
                <>
                {/* Grid: [80px Y-hist | scatter] stacked below [spacer | X-hist] */}
                <div className="grid" style={{ gridTemplateColumns: '80px 1fr', gridTemplateRows: '90px 380px', gap: '2px' }}>

                  {/* Top-left spacer */}
                  <div />

                  {/* Top: X histogram */}
                  <div style={{ height: 90 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={xHistData} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
                        <XAxis dataKey="center" type="number" domain={['auto', 'auto']} hide />
                        <YAxis hide />
                        <Bar dataKey="count" fill="hsl(var(--primary)/0.5)" isAnimationActive={false} />
                        <Tooltip formatter={(v) => [v, 'כמות']} labelFormatter={(l) => `${DataAdapter.getParameterDisplayName(xParam)}: ${Number(l).toFixed(2)}`} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Left: Y histogram (layout vertical — horizontal bars) */}
                  <div style={{ height: 380 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={yHistData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis type="number" reversed hide />
                        <YAxis dataKey="center" type="number" domain={['auto', 'auto']} hide />
                        <Bar dataKey="count" fill="hsl(var(--primary)/0.5)" isAnimationActive={false} />
                        <Tooltip formatter={(v) => [v, 'כמות']} labelFormatter={(l) => `${DataAdapter.getParameterDisplayName(yParam)}: ${Number(l).toFixed(2)}`} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right: Main scatter + regression */}
                  <div style={{ height: 380 }} ref={jointChartRef}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart margin={{ top: 5, right: 15, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis
                          dataKey="x" type="number" domain={['auto', 'auto']}
                          tickFormatter={(v: number) => v.toFixed(1)} tick={{ fontSize: 9 }}
                          label={{ value: DataAdapter.getParameterDisplayName(xParam), position: 'insideBottom', offset: -10, fontSize: 10 }}
                        />
                        <YAxis
                          dataKey="y" type="number" domain={['auto', 'auto']}
                          tickFormatter={(v: number) => v.toFixed(1)} tick={{ fontSize: 9 }} width={48}
                          label={{ value: DataAdapter.getParameterDisplayName(yParam), angle: -90, position: 'insideLeft', fontSize: 10 }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const d = payload[0].payload as any;
                            return (
                              <div className="rounded-lg border bg-background/95 backdrop-blur p-2 shadow-lg text-xs space-y-1" dir="rtl">
                                <div className="font-semibold text-foreground">נקודת נתונים</div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">{DataAdapter.getParameterDisplayName(xParam)}:</span>
                                  <span className="font-mono">{d.x?.toFixed?.(3)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">{DataAdapter.getParameterDisplayName(yParam)}:</span>
                                  <span className="font-mono">{d.y?.toFixed?.(3)}</span>
                                </div>
                                {d.isOutlier && <div className="text-red-400 font-medium">⚠ חריג</div>}
                              </div>
                            );
                          }}
                        />
                        {/* Scatter points */}
                        <Scatter data={enrichedScatter} isAnimationActive={false}>
                          {enrichedScatter.map((pt, i) => (
                            <Cell key={i} fill={pt.isOutlier ? '#ef4444' : 'hsl(var(--primary)/0.55)'} />
                          ))}
                        </Scatter>
                        {/* Regression line */}
                        {showRegression && regression && (
                          <Line data={regressionLineData} dataKey="y" type="linear"
                            stroke="hsl(var(--primary))" strokeWidth={2} dot={false}
                            isAnimationActive={false} legendType="none" />
                        )}
                        {/* Upper confidence band */}
                        {showRegression && regression && (
                          <Line data={regressionLineData} dataKey="upper" type="linear"
                            stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="5 3"
                            dot={false} opacity={0.45} isAnimationActive={false} legendType="none" />
                        )}
                        {/* Lower confidence band */}
                        {showRegression && regression && (
                          <Line data={regressionLineData} dataKey="lower" type="linear"
                            stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="5 3"
                            dot={false} opacity={0.45} isAnimationActive={false} legendType="none" />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: 'hsl(var(--primary)/0.55)' }} />
                    נקודה רגילה
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full inline-block bg-red-500" />
                    חריג (&gt;{sigmaThreshold[0].toFixed(1)}σ)
                  </div>
                  {showRegression && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-6 border-t-2" style={{ borderColor: 'hsl(var(--primary))' }} />
                      קו רגרסיה ± {sigmaThreshold[0].toFixed(1)}σ
                    </div>
                  )}
                </div>
                </> /* end chart+legend fragment */
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm border rounded-lg">
              {!xParam || !yParam ? 'בחר פרמטר X ופרמטר Y להצגת התפלגות משותפת' : 'אין נתונים לטווח הנבחר'}
            </div>
          )}

          <FullscreenOverlay isOpen={jointFullscreen} onClose={() => setJointFullscreen(false)} title={`${DataAdapter.getParameterDisplayName(yParam)} vs ${DataAdapter.getParameterDisplayName(xParam)} — מסך מלא`}>
            <div className="h-[calc(100vh-140px)]" ref={jointChartRef}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 20, right: 40, bottom: 60, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="x" type="number" domain={['auto','auto']} tickFormatter={(v:number) => v.toFixed(1)} tick={{ fontSize: 11 }} label={{ value: DataAdapter.getParameterDisplayName(xParam), position: 'insideBottom', offset: -20, fontSize: 13 }} />
                  <YAxis dataKey="y" type="number" domain={['auto','auto']} tickFormatter={(v:number) => v.toFixed(1)} tick={{ fontSize: 11 }} width={56} label={{ value: DataAdapter.getParameterDisplayName(yParam), angle: -90, position: 'insideLeft', fontSize: 13 }} />
                  <Scatter data={enrichedScatter} isAnimationActive={false}>
                    {enrichedScatter.map((p, i) => (<Cell key={i} fill={p.isOutlier ? '#ef4444' : 'hsl(var(--primary)/0.55)'} />))}
                  </Scatter>
                  {showRegression && regression && <Line data={regressionLineData} dataKey="y" type="linear" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} isAnimationActive={false} legendType="none" />}
                  {showRegression && regression && <Line data={regressionLineData} dataKey="upper" type="linear" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="6 3" dot={false} opacity={0.5} isAnimationActive={false} legendType="none" />}
                  {showRegression && regression && <Line data={regressionLineData} dataKey="lower" type="linear" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="6 3" dot={false} opacity={0.5} isAnimationActive={false} legendType="none" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </FullscreenOverlay>
        </>
      )}
    </div>
    </TooltipProvider>
  );
};
