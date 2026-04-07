/**
 * ChartToolbar — stTooltipHoverTarget equivalent
 * Top-right action bar for charts and tables.
 * Capabilities (from Streamlit Movies demo examples 1-8):
 *  [⊞] Toggle chart ↔ data table
 *  [⛶] Fullscreen overlay
 *  [⋮] Export menu: Save as SVG, Save as PNG, Export CSV
 *  [?] Help tooltip with calculation explanation
 */
import React, { useRef, useState, useEffect, useCallback, useMemo, RefObject } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Table2, Maximize2, MoreHorizontal, Download, FileImage, FileText, X, HelpCircle, Minimize2, Search, ChevronUp, ChevronDown, AlignLeft, AlignCenter, AlignRight, Pin, EyeOff, RotateCcw, ArrowUpDown } from 'lucide-react';

// ── Export helpers ─────────────────────────────────────────────────

export function exportChartSVG(containerRef: RefObject<HTMLDivElement | null>, filename = 'chart') {
  const svgEl = containerRef.current?.querySelector('svg');
  if (!svgEl) return;
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.svg`; a.click();
  URL.revokeObjectURL(url);
}

export function exportChartPNG(containerRef: RefObject<HTMLDivElement | null>, filename = 'chart') {
  const svgEl = containerRef.current?.querySelector('svg');
  if (!svgEl) return;
  const { width, height } = svgEl.getBoundingClientRect();
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const canvas  = document.createElement('canvas');
  canvas.width  = width  || 800;
  canvas.height = height || 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img  = new Image();
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  img.onload = () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png'); a.download = `${filename}.png`; a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export function exportCSV(data: Record<string, any>[], filename = 'data', columns?: string[]) {
  if (data.length === 0) return;
  const keys = columns ?? Object.keys(data[0]);
  const csv  = [keys.join(','), ...data.map(row => keys.map(k => String(row[k] ?? '')).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── TableSearchBar (Example 7: search bar triggered by search icon) ────────────

interface TableSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  placeholder?: string;
  resultCount?: number;
}

export const TableSearchBar: React.FC<TableSearchBarProps> = ({ value, onChange, onClose, placeholder = 'חיפוש…', resultCount }) => (
  <div className="flex items-center gap-1.5 border border-border rounded-md bg-background px-2 py-1 text-xs shadow-sm" dir="rtl">
    <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
    <input
      autoFocus
      className="flex-1 outline-none bg-transparent min-w-0 text-xs"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
    {resultCount !== undefined && (
      <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">{resultCount}</span>
    )}
    <button onClick={() => { onChange(''); onClose(); }} className="text-muted-foreground hover:text-foreground flex-shrink-0">
      <X className="h-3 w-3" />
    </button>
  </div>
);

// ── HelpTooltip (Example 5: "?" tooltip with explanation text) ─────────────────

interface HelpTooltipProps { text: string; }

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ text }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors flex-shrink-0">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed" dir="rtl">
        {text}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ── Progress bar column helper (Example 8: inline progress bar + value) ────────

interface ProgressCellProps {
  value: number;
  max: number;
  color?: string;
  precision?: number;
}

export const ProgressCell: React.FC<ProgressCellProps> = ({ value, max, color = 'hsl(var(--primary))', precision = 2 }) => (
  <div className="flex items-center gap-2 min-w-0">
    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[32px]">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (Math.abs(value) / (max || 1)) * 100)}%`, backgroundColor: color }} />
    </div>
    <span className="tabular-nums text-[11px] flex-shrink-0">{value.toFixed(precision)}</span>
  </div>
);

// ── Fullscreen overlay (Example 6 + 8: fullscreen view) ───────────────────────

interface FullscreenOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const FullscreenOverlay: React.FC<FullscreenOverlayProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col" dir="rtl">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card shadow-sm flex-shrink-0">
        <h2 className="font-semibold text-sm">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <Minimize2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  );
};

// ── ChartToolbar (main component, Examples 1-2, 6) ────────────────────────────

interface ChartToolbarProps {
  /** ref to the div wrapping the recharts ResponsiveContainer */
  chartRef?: RefObject<HTMLDivElement | null>;
  /** CSV data rows for export */
  csvData?: Record<string, any>[];
  /** Filename base (no extension) */
  exportFilename?: string;
  /** Show/hide table toggle */
  onToggleTable?: () => void;
  showingTable?: boolean;
  /** Fullscreen */
  onFullscreen?: () => void;
  /** Compact: don't show labels */
  compact?: boolean;
}

