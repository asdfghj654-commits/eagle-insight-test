import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCSVData } from '@/contexts/CSVDataContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, ResponsiveContainer, Brush, ReferenceLine, ReferenceArea,
} from 'recharts';
import { SelectionSetsPanel } from './SelectionSetsPanel';
import { StatsBar } from './StatsBar';
import { PhaseBandsToggle } from './PhaseBandsToggle';
import { GraphEditor } from './GraphEditor';
import { FullScreenModal } from './FullScreenModal';
import { DemoDataButton } from './DemoDataButton';
import { Activity, Plane, AlertTriangle, Maximize2, Settings, Info, User, Briefcase, MapPin, FileText, X, FileDown, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProcessedFlight } from '@/contexts/CSVDataContext';

// ── Parameter metadata ────────────────────────────────────────────
interface ThresholdInfo {
  max?: number; warningMax?: number; min?: number; warningMin?: number;
  unit: string; labelHe: string;
}
export const PARAMETER_THRESHOLDS: Record<string, ThresholdInfo> = {
  hydraulic_pressure_psi: { max: 3100, warningMax: 3050, unit: 'PSI', labelHe: 'לחץ הידראולי' },
  egt_celsius:            { max: 650,  warningMax: 570,  unit: '°C',  labelHe: 'EGT — גזי פליטה' },
  oil_pressure:           { max: 130,  warningMax: 120, min: 18, warningMin: 25, unit: 'PSI', labelHe: 'לחץ שמן' },
  brake_temp_celsius:     { max: 450,  warningMax: 350,  unit: '°C',  labelHe: 'טמפרטורת בלמים' },
  fuel_flow_pph:          { max: 14000, warningMax: 12500, unit: 'PPH', labelHe: 'צריכת דלק' },
  g_force:                { max: 9.0, warningMax: 7.5, min: -3.0, warningMin: -2.5, unit: 'G', labelHe: 'עומס G' },
  fuel_remaining_lbs:     { min: 500, warningMin: 1000, unit: 'lbs', labelHe: 'דלק נותר' },
  altitude:               { max: 50000, unit: 'ft',  labelHe: 'גובה' },
  airspeed:               { max: 900,   unit: 'kts', labelHe: 'מהירות' },
  n1_pct:                 { max: 105, warningMax: 100, unit: '%', labelHe: 'N1 — מנוע' },
  voltage_v:              { max: 30, warningMax: 29, min: 22, warningMin: 24, unit: 'V', labelHe: 'מתח חשמלי' },
};

// ── Context fields: NOT plotted as signals ────────────────────────
// These are metadata/tags — displayed in the flight header, not in charts
const CONTEXT_FIELD_NAMES = new Set([
  'flight_id','tail_number','timestamp','phase',
  'pilot_name','pilot_id','base','technician','note','notes',
  'aircraft_type','mission_type','mission','squadron','unit',
  'sortie','remarks','remark','crew','aircraft','aircraft_id',
]);

/** Returns true if a column has mostly numeric data (is plottable as a signal) */
function isNumericParam(param: string, sample: any[]): boolean {
  if (CONTEXT_FIELD_NAMES.has(param)) return false;
  if (sample.length === 0) return true;
  const check = sample.slice(0, 30);
  const numericCount = check.filter(d => typeof d[param] === 'number' && isFinite(d[param])).length;
  return numericCount >= check.length * 0.4;
}

// ── Colours ───────────────────────────────────────────────────────
const PARAM_LINE_COLORS: Record<string, string> = {
  hydraulic_pressure_psi: '#3b82f6',
  egt_celsius:            '#ef4444',
  oil_pressure:           '#f59e0b',
  brake_temp_celsius:     '#f97316',
  fuel_flow_pph:          '#84cc16',
  g_force:                '#8b5cf6',
  fuel_remaining_lbs:     '#06b6d4',
  altitude:               '#64748b',
  airspeed:               '#6366f1',
  n1_pct:                 '#ec4899',
  voltage_v:              '#eab308',
};
const DEFAULT_COLORS = ['#3b82f6','#ef4444','#f59e0b','#84cc16','#8b5cf6','#06b6d4','#ec4899','#eab308'];
export const getParamColor = (param: string, idx = 0) =>
  PARAM_LINE_COLORS[param] ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

// ── Phase design: neutral zebra stripes + transition labels ───────
// IMPORTANT: phases use desaturated greys — NOT colored fills.
// Signal lines keep bright colors; phases are purely positional context.
const PHASE_LABELS_HE: Record<string, string> = {
  taxi: 'מיסוע', takeoff: 'המראה', climb: 'עלייה',
  cruise: 'שייטה', descent: 'ירידה', landing: 'נחיתה',
};

