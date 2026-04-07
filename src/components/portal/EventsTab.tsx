// Events Tab — rule violations and anomalies with working filters + sortable columns + anomaly panel
// UX pattern: outlier-first design, top anomaly callout, sortable dense table
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle, AlertCircle, Info, Clock, Filter, ExternalLink, X,
  ArrowUpDown, ArrowUp, ArrowDown, Flame,
} from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DataAdapter } from '@/lib/data-adapter';

interface EventsTabProps {
  onJumpToTime?: (timestamp: number, parameter: string) => void;
}

// Severity display helpers
const SEVERITY_LABELS: Record<string, string> = {
  critical: 'קריטי',
  high:     'גבוה',
  medium:   'בינוני',
  low:      'נמוך',
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical': return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    case 'high':     return <AlertCircle   className="h-3.5 w-3.5 text-orange-500" />;
    case 'medium':   return <Info          className="h-3.5 w-3.5 text-yellow-500" />;
    default:         return <Info          className="h-3.5 w-3.5 text-blue-400" />;
  }
};

const getSeverityBadgeClass = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200';
    case 'high':     return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200';
    case 'medium':   return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200';
    default:         return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200';
  }
};

type SortColumn = 'severity' | 'time' | 'tail' | 'system' | 'title';
type SortDir    = 'asc' | 'desc';

