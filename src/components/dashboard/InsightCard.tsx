import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, User, Plane, Mail, CheckCircle, ArrowRight } from "lucide-react";
import { useRole } from "./RoleProvider";
import { ActionButton, ConfirmModal, useActionToast } from "@/components/ui/shared-actions";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useState } from "react";

interface InsightCardProps {
  insight: {
    id: string;
    aircraft: string;
    flightDate: string;
    title: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low";
    requiredRank: "technician" | "maintenance-chief" | "commander";
    isRecurring?: boolean;
    occurrences?: number;
    pilotName?: string;
    system: string;
    status: string;
    technicalDescription?: string;
    pilotBehaviorContext?: string;
  };
  onStatusChange?: () => void;
}

export const InsightCard = ({ insight, onStatusChange }: InsightCardProps) => {
  const { currentUser } = useRole();
  const { updateInsightStatus } = useDashboardData();
  const { showSuccess } = useActionToast();
  
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-destructive/30 bg-destructive/5";
      case "high":
        return "border-orange-500/30 bg-orange-500/5";
      case "medium":
        return "border-warning/30 bg-warning/5";
      case "low":
        return "border-success/30 bg-success/5";
      default:
        return "border-border bg-card/50";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">קריטי</Badge>;
      case "high":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">גבוה</Badge>;
      case "medium":
        return <Badge className="bg-warning/10 text-warning border-warning/20">בינוני</Badge>;
      case "low":
        return <Badge className="bg-success/10 text-success border-success/20">קל</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const getRankBadge = (rank: string) => {
    switch (rank) {
      case "technician":
        return <Badge variant="outline">דרג א׳</Badge>;
      case "maintenance-chief":
        return <Badge className="bg-accent/10 text-accent border-accent/20">ר״צ</Badge>;
      case "commander":
        return <Badge className="bg-primary/10 text-primary border-primary/20">דרג ב׳</Badge>;
      default:
        return <Badge variant="secondary">{rank}</Badge>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <Clock className="h-4 w-4 text-warning" />;
      case "low":
        return <CheckCircle className="h-4 w-4 text-success" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // =============================================================================
  // ACTION HANDLERS - כל כפתור עושה משהו!
  // =============================================================================

  const handleSendEmail = async () => {
    setIsLoading('email');
    try {
      // Minimal: Open email client with pre-filled content
      const subject = encodeURIComponent(`תובנה: ${insight.title} - מטוס ${insight.aircraft}`);
      const body = encodeURIComponent(
        `תובנה: ${insight.title}\n` +
        `מטוס: ${insight.aircraft}\n` +
        `תאריך: ${insight.flightDate}\n` +
        `מערכת: ${insight.system}\n` +
        `חומרה: ${insight.severity}\n\n` +
        `תיאור:\n${insight.description}`
      );
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      showSuccess('נפתח חלון מייל', 'העתק את הפרטים ושלח');
    } finally {
      setIsLoading(null);
    }
  };


  const handleCloseInsight = async () => {
    setIsLoading('close');
    try {
      updateInsightStatus(insight.id, 'completed', currentUser.role);
      showSuccess('התובנה נסגרה', 'הסטטוס עודכן בהצלחה');
      onStatusChange?.();
    } finally {
      setIsLoading(null);
      setCloseModalOpen(false);
    }
  };

  const handleEscalateToSpecialist = async () => {
    setIsLoading('escalate');
    try {
      updateInsightStatus(insight.id, 'escalated', currentUser.role);
      showSuccess('הועבר לר"צ', 'התובנה נשלחה לבדיקה מקצועית');
      onStatusChange?.();
    } finally {
      setIsLoading(null);
    }
  };

  const handleMarkAsTreated = async () => {
    setIsLoading('treated');
    try {
      updateInsightStatus(insight.id, 'completed', currentUser.role);
      showSuccess('סומן כטופל', 'הסטטוס עודכן');
      onStatusChange?.();
    } finally {
      setIsLoading(null);
    }
  };

  const handleTreatmentCompleted = async () => {
    setIsLoading('completed');
    try {
      updateInsightStatus(insight.id, 'in_progress', currentUser.role);
      showSuccess('בוצע טיפול', 'הסטטוס עודכן לטיפול פעיל');
      onStatusChange?.();
    } finally {
      setIsLoading(null);
    }
  };

  // =============================================================================
  // ACTION BUTTONS - לפי תפקיד
  // =============================================================================

  const getActionButtons = () => {
    const buttons = [];
    const isAlreadyClosed = insight.status === 'closed' || insight.status === 'resolved' || insight.status === 'completed';
    
    if (currentUser.role === 'commander') {
      buttons.push(
        <ActionButton 
          key="email" 
          size="sm" 
          variant="outline" 
          className="gap-2"
          onClick={handleSendEmail}
          isLoading={isLoading === 'email'}
          loadingText="פותח..."
        >
          <Mail className="h-3 w-3" />
          שלח מייל
        </ActionButton>,
        <ActionButton 
          key="close" 
          size="sm" 
          variant="outline" 
          className="gap-2"
          onClick={() => setCloseModalOpen(true)}
          disabled={isAlreadyClosed}
          disabledReasonHe={isAlreadyClosed ? 'התובנה כבר נסגרה' : undefined}
        >
          <CheckCircle className="h-3 w-3" />
          סגור תובנה
        </ActionButton>
      );
    } else if (currentUser.role === 'maintenance-chief' || currentUser.role === 'specialist') {
      buttons.push(
        <ActionButton 
          key="professional" 
          size="sm" 
          className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20 gap-2"
          onClick={handleEscalateToSpecialist}
          isLoading={isLoading === 'escalate'}
          loadingText="מעביר..."
          disabled={insight.status === 'escalated'}
          disabledReasonHe={insight.status === 'escalated' ? 'כבר הועבר לבדיקה' : undefined}
        >
          <ArrowRight className="h-3 w-3" />
          העבר לבדיקה מקצועית
        </ActionButton>,
        <ActionButton 
          key="treated" 
          size="sm" 
          variant="outline" 
          className="gap-2"
          onClick={handleMarkAsTreated}
          isLoading={isLoading === 'treated'}
          loadingText="מעדכן..."
          disabled={isAlreadyClosed}
          disabledReasonHe={isAlreadyClosed ? 'כבר טופל' : undefined}
        >
          <CheckCircle className="h-3 w-3" />
          סמן כטופל
        </ActionButton>
      );
    } else if (currentUser.role === 'technician') {
      buttons.push(
        <ActionButton 
          key="completed" 
          size="sm" 
          className="bg-success/10 text-success border-success/20 hover:bg-success/20 gap-2"
          onClick={handleTreatmentCompleted}
          isLoading={isLoading === 'completed'}
          loadingText="מעדכן..."
          disabled={insight.status === 'in_progress' || isAlreadyClosed}
          disabledReasonHe={
            insight.status === 'in_progress' ? 'כבר בטיפול' : 
            isAlreadyClosed ? 'כבר טופל' : undefined
          }
        >
          <CheckCircle className="h-3 w-3" />
          בוצע טיפול
        </ActionButton>,
        <ActionButton 
          key="escalate" 
          size="sm" 
          variant="outline" 
          className="gap-2"
          onClick={handleEscalateToSpecialist}
          isLoading={isLoading === 'escalate'}
          loadingText="מעביר..."
        >
          <ArrowRight className="h-3 w-3" />
          העבר לר״צ
        </ActionButton>
      );
    }
    
    return buttons;
  };

  const canSeePilotName = currentUser.role === 'commander';
  const canSeePilotBehavior = currentUser.role === 'commander';

  return (
    <>
      <Card className={`${getSeverityStyles(insight.severity)} transition-all duration-200 hover:shadow-md`}>
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getSeverityIcon(insight.severity)}
              <span className="font-medium">מטוס {insight.aircraft}</span>
              <span className="text-sm text-muted-foreground">{insight.flightDate}</span>
            </div>
            <div className="flex items-center gap-2">
              {getSeverityBadge(insight.severity)}
              {insight.isRecurring && (
                <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                  חוזר {insight.occurrences} פעמים
                </Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="font-medium text-lg">{insight.title}</h3>
            {canSeePilotBehavior ? (
              <p className="text-sm text-muted-foreground">{insight.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{insight.technicalDescription || insight.description}</p>
            )}
          </div>

          {/* Details */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Plane className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">מערכת:</span>
              <span className="font-medium">{insight.system}</span>
            </div>
            
            {canSeePilotName && insight.pilotName && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">טייס:</span>
                <span className="font-medium">{insight.pilotName}</span>
              </div>
            )}
          </div>

          {/* Required Rank */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">דרג נדרש לטיפול:</span>
              {getRankBadge(insight.requiredRank)}
            </div>
          </div>

          {/* Recurring Pattern Warning */}
          {insight.isRecurring && (
            <div className="bg-destructive/5 border border-destructive/20 rounded p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  תובנה חוזרת: הופיעה {insight.occurrences} פעמים ב-6 טיסות אחרונות
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
            {getActionButtons()}
          </div>
        </CardContent>
      </Card>

      {/* Close Confirmation Modal */}
      <ConfirmModal
        open={closeModalOpen}
        onOpenChange={setCloseModalOpen}
        title="Close Insight"
        titleHe="סגירת תובנה"
        description="Are you sure you want to close this insight? This action will be recorded in the audit log."
        descriptionHe="האם אתה בטוח שברצונך לסגור תובנה זו? פעולה זו תתועד ב-Audit Log."
        confirmLabelHe="סגור תובנה"
        variant="warning"
        onConfirm={handleCloseInsight}
        isLoading={isLoading === 'close'}
      />
    </>
  );
};
