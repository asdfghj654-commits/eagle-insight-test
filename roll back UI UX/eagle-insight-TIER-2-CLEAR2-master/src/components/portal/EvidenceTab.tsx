// Evidence Tab - Manage and analyze selection sets with A/B comparison
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FileText, BarChart3, Download, Trash2, Eye, GitCompare } from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';

export const EvidenceTab: React.FC = () => {
  const { selectionSets, evidence, deleteSelectionSet } = useCSVData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');

  // Filter selection sets
  const filteredSets = useMemo(() => {
    return selectionSets.filter(set => 
      set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      set.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [selectionSets, searchTerm]);

  // Calculate detailed statistics for a selection set
  const calculateDetailedStats = (set: any) => {
    if (!set.data || set.data.length === 0) return null;

    // Try to extract numeric values from data
    let values: number[] = [];
    
    if (set.data[0] && typeof set.data[0] === 'object') {
      // If data contains objects with 'value' property
      if ('value' in set.data[0]) {
        values = set.data.map((item: any) => item.value).filter((v: any) => typeof v === 'number');
      }
      // Or extract first numeric property
      else {
        const numericKey = Object.keys(set.data[0]).find(key => 
          typeof set.data[0][key] === 'number'
        );
        if (numericKey) {
          values = set.data.map((item: any) => item[numericKey]).filter((v: any) => typeof v === 'number');
        }
      }
    } else if (typeof set.data[0] === 'number') {
      values = set.data.filter((v: any) => typeof v === 'number');
    }

    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const std = Math.sqrt(variance);

    return {
      count: n,
      mean,
      std,
      min: sorted[0],
      max: sorted[n - 1],
      median: sorted[Math.floor(n / 2)],
      q1: sorted[Math.floor(n * 0.25)],
      q3: sorted[Math.floor(n * 0.75)],
      values: sorted
    };
  };

  // Compare two selection sets
  const compareData = useMemo(() => {
    if (selectedSets.length !== 2) return null;

    const set1 = selectionSets.find(s => s.id === selectedSets[0]);
    const set2 = selectionSets.find(s => s.id === selectedSets[1]);

    if (!set1 || !set2) return null;

    const stats1 = calculateDetailedStats(set1);
    const stats2 = calculateDetailedStats(set2);

    if (!stats1 || !stats2) return null;

    return {
      set1: { ...set1, stats: stats1 },
      set2: { ...set2, stats: stats2 },
      comparison: {
        meanDiff: stats2.mean - stats1.mean,
        meanDiffPercent: ((stats2.mean - stats1.mean) / stats1.mean) * 100,
        stdDiff: stats2.std - stats1.std,
        countDiff: stats2.count - stats1.count
      }
    };
  }, [selectedSets, selectionSets]);

  const handleSetSelection = (setId: string, checked: boolean) => {
    if (checked) {
      setSelectedSets(prev => [...prev, setId]);
    } else {
      setSelectedSets(prev => prev.filter(id => id !== setId));
    }
  };

  const exportData = (set: any) => {
    const data = set.data;
    const stats = calculateDetailedStats(set);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add metadata
    csvContent += `Selection Set: ${set.name}\n`;
    csvContent += `Description: ${set.description || 'N/A'}\n`;
    csvContent += `Created: ${new Date(set.createdAt).toLocaleString('he-IL')}\n`;
    csvContent += `Count: ${data.length}\n`;
    
    if (stats) {
      csvContent += `Mean: ${stats.mean.toFixed(3)}\n`;
      csvContent += `Std Dev: ${stats.std.toFixed(3)}\n`;
      csvContent += `Min: ${stats.min.toFixed(3)}\n`;
      csvContent += `Max: ${stats.max.toFixed(3)}\n`;
    }
    
    csvContent += `\nData:\n`;
    
    // Add headers
    if (data.length > 0 && typeof data[0] === 'object') {
      const headers = Object.keys(data[0]);
      csvContent += headers.join(',') + '\n';
      
      // Add data rows
      data.forEach((item: any) => {
        const row = headers.map(header => item[header] || '').join(',');
        csvContent += row + '\n';
      });
    } else {
      csvContent += 'Value\n';
      data.forEach((item: any) => {
        csvContent += item + '\n';
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${set.name.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (selectionSets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <FileText className="h-5 w-5" />
            ראיות וניתוח סטים
          </CardTitle>
          <CardDescription className="text-right">
            לא נמצאו Selection Sets. צור בחירות בטאבי Signals, Distributions או Correlations
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <FileText className="h-5 w-5" />
            ניהול ראיות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center" dir="rtl">
            <Input
              placeholder="חיפוש בסטים..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-64 text-right"
            />
            
            <Button
              variant={compareMode ? "default" : "outline"}
              onClick={() => {
                setCompareMode(!compareMode);
                setSelectedSets([]);
              }}
              className="flex items-center gap-2"
            >
              <GitCompare className="h-4 w-4" />
              מצב השוואה
            </Button>

            {selectedSets.length > 0 && (
              <Badge variant="secondary">
                {selectedSets.length} נבחרו
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sets" className="w-full">
        <TabsList className="grid w-full grid-cols-2" dir="rtl">
          <TabsTrigger value="sets">רשימת סטים</TabsTrigger>
          <TabsTrigger value="compare" disabled={!compareMode || selectedSets.length !== 2}>
            השוואה A/B
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sets" className="space-y-4">
          {filteredSets.map((set) => {
            const stats = calculateDetailedStats(set);
            const isSelected = selectedSets.includes(set.id);
            
            return (
              <Card key={set.id} className={isSelected ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {compareMode && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSetSelection(set.id, checked as boolean)}
                          disabled={!isSelected && selectedSets.length >= 2}
                        />
                      )}
                      
                      <div className="text-right">
                        <CardTitle className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: set.color }}
                          />
                          {set.name}
                        </CardTitle>
                        <CardDescription className="text-right">
                          {set.description}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportData(set)}
                        className="flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        ייצא
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSelectionSet(set.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4" dir="rtl">
                    <div className="text-center">
                      <div className="text-lg font-bold">{set.data.length}</div>
                      <div className="text-sm text-muted-foreground">נקודות</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold">{set.type}</div>
                      <div className="text-sm text-muted-foreground">סוג</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold">{set.source}</div>
                      <div className="text-sm text-muted-foreground">מקור</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        {new Date(set.createdAt).toLocaleDateString('he-IL')}
                      </div>
                      <div className="text-sm text-muted-foreground">נוצר</div>
                    </div>
                  </div>

                  {stats && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center" dir="rtl">
                      <div>
                        <div className="font-semibold">{stats.mean.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">ממוצע</div>
                      </div>
                      <div>
                        <div className="font-semibold">{stats.std.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">סטיית תקן</div>
                      </div>
                      <div>
                        <div className="font-semibold">{stats.min.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">מינימום</div>
                      </div>
                      <div>
                        <div className="font-semibold">{stats.max.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">מקסימום</div>
                      </div>
                      <div>
                        <div className="font-semibold">{stats.median.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">חציון</div>
                      </div>
                      <div>
                        <div className="font-semibold">{(stats.max - stats.min).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">טווח</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="compare">
          {compareData && (
            <div className="space-y-6">
              {/* Comparison Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-right">השוואה A/B</CardTitle>
                  <CardDescription className="text-right">
                    {compareData.set1.name} vs {compareData.set2.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4" dir="rtl">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {compareData.comparison.meanDiffPercent.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">שינוי בממוצע</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {compareData.comparison.meanDiff.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">הפרש ממוצע</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {compareData.comparison.stdDiff.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">הפרש סטיית תקן</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {compareData.comparison.countDiff}
                      </div>
                      <div className="text-sm text-muted-foreground">הפרש כמות</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Side by Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[compareData.set1, compareData.set2].map((set, index) => (
                  <Card key={set.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-right">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: set.color }}
                        />
                        {set.name} ({index === 0 ? 'A' : 'B'})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>כמות:</span>
                          <span className="font-semibold">{set.stats.count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>ממוצע:</span>
                          <span className="font-semibold">{set.stats.mean.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>סטיית תקן:</span>
                          <span className="font-semibold">{set.stats.std.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>חציון:</span>
                          <span className="font-semibold">{set.stats.median.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>טווח:</span>
                          <span className="font-semibold">
                            {set.stats.min.toFixed(2)} - {set.stats.max.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};