export const ChartToolbar: React.FC<ChartToolbarProps> = ({
  chartRef,
  csvData,
  exportFilename = 'export',
  onToggleTable,
  showingTable = false,
  onFullscreen,
  compact = true,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 flex-shrink-0 relative">

        {/* Table / Chart toggle */}
        {onToggleTable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleTable}
                className={`inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${showingTable ? 'bg-muted text-foreground' : ''}`}
              >
                <Table2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{showingTable ? 'הצג גרף' : 'הצג טבלה'}</TooltipContent>
          </Tooltip>
        )}

        {/* Fullscreen */}
        {onFullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onFullscreen}
                className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">מסך מלא</TooltipContent>
          </Tooltip>
        )}

        {/* Export menu (⋮) */}
        <div className="relative" ref={menuRef}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className={`inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${menuOpen ? 'bg-muted text-foreground' : ''}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">ייצוא</TooltipContent>
          </Tooltip>

          {menuOpen && (
            <>
              {/* Click-away overlay */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-7 z-50 min-w-[160px] rounded-lg border bg-card shadow-lg py-1 text-xs" dir="rtl">
                {chartRef && (
                  <>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-right"
                      onClick={() => { exportChartSVG(chartRef, exportFilename); setMenuOpen(false); }}
                    >
                      <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                      שמור כ-SVG
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-right"
                      onClick={() => { exportChartPNG(chartRef, exportFilename); setMenuOpen(false); }}
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      שמור כ-PNG
                    </button>
                    <div className="border-t my-1" />
                  </>
                )}
                {csvData && csvData.length > 0 && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-right"
                    onClick={() => { exportCSV(csvData, exportFilename); setMenuOpen(false); }}
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    ייצוא CSV
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

// ── FloatingSearchPopup (Example 7 — floating popup with ↑↓ navigation) ───────

interface FloatingSearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
  matchCount: number;
  currentMatch: number; // 0-based
  onNavigate: (dir: 'up' | 'down') => void;
  placeholder?: string;
}

export const FloatingSearchPopup: React.FC<FloatingSearchPopupProps> = ({
  isOpen, onClose, value, onChange, matchCount, currentMatch, onNavigate, placeholder = 'חפש בטבלה…',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="absolute top-0 inset-x-0 z-50 flex items-center gap-2 px-3 py-2 bg-card border-b border-border shadow-md" dir="rtl">
      <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <input
        ref={inputRef}
        className="flex-1 text-sm outline-none bg-transparent min-w-0"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); onNavigate('down'); }
          if (e.key === 'ArrowUp')   { e.preventDefault(); onNavigate('up'); }
          if (e.key === 'Escape')    { onClose(); }
          if (e.key === 'Enter')     { onNavigate('down'); }
        }}
      />
      {value && (
        <span className={`text-xs flex-shrink-0 tabular-nums ${matchCount === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {matchCount === 0 ? 'אין תוצאות' : `${currentMatch + 1}/${matchCount}`}
        </span>
      )}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button onClick={() => onNavigate('up')} disabled={matchCount === 0} title="תוצאה קודמת (↑)"
          className="p-1 rounded hover:bg-muted disabled:opacity-30">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onNavigate('down')} disabled={matchCount === 0} title="תוצאה הבאה (↓)"
          className="p-1 rounded hover:bg-muted disabled:opacity-30">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { onChange(''); onClose(); }} title="סגור חיפוש (Esc)"
          className="p-1 rounded hover:bg-muted ml-1">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── ColumnConfig types ─────────────────────────────────────────────────────────

export interface ColumnConfig {
  label?: string;
  align?: 'right' | 'center' | 'left';
  pinned?: boolean;
  hidden?: boolean;
}
export type ColumnConfigs = Record<string, ColumnConfig>;

// ── ColumnContextMenu (column header popup like Image #1) ─────────────────────