export const EventsTab: React.FC<EventsTabProps> = ({ onJumpToTime }) => {
  const { insights, hasData } = useDashboardData();

  const [searchTerm,     setSearchTerm]     = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [systemFilter,   setSystemFilter]   = useState('');
  const [typeFilter,     setTypeFilter]     = useState('');
  const [sortColumn,     setSortColumn]     = useState<SortColumn>('severity');
  const [sortDir,        setSortDir]        = useState<SortDir>('asc');

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDir('asc'); }
  };

  const SortIcon: React.FC<{ col: SortColumn }> = ({ col }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp   className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  // Derived filter options — only include values that actually exist in data
  const { systems, types } = useMemo(() => {
    const s = new Set(insights.map(i => i.system).filter(Boolean));
    const t = new Set(insights.map(i => i.type).filter(Boolean));
    return { systems: Array.from(s).sort(), types: Array.from(t).sort() };
  }, [insights]);

  const anyFilterActive = searchTerm || severityFilter || systemFilter || typeFilter;

  const clearFilters = () => {
    setSearchTerm('');
    setSeverityFilter('');
    setSystemFilter('');
    setTypeFilter('');
  };

  const filtered = useMemo(() => {
    let result = insights;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(i =>
        i.title?.toLowerCase().includes(term) ||
        i.description?.toLowerCase().includes(term) ||
        i.tail?.toLowerCase().includes(term) ||
        i.system?.toLowerCase().includes(term)
      );
    }

    if (severityFilter) result = result.filter(i => i.severity === severityFilter);
    if (systemFilter)   result = result.filter(i => i.system   === systemFilter);
    if (typeFilter)     result = result.filter(i => i.type     === typeFilter);

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'severity': cmp = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity); break;
        case 'time':     cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case 'tail':     cmp = (a.tail ?? '').localeCompare(b.tail ?? ''); break;
        case 'system':   cmp = (a.system ?? '').localeCompare(b.system ?? ''); break;
        case 'title':    cmp = (a.title ?? '').localeCompare(b.title ?? ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [insights, searchTerm, severityFilter, systemFilter, typeFilter, sortColumn, sortDir]);

  const stats = useMemo(() => ({
    total:    filtered.length,
    critical: filtered.filter(i => i.severity === 'critical').length,
    high:     filtered.filter(i => i.severity === 'high').length,
    medium:   filtered.filter(i => i.severity === 'medium').length,
  }), [filtered]);

  const handleJumpToTime = (insight: any) => {
    if (onJumpToTime && insight.created_at) {
      const param = insight.technical_detail?.split(':')[0] || 'altitude_ft';
      onJumpToTime(insight.created_at, param);
    }
  };

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-lg font-medium">אין אירועים זמינים</h3>
        <p className="text-sm text-muted-foreground">העלה נתוני CSV כדי לראות חריגות ואירועים</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'סה"כ אירועים', value: stats.total, cls: '' },
          { label: 'קריטיים',      value: stats.critical, cls: 'text-red-600' },
          { label: 'גבוהים',       value: stats.high,     cls: 'text-orange-500' },
          { label: 'בינוניים',     value: stats.medium,   cls: 'text-yellow-500' },
        ].map(({ label, value, cls }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Top anomalies callout ── */}
      {stats.critical > 0 && (
        <Card className="border-red-200 bg-red-50/20 dark:bg-red-900/10 dark:border-red-800/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
              <Flame className="h-4 w-4" />
              אירועים קריטיים דורשים תשומת לב מיידית
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-red-100 dark:divide-red-900/30">
              {filtered.filter(i => i.severity === 'critical').slice(0, 3).map(insight => (
                <div key={insight.insight_id} className="flex items-center gap-3 px-4 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-sm font-medium truncate">{insight.title}</div>
                    <div className="text-[11px] text-muted-foreground">{insight.tail} · {insight.system}</div>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleJumpToTime(insight)}
                    className="h-7 text-xs gap-1 flex-shrink-0 text-red-600 hover:text-red-700"
                  >
                    <ExternalLink className="h-3 w-3" />
                    קפץ
                  </Button>
                </div>
              ))}
              {stats.critical > 3 && (
                <div className="px-4 py-2 text-xs text-muted-foreground text-right">
                  ועוד {stats.critical - 3} אירועים קריטיים נוספים...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              סינון וחיפוש
            </CardTitle>
            {anyFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="h-3 w-3" />
                נקה סינון
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Free-text search */}
            <div className="relative">
              <Input
                placeholder="חיפוש חופשי…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pr-3 text-right"
              />
            </div>

            {/* Severity */}
            <Select
              value={severityFilter || '__all__'}
              onValueChange={v => setSeverityFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className={severityFilter ? 'border-primary' : ''}>
                <SelectValue>{severityFilter ? SEVERITY_LABELS[severityFilter] : 'כל רמות החומרה'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל רמות החומרה</SelectItem>
                {SEVERITY_ORDER.map(s => (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(s)}
                      {SEVERITY_LABELS[s]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* System */}
            <Select
              value={systemFilter || '__all__'}
              onValueChange={v => setSystemFilter(v === '__all__' ? '' : v)}
              disabled={systems.length === 0}
            >
              <SelectTrigger className={systemFilter ? 'border-primary' : ''}>
                <SelectValue>{systemFilter || 'כל המערכות'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל המערכות</SelectItem>
                {systems.map(s => (
                  <SelectItem key={s} value={s}>
                    {DataAdapter.getParameterSystem?.(s) ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type */}
            <Select
              value={typeFilter || '__all__'}
              onValueChange={v => setTypeFilter(v === '__all__' ? '' : v)}
              disabled={types.length === 0}
            >
              <SelectTrigger className={typeFilter ? 'border-primary' : ''}>
                <SelectValue>
                  {typeFilter
                    ? (typeFilter === 'rule_violation' ? 'חריגת כלל'
                     : typeFilter === 'trend'          ? 'מגמה'
                     : typeFilter === 'behavior_impact' ? 'השפעת התנהגות'
                     : typeFilter)
                    : 'כל הסוגים'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">כל הסוגים</SelectItem>
                {types.map(t => (
                  <SelectItem key={t} value={t}>
                    {t === 'rule_violation'   ? 'חריגת כלל'
                   : t === 'trend'            ? 'מגמה'
                   : t === 'behavior_impact'  ? 'השפעת התנהגות'
                   : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active filters summary */}
          {anyFilterActive && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground">סינון פעיל:</span>
              {severityFilter && (
                <Badge variant="secondary" className="text-xs gap-1 cursor-pointer"
                  onClick={() => setSeverityFilter('')}>
                  חומרה: {SEVERITY_LABELS[severityFilter]}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              )}
              {systemFilter && (
                <Badge variant="secondary" className="text-xs gap-1 cursor-pointer"
                  onClick={() => setSystemFilter('')}>
                  מערכת: {systemFilter}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              )}
              {typeFilter && (
                <Badge variant="secondary" className="text-xs gap-1 cursor-pointer"
                  onClick={() => setTypeFilter('')}>
                  סוג: {typeFilter}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              )}
              {searchTerm && (
                <Badge variant="secondary" className="text-xs gap-1 cursor-pointer"
                  onClick={() => setSearchTerm('')}>
                  חיפוש: "{searchTerm}"
                  <X className="h-2.5 w-2.5" />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Events table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">רשימת אירועים</CardTitle>
            <CardDescription>
              {filtered.length} מתוך {insights.length} אירועים
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right w-32 cursor-pointer hover:bg-muted/60 select-none" onClick={() => handleSort('severity')}>
                    <span className="flex items-center justify-end">חומרה <SortIcon col="severity" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none" onClick={() => handleSort('time')}>
                    <span className="flex items-center justify-end">זמן <SortIcon col="time" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none" onClick={() => handleSort('tail')}>
                    <span className="flex items-center justify-end">זנב <SortIcon col="tail" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none" onClick={() => handleSort('system')}>
                    <span className="flex items-center justify-end">מערכת <SortIcon col="system" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/60 select-none" onClick={() => handleSort('title')}>
                    <span className="flex items-center justify-end">כותרת <SortIcon col="title" /></span>
                  </TableHead>
                  <TableHead className="text-right hidden md:table-cell">תיאור</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">פרטים טכניים</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(insight => (
                  <TableRow key={insight.insight_id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {getSeverityIcon(insight.severity)}
                        <span className={`hidden sm:inline text-xs px-1.5 py-0.5 rounded border ${getSeverityBadgeClass(insight.severity)}`}>
                          {SEVERITY_LABELS[insight.severity] ?? insight.severity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1.5 justify-end text-xs whitespace-nowrap">
                        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        {new Date(insight.created_at).toLocaleString('he-IL', {
                          day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{insight.tail}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{insight.system}</TableCell>
                    <TableCell className="text-right max-w-44">
                      <span className="font-medium text-sm line-clamp-2">{insight.title}</span>
                    </TableCell>
                    <TableCell className="text-right max-w-56 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground line-clamp-2">{insight.description}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-40">
                      <code className="text-[10px] font-mono text-muted-foreground truncate block">
                        {insight.technical_detail}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleJumpToTime(insight)}
                        className="h-7 text-xs gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        קפץ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm space-y-2">
              <p>לא נמצאו אירועים התואמים לסינון הנוכחי</p>
              {anyFilterActive && (
                <Button variant="link" size="sm" onClick={clearFilters}>
                  נקה את כל הסינונים
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
