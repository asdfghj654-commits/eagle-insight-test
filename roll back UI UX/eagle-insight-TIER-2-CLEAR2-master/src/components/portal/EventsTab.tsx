// Events Tab - Display rule violations and anomalies
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, AlertCircle, Info, Clock, Filter, ExternalLink } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DataAdapter } from '@/lib/data-adapter';
import { DemoDataButton } from './DemoDataButton';

interface EventsTabProps {
  onJumpToTime?: (timestamp: number, parameter: string) => void;
}

export const EventsTab: React.FC<EventsTabProps> = ({ onJumpToTime }) => {
  const { insights, hasData } = useDashboardData();
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Get all unique systems and types for filters
  const { systems, types } = useMemo(() => {
    const systemsSet = new Set(insights.map(insight => insight.system));
    const typesSet = new Set(insights.map(insight => insight.type));
    
    return {
      systems: Array.from(systemsSet),
      types: Array.from(typesSet)
    };
  }, [insights]);

  // Filter and search insights
  const filteredInsights = useMemo(() => {
    return insights.filter(insight => {
      const matchesSearch = searchTerm === '' || 
        insight.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insight.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insight.tail.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSeverity = severityFilter === 'all' || insight.severity === severityFilter;
      const matchesSystem = systemFilter === 'all' || insight.system === systemFilter;
      const matchesType = typeFilter === 'all' || insight.type === typeFilter;
      
      return matchesSearch && matchesSeverity && matchesSystem && matchesType;
    });
  }, [insights, searchTerm, severityFilter, systemFilter, typeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredInsights.length;
    const critical = filteredInsights.filter(i => i.severity === 'critical').length;
    const high = filteredInsights.filter(i => i.severity === 'high').length;
    const medium = filteredInsights.filter(i => i.severity === 'medium').length;
    
    return { total, critical, high, medium };
  }, [filteredInsights]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive' as const;
      case 'high':
        return 'secondary' as const;
      case 'medium':
        return 'outline' as const;
      default:
        return 'default' as const;
    }
  };

  const handleJumpToTime = (insight: any) => {
    if (onJumpToTime && insight.created_at) {
      // Extract parameter from technical detail or use a default
      const parameter = insight.technical_detail?.split(':')[0] || 'altitude_ft';
      onJumpToTime(insight.created_at, parameter);
    }
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium text-center">אין אירועים זמינים</h3>
        <p className="text-muted-foreground text-center">טען נתוני דמו כדי לראות אירועים וחריגות</p>
        <DemoDataButton variant="default" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right">סה"כ אירועים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right text-destructive">קריטי</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-destructive">{stats.critical}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right text-orange-500">גבוה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-orange-500">{stats.high}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right text-yellow-500">בינוני</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-yellow-500">{stats.medium}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <Filter className="h-5 w-5" />
            סינון וחיפוש
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" dir="rtl">
            <div>
              <Input
                placeholder="חיפוש באירועים..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-right"
              />
            </div>
            
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="חומרה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל החומרות</SelectItem>
                <SelectItem value="critical">קריטי</SelectItem>
                <SelectItem value="high">גבוה</SelectItem>
                <SelectItem value="medium">בינוני</SelectItem>
                <SelectItem value="low">נמוך</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={systemFilter} onValueChange={setSystemFilter}>
              <SelectTrigger>
                <SelectValue placeholder="מערכת" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המערכות</SelectItem>
                {systems.map(system => (
                  <SelectItem key={system} value={system}>{system}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="סוג" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוגים</SelectItem>
                {types.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === 'rule_violation' ? 'חריגת כלל' :
                     type === 'trend' ? 'מגמה' :
                     type === 'behavior_impact' ? 'השפעת התנהגות' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right">רשימת אירועים</CardTitle>
          <CardDescription className="text-right">
            {filteredInsights.length} אירועים מתוך {insights.length} סה"כ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">זמן</TableHead>
                  <TableHead className="text-right">זנב</TableHead>
                  <TableHead className="text-right">מערכת</TableHead>
                  <TableHead className="text-right">חומרה</TableHead>
                  <TableHead className="text-right">כותרת</TableHead>
                  <TableHead className="text-right">תיאור</TableHead>
                  <TableHead className="text-right">פרטים טכניים</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInsights.map((insight) => (
                  <TableRow key={insight.insight_id} className="hover:bg-muted/50">
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(insight.created_at).toLocaleString('he-IL')}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <Badge variant="outline">{insight.tail}</Badge>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <span className="text-sm font-medium">{insight.system}</span>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {getSeverityIcon(insight.severity)}
                        <Badge variant={getSeverityVariant(insight.severity)}>
                          {insight.severity === 'critical' ? 'קריטי' :
                           insight.severity === 'high' ? 'גבוה' :
                           insight.severity === 'medium' ? 'בינוני' : 'נמוך'}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right max-w-48">
                      <div className="font-medium truncate">{insight.title}</div>
                    </TableCell>
                    
                    <TableCell className="text-right max-w-64">
                      <div className="text-sm text-muted-foreground truncate">
                        {insight.description}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right max-w-48">
                      <div className="text-xs font-mono truncate">
                        {insight.technical_detail}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleJumpToTime(insight)}
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        קפץ לזמן
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredInsights.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו אירועים התואמים לסינון
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};