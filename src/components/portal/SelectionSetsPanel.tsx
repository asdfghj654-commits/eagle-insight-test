import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCSVData } from "@/contexts/CSVDataContext";
import { 
  Database, 
  Plus, 
  Trash2, 
  Edit2, 
  GitMerge, 
  Zap, 
  Minus,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const SELECTION_COLORS = [
  'hsl(var(--primary))',
  'hsl(220, 70%, 50%)',
  'hsl(120, 60%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(30, 80%, 50%)',
  'hsl(190, 70%, 50%)',
];

export const SelectionSetsPanel: React.FC = () => {
  const { 
    selectionSets, 
    updateSelectionSet, 
    deleteSelectionSet, 
    combineSelectionSets 
  } = useCSVData();

  const [isOpen, setIsOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);

  const handleEditStart = (set: any) => {
    setEditingSet(set.id);
    setEditName(set.name);
    setEditDescription(set.description || '');
  };

  const handleEditSave = () => {
    if (editingSet) {
      updateSelectionSet(editingSet, {
        name: editName,
        description: editDescription
      });
      setEditingSet(null);
    }
  };

  const handleSetSelection = (setId: string) => {
    setSelectedSets(prev => {
      if (prev.includes(setId)) {
        return prev.filter(id => id !== setId);
      } else {
        return prev.length < 2 ? [...prev, setId] : [prev[1], setId];
      }
    });
  };

  const handleUnion = () => {
    if (selectedSets.length === 2) {
      const set1 = selectionSets.find(s => s.id === selectedSets[0]);
      const set2 = selectionSets.find(s => s.id === selectedSets[1]);
      const name = `${set1?.name} ∪ ${set2?.name}`;
      combineSelectionSets(selectedSets, 'union', name);
      setSelectedSets([]);
    }
  };

  const handleIntersection = () => {
    if (selectedSets.length === 2) {
      const set1 = selectionSets.find(s => s.id === selectedSets[0]);
      const set2 = selectionSets.find(s => s.id === selectedSets[1]);
      const name = `${set1?.name} ∩ ${set2?.name}`;
      combineSelectionSets(selectedSets, 'intersect', name);
      setSelectedSets([]);
    }
  };

  const handleDeleteSelected = () => {
    selectedForDeletion.forEach(setId => deleteSelectionSet(setId));
    setSelectedForDeletion([]);
  };

  const handleToggleDeletion = (setId: string) => {
    setSelectedForDeletion(prev => 
      prev.includes(setId) 
        ? prev.filter(id => id !== setId)
        : [...prev, setId]
    );
  };

  const handleDifference = () => {
    if (selectedSets.length === 2) {
      const set1 = selectionSets.find(s => s.id === selectedSets[0]);
      const set2 = selectionSets.find(s => s.id === selectedSets[1]);
      const name = `${set1?.name} \\ ${set2?.name}`;
      combineSelectionSets(selectedSets, 'difference', name);
      setSelectedSets([]);
    }
  };

  return (
    <Card className="h-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                בחירות שמורות ({selectionSets.length})
              </div>
              <div className="flex items-center gap-2">
                {selectedForDeletion.length > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSelected();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    מחק ({selectedForDeletion.length})
                  </Button>
                )}
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
        {/* Set Operations */}
        {selectedSets.length === 2 && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="text-xs font-medium text-muted-foreground text-right">
              פעולות על סטים
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={handleUnion}
                aria-label="איחוד סטים נבחרים"
              >
                <GitMerge className="h-3 w-3" />
                ∪
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={handleIntersection}
                aria-label="חיתוך סטים נבחרים"
              >
                <Zap className="h-3 w-3" />
                ∩
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={handleDifference}
                aria-label="הפרש בין סטים נבחרים"
              >
                <Minus className="h-3 w-3" />
                \
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Selection Sets List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {selectionSets.map((set, index) => (
            <div
              key={set.id}
              className={`p-3 rounded-lg border transition-all ${
                selectedSets.includes(set.id) 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedForDeletion.includes(set.id)}
                    onCheckedChange={() => handleToggleDeletion(set.id)}
                    className="h-4 w-4"
                  />
                  <div
                    className="w-3 h-3 rounded-full cursor-pointer"
                    style={{ backgroundColor: SELECTION_COLORS[index % SELECTION_COLORS.length] }}
                    onClick={() => handleSetSelection(set.id)}
                  />
                  {editingSet === set.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-6 text-xs"
                      onBlur={handleEditSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="text-sm font-medium cursor-pointer"
                      onClick={() => handleSetSelection(set.id)}
                    >
                      {set.name}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditStart(set);
                    }}
                    aria-label={`ערוך את ${set.name}`}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {set.type}
                  </Badge>
                  <span>{set.data.length} נקודות</span>
                </div>
                
                {set.statistics && (
                  <div className="text-xs text-muted-foreground">
                    μ={set.statistics.mean?.toFixed(2)} σ={set.statistics.std?.toFixed(2)}
                  </div>
                )}

                {editingSet === set.id ? (
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="text-xs h-12"
                    placeholder="תיאור..."
                    onBlur={handleEditSave}
                  />
                ) : (
                  set.description && (
                    <div className="text-xs text-muted-foreground">
                      {set.description}
                    </div>
                  )
                )}

                <div className="text-xs text-muted-foreground">
                  {new Date(set.createdAt).toLocaleString('he-IL')}
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectionSets.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <div>אין בחירות שמורות</div>
            <div className="text-xs">בחר נתונים בגרפים ליצירת סטים</div>
          </div>
        )}
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
    </Card>
  );
};
