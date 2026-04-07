// Evidence Tab — problem-solving-oriented evidence management
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText, Download, Trash2, GitCompare, TrendingUp, TrendingDown,
  Minus, BarChart3, Search, Info, Layers, Clock, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';

// ── helpers ──────────────────────────────────────────────────────────────────

const SELECTION_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444',
];

const TYPE_LABELS: Record<string, string> = {
  'time-range':   'טווח זמן',
  'value-range':  'טווח ערכים',
  'lasso':        'בחירה חופשית',
  'combined':     'משולב',
};

const SOURCE_LABELS: Record<string, string> = {
  'signals':       'אותות',
  'distributions': 'התפלגויות',
  'correlations':  'קורלציות',
};

function calcStats(set: any) {
  if (!set.data?.length) return null;
  let values: number[] = [];
  const first = set.data[0];
  if (first && typeof first === 'object') {
    const key = 'value' in first
      ? 'value'
      : Object.keys(first).find(k => typeof first[k] === 'number');
    if (key) values = set.data.map((d: any) => d[key]).filter((v: any) => typeof v === 'number');
  } else if (typeof first === 'number') {
    values = set.data.filter((v: any) => typeof v === 'number');
  }
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return {
    count: n, mean, std: Math.sqrt(variance),
    min: sorted[0], max: sorted[n - 1],
    median: sorted[Math.floor(n / 2)],
    q1: sorted[Math.floor(n * 0.25)],
    q3: sorted[Math.floor(n * 0.75)],
  };
}

