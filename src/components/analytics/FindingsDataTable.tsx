/**
 * FindingsDataTable — serious, full-data analytical table for findings/anomalies
 *
 * UX pattern from Streamlit Movies demo:
 *  - Pinned first column (identity: tail number)
 *  - Typed columns: progress bars for severity score, status chips, category tags
 *  - Dense but readable — engineer-grade data review
 *  - Sortable columns, filterable, full browseable dataset
 *  - Outlier-first: critical items surface at top by default
 *
 * Apache-2.0 UX grammar reference: streamlit/demo-movies (interaction pattern only)
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle, AlertCircle, Info, Search, X,
  ArrowUp, ArrowDown, ArrowUpDown, Database,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FindingRow {
  id:          string;
  tail:        string;
  severity:    'critical' | 'high' | 'medium' | 'low';
  status:      string;
  title:       string;
  system?:     string;
  assignedTo?: string;
  createdAt:   string;
  confidence?: number; // 0-100
  occurrences?: number;
}

type SortCol = 'tail' | 'severity' | 'status' | 'title' | 'system' | 'createdAt' | 'confidence' | 'occurrences';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_LABELS: Record<string, string> = {
  critical: 'קריטי', high: 'גבוה', medium: 'בינוני', low: 'נמוך',
};

const SEVERITY_BAR_COLOR: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-blue-400',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
  high:     'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200',
  low:      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
};

const SEVERITY_SCORE: Record<string, number> = {
  critical: 100, high: 70, medium: 40, low: 15,
};

const SeverityIcon = ({ s }: { s: string }) => {
  if (s === 'critical') return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  if (s === 'high')     return <AlertCircle   className="h-3.5 w-3.5 text-orange-500" />;
  return                       <Info          className="h-3.5 w-3.5 text-yellow-500" />;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface FindingsDataTableProps {
  findings:    FindingRow[];
  title?:      string;
  description?: string;
  onSelect?:   (id: string) => void;
}

export const FindingsDataTable: React.FC<FindingsDataTableProps> = ({
  findings,
  title       = 'דפדפן ממצאים',
  description = 'כלל הממצאים — ניתן למיון, סינון ובחינה',
  onSelect,
}) => {
  const [search,         setSearch]         = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [systemFilter,   setSystemFilter]   = useState('');
  const [sortCol,        setSortCol]        = useState<SortCol>('severity');
  const [sortDir,        setSortDir]        = useState<SortDir>('asc');
  const [pageSize,       setPageSize]       = useState(25);
  const [page,           setPage]           = useState(0);

  // Derived filter options
  const { statuses, systems } = useMemo(() => ({
    statuses: [...new Set(findings.map(f => f.status).filter(Boolean))].sort(),
    systems:  [...new Set(findings.map(f => f.system).filter(Boolean) as string[])].sort(),
  }), [findings]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'severity' || col === 'createdAt' ? 'asc' : 'desc'); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp   className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const filtered = useMemo(() => {
    let r = findings;
    if (search) {
      const t = search.toLowerCase();
      r = r.filter(f =>
        f.title?.toLowerCase().includes(t) ||
        f.tail?.toLowerCase().includes(t)  ||
        f.system?.toLowerCase().includes(t)||
        f.assignedTo?.toLowerCase().includes(t)
      );
    }
    if (severityFilter) r = r.filter(f => f.severity === severityFilter);
    if (statusFilter)   r = r.filter(f => f.status   === statusFilter);
    if (systemFilter)   r = r.filter(f => f.system   === systemFilter);

    return [...r].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'severity':    cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]; break;
        case 'tail':        cmp = a.tail.localeCompare(b.tail); break;
        case 'status':      cmp = (a.status ?? '').localeCompare(b.status ?? ''); break;
        case 'title':       cmp = (a.title ?? '').localeCompare(b.title ?? ''); break;
        case 'system':      cmp = (a.system ?? '').localeCompare(b.system ?? ''); break;
        case 'createdAt':   cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'confidence':  cmp = (a.confidence ?? 0) - (b.confidence ?? 0); break;
        case 'occurrences': cmp = (a.occurrences ?? 0) - (b.occurrences ?? 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [findings, search, severityFilter, statusFilter, systemFilter, sortCol, sortDir]);

  const paged       = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages  = Math.ceil(filtered.length / pageSize);
  const anyFilter   = !!(search || severityFilter || statusFilter || systemFilter);

  const clearFilters = () => {
    setSearch(''); setSeverityFilter(''); setStatusFilter(''); setSystemFilter('');
    setPage(0);
  };

  // Stats
  const stats = useMemo(() => ({
    total:    filtered.length,
    critical: filtered.filter(f => f.severity === 'critical').length,
    high:     filtered.filter(f => f.severity === 'high').length,
  }), [filtered]);

  if (findings.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Database className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">אין ממצאים זמינים</p>
        </CardContent>
      </Card>
    );
  }

  const SortHead = ({ col, children, className = '' }: { col: SortCol; children: React.ReactNode; className?: string }) => (
    <th
      className={`text-right px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:bg-muted/60 whitespace-nowrap ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center justify-end gap-1">
        {children} <SortIcon col={col} />
      </span>
    </th>
  );

  return (
    <div className="space-y-3" dir="rtl">
      {/* ── Header metrics ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
            <div className="text-xs text-muted-foreground">ממצאים מוצגים</div>
          </CardContent>
        </Card>
        <Card className={stats.critical > 0 ? 'border-red-200' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className={`text-2xl font-bold tabular-nums ${stats.critical > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {stats.critical}
            </div>
            <div className="text-xs text-muted-foreground">קריטיים</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold tabular-nums text-orange-500">{stats.high}</div>
            <div className="text-xs text-muted-foreground">גבוהים</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="חיפוש חופשי…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pr-8 text-right text-sm h-9"
              />
            </div>
            <Select value={severityFilter || '__all__'} onValueChange={v => { setSeverityFilter(v === '__all__' ? '' : v); setPage(0); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue>{severityFilter ? SEVERITY_LABELS[severityFilter] : 'כל רמות החומרה'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל רמות החומרה</SelectItem>
                {Object.keys(SEVERITY_ORDER).map(s => (
                  <SelectItem key={s} value={s}>{SEVERITY_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter || '__all__'} onValueChange={v => { setStatusFilter(v === '__all__' ? '' : v); setPage(0); }} disabled={statuses.length === 0}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue>{statusFilter || 'כל הסטטוסים'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל הסטטוסים</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={systemFilter || '__all__'} onValueChange={v => { setSystemFilter(v === '__all__' ? '' : v); setPage(0); }} disabled={systems.length === 0}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue>{systemFilter || 'כל המערכות'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל המערכות</SelectItem>
                {systems.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {anyFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2 h-7 text-xs gap-1 text-muted-foreground">
              <X className="h-3 w-3" /> נקה סינון
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Main table ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">{description} · {filtered.length} רשומות</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {/* Pinned identity column */}
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground sticky right-0 bg-muted/30">
                    זנב
                  </th>
                  <SortHead col="severity">חומרה</SortHead>
                  <SortHead col="status">סטטוס</SortHead>
                  <SortHead col="title">כותרת</SortHead>
                  <SortHead col="system">מערכת</SortHead>
                  <SortHead col="confidence" className="hidden md:table-cell">ביטחון</SortHead>
                  <SortHead col="occurrences" className="hidden md:table-cell">חזרות</SortHead>
                  <SortHead col="createdAt">תאריך</SortHead>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((f, i) => {
                  const score = SEVERITY_SCORE[f.severity] ?? 0;
                  return (
                    <tr
                      key={f.id}
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                      onClick={() => onSelect?.(f.id)}
                    >
                      {/* Pinned tail column */}
                      <td className="px-3 py-2.5 sticky right-0 bg-background group-hover:bg-muted/40 font-mono font-semibold text-sm whitespace-nowrap border-r border-muted/30">
                        {f.tail}
                      </td>
                      {/* Severity — icon + badge + progress bar */}
                      <td className="px-3 py-2.5 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <SeverityIcon s={f.severity} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[f.severity]}`}>
                                {SEVERITY_LABELS[f.severity]}
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums">{score}</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${SEVERITY_BAR_COLOR[f.severity]} transition-all`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Status chip */}
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap">
                          {f.status}
                        </Badge>
                      </td>
                      {/* Title */}
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <span className="font-medium text-sm line-clamp-2">{f.title}</span>
                      </td>
                      {/* System tag */}
                      <td className="px-3 py-2.5">
                        {f.system ? (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {f.system}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      {/* Confidence progress */}
                      <td className="px-3 py-2.5 hidden md:table-cell min-w-[100px]">
                        {f.confidence != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${f.confidence}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
                              {f.confidence}%
                            </span>
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      {/* Occurrences */}
                      <td className="px-3 py-2.5 hidden md:table-cell tabular-nums text-center">
                        {(f.occurrences ?? 1) > 1 ? (
                          <Badge variant="outline" className="text-[10px]">{f.occurrences}×</Badge>
                        ) : <span className="text-muted-foreground text-xs">1</span>}
                      </td>
                      {/* Date */}
                      <td className="px-3 py-2.5 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(f.createdAt).toLocaleDateString('he-IL', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paged.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <p>לא נמצאו ממצאים</p>
              {anyFilter && <Button variant="link" size="sm" onClick={clearFilters}>נקה סינון</Button>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} מתוך {filtered.length}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              הקודם
            </Button>
            <span className="tabular-nums">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              הבא
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindingsDataTable;
