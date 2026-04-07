import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Edit, Trash2, BarChart3, Eye, Plus, Loader2 } from "lucide-react";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useNavigate } from "react-router-dom";
import { useActionToast } from "@/components/ui/shared-actions";
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const RuleManagementTab = () => {
  const { rules, toggleRuleActive, deleteRule, updateRule } = useCSVData();
  const navigate = useNavigate();
  const { showSuccess, showInfo, showError } = useActionToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive'; 
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'critical': return 'קריטי';
      case 'high': return 'גבוה';
      case 'medium': return 'בינוני';
      case 'low': return 'נמוך';
      default: return severity;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'מאושר';
      case 'pending-review': return 'ממתין לאישור';
      case 'rejected': return 'נדחה';
      case 'draft': return 'טיוטה';
      default: return status;
    }
  };

  const handleNewRule = useCallback(() => {
    navigate('/portal/magen-achzaka-david');
  }, [navigate]);

  const handleViewRule = useCallback((rule: any) => {
    setSelectedRule(rule);
    setDetailsDialogOpen(true);
  }, []);

  const handleAnalyzeRule = useCallback((ruleId: string) => {
    setLoading(`analyze-${ruleId}`);
    setTimeout(() => {
      showInfo('ניתוח ביצועים', 'ניתוח ביצועי הכלל בתהליך...');
      setLoading(null);
    }, 500);
  }, [showInfo]);

  const handleEditRule = useCallback((ruleId: string) => {
    setLoading(`edit-${ruleId}`);
    setTimeout(() => {
      navigate('/portal/magen-achzaka-david');
      setLoading(null);
    }, 300);
  }, [navigate]);

  const handleDeleteClick = useCallback((rule: any) => {
    setRuleToDelete({ id: rule.id, name: rule.name });
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (ruleToDelete) {
      setLoading(`delete-${ruleToDelete.id}`);
      setTimeout(() => {
        deleteRule(ruleToDelete.id);
        showSuccess('כלל נמחק', `הכלל "${ruleToDelete.name}" נמחק בהצלחה`);
        setDeleteDialogOpen(false);
        setRuleToDelete(null);
        setLoading(null);
      }, 500);
    }
  }, [ruleToDelete, deleteRule, showSuccess]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-right">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                ניהול כללי אחזקה
              </CardTitle>
              <CardDescription>
                צפה, ערוך ונהל את כללי האחזקה המותאמים אישית
              </CardDescription>
            </div>
            <Button onClick={handleNewRule}>
              <Plus className="h-4 w-4 mr-2" />
              כלל חדש
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">אין כללים מותאמים</h3>
              <p className="mb-4">צור כללים חדשים בפורטל ההנדסי</p>
              <Button onClick={handleNewRule}>
                <Plus className="h-4 w-4 mr-2" />
                צור כלל ראשון
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם הכלל</TableHead>
                  <TableHead className="text-right">תיאור</TableHead>
                  <TableHead className="text-right">חומרה</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">פעיל</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium text-right">
                      {rule.name}
                    </TableCell>
                    <TableCell className="text-right max-w-xs truncate">
                      {rule.description}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getSeverityColor(rule.severity) as any}>
                        {getSeverityText(rule.severity)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={rule.status === 'approved' ? 'default' : 'secondary'}
                      >
                        {getStatusText(rule.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch 
                        checked={rule.isActive}
                        disabled={rule.status !== 'approved'}
                        onCheckedChange={() => toggleRuleActive(rule.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="צפה בפרטי הכלל"
                          onClick={() => handleViewRule(rule)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="ניתוח ביצועים"
                          onClick={() => handleAnalyzeRule(rule.id)}
                          disabled={loading === `analyze-${rule.id}`}
                        >
                          {loading === `analyze-${rule.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <BarChart3 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="ערוך כלל"
                          onClick={() => handleEditRule(rule.id)}
                          disabled={loading === `edit-${rule.id}`}
                        >
                          {loading === `edit-${rule.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Edit className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive"
                          title="מחק כלל"
                          onClick={() => handleDeleteClick(rule)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>אישור מחיקה</DialogTitle>
            <DialogDescription>
              האם אתה בטוח שברצונך למחוק את הכלל "{ruleToDelete?.name}"?
              פעולה זו אינה ניתנת לביטול.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={loading === `delete-${ruleToDelete?.id}`}
            >
              {loading === `delete-${ruleToDelete?.id}` ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              מחק
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>פרטי כלל: {selectedRule?.name}</DialogTitle>
          </DialogHeader>
          {selectedRule && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">תיאור</div>
                <div>{selectedRule.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">חומרה</div>
                  <Badge variant={getSeverityColor(selectedRule.severity) as any}>
                    {getSeverityText(selectedRule.severity)}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">סטטוס</div>
                  <Badge variant={selectedRule.status === 'approved' ? 'default' : 'secondary'}>
                    {getStatusText(selectedRule.status)}
                  </Badge>
                </div>
              </div>
              {selectedRule.conditions && selectedRule.conditions.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">תנאים</div>
                  <div className="space-y-1">
                    {selectedRule.conditions.map((cond: any, idx: number) => (
                      <div key={idx} className="text-sm bg-muted p-2 rounded">
                        {cond.parameter} {cond.operator} {cond.threshold}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsDialogOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Performance Analytics */}
      {rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-right">ביצועי כללים</CardTitle>
            <CardDescription className="text-right">
              סטטיסטיקות על יעילות הכללים השונים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {rules.filter(r => r.isActive).length}
                </div>
                <div className="text-sm text-muted-foreground">כללים פעילים</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.floor(Math.random() * 50)}
                </div>
                <div className="text-sm text-muted-foreground">התעוררויות השבוע</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.floor(Math.random() * 20) + 80}%
                </div>
                <div className="text-sm text-muted-foreground">דיוק ממוצע</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};