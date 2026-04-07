/**
 * Finding Card Component
 *
 * תצוגת ממצא עם:
 * - Severity S1-S4 מסומן בצבע
 * - Status Lifecycle עם מעברים חוקיים
 * - Evidence links
 * - Quick actions (Acknowledge, Create Task, etc.)
 * - Confidence score
 * - Two sources of truth indication (Measured/Reported)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  ArrowRight,
  Activity,
  Database,
  PenLine,
  Plane,
  CheckCircle,
  XCircle,
  BarChart3,
} from 'lucide-react';
import {
  Finding,
  FindingStatus,
  SeverityLevel,
  SEVERITY_CONFIG,
  FINDING_STATUS_CONFIG,
} from '@/types/core';
import { useFlightDossier } from '@/contexts/FlightDossierContext';

// =============================================================================
// TYPES
// =============================================================================

interface FindingCardProps {
  finding: Finding;
  variant?: 'compact' | 'full';
  showActions?: boolean;
  onViewDetails?: (finding: Finding) => void;
}

// =============================================================================
// SEVERITY INDICATOR
// =============================================================================

const SeverityIndicator: React.FC<{ severity: SeverityLevel; size?: 'sm' | 'md' }> = ({
  severity,
  size = 'md'
}) => {
  const config = SEVERITY_CONFIG[severity];

  const getIcon = () => {
    const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    switch (severity) {
      case 'S1':
        return <AlertTriangle className={iconClass} />;
      case 'S2':
        return <AlertCircle className={iconClass} />;
      case 'S3':
        return <Info className={iconClass} />;
      case 'S4':
        return <Activity className={iconClass} />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`
            flex items-center gap-1.5 rounded-lg border
            ${config.bgColor} ${config.color} ${config.borderColor}
            ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
          `}>
            {getIcon()}
            <span className="font-bold">{severity}</span>
            {size === 'md' && <span className="hidden sm:inline">- {config.labelHe}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-right" dir="rtl">
          <div className="space-y-1">
            <p className="font-semibold">{config.labelHe}</p>
            <p className="text-sm">{config.descriptionHe}</p>
            <Separator className="my-1" />
            <p className="text-xs"><strong>השפעה:</strong> {config.impactHe}</p>
            <p className="text-xs"><strong>זמן תגובה:</strong> {config.responseTimeHe}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// =============================================================================
// STATUS BADGE
// =============================================================================

const StatusBadge: React.FC<{ status: FindingStatus }> = ({ status }) => {
  const config = FINDING_STATUS_CONFIG[status];

  return (
    <Badge className={`${config.color} border-0`}>
      {config.labelHe}
    </Badge>
  );
};

// =============================================================================
// CONFIDENCE INDICATOR
// =============================================================================

const ConfidenceIndicator: React.FC<{ value: number; dataQuality: string }> = ({
  value,
  dataQuality
}) => {
  const getColor = () => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityIcon = () => {
    switch (dataQuality) {
      case 'complete':
        return <Database className="h-3 w-3 text-green-600" />;
      case 'partial':
        return <Database className="h-3 w-3 text-yellow-600" />;
      default:
        return <Database className="h-3 w-3 text-red-600" />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            {getQualityIcon()}
            <div className="flex items-center gap-1">
              <Progress value={value} className="w-16 h-2" />
              <span className={`text-xs font-medium ${getColor()}`}>{value}%</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" dir="rtl">
          <div className="text-sm">
            <p><strong>רמת ביטחון:</strong> {value}%</p>
            <p><strong>איכות נתונים:</strong> {dataQuality === 'complete' ? 'מלאה' : dataQuality === 'partial' ? 'חלקית' : 'חסרה'}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// =============================================================================
// DATA SOURCE BADGE
// =============================================================================

const DataSourceBadge: React.FC<{ type: 'measured' | 'reported' }> = ({ type }) => {
  const isMeasured = type === 'measured';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-xs ${isMeasured ? 'border-blue-300 text-blue-700' : 'border-orange-300 text-orange-700'}`}>
            {isMeasured ? (
              <>
                <BarChart3 className="h-3 w-3 ml-1" />
                נמדד
              </>
            ) : (
              <>
                <PenLine className="h-3 w-3 ml-1" />
                מדווח
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" dir="rtl">
          {isMeasured
            ? 'נתון אוטומטי מקופסה שחורה / חיישנים'
            : 'נתון שהוזן ידנית'
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// =============================================================================
// STATUS TRANSITION DIALOG
// =============================================================================

const StatusTransitionDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding: Finding;
  targetStatus: FindingStatus;
  onConfirm: (note: string) => void;
}> = ({ open, onOpenChange, finding, targetStatus, onConfirm }) => {
  const [note, setNote] = useState('');
  const targetConfig = FINDING_STATUS_CONFIG[targetStatus];

  const handleConfirm = () => {
    onConfirm(note);
    setNote('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>שינוי סטטוס ממצא</DialogTitle>
          <DialogDescription>
            שינוי מ-<strong>{FINDING_STATUS_CONFIG[finding.status].labelHe}</strong> ל-<strong>{targetConfig.labelHe}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted">
            <p className="font-medium">{finding.titleHe}</p>
            <p className="text-sm text-muted-foreground mt-1">{finding.tailNumbers.join(', ')}</p>
          </div>

          {targetConfig.requiresNote && (
            <div className="space-y-2">
              <Label htmlFor="note">
                הערה {targetConfig.requiresNote && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="note"
                placeholder="הוסף הערה לשינוי הסטטוס..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {targetConfig.requiresApproval && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-700 dark:text-yellow-400">
                שינוי זה דורש אישור {targetConfig.approvalRole === 'engineer' ? 'מהנדס' : 'גורם מוסמך'}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={targetConfig.requiresNote && !note.trim()}
          >
            אישור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =============================================================================
// CREATE TASK DIALOG
// =============================================================================

const CreateTaskDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding: Finding;
}> = ({ open, onOpenChange, finding }) => {
  const { createTaskFromFinding } = useFlightDossier();
  const [title, setTitle] = useState(finding.titleHe);
  const [description, setDescription] = useState(finding.recommendationHe);

  const handleCreate = () => {
    createTaskFromFinding(finding.id, {
      title,
      titleHe: title,
      description,
      descriptionHe: description,
      dueType: 'before_sortie',
      dueTypeHe: 'לפני הגיחה הבאה',
    }, 'current_user');

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>יצירת משימה מממצא</DialogTitle>
          <DialogDescription>
            צור משימה חדשה על בסיס הממצא
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">כותרת המשימה</Label>
            <Textarea
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">תיאור המשימה</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 ml-2" />
            צור משימה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  variant = 'full',
  showActions = true,
  onViewDetails,
}) => {
  const { acknowledgeFinding, updateFindingStatus, getTasksForFinding } = useFlightDossier();
  const [isExpanded, setIsExpanded] = useState(false);
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<FindingStatus | null>(null);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);

  const statusConfig = FINDING_STATUS_CONFIG[finding.status];
  const allowedTransitions = statusConfig.allowedTransitions;
  const tasks = getTasksForFinding(finding.id);

  const handleStatusTransition = (newStatus: FindingStatus) => {
    const targetConfig = FINDING_STATUS_CONFIG[newStatus];
    if (targetConfig.requiresNote || targetConfig.requiresApproval) {
      setPendingStatus(newStatus);
      setTransitionDialogOpen(true);
    } else {
      updateFindingStatus(finding.id, newStatus, 'current_user');
    }
  };

  const handleTransitionConfirm = (note: string) => {
    if (pendingStatus) {
      updateFindingStatus(finding.id, pendingStatus, 'current_user', note);
      setPendingStatus(null);
    }
  };

  const handleQuickAcknowledge = () => {
    acknowledgeFinding(finding.id, 'current_user');
  };

  // =============================================================================
  // COMPACT VARIANT
  // =============================================================================

  if (variant === 'compact') {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => onViewDetails?.(finding)}
        dir="rtl"
      >
        <SeverityIndicator severity={finding.severity} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{finding.titleHe}</p>
          <p className="text-xs text-muted-foreground">
            {finding.tailNumbers.join(', ')} • {finding.systemAffectedHe}
          </p>
        </div>
        <StatusBadge status={finding.status} />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  // =============================================================================
  // FULL VARIANT
  // =============================================================================

  return (
    <>
      <Card className={`${SEVERITY_CONFIG[finding.severity].borderColor} border-r-4`} dir="rtl">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <SeverityIndicator severity={finding.severity} />
              <div>
                <h3 className="font-semibold text-lg">{finding.titleHe}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Plane className="h-4 w-4" />
                  <span>{finding.tailNumbers.join(', ')}</span>
                  <span>•</span>
                  <span>{finding.systemAffectedHe}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={finding.status} />
              <DataSourceBadge type="measured" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Description */}
          <p className="text-muted-foreground">{finding.descriptionHe}</p>

          {/* Technical Detail */}
          <div className="p-3 rounded-lg bg-muted/50 font-mono text-sm">
            {finding.technicalDetail}
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-4 text-sm">
            {finding.confidence && (
              <ConfidenceIndicator
                value={finding.confidence.value}
                dataQuality={finding.confidence.dataQuality}
              />
            )}

            {finding.assignedTo && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{finding.assignedTo}</span>
              </div>
            )}

            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{new Date(finding.createdAt).toLocaleDateString('he-IL')}</span>
            </div>

            {finding.occurrences > 1 && (
              <Badge variant="secondary">
                {finding.occurrences} מופעים
              </Badge>
            )}

            {tasks.length > 0 && (
              <Badge variant="outline">
                {tasks.length} משימות
              </Badge>
            )}
          </div>

          {/* Recommendation */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-primary font-medium mb-1">
              <FileText className="h-4 w-4" />
              המלצה
            </div>
            <p className="text-sm">{finding.recommendationHe}</p>
          </div>

          {/* Expandable Details */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span>{isExpanded ? 'הסתר פרטים' : 'הצג פרטים נוספים'}</span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Status History */}
              {finding.statusHistory.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">היסטוריית סטטוס</h4>
                  <div className="space-y-2">
                    {finding.statusHistory.map((change, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <ArrowRight className="h-3 w-3" />
                        <span>{FINDING_STATUS_CONFIG[change.from].labelHe}</span>
                        <span>→</span>
                        <span>{FINDING_STATUS_CONFIG[change.to].labelHe}</span>
                        <span className="text-muted-foreground">
                          ({new Date(change.changedAt).toLocaleString('he-IL')})
                        </span>
                        {change.note && <span className="italic">"{change.note}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rule Reference */}
              {finding.ruleId && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">כלל:</span>
                  <Badge variant="outline">{finding.ruleId}</Badge>
                  {finding.ruleVersion && <span className="text-muted-foreground">v{finding.ruleVersion}</span>}
                </div>
              )}

              {/* Evidence */}
              {finding.evidence.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">ראיות ({finding.evidence.length})</h4>
                  <div className="space-y-1">
                    {finding.evidence.map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ExternalLink className="h-3 w-3" />
                        <span>{ev.relevanceHe}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>

        {/* Actions */}
        {showActions && (
          <CardFooter className="pt-0">
            <Separator className="mb-4" />
            <div className="flex items-center justify-between w-full gap-2">
              {/* Status Transitions */}
              <div className="flex items-center gap-2">
                {finding.status === 'new' && (
                  <Button size="sm" onClick={handleQuickAcknowledge}>
                    <CheckCircle className="h-4 w-4 ml-2" />
                    הכר
                  </Button>
                )}

                {allowedTransitions.filter(s => s !== 'acknowledged').map((newStatus) => (
                  <Button
                    key={newStatus}
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusTransition(newStatus)}
                  >
                    {newStatus === 'in_progress' && 'התחל טיפול'}
                    {newStatus === 'escalated' && 'הסלם'}
                    {newStatus === 'resolved' && 'סמן כנפתר'}
                    {newStatus === 'rejected' && 'דחה'}
                    {newStatus === 'closed' && 'סגור'}
                  </Button>
                ))}
              </div>

              {/* Additional Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateTaskDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 ml-2" />
                  צור משימה
                </Button>

                {onViewDetails && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewDetails(finding)}
                  >
                    <ExternalLink className="h-4 w-4 ml-2" />
                    פרטים
                  </Button>
                )}
              </div>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Dialogs */}
      {pendingStatus && (
        <StatusTransitionDialog
          open={transitionDialogOpen}
          onOpenChange={setTransitionDialogOpen}
          finding={finding}
          targetStatus={pendingStatus}
          onConfirm={handleTransitionConfirm}
        />
      )}

      <CreateTaskDialog
        open={createTaskDialogOpen}
        onOpenChange={setCreateTaskDialogOpen}
        finding={finding}
      />
    </>
  );
};

export default FindingCard;
