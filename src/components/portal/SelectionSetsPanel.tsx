import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCSVData } from '@/contexts/CSVDataContext';
import {
  Database,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
  TrendingUp,
  Clock,
  GitMerge,
} from 'lucide-react';

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

export const SelectionSetsPanel: React.FC = () => {
  const { selectionSets, updateSelectionSet, deleteSelectionSet, combineSelectionSets } = useCSVData();

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState('');
  const [editDesc, setEditDesc]     = useState('');
  const [selectedForOp, setSelectedForOp] = useState<string[]>([]);

  const startEdit = (set: typeof selectionSets[0]) => {
    setEditingId(set.id);
    setEditName(set.name);
    setEditDesc(set.description || '');
  };

  const saveEdit = () => {
    if (editingId) {
      updateSelectionSet(editingId, { name: editName, description: editDesc });
      setEditingId(null);
    }
  };

  const cancelEdit = () => setEditingId(null);

  const toggleOp = (id: string) =>
    setSelectedForOp(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]
    );

  const opSet1 = selectionSets.find(s => s.id === selectedForOp[0]);
  const opSet2 = selectionSets.find(s => s.id === selectedForOp[1]);

  const doOp = (op: 'union' | 'intersect' | 'difference') => {
    if (selectedForOp.length === 2) {
      const names = { union: '∪', intersect: '∩', difference: '\\' };
      combineSelectionSets(selectedForOp, op, `${opSet1?.name} ${names[op]} ${opSet2?.name}`);
      setSelectedForOp([]);
    }
  };

  if (selectionSets.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            בחירות שמורות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 space-y-2">
            <Database className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">אין בחירות שמורות עדיין</p>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              גרור אזור בגרף האותות<br />כדי לשמור בחירת נתונים
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            בחירות שמורות
            <Badge variant="secondary" className="text-xs h-5 px-1.5">{selectionSets.length}</Badge>
          </CardTitle>
          {selectedForOp.length === 2 && (
            <span className="text-[10px] text-muted-foreground">בחרת 2 — בצע פעולה</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Operations bar — appears when 2 sets are tapped */}
        {selectedForOp.length === 2 && (
          <div className="flex items-center gap-1 p-2 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-xs text-muted-foreground ml-1">
              {opSet1?.name} ↔ {opSet2?.name}
            </span>
            <div className="flex gap-1 mr-auto">
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => doOp('union')}
                title="איחוד">
                <GitMerge className="h-3 w-3 ml-1" />∪
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => doOp('intersect')}
                title="חיתוך">
                ∩
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => doOp('difference')}
                title="הפרש">
                \
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setSelectedForOp([])}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Sets list — no fixed cap: grows to fill space beside the charts */}
        <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {selectionSets.map((set, idx) => {
            const color = SELECTION_COLORS[idx % SELECTION_COLORS.length];
            const isEditing = editingId === set.id;
            const isSelected = selectedForOp.includes(set.id);

            return (
              <div
                key={set.id}
                className={`rounded-lg border transition-all ${
                  isSelected
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                {isEditing ? (
                  <div className="p-2 space-y-2">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    />
                    <Textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      className="text-xs h-10 resize-none"
                      placeholder="תיאור קצר (אופציונלי)"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs flex-1" onClick={saveEdit}>
                        <Check className="h-3 w-3 ml-1" />שמור
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={cancelEdit}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-2 cursor-pointer"
                    onClick={() => toggleOp(set.id)}
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-2">
                      {/* Color swatch + selection indicator */}
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 ring-2 transition-all ${
                          isSelected ? 'ring-primary ring-offset-1' : 'ring-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-medium flex-1 truncate">{set.name}</span>
                      {/* Actions */}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                           onClick={e => e.stopPropagation()}>
                        <Button
                          size="sm" variant="ghost" className="h-5 w-5 p-0"
                          onClick={() => startEdit(set)}
                          title="ערוך שם"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteSelectionSet(set.id)}
                          title="מחק"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-1.5 mt-1.5 pr-5">
                      <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">
                        {TYPE_LABELS[set.type] ?? set.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Layers className="h-2.5 w-2.5" />
                        {SOURCE_LABELS[set.source] ?? set.source}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mr-auto">
                        <TrendingUp className="h-2.5 w-2.5" />
                        {set.data.length} נק׳
                      </span>
                    </div>

                    {/* Stats row */}
                    {set.statistics?.mean != null && (
                      <div className="flex gap-2 mt-1 pr-5 text-[10px] text-muted-foreground">
                        <span>μ {set.statistics.mean.toFixed(1)}</span>
                        <span>σ {set.statistics.std?.toFixed(1)}</span>
                        {set.statistics.outlierPercentage != null && set.statistics.outlierPercentage > 0 && (
                          <span className="text-amber-500">{set.statistics.outlierPercentage.toFixed(0)}% חריגות</span>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {set.description && (
                      <p className="text-[10px] text-muted-foreground mt-1 pr-5 truncate">{set.description}</p>
                    )}

                    {/* Time */}
                    <div className="flex items-center gap-0.5 mt-1 pr-5 text-[10px] text-muted-foreground/60">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(set.createdAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectionSets.length >= 2 && selectedForOp.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            לחץ על שתי בחירות כדי לאחד / לחתוך
          </p>
        )}
      </CardContent>
    </Card>
  );
};
