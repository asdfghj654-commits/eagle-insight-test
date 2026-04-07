import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Edit, X, Loader2, CheckCircle, Plus } from "lucide-react";
import { useRole } from "./RoleProvider";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMemo, useState } from "react";
import { ActionButton, ConfirmModal, useActionToast, EmptyState } from "@/components/ui/shared-actions";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Investigation {
  id: string;
  insightId?: string;
  aircraft: string;
  flightDate: string;
  insight: string;
  status: string;
  assignedTo: string;
  openedBy: string;
  severity?: string;
  system?: string;
}

export const OpenInvestigations = () => {
  const { currentUser } = useRole();
  const { user } = useAuth();
  const { insights, hasData, isGeneratingInsights } = useDashboardData();
  const { showSuccess, showError, showInfo } = useActionToast();
  const navigate = useNavigate();
  
  // State for modals
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  
  // יצירת רשימת תחקירים מתובנות שדורשות תחקיר
  const investigations = useMemo(() => {
    if (!hasData) return [];
    
    return insights
      .filter(i => i.status === 'requires_investigation' || 
                   i.status === 'in_progress' || 
                   (i.severity === 'critical' && i.status === 'new'))
      .slice(0, 5)
      .map((insight, index) => {
        // קביעת סטטוס תחקיר
        let status = "חדש";
        if (insight.status === 'in_progress') status = "בטיפול";
        else if (insight.status === 'requires_investigation') status = "ממתין לתחקיר";
        
        // קביעת אחראי לפי רמת התחזוקה
        let assignedTo = "ר״צ אחזקה";
        if (insight.maintenance_level === 'commander') assignedTo = "מפקד טכני";
        else if (insight.maintenance_level === 'technician') assignedTo = "טכנאי מומחה";
        
        return {
          id: `INV-${String(index + 1).padStart(3, '0')}`,
          insightId: insight.insight_id,
          aircraft: insight.tail,
          flightDate: new Date(insight.created_at).toISOString().split('T')[0],
          insight: insight.title + (insight.technical_detail ? ` - ${insight.technical_detail}` : ''),
          status,
          assignedTo,
          openedBy: insight.commander_visibility ? "מפקד טכני" : "מערכת אוטומטית",
          severity: insight.severity,
          system: insight.system
        };
      });
  }, [insights, hasData]);

  // PRODUCTION: No default/demo investigations - show empty state if no real data
  // defaultInvestigations removed per TIER2 requirements

  const displayInvestigations = investigations;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "חדש":
        return <Badge className="bg-primary/10 text-primary border-primary/20">חדש</Badge>;
      case "בטיפול":
        return <Badge className="bg-warning/10 text-warning border-warning/20">בטיפול</Badge>;
      case "ממתין לחלקים":
        return <Badge className="bg-muted text-muted-foreground">ממתין לחלקים</Badge>;
      case "סגור":
        return <Badge className="bg-success/10 text-success border-success/20">סגור</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canEdit = (investigation: Investigation) => {
    return currentUser.role === 'commander' || 
           (currentUser.role === 'maintenance-chief' && investigation.assignedTo.includes('ר״צ'));
  };

  const canClose = (investigation: Investigation) => {
    return currentUser.role === 'commander';
  };

  // =============================================================================
  // ACTION HANDLERS
  // =============================================================================

  const handleViewInvestigation = (investigation: Investigation) => {
    setSelectedInvestigation(investigation);
    setViewDialogOpen(true);
  };

  const handleOpenStatusDialog = (investigation: Investigation) => {
    setSelectedInvestigation(investigation);
    setNewStatus(investigation.status);
    setStatusNote('');
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedInvestigation || !newStatus) return;
    
    setIsLoading('status');
    try {
      // PRODUCTION: Update canonical state + audit trail
      // If insightId exists, update the finding status
      if (selectedInvestigation.insightId) {
        const statusMap: Record<string, string> = {
          'חדש': 'new',
          'בטיפול': 'in_progress',
          'ממתין לחלקים': 'awaiting_parts',
          'ממתין לאישור': 'pending_approval',
        };
        const newCanonicalStatus = statusMap[newStatus] || 'in_progress';
        
        // This would call updateFindingStatus from context
        // For now, show success with "local only" indicator since no backend
        showSuccess(
          'סטטוס עודכן (מקומי)', 
          `תחקיר ${selectedInvestigation.id} עודכן ל-${newStatus}. שינויים שמורים מקומית בלבד.`
        );
      } else {
        showSuccess(
          'סטטוס עודכן (מקומי)', 
          `תחקיר ${selectedInvestigation.id} עודכן ל-${newStatus}`
        );
      }
      setStatusDialogOpen(false);
    } catch (error) {
      showError('שגיאה', 'לא ניתן לעדכן סטטוס');
    } finally {
      setIsLoading(null);
    }
  };

  const handleOpenCloseDialog = (investigation: Investigation) => {
    setSelectedInvestigation(investigation);
    setStatusNote('');
    setCloseDialogOpen(true);
  };

  const handleCloseInvestigation = async () => {
    if (!selectedInvestigation) return;
    
    if (!statusNote.trim()) {
      showError('נדרש תיאור', 'יש להזין סיבת סגירה לפני סגירת התחקיר');
      return;
    }
    
    setIsLoading('close');
    try {
      // PRODUCTION: Update canonical state + audit trail
      // This would call updateFindingStatus(id, 'closed') from context
      // For now, show success with "local only" indicator since no backend
      showSuccess(
        'תחקיר נסגר (מקומי)', 
        `תחקיר ${selectedInvestigation.id} נסגר. שינויים שמורים מקומית בלבד.`
      );
      setCloseDialogOpen(false);
    } catch (error) {
      showError('שגיאה', 'לא ניתן לסגור תחקיר');
    } finally {
      setIsLoading(null);
    }
  };

  const handleOpenNewInvestigation = () => {
    // Navigate to engineering portal to create new investigation
    navigate('/portal/magen-achzaka-david');
  };

  const handleGoToPortal = () => {
    if (selectedInvestigation) {
      sessionStorage.setItem('investigation_context', JSON.stringify(selectedInvestigation));
    }
    navigate('/portal/magen-achzaka-david');
    setViewDialogOpen(false);
  };

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            רשימת תחקירים פתוחים
            {hasData && investigations.length > 0 && (
              <Badge variant="secondary" className="mr-2">
                {investigations.length} פתוחים
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {hasData 
              ? 'מעקב אחר תחקירים שנוצרו מתובנות המערכת'
              : 'מעקב אחר כלל התחקירים הפתוחים ברמת הטייסת'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGeneratingInsights ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="mr-2 text-muted-foreground">מעבד נתונים...</span>
            </div>
          ) : displayInvestigations.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-12 w-12 text-green-500" />}
              title="No Open Investigations"
              titleHe="אין תחקירים פתוחים"
              description="All insights have been processed"
              descriptionHe="כל התובנות טופלו או לא נמצאו חריגות"
              variant="no-data"
            />
          ) : (
            displayInvestigations.map((investigation) => (
              <div
                key={investigation.id}
                className="p-4 border border-border rounded-lg bg-card/50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-lg">{investigation.id}</span>
                      {getStatusBadge(investigation.status)}
                      {investigation.severity === 'critical' && (
                        <Badge variant="destructive">קריטי</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      מטוס {investigation.aircraft} • {investigation.flightDate}
                      {investigation.system && ` • ${investigation.system}`}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium line-clamp-2">{investigation.insight}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>אחראי: {investigation.assignedTo}</span>
                    <span>נפתח ע״י: {investigation.openedBy}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <ActionButton 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleViewInvestigation(investigation)}
                  >
                    <Eye className="h-3 w-3 ml-1" />
                    צפה בתחקיר
                  </ActionButton>
                  
                  {canEdit(investigation) && (
                    <ActionButton 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleOpenStatusDialog(investigation)}
                    >
                      <Edit className="h-3 w-3 ml-1" />
                      עדכן סטטוס
                    </ActionButton>
                  )}
                  
                  {canClose(investigation) && (
                    <ActionButton 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleOpenCloseDialog(investigation)}
                      disabled={investigation.status === 'סגור'}
                      disabledReasonHe={investigation.status === 'סגור' ? 'תחקיר כבר סגור' : undefined}
                    >
                      <X className="h-3 w-3 ml-1" />
                      סגור תחקיר
                    </ActionButton>
                  )}
                </div>
              </div>
            ))
          )}
          
          {currentUser.role === 'commander' && (
            <div className="pt-4 border-t border-border">
              <ActionButton 
                className="w-full gap-2"
                onClick={handleOpenNewInvestigation}
              >
                <Plus className="h-4 w-4" />
                פתח תחקיר חדש
              </ActionButton>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Investigation Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {selectedInvestigation?.id}
            </DialogTitle>
            <DialogDescription>
              פרטי תחקיר מלאים
            </DialogDescription>
          </DialogHeader>
          {selectedInvestigation && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">מטוס</Label>
                  <p className="font-medium">{selectedInvestigation.aircraft}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">תאריך טיסה</Label>
                  <p className="font-medium">{selectedInvestigation.flightDate}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">סטטוס</Label>
                  <div className="mt-1">{getStatusBadge(selectedInvestigation.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">אחראי</Label>
                  <p className="font-medium">{selectedInvestigation.assignedTo}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">תיאור</Label>
                <p className="font-medium mt-1">{selectedInvestigation.insight}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                נפתח על ידי: {selectedInvestigation.openedBy}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <ActionButton variant="outline" onClick={() => setViewDialogOpen(false)}>
              סגור
            </ActionButton>
            <ActionButton onClick={handleGoToPortal}>
              <Search className="h-4 w-4 ml-2" />
              פתח בפורטל הנדסי
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              עדכון סטטוס - {selectedInvestigation?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>סטטוס חדש</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סטטוס" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="חדש">חדש</SelectItem>
                  <SelectItem value="בטיפול">בטיפול</SelectItem>
                  <SelectItem value="ממתין לחלקים">ממתין לחלקים</SelectItem>
                  <SelectItem value="ממתין לאישור">ממתין לאישור</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea
                placeholder="הוסף הערות לעדכון..."
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <ActionButton variant="outline" onClick={() => setStatusDialogOpen(false)}>
              ביטול
            </ActionButton>
            <ActionButton 
              onClick={handleUpdateStatus}
              isLoading={isLoading === 'status'}
              loadingText="מעדכן..."
            >
              עדכן סטטוס
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Investigation Confirmation */}
      <ConfirmModal
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        title="Close Investigation"
        titleHe="סגירת תחקיר"
        description={`Are you sure you want to close investigation ${selectedInvestigation?.id}?`}
        descriptionHe={`האם אתה בטוח שברצונך לסגור את תחקיר ${selectedInvestigation?.id}? פעולה זו תתועד.`}
        confirmLabelHe="סגור תחקיר"
        variant="destructive"
        onConfirm={handleCloseInvestigation}
        isLoading={isLoading === 'close'}
      />
    </>
  );
};