function exportSetAsCSV(set: any) {
  const stats = calcStats(set);
  let csv = `data:text/csv;charset=utf-8,`;
  csv += `"סט ראיות","${set.name}"\n`;
  csv += `"תיאור","${set.description ?? ''}"\n`;
  csv += `"מקור","${SOURCE_LABELS[set.source] ?? set.source}"\n`;
  csv += `"סוג","${TYPE_LABELS[set.type] ?? set.type}"\n`;
  if (stats) {
    csv += `"ממוצע","${stats.mean.toFixed(3)}"\n`;
    csv += `"סטיית תקן","${stats.std.toFixed(3)}"\n`;
    csv += `"מינימום","${stats.min.toFixed(3)}"\n`;
    csv += `"מקסימום","${stats.max.toFixed(3)}"\n`;
    csv += `"חציון","${stats.median.toFixed(3)}"\n`;
    csv += `"כמות","${stats.count}"\n`;
  }
  if (set.data.length > 0) {
    csv += '\nנתונים\n';
    const headers = typeof set.data[0] === 'object' ? Object.keys(set.data[0]) : ['value'];
    csv += headers.join(',') + '\n';
    set.data.forEach((row: any) =>
      typeof row === 'object'
        ? (csv += headers.map(h => row[h] ?? '').join(',') + '\n')
        : (csv += row + '\n')
    );
  }
  const a = document.createElement('a');
  a.href = encodeURI(csv);
  a.download = `${set.name.replace(/[^\w\u0590-\u05FF]/g, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Stat pill ────────────────────────────────────────────────────────────────

const StatPill: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`text-center px-3 py-2 rounded-lg ${accent ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-muted/60'}`}>
    <div className={`text-base font-bold ${accent ? 'text-amber-700 dark:text-amber-400' : ''}`}>{value}</div>
    <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
  </div>
);

// ── Evidence set card ────────────────────────────────────────────────────────

const EvidenceCard: React.FC<{
  set: any;
  idx: number;
  compareMode: boolean;
  isSelected: boolean;
  selectionCount: number;
  onToggleSelect: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}> = ({ set, idx, compareMode, isSelected, selectionCount, onToggleSelect, onDelete }) => {
  const stats = useMemo(() => calcStats(set), [set]);
  const color = SELECTION_COLORS[idx % SELECTION_COLORS.length];

  const spreadRisk = stats
    ? stats.std / (Math.abs(stats.mean) || 1)
    : null;

  const riskLabel = spreadRisk == null ? null
    : spreadRisk > 0.3  ? { text: 'שונות גבוהה', cls: 'text-red-600', Icon: AlertTriangle }
    : spreadRisk > 0.12 ? { text: 'שונות בינונית', cls: 'text-amber-600', Icon: TrendingUp }
    :                     { text: 'שונות נמוכה', cls: 'text-emerald-600', Icon: CheckCircle2 };

  return (
    <Card className={`transition-all ${isSelected ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-sm'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {compareMode && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={c => onToggleSelect(set.id, c as boolean)}
              disabled={!isSelected && selectionCount >= 2}
              className="mt-0.5"
            />
          )}
          {/* Color + name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{set.name}</h3>
              {set.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{set.description}</p>
              )}
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => exportSetAsCSV(set)}>
              <Download className="h-3 w-3" />
              ייצא
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(set.id)}
              title="מחק סט"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Type + source badges */}
        <div className="flex items-center gap-1.5 mt-2 pr-6">
          <Badge variant="secondary" className="text-xs h-5">
            <Layers className="h-2.5 w-2.5 ml-1" />
            {TYPE_LABELS[set.type] ?? set.type}
          </Badge>
          <Badge variant="outline" className="text-xs h-5">
            {SOURCE_LABELS[set.source] ?? set.source}
          </Badge>
          {riskLabel && (
            <span className={`flex items-center gap-1 text-[11px] ${riskLabel.cls} mr-auto`}>
              <riskLabel.Icon className="h-3 w-3" />
              {riskLabel.text}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {stats ? (
          <>
            {/* Primary stats grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              <StatPill label="כמות" value={String(stats.count)} />
              <StatPill label="ממוצע" value={stats.mean.toFixed(2)} />
              <StatPill label="סטיית תקן" value={stats.std.toFixed(2)} />
              <StatPill label="מינימום" value={stats.min.toFixed(2)} />
              <StatPill label="מקסימום" value={stats.max.toFixed(2)} accent={stats.max > stats.mean + 2 * stats.std} />
              <StatPill label="חציון" value={stats.median.toFixed(2)} />
            </div>

            {/* IQR bar visual */}
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Q1: {stats.q1.toFixed(2)}</span>
                <span className="font-medium">IQR = {(stats.q3 - stats.q1).toFixed(2)}</span>
                <span>Q3: {stats.q3.toFixed(2)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted relative overflow-hidden">
                {(() => {
                  const range = stats.max - stats.min || 1;
                  const q1pct = ((stats.q1 - stats.min) / range) * 100;
                  const q3pct = ((stats.q3 - stats.min) / range) * 100;
                  return (
                    <div
                      className="absolute h-full rounded-full"
                      style={{ left: `${q1pct}%`, width: `${q3pct - q1pct}%`, backgroundColor: color, opacity: 0.6 }}
                    />
                  );
                })()}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Info className="h-4 w-4" />
            אין נתונים מספריים לניתוח סטטיסטי
          </div>
        )}

        <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {new Date(set.createdAt).toLocaleString('he-IL', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// ── helpers for A/B ──────────────────────────────────────────────────────────

function getDataTimeRange(set: any): { from: number; to: number } | null {
  const timestamps: number[] = (set.data ?? [])
    .map((d: any) => {
      const t = d?.timestamp;
      if (t == null) return null;
      const n = typeof t === 'number' ? t : Number(t);
      return isNaN(n) ? null : n;
    })
    .filter((t: number | null): t is number => t !== null);
  if (!timestamps.length) return null;
  return { from: Math.min(...timestamps), to: Math.max(...timestamps) };
}

const SELECTION_COLORS_AB = ['#3b82f6', '#10b981'];

// ── A/B comparison ───────────────────────────────────────────────────────────

const AbComparison: React.FC<{ setA: any; setB: any }> = ({ setA, setB }) => {
  const statsA = useMemo(() => calcStats(setA), [setA]);
  const statsB = useMemo(() => calcStats(setB), [setB]);
  const rangeA = useMemo(() => getDataTimeRange(setA), [setA]);
  const rangeB = useMemo(() => getDataTimeRange(setB), [setB]);

  if (!statsA || !statsB) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          אחד או יותר מהסטים אינם מכילים נתונים מספריים להשוואה
        </CardContent>
      </Card>
    );
  }

  const meanDiff = statsB.mean - statsA.mean;
  const meanDiffPct = (meanDiff / (Math.abs(statsA.mean) || 1)) * 100;
  const stdDiff = statsB.std - statsA.std;

  const DiffBadge = ({ value, pct }: { value: number; pct?: boolean }) => {
    const up = value > 0;
    const zero = Math.abs(value) < 0.001;
    if (zero) return <span className="text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> זהה</span>;
    return (
      <span className={`flex items-center gap-0.5 font-medium ${up ? 'text-red-600' : 'text-emerald-600'}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? '+' : ''}{pct ? `${value.toFixed(1)}%` : value.toFixed(3)}
      </span>
    );
  };

  const rows = [
    { label: 'ממוצע',        a: statsA.mean.toFixed(3),   b: statsB.mean.toFixed(3),   diff: meanDiff,      pct: false },
    { label: 'שינוי %',       a: '—',                      b: '—',                       diff: meanDiffPct,   pct: true  },
    { label: 'סטיית תקן',    a: statsA.std.toFixed(3),    b: statsB.std.toFixed(3),    diff: stdDiff,       pct: false },
    { label: 'מינימום',      a: statsA.min.toFixed(3),    b: statsB.min.toFixed(3),    diff: statsB.min - statsA.min,  pct: false },
    { label: 'מקסימום',      a: statsA.max.toFixed(3),    b: statsB.max.toFixed(3),    diff: statsB.max - statsA.max,  pct: false },
    { label: 'חציון',        a: statsA.median.toFixed(3), b: statsB.median.toFixed(3), diff: statsB.median - statsA.median, pct: false },
    { label: 'כמות נקודות', a: String(statsA.count),     b: String(statsB.count),     diff: statsB.count - statsA.count,  pct: false },
  ];

  const renderTimeRange = (range: { from: number; to: number } | null) => {
    if (!range) return <span className="text-muted-foreground text-[11px]">—</span>;
    const fmt = (ts: number, opts: Intl.DateTimeFormatOptions) =>
      new Date(ts).toLocaleString('he-IL', opts);
    const dateStr = fmt(range.from, { day: '2-digit', month: '2-digit', year: '2-digit' });
    const fromTime = fmt(range.from, { hour: '2-digit', minute: '2-digit' });
    const toTime   = fmt(range.to,   { hour: '2-digit', minute: '2-digit' });
    const durationMin = Math.round((range.to - range.from) / 60000);
    return (
      <div className="text-[11px] space-y-0.5">
        <div className="font-mono text-muted-foreground">{dateStr}</div>
        <div className="font-mono">{fromTime} → {toTime}</div>
        <div className="text-muted-foreground">{durationMin} דקות</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header — shows actual data time ranges and point counts */}
      <div className="grid grid-cols-3 gap-4">
        {([{ set: setA, range: rangeA, stats: statsA, label: 'A', colorIdx: 0 },
           { set: setB, range: rangeB, stats: statsB, label: 'B', colorIdx: 1 }] as const).map(({ set, range, stats, label, colorIdx }) => (
          <Card key={set.id} className="col-span-1">
            <CardHeader className="pb-2 space-y-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge
                  style={{ backgroundColor: SELECTION_COLORS_AB[colorIdx] }}
                  className="text-white border-0"
                >
                  {label}
                </Badge>
                <span className="truncate">{set.name}</span>
              </CardTitle>
              <div className="space-y-1 pt-1 border-t">
                {renderTimeRange(range)}
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                  <Clock className="h-3 w-3" />
                  נשמר {new Date(set.createdAt).toLocaleString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">הפרש (B − A)</CardTitle>
            <div className="text-[11px] text-muted-foreground pt-1 border-t space-y-0.5">
              <div>ירוק = B נמוך מ-A</div>
              <div>אדום = B גבוה מ-A</div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Comparison table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">מדד</th>
                <th className="text-center px-4 py-2 font-medium text-xs">A — {setA.name}</th>
                <th className="text-center px-4 py-2 font-medium text-xs">B — {setB.name}</th>
                <th className="text-center px-4 py-2 font-medium text-xs">הפרש</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? 'bg-muted/10' : ''}>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{row.label}</td>
                  <td className="px-4 py-2 text-center font-mono text-xs">{row.a}</td>
                  <td className="px-4 py-2 text-center font-mono text-xs">{row.b}</td>
                  <td className="px-4 py-2 text-center text-xs">
                    <DiffBadge value={row.diff} pct={row.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        ערכים חיוביים (אדום) = B גבוה מ-A · ערכים שליליים (ירוק) = B נמוך מ-A
      </p>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

export const EvidenceTab: React.FC = () => {
  const { selectionSets, deleteSelectionSet } = useCSVData();
  const [search, setSearch]               = useState('');
  const [compareMode, setCompareMode]     = useState(false);
  const [selectedSets, setSelectedSets]   = useState<string[]>([]);

  const filtered = useMemo(
    () => selectionSets.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [selectionSets, search],
  );

  const toggleSelect = (id: string, checked: boolean) =>
    checked
      ? setSelectedSets(prev => [...prev, id])
      : setSelectedSets(prev => prev.filter(x => x !== id));

  const setA = selectionSets.find(s => s.id === selectedSets[0]);
  const setB = selectionSets.find(s => s.id === selectedSets[1]);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (selectionSets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ניהול ראיות
          </CardTitle>
          <CardDescription>
            ראיות הן קטעי נתונים שנבחרו בגרפים ושמורים לתחקיר
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center space-y-3">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <h3 className="font-medium">אין ראיות שמורות עדיין</h3>
            <div className="text-sm text-muted-foreground max-w-sm mx-auto space-y-1">
              <p>כיצד לשמור ראיה:</p>
              <ol className="text-right list-decimal list-inside space-y-1 text-xs">
                <li>עבור לטאב "אותות" ובחר פרמטר לניתוח</li>
                <li>גרור על הגרף כדי לסמן אזור חשוד</li>
                <li>שמור כ"בחירה" עם שם תיאורי</li>
                <li>חזור לכאן לניתוח ולהשוואה</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Controls bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש בראיות…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 text-right"
          />
        </div>

        <Button
          variant={compareMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setCompareMode(m => !m); setSelectedSets([]); }}
          className="flex items-center gap-2"
        >
          <GitCompare className="h-4 w-4" />
          {compareMode ? 'ביטול השוואה' : 'השוואת A/B'}
        </Button>

        {compareMode && (
          <span className="text-xs text-muted-foreground">
            {selectedSets.length}/2 נבחרו
          </span>
        )}

        <span className="text-xs text-muted-foreground mr-auto">
          {filtered.length} מתוך {selectionSets.length} ראיות
        </span>
      </div>

      <Separator />

      <Tabs defaultValue="list">
        <TabsList className="grid grid-cols-2 w-48">
          <TabsTrigger value="list">רשימה</TabsTrigger>
          <TabsTrigger
            value="compare"
            disabled={!compareMode || selectedSets.length !== 2}
          >
            השוואה
          </TabsTrigger>
        </TabsList>

        {/* ── List tab ── */}
        <TabsContent value="list" className="space-y-3 mt-4">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              לא נמצאו ראיות התואמות לחיפוש
            </div>
          ) : (
            filtered.map((set, idx) => (
              <EvidenceCard
                key={set.id}
                set={set}
                idx={selectionSets.indexOf(set)}
                compareMode={compareMode}
                isSelected={selectedSets.includes(set.id)}
                selectionCount={selectedSets.length}
                onToggleSelect={toggleSelect}
                onDelete={deleteSelectionSet}
              />
            ))
          )}

          {compareMode && selectedSets.length === 2 && (
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  const tab = document.querySelector('[data-value="compare"]') as HTMLElement;
                  tab?.click();
                }}
                className="flex items-center gap-2"
              >
                <GitCompare className="h-4 w-4" />
                פתח השוואה
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Compare tab ── */}
        <TabsContent value="compare" className="mt-4">
          {setA && setB ? (
            <AbComparison setA={setA} setB={setB} />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                בחר שני סטים ברשימה כדי להשוות
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