// ── Flight context banner ─────────────────────────────────────────
interface FlightContextBannerProps {
  flight: ProcessedFlight;
  contextFields: Record<string, string>;
}
const FlightContextBanner: React.FC<FlightContextBannerProps> = ({ flight, contextFields }) => {
  const startDate = new Date(flight.startTime);
  const durationMin = Math.round((new Date(flight.endTime).getTime() - startDate.getTime()) / 60000);
  const pilot   = contextFields.pilot_name;
  const mission = contextFields.mission_type || contextFields.mission;
  const base    = contextFields.base;
  const tech    = contextFields.technician;
  const note    = contextFields.note || contextFields.notes;

  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 overflow-hidden" dir="rtl">
      {/* Primary row: flight ID + tail + date */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-blue-400" />
          <span className="font-bold text-blue-300">זנב {flight.tail_number}</span>
        </div>
        <span className="text-slate-400 font-mono text-xs">{flight.flight_id}</span>
        <Separator orientation="vertical" className="h-3.5 bg-slate-600" />
        <span className="text-slate-400 text-xs">
          {startDate.toLocaleDateString('he-IL')} · {durationMin} דק׳ · {flight.records.length} רשומות
        </span>
        {mission && (
          <>
            <Separator orientation="vertical" className="h-3.5 bg-slate-600" />
            <Badge variant="outline" className="text-blue-300 border-blue-700 text-xs">{mission}</Badge>
          </>
        )}
      </div>

      {/* Context row: only shown when context fields exist */}
      {(pilot || base || tech || note) && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-2 text-xs">
          {pilot && (
            <span className="flex items-center gap-1.5 text-slate-300">
              <User className="h-3 w-3 text-slate-500" />
              {pilot}
            </span>
          )}
          {base && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <MapPin className="h-3 w-3 text-slate-500" />
              {base}
            </span>
          )}
          {tech && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <Briefcase className="h-3 w-3 text-slate-500" />
              טכנאי: {tech}
            </span>
          )}
          {note && (
            <span className="flex items-center gap-1.5 text-slate-400 italic">
              <FileText className="h-3 w-3 text-slate-500" />
              {note}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Investigative Phase Timeline ──────────────────────────────────
// Clickable phase bar — each segment zooms the charts to that phase.
// Color palette is distinct from signal line colors (signal = per-param; phase = activity zone).
const PHASE_BAND_COLORS: Record<string, string> = {
  taxi:    '#64748b',   // slate — ground ops
  takeoff: '#2563eb',   // blue  — critical departure
  climb:   '#16a34a',   // green — climbing
  cruise:  '#7c3aed',   // violet — cruise
  descent: '#d97706',   // amber — descending
  landing: '#dc2626',   // red   — critical arrival
};

interface PhaseBand { phase: string; start: number; end: number }

const PhaseTimeline: React.FC<{
  bands: PhaseBand[];
  focused: string | null;
  chartData: any[];
  selectedParameters: string[];
  onFocus: (phase: string | null) => void;
}> = ({ bands, focused, chartData, selectedParameters, onFocus }) => {
  if (bands.length === 0) return null;

  const totalMs = (bands[bands.length - 1].end - bands[0].start) || 1;

  // Per-phase stats for the stats panel
  const phaseStats = useMemo(() => {
    if (!focused) return null;
    const band = bands.find(b => b.phase === focused);
    if (!band) return null;
    const pts = chartData.filter(d => d.timestamp >= band.start && d.timestamp <= band.end);
    const duration = Math.round((band.end - band.start) / 60000);
    const params = selectedParameters.map(p => {
      const vals = pts.map(d => d[p]).filter((v): v is number => v != null && isFinite(v));
      if (!vals.length) return null;
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const info = PARAMETER_THRESHOLDS[p];
      return { param: p, avg, min: Math.min(...vals), max: Math.max(...vals), info, color: getParamColor(p, selectedParameters.indexOf(p)) };
    }).filter(Boolean) as { param: string; avg: number; min: number; max: number; info: any; color: string }[];

    return { duration, count: pts.length, params, band };
  }, [focused, bands, chartData, selectedParameters]);

  return (
    <div className="space-y-2" dir="rtl">
      {/* Label row */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground">שלבי טיסה</span>
        <span className="text-muted-foreground/60">— לחץ על שלב לניתוח מרוכז</span>
        {focused && (
          <button
            onClick={() => onFocus(null)}
            className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors mr-auto text-[11px]"
          >
            <X className="h-3 w-3" />
            נקה בחירה
          </button>
        )}
      </div>

      {/* Proportional phase bar */}
      <div className="flex h-8 rounded-lg overflow-hidden gap-px w-full">
        {bands.map((band, i) => {
          const pct = ((band.end - band.start) / totalMs) * 100;
          const color = PHASE_BAND_COLORS[band.phase] ?? '#94a3b8';
          const isFocused = focused === band.phase;
          const isDimmed  = focused !== null && !isFocused;
          const durationMin = Math.round((band.end - band.start) / 60000);

          return (
            <button
              key={i}
              onClick={() => onFocus(isFocused ? null : band.phase)}
              title={`${PHASE_LABELS_HE[band.phase] ?? band.phase} — ${durationMin} דקות`}
              className="flex items-center justify-center text-white text-[10px] font-semibold transition-all overflow-hidden hover:brightness-110 relative"
              style={{
                width: `${pct}%`,
                minWidth: '6px',
                backgroundColor: color,
                opacity: isDimmed ? 0.25 : 1,
                boxShadow: isFocused ? `0 0 0 2px white inset` : 'none',
              }}
            >
              {pct > 10 && <span className="truncate px-1">{PHASE_LABELS_HE[band.phase] ?? band.phase}</span>}
              {pct > 16 && <span className="opacity-70 text-[9px]"> {durationMin}דק</span>}
            </button>
          );
        })}
      </div>

      {/* Focused phase stats panel */}
      {phaseStats && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: PHASE_BAND_COLORS[focused!] ?? '#94a3b8' }}
              />
              {PHASE_LABELS_HE[focused!] ?? focused}
            </span>
            <span className="text-muted-foreground">{phaseStats.duration} דק׳ · {phaseStats.count} נקודות</span>
          </div>
          {phaseStats.params.length > 0 && (
            <div className="space-y-1.5">
              {phaseStats.params.map(({ param, avg, min, max, info, color }) => (
                <div key={param} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="w-24 truncate text-muted-foreground">{info?.labelHe ?? param}</span>
                  <span className="font-mono font-medium">{avg.toFixed(1)}</span>
                  <span className="text-muted-foreground text-[10px]">
                    ({min.toFixed(1)}–{max.toFixed(1)}{info?.unit ? ` ${info.unit}` : ''})
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/60 pt-1 border-t">
            ממוצע · (מינימום–מקסימום) בשלב זה
          </p>
        </div>
      )}
    </div>
  );
};

// ── Annotation type ───────────────────────────────────────────────
export interface ChartAnnotation {
  id: string;
  timestamp: number;
  text: string;
  type: 'note' | 'fault' | 'rule' | 'maintenance';
  author?: string;
}

const ANNOTATION_COLORS: Record<ChartAnnotation['type'], string> = {
  note:        '#6366f1',
  fault:       '#ef4444',
  rule:        '#f59e0b',
  maintenance: '#22c55e',
};

const ANNOTATION_LABELS: Record<ChartAnnotation['type'], string> = {
  note:        'הע',
  fault:       'תק',
  rule:        'כל',
  maintenance: 'אח',
};

const ANNOTATION_LABELS_HE: Record<ChartAnnotation['type'], string> = {
  note:        'הערה',
  fault:       'תקלה',
  rule:        'כלל',
  maintenance: 'אחזקה',
};

// ── Per-parameter subchart ─────────────────────────────────────────
interface SubchartProps {
  param: string; paramIdx: number; data: any[];
  phaseBands: { phase: string; start: number; end: number }[];
  showPhaseBands: boolean; isLast: boolean;
  onBrushChange?: (data: any) => void;
  formatTimestamp: (ts: number) => string;
  // Forensic extensions
  annotations?: ChartAnnotation[];
  showMovingAvg?: boolean;
  onChartClick?: (timestamp: number) => void;
}

export const ParameterSubchart = memo(({
  param, paramIdx, data, phaseBands, showPhaseBands, isLast, onBrushChange, formatTimestamp,
  annotations = [], showMovingAvg = false, onChartClick,
}: SubchartProps) => {
  const info  = PARAMETER_THRESHOLDS[param];
  const color = getParamColor(param, paramIdx);

  const { maxVal, minVal } = useMemo(() => {
    const vals = data.map(d => d[param]).filter((v): v is number => v != null && isFinite(v));
    return vals.length > 0
      ? { maxVal: Math.max(...vals), minVal: Math.min(...vals) }
      : { maxVal: 0, minVal: 0 };
  }, [data, param]);

  // Moving average overlay data
  const maData = useMemo(() => {
    if (!showMovingAvg || data.length < 5) return [];
    const win = Math.min(20, Math.max(5, Math.floor(data.length / 15)));
    return data.map((d, i) => {
      const slice = data.slice(Math.max(0, i - win), i + 1);
      const vals  = slice.map(s => s[param]).filter((v): v is number => v != null && isFinite(v));
      const avg   = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
      return { timestamp: d.timestamp, [`${param}__ma`]: avg };
    });
  }, [data, param, showMovingAvg]);

  // Data gap detection — spans > 3× average interval
  const dataGaps = useMemo(() => {
    if (data.length < 3) return [];
    const intervals = data.slice(1).map((d, i) => d.timestamp - data[i].timestamp);
    const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const threshold = avg * 3;
    return intervals
      .map((gap, i) => gap > threshold ? { start: data[i].timestamp, end: data[i + 1].timestamp } : null)
      .filter(Boolean) as { start: number; end: number }[];
  }, [data]);

  const isMaxBreach = info?.max !== undefined && maxVal > info.max;
  const isMinBreach = info?.min !== undefined && minVal < info.min;
  const isWarnMax   = !isMaxBreach && info?.warningMax !== undefined && maxVal > info.warningMax;
  const isWarnMin   = !isMinBreach && info?.warningMin !== undefined && minVal < info.warningMin;
  const breached = isMaxBreach || isMinBreach;
  const warned   = isWarnMax || isWarnMin;

  const yPad = 0.08;
  const rawMin = info?.min !== undefined ? Math.min(minVal, info.min) : minVal;
  const rawMax = info?.max !== undefined ? Math.max(maxVal, info.max) : maxVal;
  const span   = rawMax - rawMin || 1;
  const yDomain: [number, number] = [rawMin - span * yPad, rawMax + span * yPad];

  const borderCls = breached ? 'border-red-500' : warned ? 'border-amber-400' : 'border-border';
  const headerBg  = breached
    ? 'bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800'
    : warned
      ? 'bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800'
      : 'bg-muted/30 border-b border-border';

  // Rich forensic tooltip
  const ForensicTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const value = payload[0]?.value as number;
    if (value == null) return null;
    const phase = phaseBands.find(b => label >= b.start && label <= b.end)?.phase;
    const overLimit  = info?.max !== undefined && value > info.max;
    const overWarn   = !overLimit && info?.warningMax !== undefined && value > info.warningMax;
    const nearbyAnnotation = annotations.find(a => Math.abs(a.timestamp - label) < (data.length > 1 ? (data[1]?.timestamp - data[0]?.timestamp) * 5 : 5000));

    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-3 text-xs" dir="rtl" style={{ minWidth: 180, pointerEvents: 'none' }}>
        {/* Timestamp */}
        <div className="font-mono text-muted-foreground text-[10px] mb-2 pb-2 border-b">
          {new Date(label).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        {/* Value + status */}
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="font-bold" style={{ color }}>
            {Number(value).toFixed(2)} {info?.unit ?? ''}
          </span>
          {overLimit  && <span className="text-red-600 font-bold text-[10px] bg-red-50 px-1.5 py-0.5 rounded">חריגה ↑</span>}
          {overWarn   && <span className="text-amber-600 font-medium text-[10px] bg-amber-50 px-1.5 py-0.5 rounded">אזהרה</span>}
          {!overLimit && !overWarn && <span className="text-emerald-600 text-[10px]">✓ תקין</span>}
        </div>
        {/* Distance from limit */}
        {info?.max !== undefined && (
          <div className="text-muted-foreground text-[10px]">
            {overLimit
              ? `+${(value - info.max).toFixed(2)} מעל LIM ${info.max}`
              : `${(info.max - value).toFixed(2)} מתחת ל-LIM ${info.max}`} {info.unit}
          </div>
        )}
        {/* Phase */}
        {phase && (
          <div className="text-muted-foreground text-[10px] mt-1 flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-sm inline-block"
              style={{ backgroundColor: PHASE_BAND_COLORS[phase] ?? '#94a3b8' }}
            />
            {PHASE_LABELS_HE[phase] ?? phase}
          </div>
        )}
        {/* Nearby annotation */}
        {nearbyAnnotation && (
          <div className="mt-2 pt-2 border-t text-[10px]" style={{ color: ANNOTATION_COLORS[nearbyAnnotation.type] }}>
            {ANNOTATION_LABELS[nearbyAnnotation.type]}: {nearbyAnnotation.text}
          </div>
        )}
      </div>
    );
  };

  const handleChartClick = (chartData: any) => {
    if (onChartClick && chartData?.activeLabel) {
      onChartClick(chartData.activeLabel as number);
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${borderCls}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-1.5 text-xs ${headerBg}`} dir="rtl">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold">{info?.labelHe ?? param}</span>
          {info?.unit && <span className="text-muted-foreground">[{info.unit}]</span>}
          {showMovingAvg && <Badge variant="outline" className="text-[9px] h-3.5 px-1">MA</Badge>}
          {dataGaps.length > 0 && (
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-muted-foreground">
              {dataGaps.length} חסר
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground tabular-nums">
            {minVal.toFixed(1)} – {maxVal.toFixed(1)}{info?.unit ? ` ${info.unit}` : ''}
          </span>
          {breached && <Badge variant="destructive" className="py-0 h-4 text-[10px]">חריגה</Badge>}
          {!breached && warned && <Badge variant="outline" className="py-0 h-4 text-[10px] text-amber-700 border-amber-400">אזהרה</Badge>}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={isLast ? 180 : 150}>
        <LineChart
          data={data}
          syncId="eagle-signals"
          margin={{ top: 4, right: 10, bottom: isLast ? 28 : 4, left: 4 }}
          onClick={onChartClick ? handleChartClick : undefined}
          style={onChartClick ? { cursor: 'crosshair' } : undefined}
        >
          {/* ── Threshold shading bands ── */}
          {/* Warning zone: from warningMax to max (amber fill) */}
          {info?.warningMax !== undefined && info?.max !== undefined && (
            <ReferenceArea y1={info.warningMax} y2={info.max}
              fill="#f59e0b" fillOpacity={0.05} strokeWidth={0} />
          )}
          {/* Danger zone: above max (red fill) */}
          {info?.max !== undefined && (
            <ReferenceArea y1={info.max} y2={yDomain[1]}
              fill="#ef4444" fillOpacity={0.07} strokeWidth={0} />
          )}
          {/* Low warning zone: warningMin to min (amber) */}
          {info?.warningMin !== undefined && info?.min !== undefined && (
            <ReferenceArea y1={info.min} y2={info.warningMin}
              fill="#f59e0b" fillOpacity={0.05} strokeWidth={0} />
          )}
          {/* Low danger zone: below min (red) */}
          {info?.min !== undefined && (
            <ReferenceArea y1={yDomain[0]} y2={info.min}
              fill="#ef4444" fillOpacity={0.07} strokeWidth={0} />
          )}

          {/* ── Phase bands ── */}
          {showPhaseBands && phaseBands.map((band, i) => (
            <ReferenceArea key={`phase-${i}`} x1={band.start} x2={band.end}
              fill={i % 2 === 0 ? '#94a3b8' : '#64748b'}
              fillOpacity={0.05} strokeWidth={0} />
          ))}

          {/* Phase transition markers */}
          {showPhaseBands && phaseBands.map((band, i) =>
            i === 0 ? null : (
              <ReferenceLine key={`pt-${i}`} x={band.start}
                stroke="#94a3b8" strokeDasharray="2 6" strokeWidth={1}
                label={isLast ? undefined : { value: PHASE_LABELS_HE[band.phase] ?? band.phase, position: 'insideTopLeft', fill: '#94a3b8', fontSize: 7 }}
              />
            )
          )}

          {/* ── Data gaps: gray diagonal-stripe bands ── */}
          {dataGaps.map((gap, i) => (
            <ReferenceArea key={`gap-${i}`} x1={gap.start} x2={gap.end}
              fill="#64748b" fillOpacity={0.18} stroke="#94a3b8"
              strokeDasharray="4 4" strokeWidth={0.5} />
          ))}

          {/* ── Annotation markers ── */}
          {annotations.map(ann => (
            <ReferenceLine key={ann.id} x={ann.timestamp}
              stroke={ANNOTATION_COLORS[ann.type]} strokeWidth={1.5}
              strokeDasharray="6 3"
              label={{
                value: ANNOTATION_LABELS[ann.type],
                position: 'insideTopRight',
                fill: ANNOTATION_COLORS[ann.type],
                fontSize: 9,
              }}
            />
          ))}

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

          <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin','dataMax']}
            tickFormatter={formatTimestamp} hide={!isLast} tick={{ fontSize: 10 }} />

          <YAxis domain={yDomain} tickFormatter={(v: number) => v.toFixed(0)}
            tick={{ fontSize: 9 }} width={54} tickCount={4} />

          {/* Threshold lines */}
          {info?.max !== undefined && (
            <ReferenceLine y={info.max} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
              label={{ value: `LIM ${info.max}`, position: 'insideTopRight', fill: '#ef4444', fontSize: 9 }} />
          )}
          {info?.warningMax !== undefined && (
            <ReferenceLine y={info.warningMax} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1}
              label={{ value: `WARN ${info.warningMax}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 9 }} />
          )}
          {info?.min !== undefined && (
            <ReferenceLine y={info.min} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
              label={{ value: `MIN ${info.min}`, position: 'insideBottomRight', fill: '#f59e0b', fontSize: 9 }} />
          )}

          {/* Rich forensic tooltip */}
          <ChartTooltip content={<ForensicTooltip />} />

          {/* Raw signal line */}
          <Line type="monotone" dataKey={param} stroke={color} strokeWidth={2}
            dot={false} connectNulls={false} isAnimationActive={false} />

          {/* Moving average overlay */}
          {showMovingAvg && maData.length > 0 && (
            <Line
              data={maData}
              type="monotone"
              dataKey={`${param}__ma`}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="8 4"
              dot={false}
              isAnimationActive={false}
              opacity={0.65}
              connectNulls
            />
          )}

          {isLast && onBrushChange && (
            <Brush dataKey="timestamp" height={40} stroke="hsl(var(--primary))"
              onChange={onBrushChange} tickFormatter={formatTimestamp} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
ParameterSubchart.displayName = 'ParameterSubchart';

// ── Main component ────────────────────────────────────────────────
export const SignalsTab: React.FC = memo(() => {
  const { processedFlights, availableParameters, createSelectionSet } = useCSVData();

  // Build chart data first (needed for isNumericParam check)
  const allRecords = useMemo(() =>
    processedFlights.flatMap(f => f.records),
  [processedFlights]);

  // Split: numeric params (signals) vs context fields (metadata)
  const { numericParams, contextFieldKeys } = useMemo(() => {
    const numeric: string[] = [];
    const contextKeys: string[] = [];
    availableParameters.forEach(p => {
      if (isNumericParam(p, allRecords)) numeric.push(p);
      else if (!CONTEXT_FIELD_NAMES.has(p)) contextKeys.push(p);
    });
    return { numericParams: numeric, contextFieldKeys: contextKeys };
  }, [availableParameters, allRecords]);

  const parameterPriority = useMemo(() =>
    [...numericParams].sort((a, b) => {
      const aK = PARAMETER_THRESHOLDS[a] ? 0 : 1;
      const bK = PARAMETER_THRESHOLDS[b] ? 0 : 1;
      return aK - bK || a.localeCompare(b);
    }),
  [numericParams]);

  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [selectedFlight, setSelectedFlight]         = useState<string>('');
  const [showPhaseBands, setShowPhaseBands]          = useState(true);
  const [showGraphEditor, setShowGraphEditor]        = useState(false);
  const [showFullScreen, setShowFullScreen]          = useState(false);
  const [focusedPhase, setFocusedPhase]             = useState<string | null>(null);
  // Forensic extensions
  const [showMovingAvg, setShowMovingAvg]           = useState(false);
  const [annotationMode, setAnnotationMode]         = useState(false);
  const [annotations, setAnnotations]               = useState<ChartAnnotation[]>([]);
  const [pendingAnnotation, setPendingAnnotation]   = useState<{ timestamp: number } | null>(null);
  const [annotationDraft, setAnnotationDraft]       = useState('');
  const [annotationDraftType, setAnnotationDraftType] = useState<ChartAnnotation['type']>('note');

  useEffect(() => {
    setSelectedParameters(prev => {
      const valid = prev.filter(p => numericParams.includes(p));
      return valid.length > 0 ? valid : parameterPriority.slice(0, 4);
    });
  }, [numericParams, parameterPriority]);

  // Default to latest flight when data loads
  useEffect(() => {
    if (processedFlights.length > 0) {
      const latest = [...processedFlights].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
      setSelectedFlight(latest.flight_id);
    }
  }, [processedFlights]);

  // Chart data — only numeric columns
  const chartData = useMemo(() => {
    if (processedFlights.length === 0 || selectedParameters.length === 0) return [];
    const points: any[] = [];
    processedFlights
      .filter(f => !selectedFlight || selectedFlight === 'all' || f.flight_id === selectedFlight)
      .forEach(f => f.records.forEach(r => {
        const ts = new Date(r.timestamp).getTime();
        if (isNaN(ts)) return;
        const pt: any = { timestamp: ts, phase: r.phase, flight_id: r.flight_id, tail_number: r.tail_number };
        for (const p of selectedParameters) {
          const v = r[p];
          if (v != null) {
            const n = typeof v === 'number' ? v : parseFloat(v);
            pt[p] = isNaN(n) ? null : n;
          } else pt[p] = null;
        }
        points.push(pt);
      }));
    return points.sort((a, b) => a.timestamp - b.timestamp);
  }, [processedFlights, selectedFlight, selectedParameters]);

  // Context field values for selected flight
  const contextFields = useMemo((): Record<string, string> => {
    const src = selectedFlight !== 'all'
      ? processedFlights.find(f => f.flight_id === selectedFlight)?.records[0]
      : processedFlights[0]?.records[0];
    if (!src) return {};
    const out: Record<string, string> = {};
    [...Array.from(CONTEXT_FIELD_NAMES), ...contextFieldKeys].forEach(k => {
      const v = src[k];
      if (v != null && v !== '' && typeof v === 'string') out[k] = v;
    });
    return out;
  }, [selectedFlight, processedFlights, contextFieldKeys]);

  const phaseBands = useMemo(() => {
    if (chartData.length === 0) return [];
    const bands: { phase: string; start: number; end: number }[] = [];
    let cur = chartData[0].phase, start = chartData[0].timestamp;
    for (let i = 1; i < chartData.length; i++) {
      if (chartData[i].phase !== cur) {
        bands.push({ phase: cur, start, end: chartData[i].timestamp });
        cur = chartData[i].phase; start = chartData[i].timestamp;
      }
    }
    bands.push({ phase: cur, start, end: chartData[chartData.length - 1].timestamp });
    return bands;
  }, [chartData]);

  const selectedFlightData = useMemo(() =>
    (selectedFlight && selectedFlight !== 'all')
      ? processedFlights.find(f => f.flight_id === selectedFlight) ?? null
      : null,
  [selectedFlight, processedFlights]);

  const formatTimestamp = useCallback((ts: number) =>
    new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
  []);


  const handleBrushChange = useCallback((brushData: any) => {
    const si = brushData?.startIndex, ei = brushData?.endIndex;
    if (si == null || ei == null || si === ei) return;
    const start = chartData[si]?.timestamp, end = chartData[ei]?.timestamp;
    if (!start || !end) return;
    const slice = chartData.slice(si, ei + 1);
    const sd = new Date(start);
    createSelectionSet({
      name: `${sd.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} ${sd.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} (${Math.round((end - start) / 60000)} דק)`,
      color: getParamColor(selectedParameters[0] ?? '', 0),
      type: 'time-range', data: slice, source: 'signals',
    });
  }, [chartData, createSelectionSet, selectedParameters]);

  const handleParamToggle = useCallback((param: string) => {
    setSelectedParameters(prev =>
      prev.includes(param) ? prev.filter(p => p !== param)
        : prev.length < 8 ? [...prev, param] : prev
    );
  }, []);

  const handleChartClick = useCallback((timestamp: number) => {
    if (!annotationMode) return;
    setPendingAnnotation({ timestamp });
    setAnnotationDraft('');
    setAnnotationDraftType('note');
  }, [annotationMode]);

  const saveAnnotation = useCallback(() => {
    if (!pendingAnnotation || !annotationDraft.trim()) return;
    setAnnotations(prev => [...prev, {
      id: `ann-${Date.now()}`,
      timestamp: pendingAnnotation.timestamp,
      text: annotationDraft.trim(),
      type: annotationDraftType,
    }]);
    setPendingAnnotation(null);
    setAnnotationDraft('');
  }, [pendingAnnotation, annotationDraft, annotationDraftType]);

  const exportSnapshot = useCallback(() => {
    const snap = {
      exportedAt: new Date().toISOString(),
      flight: selectedFlight,
      parameters: selectedParameters,
      focusedPhase,
      annotations,
      dataPoints: chartData.length,
      dateRange: chartData.length
        ? { from: new Date(chartData[0].timestamp).toISOString(), to: new Date(chartData[chartData.length - 1].timestamp).toISOString() }
        : null,
    };
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `investigation_snapshot_${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [selectedFlight, selectedParameters, focusedPhase, annotations, chartData]);

  // ── Empty state ──────────────────────────────────────────────────
  if (processedFlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-5" dir="rtl">
        <Activity className="h-16 w-16 text-muted-foreground/30" />
        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-semibold">אין נתוני טיסה</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            העלה קובץ CSV או טען נתוני דמו כדי לחקור את פאנל הסיגנלים
          </p>
        </div>
        <DemoDataButton variant="default" size="default" />
      </div>
    );
  }

  const breachCount = selectedParameters.filter(p => {
    const info = PARAMETER_THRESHOLDS[p]; if (!info) return false;
    const vals = chartData.map(d => d[p]).filter((v): v is number => v != null && isFinite(v));
    if (vals.length === 0) return false;
    const mx = Math.max(...vals), mn = Math.min(...vals);
    return (info.max !== undefined && mx > info.max) || (info.min !== undefined && mn < info.min);
  }).length;

  const uniquePhases = [...new Set(phaseBands.map(b => b.phase))];

  return (
    <TooltipProvider>
      <div className="space-y-3" dir="rtl">

        {/* Flight context banner — shows metadata + context fields */}
        {selectedFlightData && (
          <FlightContextBanner flight={selectedFlightData} contextFields={contextFields} />
        )}

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedFlight}
            onChange={e => setSelectedFlight(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-sm"
          >
            <option value="all">כל הטיסות ({processedFlights.length})</option>
            {[...processedFlights].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map(f => (
              <option key={f.flight_id} value={f.flight_id}>
                {new Date(f.startTime).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} | {f.flight_id} | זנב {f.tail_number}
              </option>
            ))}
          </select>

          <Tooltip>
            <TooltipTrigger>
              <PhaseBandsToggle enabled={showPhaseBands} onToggle={setShowPhaseBands} />
            </TooltipTrigger>
            <TooltipContent><p>הצג רצועות שלבי טיסה</p></TooltipContent>
          </Tooltip>

          {/* Moving average toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showMovingAvg ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowMovingAvg(v => !v)}
              >
                <Info className="h-3 w-3" />
                ממוצע נע
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>ממוצע נע (Moving Average)</p></TooltipContent>
          </Tooltip>

          {/* Annotation mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={annotationMode ? 'default' : 'outline'}
                size="sm"
                className={`h-8 text-xs gap-1.5 ${annotationMode ? 'ring-2 ring-primary/50' : ''}`}
                onClick={() => { setAnnotationMode(v => !v); setPendingAnnotation(null); }}
              >
                <StickyNote className="h-3 w-3" />
                {annotationMode ? 'לחץ על גרף' : 'הוסף הערה'}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>הפעל מצב הערות — לחץ על גרף להוסיף סמן</p></TooltipContent>
          </Tooltip>

          {annotations.length > 0 && (
            <Badge variant="outline" className="gap-1 text-xs">
              <StickyNote className="h-3 w-3" />
              {annotations.length} הערות
            </Badge>
          )}

          <div className="flex items-center gap-2 mr-auto">
            {breachCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {breachCount} חריגות
              </Badge>
            )}
            <Badge variant="secondary">{chartData.length.toLocaleString()} נקודות</Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={exportSnapshot} className="gap-1.5">
                  <FileDown className="h-3.5 w-3.5" />
                  <span className="text-xs">ייצא</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>ייצא תמונת חקירה (JSON)</p></TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" onClick={() => setShowGraphEditor(true)}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowFullScreen(true)}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Annotation creation form — appears when user clicks chart in annotation mode */}
        {pendingAnnotation && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5" dir="rtl">
            <span className="text-xs font-medium flex-shrink-0 flex items-center gap-1">
              <StickyNote className="h-3 w-3" />
              הערה ב-{new Date(pendingAnnotation.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}:
            </span>
            <select
              value={annotationDraftType}
              onChange={e => setAnnotationDraftType(e.target.value as ChartAnnotation['type'])}
              className="h-7 text-xs rounded border border-input bg-background px-1.5 flex-shrink-0"
            >
              <option value="note">הערה</option>
              <option value="fault">תקלה</option>
              <option value="rule">כלל</option>
              <option value="maintenance">אחזקה</option>
            </select>
            <input
              autoFocus
              type="text"
              value={annotationDraft}
              onChange={e => setAnnotationDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAnnotation(); if (e.key === 'Escape') setPendingAnnotation(null); }}
              placeholder="תיאור קצר…"
              className="flex-1 h-7 text-xs rounded border border-input bg-background px-2 outline-none focus:border-primary"
            />
            <Button size="sm" className="h-7 text-xs" onClick={saveAnnotation} disabled={!annotationDraft.trim()}>שמור</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPendingAnnotation(null)}>ביטול</Button>
          </div>
        )}

        {/* Annotations list — shown when annotations exist */}
        {annotations.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-2 space-y-1" dir="rtl">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b">
              <span className="font-medium flex items-center gap-1">
                <StickyNote className="h-3 w-3" /> הערות חקירה ({annotations.length})
              </span>
              <button
                className="text-[10px] hover:text-destructive transition-colors flex items-center gap-0.5"
                onClick={() => setAnnotations([])}
              >
                <Trash2 className="h-2.5 w-2.5" /> נקה הכל
              </button>
            </div>
            <div className="space-y-0.5 max-h-28 overflow-y-auto">
              {annotations.map(ann => (
                <div key={ann.id} className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-muted/40">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ANNOTATION_COLORS[ann.type] }} />
                  <span className="text-muted-foreground text-[10px] flex-shrink-0">{ANNOTATION_LABELS_HE[ann.type]}</span>
                  <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                    {new Date(ann.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="flex-1 truncate">{ann.text}</span>
                  <Button
                    size="sm" variant="ghost"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => setAnnotations(prev => prev.filter(a => a.id !== ann.id))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parameter chips — only numeric parameters shown */}
        <div className="flex flex-wrap gap-1.5" dir="rtl">
          {parameterPriority.map((param, idx) => {
            const isActive  = selectedParameters.includes(param);
            const color     = getParamColor(param, idx);
            const info      = PARAMETER_THRESHOLDS[param];
            const disabled  = !isActive && selectedParameters.length >= 8;
            return (
              <Tooltip key={param}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => !disabled && handleParamToggle(param)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isActive
                        ? 'text-white shadow-sm'
                        : disabled
                          ? 'opacity-40 cursor-not-allowed border-border text-muted-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer'
                    }`}
                    style={isActive ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.75)' : color }} />
                    {info?.labelHe ?? param}
                  </button>
                </TooltipTrigger>
                {info && (
                  <TooltipContent>
                    <p className="text-xs">
                      {info.labelHe} [{info.unit}]
                      {info.max ? ` · LIM ${info.max}` : ''}
                      {info.warningMax ? ` · WARN ${info.warningMax}` : ''}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
          {selectedParameters.length >= 8 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground px-1">
              <Info className="h-3 w-3" /> מקסימום 8
            </span>
          )}
        </div>

        {/* Interactive phase timeline — replaces static legend */}
        {showPhaseBands && phaseBands.length > 0 && (
          <PhaseTimeline
            bands={phaseBands}
            focused={focusedPhase}
            chartData={chartData}
            selectedParameters={selectedParameters}
            onFocus={phase => {
              setFocusedPhase(phase);
            }}
          />
        )}

        {/* Main grid: charts (9 cols) + SelectionSetsPanel (3 cols) side-by-side */}
        <div className="grid grid-cols-12 gap-4 items-start">
          {/* Charts + StatsBar column */}
          <div className="col-span-9 space-y-2">
            {selectedParameters.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
                בחר פרמטרים להצגה
              </div>
            ) : (
              selectedParameters.map((param, idx) => (
                <ParameterSubchart
                  key={param} param={param} paramIdx={idx}
                  data={focusedPhase
                    ? chartData.filter(d => {
                        const band = phaseBands.find(b => b.phase === focusedPhase);
                        return band ? d.timestamp >= band.start && d.timestamp <= band.end : true;
                      })
                    : chartData}
                  phaseBands={focusedPhase
                    ? phaseBands.filter(b => b.phase === focusedPhase)
                    : phaseBands}
                  showPhaseBands={showPhaseBands}
                  isLast={idx === selectedParameters.length - 1}
                  onBrushChange={idx === selectedParameters.length - 1 ? handleBrushChange : undefined}
                  formatTimestamp={formatTimestamp}
                  annotations={annotations}
                  showMovingAvg={showMovingAvg}
                  onChartClick={annotationMode ? handleChartClick : undefined}
                />
              ))
            )}
            {/* StatsBar directly below charts — visually unified with the chart column */}
            <StatsBar data={chartData} parameters={selectedParameters} />
          </div>

          {/* SelectionSetsPanel — sticky, stretches alongside charts+stats */}
          <div className="col-span-3 sticky top-4">
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
          colors={selectedParameters.map((p, i) => getParamColor(p, i))}
          phaseBands={phaseBands}
          showPhaseBands={showPhaseBands}
          title="גרפי סיגנלים — חקירה"
          annotations={annotations}
        />
      </div>
    </TooltipProvider>
  );
});

SignalsTab.displayName = 'SignalsTab';
