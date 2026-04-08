import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Wrench, AlertTriangle, CheckCircle, FileText, Play, ArrowRight, Eye, CheckCheck } from "lucide-react";
import { ActionButton, useActionToast } from "@/components/ui/shared-actions";
import { useState } from "react";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMyTasks, type MaintenanceTask } from "@/hooks/useMyTasks";
import type { UserRole } from "@/types/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";

export const TechnicianMaintenanceView = () => {
  const { showSuccess, showError, showInfo } = useActionToast();
  const { user } = useAuth();
  const { createTaskFromFinding, updateFindingStatus } = useFlightDossier();
  const { myPendingTasks, waitingForOthers, weeklyStats, isEmpty } = useMyTasks();

  const [workFileDialogOpen, setWorkFileDialogOpen] = useState(false);
  const [startTreatmentDialogOpen, setStartTreatmentDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [workNotes, setWorkNotes] = useState("");
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const actorId = user?.id || "tech001";
  const actorRole: UserRole = user?.role || "technician";

  const getSeverityBadge = (severity: MaintenanceTask["severity"]) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">קריטי</Badge>;
      case "medium":
        return <Badge className="bg-warning/10 text-warning border-warning/20">בינוני</Badge>;
      case "low":
      default:
        return <Badge className="bg-success/10 text-success border-success/20">נמוך</Badge>;
    }
  };

  const getSystemIcon = (system: string) => {
    if (system.includes("בלם")) return "🛞";
    if (system.includes("מנוע")) return "⚙";
    if (system.includes("הידרא")) return "🛠";
    return "📌";
  };

  const handleOpenWorkFile = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setWorkNotes("");
    setWorkFileDialogOpen(true);
  };

  const handleCreateWorkFile = async () => {
    if (!selectedTask) return;

    setIsLoading("workfile");
    try {
      // Persist the notes against the linked finding
      if (selectedTask.findingId) {
        const result = updateFindingStatus(
          selectedTask.findingId,
          "in_progress",
          actorId,
          actorRole,
          workNotes || "תיק עבודה נפתח"
        );
        if (!result.success) {
          showError("שגיאה", result.errorHe || "לא ניתן היה לשמור הערות.");
          return;
        }
      }
      showSuccess("תיק עבודה נפתח", workNotes ? "ההערות תועדו במשימה המקושרת." : "הממצא סומן כבטיפול.");
      setWorkFileDialogOpen(false);
    } catch {
      showError("שגיאה", "לא ניתן היה לפתוח מסלול עבודה.");
    } finally {
      setIsLoading(null);
    }
  };

  const handleOpenStartTreatment = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setWorkNotes("");
    setStartTreatmentDialogOpen(true);
  };

  const handleStartTreatment = async () => {
    if (!selectedTask) return;

    setIsLoading("treatment");
    try {
      const taskResult = createTaskFromFinding(
        selectedTask.findingId || selectedTask.id,
        {
          title: selectedTask.title,
          titleHe: selectedTask.title,
          description: selectedTask.technicalDescription,
          descriptionHe: selectedTask.technicalDescription,
        },
        actorId,
        actorRole
      );

      if (!taskResult.success) {
        showError("שגיאה", taskResult.errorHe || "לא ניתן היה ליצור משימת טיפול.");
        return;
      }

      if (selectedTask.findingId) {
        updateFindingStatus(
          selectedTask.findingId,
          "in_progress",
          actorId,
          actorRole,
          workNotes || "Treatment started from technician queue"
        );
      }

      showSuccess("הטיפול התחיל", `נוצרה או עודכנה משימת טיפול עבור ${selectedTask.id}.`);
      setStartTreatmentDialogOpen(false);
    } catch {
      showError("שגיאה", "לא ניתן היה להתחיל טיפול.");
    } finally {
      setIsLoading(null);
    }
  };

  const handleEscalate = async (task: MaintenanceTask) => {
    setIsLoading(`escalate-${task.id}`);
    try {
      if (!task.findingId) {
        showInfo("אין ממצא מקושר", "לא ניתן להסלים פריט שאינו מחובר לממצא רשום במערכת.");
        return;
      }

      const result = updateFindingStatus(
        task.findingId,
        "requires_investigation",
        actorId,
        actorRole,
        workNotes || "הועבר לתחקיר על ידי טכנאי"
      );

      if (!result.success) {
        showError("שגיאה", result.errorHe || "לא ניתן היה להסלים את הממצא.");
        return;
      }

      showSuccess("הועבר לבדיקת דרג בכיר", `הממצא המקושר ל-${task.id} הוסלם.`);
    } finally {
      setIsLoading(null);
    }
  };

  const handleCompleteTask = async (task: MaintenanceTask) => {
    setIsLoading(`complete-${task.id}`);
    try {
      if (task.findingId) {
        const result = updateFindingStatus(
          task.findingId,
          "completed",
          actorId,
          actorRole,
          "סומן כהושלם על ידי טכנאי"
        );
        if (!result.success) {
          showError("שגיאה", result.errorHe || "לא ניתן לסמן כהושלם.");
          return;
        }
      }
      showSuccess("משימה הושלמה", `${task.id} סומנה כהושלמה.`);
    } catch {
      showError("שגיאה", "שגיאה בסימון כהושלם.");
    } finally {
      setIsLoading(null);
    }
  };

  const handleViewStatus = (task: MaintenanceTask) => {
    showInfo("סטטוס משימה", `${task.id}: ${task.status}`);
  };

  const renderTaskCard = (task: MaintenanceTask, muted = false) => (
    <div key={task.id} className={`border rounded-lg p-4 ${muted ? "bg-muted/30" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`text-2xl ${muted ? "opacity-50" : ""}`}>{getSystemIcon(task.system)}</div>
          <div>
            <h4 className="font-semibold">
              מטוס {task.aircraft} | {task.flightCode}
            </h4>
            <p className="text-sm text-muted-foreground">{task.title}</p>
            <p className="text-sm text-foreground mt-1">{task.technicalDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">{getSeverityBadge(task.severity)}</div>
      </div>

      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {task.flightDate}
          </span>
          <span>מערכת: {task.system}</span>
          {!task.isMyResponsibility && task.assignedTo && <span>מוקצה ל: {task.assignedTo}</span>}
        </div>
        <div className="flex items-center gap-2">
          {!task.isMyResponsibility ? (
            <>
              <Badge variant="outline" className="text-xs">
                {task.status}
              </Badge>
              <ActionButton size="sm" variant="ghost" onClick={() => handleViewStatus(task)} className="gap-1">
                <Eye className="h-3 w-3" />
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton size="sm" variant="outline" onClick={() => handleOpenWorkFile(task)} className="gap-1">
                <FileText className="h-3 w-3" />
                פתח תיק עבודה
              </ActionButton>
              <ActionButton
                size="sm"
                onClick={() => handleOpenStartTreatment(task)}
                className="gap-1"
                disabled={task.status.includes("חלק")}
                disabledReasonHe={task.status.includes("חלק") ? "המשימה ממתינה לחלקים" : undefined}
              >
                <Play className="h-3 w-3" />
                התחל טיפול
              </ActionButton>
              <ActionButton
                size="sm"
                onClick={() => handleCompleteTask(task)}
                isLoading={isLoading === `complete-${task.id}`}
                loadingText=""
                className="gap-1 bg-success/90 hover:bg-success text-success-foreground"
                disabled={task.status === "הושלם"}
                disabledReasonHe="המשימה כבר הושלמה"
              >
                <CheckCheck className="h-3 w-3" />
                סיים
              </ActionButton>
              <ActionButton
                size="sm"
                variant="ghost"
                onClick={() => handleEscalate(task)}
                isLoading={isLoading === `escalate-${task.id}`}
                loadingText=""
                className="gap-1"
                title="העבר לתחקיר"
              >
                <ArrowRight className="h-3 w-3" />
              </ActionButton>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {isEmpty && (
          <Card>
            <CardContent className="py-10">
              <EmptyState
                icon={Wrench}
                title="אין משימות תפעוליות"
                description="כרגע אין משימות מוקצות או תחקירים הממתינים לטיפול בדרג זה."
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              המשימות שלי
            </CardTitle>
            <CardDescription>משימות שהוקצו אליך לטיפול פעיל.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {myPendingTasks.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="אין משימות מוקצות"
                description="לא הוקצו לך כרגע משימות טיפול פתוחות."
                variant="subtle"
              />
            ) : (
              myPendingTasks.map((task) => renderTaskCard(task))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              ממתין לגורם אחר
            </CardTitle>
            <CardDescription>פריטים שעוכבו בגלל אישור או חלקים ולא דורשים פעולה ישירה ממך כרגע.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {waitingForOthers.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="אין פריטים ממתינים"
                description="אין כרגע משימות חסומות שממתינות לגורם אחר."
                variant="subtle"
              />
            ) : (
              waitingForOthers.map((task) => renderTaskCard(task, true))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              סיכום שבועי
            </CardTitle>
            <CardDescription>פעילות שבועית על בסיס משימות שנסגרו בשבעת הימים האחרונים.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-success/5 border border-success/20 rounded-lg">
                <div className="text-2xl font-bold text-success">{weeklyStats.completedThisWeek}</div>
                <div className="text-xs text-muted-foreground">הושלמו</div>
              </div>
              <div className="text-center p-3 bg-warning/5 border border-warning/20 rounded-lg">
                <div className="text-2xl font-bold text-warning">{weeklyStats.escalatedThisWeek}</div>
                <div className="text-xs text-muted-foreground">ממתינים לאישור</div>
              </div>
              <div className="text-center p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="text-2xl font-bold text-primary">{weeklyStats.awaitingParts}</div>
                <div className="text-xs text-muted-foreground">ממתינים לחלקים</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={workFileDialogOpen} onOpenChange={setWorkFileDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              הערות לתיק עבודה - {selectedTask?.id}
            </DialogTitle>
            <DialogDescription>תיעוד הערות לפתיחת הטיפול — ישמרו במשימה המקושרת.</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">מטוס</Label>
                  <p className="font-medium">{selectedTask.aircraft}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">מערכת</Label>
                  <p className="font-medium">{selectedTask.system}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">תיאור</Label>
                <p className="font-medium">{selectedTask.technicalDescription}</p>
              </div>
              <div className="space-y-2">
                <Label>הערות ראשוניות</Label>
                <Textarea
                  placeholder="תעד כאן הערות לפתיחת הטיפול..."
                  value={workNotes}
                  onChange={(event) => setWorkNotes(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <ActionButton variant="outline" onClick={() => setWorkFileDialogOpen(false)}>
              ביטול
            </ActionButton>
            <ActionButton onClick={handleCreateWorkFile} isLoading={isLoading === "workfile"} loadingText="שומר...">
              <FileText className="h-4 w-4 ml-2" />
              שמור הערות
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startTreatmentDialogOpen} onOpenChange={setStartTreatmentDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              התחלת טיפול - {selectedTask?.id}
            </DialogTitle>
            <DialogDescription>הפעולה מסמנת את הממצא המקושר כ"בטיפול" ויוצרת משימה.</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedTask.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedTask.technicalDescription}</p>
              </div>
              <div className="space-y-2">
                <Label>הערות לתחילת טיפול</Label>
                <Textarea
                  placeholder="תאר את הפעולה הראשונה או את ההכנה הנדרשת..."
                  value={workNotes}
                  onChange={(event) => setWorkNotes(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <ActionButton variant="outline" onClick={() => setStartTreatmentDialogOpen(false)}>
              ביטול
            </ActionButton>
            <ActionButton
              onClick={handleStartTreatment}
              isLoading={isLoading === "treatment"}
              loadingText="מתחיל..."
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 ml-2" />
              התחל טיפול
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
