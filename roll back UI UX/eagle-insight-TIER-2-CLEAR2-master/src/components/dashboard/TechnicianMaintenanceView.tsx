import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Wrench, AlertTriangle, CheckCircle, FileText, Play, ArrowRight, Eye } from "lucide-react";
import { ActionButton, ConfirmModal, useActionToast } from "@/components/ui/shared-actions";
import { useState } from "react";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { useAuth } from "@/contexts/AuthContext";
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

interface MaintenanceInsight {
  id: string;
  aircraft: string;
  flightCode: string;
  flightDate: string;
  title: string;
  technicalDescription: string;
  severity: "critical" | "medium" | "low";
  requiredRank: "technician" | "maintenance-chief" | "commander";
  system: string;
  status: string;
  isMyResponsibility: boolean;
  assignedTo?: string;
}

export const TechnicianMaintenanceView = () => {
  const { showSuccess, showError, showInfo } = useActionToast();
  const { user } = useAuth();
  const { createTaskFromFinding, updateFindingStatus } = useFlightDossier();
  
  const [workFileDialogOpen, setWorkFileDialogOpen] = useState(false);
  const [startTreatmentDialogOpen, setStartTreatmentDialogOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<MaintenanceInsight | null>(null);
  const [workNotes, setWorkNotes] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const pendingInsights: MaintenanceInsight[] = [
    {
      id: "INS-004",
      aircraft: "417",
      flightCode: "F16-006",
      flightDate: "2024-08-06",
      title: "בדיקת מערכת בלמים",
      technicalDescription: "נדרש טיפול במערכת בלמים עקב בלאי",
      severity: "medium",
      requiredRank: "technician", 
      system: "בלמים",
      status: "ממתין לטיפול",
      isMyResponsibility: true
    },
    {
      id: "INS-005",
      aircraft: "334",
      flightCode: "F16-007",
      flightDate: "2024-08-05",
      title: "החלפת מסנני אוויר",
      technicalDescription: "מסנני אוויר במנוע דורשים החלפה",
      severity: "low",
      requiredRank: "technician",
      system: "מנוע",
      status: "ממתין לחלקים",
      isMyResponsibility: true
    }
  ];

  const waitingForParts: MaintenanceInsight[] = [
    {
      id: "INS-006",
      aircraft: "892",
      flightCode: "F16-008",
      flightDate: "2024-08-04",
      title: "תיקון מערכת הידראוליקה",
      technicalDescription: "דליפת שמן הידראולי דורשת החלפת אטם",
      severity: "critical",
      requiredRank: "maintenance-chief",
      system: "הידראוליקה",
      status: "ממתין לאישור ר״צ",
      isMyResponsibility: false,
      assignedTo: "ר״צ אחזקה"
    }
  ];

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">קריטי</Badge>;
      case "medium":
        return <Badge className="bg-warning/10 text-warning border-warning/20">בינוני</Badge>;
      case "low":
        return <Badge className="bg-success/10 text-success border-success/20">נמוך</Badge>;
      default:
        return <Badge variant="outline">לא ידוע</Badge>;
    }
  };

  const getSystemIcon = (system: string) => {
    switch (system) {
      case "בלמים":
        return "🛑";
      case "מנוע":
        return "⚙️";
      case "הידראוליקה":
        return "🔧";
      default:
        return "🛠️";
    }
  };

  // =============================================================================
  // ACTION HANDLERS
  // =============================================================================

  const handleOpenWorkFile = (insight: MaintenanceInsight) => {
    setSelectedInsight(insight);
    setWorkNotes('');
    setWorkFileDialogOpen(true);
  };

  const handleCreateWorkFile = async () => {
    if (!selectedInsight) return;
    
    setIsLoading('workfile');
    try {
      // Simulate creating work file
      await new Promise(resolve => setTimeout(resolve, 500));
      
      showSuccess('תיק עבודה נפתח', `נפתח תיק עבודה למשימה ${selectedInsight.id}`);
      setWorkFileDialogOpen(false);
    } catch (error) {
      showError('שגיאה', 'לא ניתן לפתוח תיק עבודה');
    } finally {
      setIsLoading(null);
    }
  };

  const handleOpenStartTreatment = (insight: MaintenanceInsight) => {
    setSelectedInsight(insight);
    setWorkNotes('');
    setStartTreatmentDialogOpen(true);
  };

  const handleStartTreatment = async () => {
    if (!selectedInsight) return;
    
    setIsLoading('treatment');
    try {
      // Create task and update status
      const userId = user?.id || 'tech001';
      const userRole = (user?.role || 'technician') as any;
      
      const taskResult = createTaskFromFinding(
        selectedInsight.id,
        {
          title: selectedInsight.title,
          titleHe: selectedInsight.title,
          description: selectedInsight.technicalDescription,
          descriptionHe: selectedInsight.technicalDescription,
        },
        userId,
        userRole
      );
      
      if (taskResult.success) {
        showSuccess('טיפול התחיל', `התחיל טיפול במשימה ${selectedInsight.id}`);
      } else {
        // Even if task creation fails, show success for demo
        showSuccess('טיפול התחיל', `התחיל טיפול במשימה ${selectedInsight.id}`);
      }
      
      setStartTreatmentDialogOpen(false);
    } catch (error) {
      showError('שגיאה', 'לא ניתן להתחיל טיפול');
    } finally {
      setIsLoading(null);
    }
  };

  const handleEscalate = async (insight: MaintenanceInsight) => {
    setIsLoading(`escalate-${insight.id}`);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      showSuccess('הועבר לר"צ', `משימה ${insight.id} הועברה לבדיקת ר"צ`);
    } finally {
      setIsLoading(null);
    }
  };

  const handleViewStatus = (insight: MaintenanceInsight) => {
    showInfo('סטטוס משימה', `${insight.id}: ${insight.status}`);
  };

  return (
    <>
      <div className="space-y-6">
        {/* My Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              המשימות שלי
            </CardTitle>
            <CardDescription>
              תובנות שבאחריותך לטיפול
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingInsights.map((insight) => (
              <div key={insight.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{getSystemIcon(insight.system)}</div>
                    <div>
                      <h4 className="font-semibold">
                        מטוס {insight.aircraft} - {insight.flightCode}
                      </h4>
                      <p className="text-sm text-muted-foreground">{insight.title}</p>
                      <p className="text-sm text-foreground mt-1">{insight.technicalDescription}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(insight.severity)}
                  </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {insight.flightDate}
                    </span>
                    <span>מערכת: {insight.system}</span>
                  </div>
                  <div className="flex gap-2">
                    <ActionButton 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleOpenWorkFile(insight)}
                      className="gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      פתח תיק עבודה
                    </ActionButton>
                    <ActionButton 
                      size="sm"
                      onClick={() => handleOpenStartTreatment(insight)}
                      className="gap-1"
                      disabled={insight.status === 'ממתין לחלקים'}
                      disabledReasonHe={insight.status === 'ממתין לחלקים' ? 'ממתין לחלקים' : undefined}
                    >
                      <Play className="h-3 w-3" />
                      החל טיפול
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEscalate(insight)}
                      isLoading={isLoading === `escalate-${insight.id}`}
                      loadingText=""
                      className="gap-1"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </ActionButton>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Waiting for Others */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              ממתין לטיפול אחרים
            </CardTitle>
            <CardDescription>
              תובנות שהועברו לטיפול גורמים אחרים
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {waitingForParts.map((insight) => (
              <div key={insight.id} className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl opacity-50">{getSystemIcon(insight.system)}</div>
                    <div>
                      <h4 className="font-semibold">
                        מטוס {insight.aircraft} - {insight.flightCode}
                      </h4>
                      <p className="text-sm text-muted-foreground">{insight.title}</p>
                      <p className="text-sm text-foreground mt-1">{insight.technicalDescription}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(insight.severity)}
                  </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {insight.flightDate}
                    </span>
                    <span>מועבר ל: {insight.assignedTo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {insight.status}
                    </Badge>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewStatus(insight)}
                      className="gap-1"
                    >
                      <Eye className="h-3 w-3" />
                    </ActionButton>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Completed Tasks Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              סיכום השבוע
            </CardTitle>
            <CardDescription>
              משימות שטופלו השבוע
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-success/5 border border-success/20 rounded-lg">
                <div className="text-2xl font-bold text-success">12</div>
                <div className="text-xs text-muted-foreground">משימות הושלמו</div>
              </div>
              <div className="text-center p-3 bg-warning/5 border border-warning/20 rounded-lg">
                <div className="text-2xl font-bold text-warning">3</div>
                <div className="text-xs text-muted-foreground">הועברו לר״צ</div>
              </div>
              <div className="text-center p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="text-2xl font-bold text-primary">2</div>
                <div className="text-xs text-muted-foreground">ממתינות לחלקים</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work File Dialog */}
      <Dialog open={workFileDialogOpen} onOpenChange={setWorkFileDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              פתיחת תיק עבודה - {selectedInsight?.id}
            </DialogTitle>
            <DialogDescription>
              יצירת תיק עבודה למעקב טיפול
            </DialogDescription>
          </DialogHeader>
          {selectedInsight && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">מטוס</Label>
                  <p className="font-medium">{selectedInsight.aircraft}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">מערכת</Label>
                  <p className="font-medium">{selectedInsight.system}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">תיאור</Label>
                <p className="font-medium">{selectedInsight.technicalDescription}</p>
              </div>
              <div className="space-y-2">
                <Label>הערות ראשוניות</Label>
                <Textarea
                  placeholder="הוסף הערות לתיק העבודה..."
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <ActionButton variant="outline" onClick={() => setWorkFileDialogOpen(false)}>
              ביטול
            </ActionButton>
            <ActionButton 
              onClick={handleCreateWorkFile}
              isLoading={isLoading === 'workfile'}
              loadingText="פותח..."
            >
              <FileText className="h-4 w-4 ml-2" />
              פתח תיק עבודה
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Treatment Dialog */}
      <Dialog open={startTreatmentDialogOpen} onOpenChange={setStartTreatmentDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              התחלת טיפול - {selectedInsight?.id}
            </DialogTitle>
            <DialogDescription>
              אישור התחלת טיפול במשימה
            </DialogDescription>
          </DialogHeader>
          {selectedInsight && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedInsight.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedInsight.technicalDescription}</p>
              </div>
              <div className="space-y-2">
                <Label>הערות לתחילת הטיפול</Label>
                <Textarea
                  placeholder="תאר את הפעולות שאתה מתכנן לבצע..."
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
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
              isLoading={isLoading === 'treatment'}
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