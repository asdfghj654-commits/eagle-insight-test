import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, ArrowLeft, Clock, User, AlertTriangle, CheckCircle, XCircle, Eye } from "lucide-react";
import { useRole } from "@/components/dashboard/RoleProvider";
import { useCSVData } from "@/contexts/CSVDataContext";
import type { Rule } from "@/contexts/CSVDataContext";
import { useNavigate } from "react-router-dom";
import { ActionButton, ConfirmModal, useActionToast, EmptyState } from "@/components/ui/shared-actions";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const ReviewHeader = () => {
  const { user } = useAuth();
  const { currentUser } = useRole();
  const navigate = useNavigate();

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <ActionButton 
              variant="outline" 
              onClick={() => navigate('/portal/magen-achzaka-david')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              חזרה לפורטל
            </ActionButton>
            <div className="flex items-center gap-3">
              <CheckSquare className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">תור אישורים</h1>
                <p className="text-sm text-muted-foreground">סקירה ואישור כללים ותגים</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{user?.nameHe || currentUser.name}</p>
            <p className="text-xs text-muted-foreground">{user?.roleHe || currentUser.rank}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

interface ReviewItemProps {
  rule: Rule;
  onApprove: (ruleId: string, reason: string) => Promise<void>;
  onReject: (ruleId: string, reason: string) => Promise<void>;
  onViewDetails: (ruleId: string) => void;
}

const ReviewItem: React.FC<ReviewItemProps> = ({ rule, onApprove, onReject, onViewDetails }) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [checklist, setChecklist] = useState({
    noConflict: false,
    unitsVerified: false,
    falseAlarmAcceptable: false,
    historicalTested: false,
  });
  const { showSuccess, showError } = useActionToast();

  const allChecked = Object.values(checklist).every(Boolean);

  const handleApprove = async () => {
    if (!allChecked) {
      showError('שגיאה', 'יש לאשר את כל סעיפי רשימת הבטיחות');
      return;
    }
    setIsLoading('approve');
    try {
      await onApprove(rule.id, reason || 'אושר');
      showSuccess('הכלל אושר', `הכלל ${rule.name} אושר בהצלחה`);
      setApproveModalOpen(false);
      setReason('');
    } catch (error) {
      showError('שגיאה', 'לא ניתן לאשר את הכלל');
    } finally {
      setIsLoading(null);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      showError('שגיאה', 'יש לציין סיבה להחזרה');
      return;
    }
    setIsLoading('reject');
    try {
      await onReject(rule.id, reason);
      showSuccess('הוחזר לתיקון', `הכלל ${rule.name} הוחזר לתיקון`);
      setRejectModalOpen(false);
      setReason('');
    } catch (error) {
      showError('שגיאה', 'לא ניתן להחזיר את הכלל');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {rule.name}
              <Badge variant="outline">{rule.id}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge 
                variant={
                  rule.severity === 'critical' ? 'destructive' :
                  rule.severity === 'high' ? 'destructive' :
                  rule.severity === 'medium' ? 'secondary' : 'outline'
                }
              >
                {rule.severity === 'critical' ? 'קריטי' :
                 rule.severity === 'high' ? 'גבוה' :
                 rule.severity === 'medium' ? 'בינוני' : 'נמוך'}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {new Date(rule.createdAt).toLocaleDateString('he-IL')}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                {rule.createdBy}
              </div>
            </div>
          </div>
          <CardDescription>{rule.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">תנאי הכלל:</h4>
            <div className="space-y-1">
              {rule.conditions.map((condition: Rule["conditions"][number], index: number) => (
                <div key={index} className="bg-muted p-2 rounded text-sm">
                  <strong>{condition.parameter}</strong> - 
                  {condition.type === 'threshold' && ` ספי: ${condition.value}`}
                  {condition.type === 'range' && ` טווח: ${condition.value.min}-${condition.value.max}`}
                  {condition.type === 'consecutive' && ` רצוף: ${condition.value} שניות`}
                  {condition.debounce && ` (Debounce: ${condition.debounce}ms)`}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">היקף:</h4>
            <div className="text-sm text-muted-foreground">
              {rule.scope.tailNumbers && `זנבות: ${rule.scope.tailNumbers.join(', ')}`}
              {rule.scope.phases && ` | שלבי טיסה: ${rule.scope.phases.join(', ')}`}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">מטריצת סיכון:</h4>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span>חומרה:</span>
                <Badge variant="outline">{rule.riskMatrix.severity}/5</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span>הסתברות:</span>
                <Badge variant="outline">{rule.riskMatrix.probability}/5</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span>סיכון כולל:</span>
                <Badge 
                  variant={rule.riskMatrix.severity * rule.riskMatrix.probability > 15 ? 'destructive' : 'secondary'}
                >
                  {rule.riskMatrix.severity * rule.riskMatrix.probability}/25
                </Badge>
              </div>
            </div>
          </div>

          {rule.backtest && (
            <div>
              <h4 className="font-medium mb-2">תוצאות Backtest:</h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-success">
                    {(rule.backtest.precision * 100).toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground">Precision</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-success">
                    {(rule.backtest.recall * 100).toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground">Recall</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-warning">
                    {rule.backtest.falsePositives}
                  </div>
                  <div className="text-muted-foreground">False Positives</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-destructive">
                    {rule.backtest.falseNegatives}
                  </div>
                  <div className="text-muted-foreground">False Negatives</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              רשימת בטיחות:
            </h4>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded" 
                  checked={checklist.noConflict}
                  onChange={(e) => setChecklist(prev => ({ ...prev, noConflict: e.target.checked }))}
                />
                <span>הכלל לא מתנגש עם מעטפת פעולה מותרת</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded"
                  checked={checklist.unitsVerified}
                  onChange={(e) => setChecklist(prev => ({ ...prev, unitsVerified: e.target.checked }))}
                />
                <span>יחידות ותנאים נבדקו ואומתו</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded"
                  checked={checklist.falseAlarmAcceptable}
                  onChange={(e) => setChecklist(prev => ({ ...prev, falseAlarmAcceptable: e.target.checked }))}
                />
                <span>שיעור False Alarm מקובל</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded"
                  checked={checklist.historicalTested}
                  onChange={(e) => setChecklist(prev => ({ ...prev, historicalTested: e.target.checked }))}
                />
                <span>הכלל נבדק על נתונים היסטוריים</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <ActionButton 
              className="flex-1 gap-2"
              onClick={() => setApproveModalOpen(true)}
              disabled={!allChecked}
              disabledReasonHe={!allChecked ? 'יש לאשר את כל סעיפי רשימת הבטיחות' : undefined}
            >
              <CheckCircle className="h-4 w-4" />
              אשר כלל
            </ActionButton>
            <ActionButton 
              variant="outline" 
              className="flex-1 gap-2"
              onClick={() => setRejectModalOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              החזר לתיקון
            </ActionButton>
            <ActionButton 
              variant="ghost"
              onClick={() => onViewDetails(rule.id)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              צפה בפרטים מלאים
            </ActionButton>
          </div>
        </CardContent>
      </Card>

      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              אישור כלל
            </DialogTitle>
            <DialogDescription>
              אתה עומד לאשר את הכלל "{rule.name}". הכלל יהפוך לפעיל מיידית.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>הערות (אופציונלי)</Label>
              <Textarea
                placeholder="הוסף הערות לאישור..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <ActionButton variant="outline" onClick={() => setApproveModalOpen(false)}>
              ביטול
            </ActionButton>
            <ActionButton 
              onClick={handleApprove}
              isLoading={isLoading === 'approve'}
              loadingText="מאשר..."
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 ml-2" />
              אשר כלל
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-orange-600" />
              החזרה לתיקון
            </DialogTitle>
            <DialogDescription>
              אתה עומד להחזיר את הכלל "{rule.name}" לתיקון. יש לציין סיבה.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>סיבת ההחזרה <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="הסבר מה צריך לתקן..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <ActionButton variant="outline" onClick={() => setRejectModalOpen(false)}>
              ביטול
            </ActionButton>
            <ActionButton 
              onClick={handleReject}
              isLoading={isLoading === 'reject'}
              loadingText="מחזיר..."
              disabled={!reason.trim()}
              disabledReasonHe="יש לציין סיבה"
              className="bg-orange-600 hover:bg-orange-700"
            >
              <XCircle className="h-4 w-4 ml-2" />
              החזר לתיקון
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ReviewQueue = () => {
  const { rules, updateRule } = useCSVData();
  const navigate = useNavigate();
  const { user } = useAuth();
  const pendingRules = rules.filter(rule => rule.status === 'pending-review');

  const handleApprove = async (ruleId: string, reason: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    updateRule(ruleId, { 
      status: 'active', 
      approvedAt: new Date().toISOString(),
      approvedBy: user?.nameHe || 'Unknown',
      approvalNote: reason,
    });
  };

  const handleReject = async (ruleId: string, reason: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    updateRule(ruleId, { 
      status: 'draft', 
      rejectionNote: reason,
      rejectedAt: new Date().toISOString(),
      rejectedBy: user?.nameHe || 'Unknown',
    });
  };

  const handleViewDetails = (ruleId: string) => {
    sessionStorage.setItem('view_rule_id', ruleId);
    navigate('/portal/magen-achzaka-david');
  };

  if (pendingRules.length === 0) {
    return (
      <EmptyState
        icon={<CheckSquare className="h-12 w-12 text-green-500" />}
        title="All Caught Up"
        titleHe="אין בקשות ממתינות"
        description="All rules and tags have been reviewed"
        descriptionHe="כל הכללים והתגים אושרו או שאין בקשות חדשות"
        variant="no-data"
      />
    );
  }

  return (
    <div className="space-y-4">
      {pendingRules.map(rule => (
        <ReviewItem
          key={rule.id}
          rule={rule}
          onApprove={handleApprove}
          onReject={handleReject}
          onViewDetails={handleViewDetails}
        />
      ))}
    </div>
  );
};

const ReviewContent = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">בקשות ממתינות לאישור</h2>
        <p className="text-muted-foreground">
          סקור ואשר כללים ותגים שנוצרו על ידי המהנדסים
        </p>
      </div>
      <ReviewQueue />
    </div>
  );
};

const Review = () => {
  return <ReviewContent />;
};

export default Review;
