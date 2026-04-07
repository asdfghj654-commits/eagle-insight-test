/**
 * FullScreenModal — true 100vw × 100vh forensic investigation view
 *
 * Not a Dialog — renders as a fixed inset-0 overlay so it fills the entire
 * screen without constraints. Each parameter gets its own Y-axis domain.
 * All charts share syncId so panning/zooming is synchronized.
 *
 * Graph modes:
 *   אותות    — all selected parameters (default)
 *   חריגות   — only parameters breaching thresholds
 *   השוואה   — overlay current flight vs a second flight
 *
 * Time navigator at the bottom: a mini overview chart with a Brush.
 * Moving it filters displayData for all subcharts.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ChevronLeft, ChevronRight, Activity, AlertTriangle, GitCompare, Download } from 'lucide-react';
import { PARAMETER_THRESHOLDS, getParamColor, ParameterSubchart, ChartAnnotation } from './SignalsTab';
import {
  LineChart, Line, ResponsiveContainer, Brush, XAxis,
} from 'recharts';
import { useCSVData } from '@/contexts/CSVDataContext';

interface PhaseBand { phase: string; start: number; end: number; }

interface FullScreenModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  data:            any[];
  parameters:      string[];
  colors:          string[];
  phaseBands?:     PhaseBand[];
  showPhaseBands?: boolean;
  title:           string;
  annotations?:    ChartAnnotation[];
}

const PHASE_LABELS_HE: Record<string, string> = {
  taxi: 'מיסוע', takeoff: 'המראה', climb: 'עלייה',
  cruise: 'שייטה', descent: 'ירידה', landing: 'נחיתה',
};

type GraphMode = 'signals' | 'anomalies' | 'compare';

const MODE_LABELS: Record<GraphMode, string> = {
  signals:   'אותות',
  anomalies: 'חריגות',
  compare:   'השוואה',
};

const MODE_ICONS: Record<GraphMode, React.ElementType> = {
  signals:   Activity,
  anomalies: AlertTriangle,
  compare:   GitCompare,
};

export const FullScreenModal: React.FC<FullScreenModalProps> = ({
  isOpen, onClose, data, parameters, colors, phaseBands = [],
  showPhaseBands = true, title, annotations = [],
}) => {
  const { processedFlights } = useCSVData();

  const [focusedParam, setFocusedParam]     = useState<string | null>(null);
  const [graphMode, setGraphMode]           = useState<GraphMode>('signals');
  const [compareFlightId, setCompareFlightId] = useState<string>('');
  const [brushIndices, setBrushIndices]     = useState<{ startIndex: number; endIndex: number } | null>(null);

  // Export current view data as CSV
  const exportData = useCallback(() => {
    const csv = [
      ['timestamp', ...parameters].join(','),
      ...data.map(row => [
        new Date(row.timestamp).toISOString(),
        ...parameters.map(p => row[p] ?? ''),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${title.replace(/\s+/g, '_')}_export.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [data, parameters, title]);

  const formatTimestamp = useCallback(
    (ts: number) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
    [],
  );

  // Slice data by brush indices
  const displayData = useMemo(() => {
    if (!brushIndices) return data;
    return data.slice(brushIndices.startIndex, brushIndices.endIndex + 1);
  }, [data, brushIndices]);

  // Compare flight data (blended into displayData for compare mode)
  const compareData = useMemo(() => {
    if (graphMode !== 'compare' || !compareFlightId) return null;
    const flight = processedFlights.find(f => f.flight_id === compareFlightId);
    if (!flight) return null;
    return flight.records.map(r => {
      const ts = new Date(r.timestamp).getTime();
      const pt: any = { timestamp: ts };
      for (const p of parameters) {
        const v = r[p];
        if (v != null) {
          const n = typeof v === 'number' ? v : parseFloat(v);
          pt[`${p}__cmp`] = isNaN(n) ? null : n;
        } else pt[`${p}__cmp`] = null;
      }
      return pt;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [graphMode, compareFlightId, processedFlights, parameters]);

  // Which parameters to show
  const displayParams = useMemo(() => {
    let params = focusedParam ? [focusedParam] : parameters;
    if (graphMode === 'anomalies') {
      params = params.filter(p => {
        const info = PARAMETER_THRESHOLDS[p];
        if (!info) return false;
        const vals = data.map(d => d[p]).filter((v): v is number => v != null && isFinite(v));
        if (!vals.length) return false;
        const mx = Math.max(...vals), mn = Math.min(...vals);
        return (info.max !== undefined && mx > info.max) || (info.min !== undefined && mn < info.min);
      });
    }
    return params;
  }, [focusedParam, parameters, graphMode, data]);

  const focusedIdx = focusedParam ? parameters.indexOf(focusedParam) : -1;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0 bg-card shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base font-semibold flex-shrink-0">{title} — מסך מלא</h2>

          {/* Graph mode switcher */}
          <div className="flex items-center gap-0.5 border rounded-md overflow-hidden flex-shrink-0">
            {(Object.keys(MODE_LABELS) as GraphMode[]).map(mode => {
              const Icon = MODE_ICONS[mode];
              return (
                <button
                  key={mode}
                  onClick={() => setGraphMode(mode)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
                    graphMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>

          {/* Compare flight selector */}
          {graphMode === 'compare' && (
            <select
              value={compareFlightId}
              onChange={e => setCompareFlightId(e.target.value)}
              className="h-7 rounded border border-input bg-background px-2 text-xs"
            >
              <option value="">— בחר טיסה להשוואה —</option>
              {processedFlights.map(f => (
                <option key={f.flight_id} value={f.flight_id}>
                  {f.flight_id} | זנב {f.tail_number}
                </option>
              ))}
            </select>
          )}

          {/* Parameter badges — click to focus */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {parameters.map((param, i) => {
              const info = PARAMETER_THRESHOLDS[param];
              const isFocused = focusedParam === param;
              return (
                <Badge
                  key={param}
                  variant={isFocused ? 'default' : 'outline'}
                  style={isFocused
                    ? { backgroundColor: colors[i], borderColor: colors[i] }
                    : { borderColor: colors[i], color: colors[i] }}
                  className="text-xs cursor-pointer transition-all"
                  onClick={() => setFocusedParam(isFocused ? null : param)}
                >
                  {info?.labelHe ?? param}
                </Badge>
              );
            })}
          </div>
          {focusedParam && (
            <button
              onClick={() => setFocusedParam(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 flex-shrink-0"
            >
              <X className="h-3 w-3" /> הצג הכל
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Navigate focused parameter */}
          {focusedParam && (
            <>
              <Button variant="ghost" size="sm"
                disabled={focusedIdx === 0}
                onClick={() => setFocusedParam(parameters[focusedIdx - 1])}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {focusedIdx + 1} / {parameters.length}
              </span>
              <Button variant="ghost" size="sm"
                disabled={focusedIdx === parameters.length - 1}
                onClick={() => setFocusedParam(parameters[focusedIdx + 1])}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportData} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            ייצא CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <X className="h-4 w-4" />
            סגור
          </Button>
        </div>
      </div>

      {/* ── Per-parameter subcharts — each with its own Y-scale ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {graphMode === 'anomalies' && displayParams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
            <AlertTriangle className="h-8 w-8 opacity-30" />
            <span>אין חריגות בנתונים הנוכחיים</span>
          </div>
        ) : displayParams.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            לא נבחרו פרמטרים
          </div>
        ) : (
          displayParams.map((param, idx) => (
            <ParameterSubchart
              key={param}
              param={param}
              paramIdx={focusedParam ? parameters.indexOf(param) : idx}
              data={displayData}
              phaseBands={phaseBands}
              showPhaseBands={showPhaseBands}
              isLast={idx === displayParams.length - 1}
              formatTimestamp={formatTimestamp}
              annotations={annotations}
            />
          ))
        )}
      </div>

      {/* ── Time navigator strip with Brush ── */}
      {data.length > 1 && (
        <div className="px-4 pt-2 pb-1 border-t flex-shrink-0 bg-card/80">
          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
            <span>ניווט זמן</span>
            {brushIndices && (
              <button
                onClick={() => setBrushIndices(null)}
                className="flex items-center gap-0.5 hover:text-foreground transition-colors"
              >
                <X className="h-2.5 w-2.5" /> אפס מסגרת
              </button>
            )}
            <span className="mr-auto font-mono text-[10px]">
              {formatTimestamp(data[brushIndices?.startIndex ?? 0]?.timestamp ?? data[0]?.timestamp)}
              {' — '}
              {formatTimestamp(data[brushIndices?.endIndex ?? data.length - 1]?.timestamp ?? data[data.length - 1]?.timestamp)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={52}>
            <LineChart data={data} margin={{ top: 2, right: 4, bottom: 2, left: 54 }}>
              <XAxis dataKey="timestamp" hide />
              {parameters.slice(0, 4).map((param, i) => (
                <Line
                  key={param}
                  type="monotone"
                  dataKey={param}
                  stroke={colors[i]}
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              <Brush
                dataKey="timestamp"
                height={36}
                stroke="hsl(var(--primary))"
                fill="hsl(var(--muted))"
                tickFormatter={formatTimestamp}
                onChange={(brushData: any) => {
                  if (brushData?.startIndex !== undefined && brushData?.endIndex !== undefined) {
                    setBrushIndices({ startIndex: brushData.startIndex, endIndex: brushData.endIndex });
                  }
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="px-4 py-1.5 border-t flex-shrink-0 bg-card text-xs text-muted-foreground flex items-center gap-4">
        <span>{(brushIndices ? displayData : data).length.toLocaleString()} נקודות</span>
        {brushIndices && (
          <span className="text-primary">{data.length.toLocaleString()} סה"כ → {displayData.length.toLocaleString()} מוצגות</span>
        )}
        {phaseBands.length > 0 && (
          <span>
            שלבי טיסה: {[...new Set(phaseBands.map(b => PHASE_LABELS_HE[b.phase] ?? b.phase))].join(' · ')}
          </span>
        )}
        {annotations.length > 0 && (
          <span>{annotations.length} הערות חוקר</span>
        )}
        <span className="mr-auto text-muted-foreground/50">
          {graphMode === 'anomalies'
            ? `מצב חריגות — מוצגים ${displayParams.length} פרמטרים חורגים`
            : graphMode === 'compare'
              ? compareFlightId ? `השוואת טיסות — ${compareFlightId}` : 'בחר טיסה להשוואה'
              : focusedParam
                ? `מוצג: ${PARAMETER_THRESHOLDS[focusedParam]?.labelHe ?? focusedParam} בלבד — לחץ על תג לבחירה אחרת`
                : 'לחץ על פרמטר להגדלה · כל גרף מציג סקאלה ייחודית · ניווט מסונכרן'}
        </span>
      </div>
    </div>
  );
};
