import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Edit, Trash2, BarChart3, Eye, Plus, Loader2 } from "lucide-react";
import { useCSVData } from "@/contexts/CSVDataContext";
import type { Rule } from "@/contexts/CSVDataContext";
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
  const { rules, toggleRuleActive, deleteRule } = useCSVData();
  const navigate = useNavigate();
  const { showSuccess, showInfo, showError } = useActionToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  const getSeverityColor = (severity: string): BadgeProps["variant"] => {
    switch (severity) {
      case "critical":
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
      default:
        return "secondary";
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case "critical":
        return "קריטי";
      case "high":
        return "גבוה";
      case "medium":
        return "בינוני";
      case "low":
      default:
        return "נמוך";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "מאושר";
      case "pending-review":
        return "ממתין לאישור";
      case "rejected":
        return "נדחה";
      case "draft":
      default:
        return "טיוטה";
    }
  };

  const handleNewRule = useCallback(() => {
    navigate("/portal/data-research");
  }, [navigate]);

  const handleViewRule = useCallback((rule: Rule) => {
    setSelectedRule(rule);
    setDetailsDialogOpen(true);
  }, []);

  const handleAnalyzeRule = useCallback(
    (ruleId: string) => {
      const rule = rules.find((item) => item.id === ruleId);
      if (!rule) {
        showError("הכלל לא נמצא", "לא ניתן להציג פרטי ביצוע עבור כלל שלא קיים.");
        return;
      }

      showInfo(
        "מדדי הרצה עדיין לא זמינים",
        `לכלל "${rule.name}" אין עדיין טלמטריית ביצוע persisted. כרגע ניתן לבדוק רק הגדרה, תנאים וסטטוס אישור.`
      );
    },
    [rules, showError, showInfo]
  );

  const handleEditRule = useCallback(() => {
    navigate("/portal/data-research");
  }, [navigate]);

  const handleDeleteClick = useCallback((rule: Rule) => {
    setRuleToDelete({ id: rule.id, name: rule.name });
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!ruleToDelete) {
      return;
    }

    setLoading(`delete-${ruleToDelete.id}`);
    try {
      deleteRule(ruleToDelete.id);
      showSuccess("הכלל נמחק", `הכלל "${ruleToDelete.name}" נמחק.`);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    } finally {
      setLoading(null);
    }
  }, [deleteRule, ruleToDelete, showSuccess]);

  const activeRuleCount = rules.filter((rule) => rule.isActive).length;
  const pendingReviewCount = rules.filter((rule) => rule.status === "pending-review").length;
  const approvedRuleCount = rules.filter((rule) => rule.status === "approved").length;

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-4" dir="rtl">
            <div className="space-y-2 text-right">
              <CardTitle className="flex flex-row-reverse items-center justify-end gap-2 text-right">
                <Settings className="h-5 w-5" />
                ניהול כללי אחזקה
              </CardTitle>
              <CardDescription>צפייה, עריכה ובקרת אישור של כללי אחזקה מקומיים.</CardDescription>
            </div>
            <Button onClick={handleNewRule} className="shrink-0">
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
              <p className="mb-4">צרו כללים חדשים בפורטל התחקור ההנדסי.</p>
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
                    <TableCell className="font-medium text-right">{rule.name}</TableCell>
                    <TableCell className="text-right max-w-xs truncate">{rule.description}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getSeverityColor(rule.severity)}>{getSeverityText(rule.severity)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={rule.status === "approved" ? "default" : "secondary"}>
                        {getStatusText(rule.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={rule.isActive}
                        disabled={rule.status !== "approved"}
                        onCheckedChange={() => toggleRuleActive(rule.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="צפה בפרטי הכלל"
                          aria-label="צפה בפרטי הכלל"
                          onClick={() => handleViewRule(rule)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="בדוק מדדי הרצה"
                          aria-label="בדוק מדדי הרצה"
                          onClick={() => handleAnalyzeRule(rule.id)}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="ערוך כלל"
                          aria-label="ערוך כלל"
                          onClick={handleEditRule}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          title="מחק כלל"
                          aria-label="מחק כלל"
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>אישור מחיקה</DialogTitle>
            <DialogDescription>
              האם למחוק את הכלל "{ruleToDelete?.name}"? פעולה זו מסירה את הכלל מהמסלול המקומי.
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
                  <Badge variant={getSeverityColor(selectedRule.severity)}>
                    {getSeverityText(selectedRule.severity)}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">סטטוס</div>
                  <Badge variant={selectedRule.status === "approved" ? "default" : "secondary"}>
                    {getStatusText(selectedRule.status)}
                  </Badge>
                </div>
              </div>
              {selectedRule.conditions && selectedRule.conditions.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">תנאים</div>
                  <div className="space-y-1">
                    {selectedRule.conditions.map((cond: Rule["conditions"][number], idx: number) => (
                      <div key={idx} className="text-sm bg-muted p-2 rounded">
                        {cond.parameter} | {cond.type} | {String(cond.value)}
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

      {rules.length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-2 text-right">
            <CardTitle className="text-right">מצב ספר הכללים</CardTitle>
            <CardDescription className="text-right">
              ספירות מבוססות על ספר הכללים המקומי בלבד. מדדי הרצה יוצגו רק אחרי שמירת טלמטריית ביצוע.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card px-4 py-5 text-center">
                <div className="text-2xl font-bold text-green-600">{activeRuleCount}</div>
                <div className="text-sm text-muted-foreground">כללים פעילים</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card px-4 py-5 text-center">
                <div className="text-2xl font-bold text-yellow-600">{pendingReviewCount}</div>
                <div className="text-sm text-muted-foreground">ממתינים לאישור</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card px-4 py-5 text-center">
                <div className="text-2xl font-bold text-blue-600">{approvedRuleCount}</div>
                <div className="text-sm text-muted-foreground">מאושרים</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
