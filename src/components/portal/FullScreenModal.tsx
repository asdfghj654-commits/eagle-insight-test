import React, { useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { X, Settings, Download } from 'lucide-react';

interface FullScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  parameters: string[];
  colors: string[];
  title: string;
}

export const FullScreenModal: React.FC<FullScreenModalProps> = ({
  isOpen,
  onClose,
  data,
  parameters,
  colors,
  title
}) => {
  const [brushDomain, setBrushDomain] = useState<[number, number] | null>(null);

  const handleBrushChange = (brushData: any) => {
    if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      const start = data[brushData.startIndex]?.timestamp;
      const end = data[brushData.endIndex]?.timestamp;
      if (start && end) {
        setBrushDomain([start, end]);
      }
    }
  };

  const formatTimestamp = (tickItem: any) => {
    return new Date(tickItem).toLocaleTimeString('he-IL');
  };

  const exportData = () => {
    const filteredData = brushDomain 
      ? data.filter(d => d.timestamp >= brushDomain[0] && d.timestamp <= brushDomain[1])
      : data;
    
    const csv = [
      ['timestamp', ...parameters].join(','),
      ...filteredData.map(row => [
        new Date(row.timestamp).toISOString(),
        ...parameters.map(param => row[param] || '')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full" dir="rtl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">{title} - מסך מלא</h2>
              <div className="flex items-center gap-2">
                {parameters.map((param, index) => (
                  <Badge 
                    key={param}
                    variant="outline"
                    style={{ 
                      borderColor: colors[index],
                      color: colors[index]
                    }}
                    className="text-xs"
                  >
                    {param}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="h-4 w-4 ml-1" />
                ייצא נתונים
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4 ml-1" />
                סגור
              </Button>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  type="number"
                  scale="time"
                  domain={brushDomain || ['dataMin', 'dataMax']}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString('he-IL')}
                  formatter={(value: any, name: string) => [
                    parseFloat(value).toFixed(2), 
                    name
                  ]}
                />
                
                {parameters.map((param, index) => (
                  <Line
                    key={param}
                    type="monotone"
                    dataKey={param}
                    stroke={colors[index]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}
                
                <Brush
                  dataKey="timestamp"
                  height={40}
                  stroke="hsl(var(--primary))"
                  onChange={handleBrushChange}
                  tickFormatter={formatTimestamp}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Info Bar */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                נקודות נתונים: {brushDomain 
                  ? data.filter(d => d.timestamp >= brushDomain[0] && d.timestamp <= brushDomain[1]).length
                  : data.length
                }
              </div>
              {brushDomain && (
                <div>
                  טווח נבחר: {new Date(brushDomain[0]).toLocaleString('he-IL')} - {new Date(brushDomain[1]).toLocaleString('he-IL')}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};