interface ColumnContextMenuProps {
  colKey: string;
  defaultLabel: string;
  config: ColumnConfig;
  onUpdate: (updates: Partial<ColumnConfig>) => void;
  onReset: () => void;
  onSortAsc?: () => void;
  onSortDesc?: () => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

export const ColumnContextMenu: React.FC<ColumnContextMenuProps> = ({
  colKey, defaultLabel, config, onUpdate, onReset, onSortAsc, onSortDesc, onClose, anchorEl,
}) => {
  const [labelEdit, setLabelEdit] = useState(config.label ?? defaultLabel);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const rect = anchorEl?.getBoundingClientRect();
  const style: React.CSSProperties = rect
    ? { position: 'fixed', top: rect.bottom + 4, left: Math.max(8, rect.right - 224), zIndex: 200 }
    : { position: 'fixed', top: 120, left: 120, zIndex: 200 };

  const hasChanges = !!(config.label || config.align || config.pinned || config.hidden);

  const saveLabel = () => {
    const trimmed = labelEdit.trim();
    onUpdate({ label: trimmed && trimmed !== defaultLabel ? trimmed : undefined });
  };

  return (
    <div ref={menuRef} style={style} className="w-56 bg-popover border border-border rounded-xl shadow-xl text-xs select-none" dir="rtl">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="font-semibold text-sm">הגדרות עמודה</span>
        {hasChanges && (
          <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">שונה</span>
        )}
      </div>

      {/* Rename */}
      <div className="px-3 py-2 space-y-1 border-b">
        <label className="text-[11px] text-muted-foreground">שם עמודה</label>
        <input
          autoFocus
          className="w-full h-7 px-2 text-xs rounded border border-input bg-background outline-none focus:border-primary"
          value={labelEdit}
          onChange={e => setLabelEdit(e.target.value)}
          onBlur={saveLabel}
          onKeyDown={e => { if (e.key === 'Enter') { saveLabel(); onClose(); } if (e.key === 'Escape') onClose(); }}
        />
      </div>

      {/* Alignment */}
      <div className="px-3 py-2 space-y-1.5 border-b">
        <label className="text-[11px] text-muted-foreground">יישור</label>
        <div className="flex gap-1">
          {(['right', 'center', 'left'] as const).map(a => (
            <button key={a} onClick={() => onUpdate({ align: config.align === a ? undefined : a })}
              title={a === 'right' ? 'ימין' : a === 'center' ? 'מרכז' : 'שמאל'}
              className={`flex-1 h-7 rounded flex items-center justify-center border transition-colors
                ${config.align === a ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-muted'}`}>
              {a === 'right' ? <AlignRight className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* Sort + actions */}
      <div className="px-1 py-1 space-y-0.5 border-b">
        {onSortAsc && (
          <button className="w-full text-right px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
            onClick={() => { onSortAsc(); onClose(); }}>
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />מיין עולה
          </button>
        )}
        {onSortDesc && (
          <button className="w-full text-right px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
            onClick={() => { onSortDesc(); onClose(); }}>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />מיין יורד
          </button>
        )}
        <button className="w-full text-right px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
          onClick={() => { onUpdate({ pinned: !config.pinned }); onClose(); }}>
          <Pin className="h-3.5 w-3.5 text-muted-foreground" />{config.pinned ? 'בטל נעיצה' : 'נעץ עמודה'}
        </button>
        <button className="w-full text-right px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 text-muted-foreground"
          onClick={() => { onUpdate({ hidden: true }); onClose(); }}>
          <EyeOff className="h-3.5 w-3.5" />הסתר עמודה
        </button>
      </div>

      {/* Reset */}
      {hasChanges && (
        <div className="px-3 py-2">
          <button onClick={() => { onReset(); onClose(); }}
            className="w-full h-7 text-xs rounded border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center gap-1">
            <RotateCcw className="h-3 w-3" />איפוס עמודה
          </button>
        </div>
      )}
    </div>
  );
};

// ── useColumnConfigs hook ────────────────────────────────────────────────────

export function useColumnConfigs(colDefs: { key: string; label: string }[]) {
  const [configs, setConfigs] = useState<ColumnConfigs>({});

  const updateColumn = useCallback((key: string, updates: Partial<ColumnConfig>) =>
    setConfigs(prev => ({ ...prev, [key]: { ...prev[key], ...updates } })), []);

  const resetColumn = useCallback((key: string) =>
    setConfigs(prev => { const n = { ...prev }; delete n[key]; return n; }), []);

  const getLabel = useCallback((key: string, def: string) =>
    configs[key]?.label ?? def, [configs]);

  const getAlign = useCallback((key: string): 'right' | 'center' | 'left' =>
    configs[key]?.align ?? 'right', [configs]);

  const isHidden = useCallback((key: string) => !!configs[key]?.hidden, [configs]);

  const hasChanges = useCallback((key: string) => {
    const c = configs[key];
    return !!(c?.label || c?.align || c?.pinned || c?.hidden);
  }, [configs]);

  const visibleCols = useMemo(() =>
    colDefs.filter(c => !configs[c.key]?.hidden), [colDefs, configs]);

  return { configs, updateColumn, resetColumn, getLabel, getAlign, isHidden, hasChanges, visibleCols };
}
