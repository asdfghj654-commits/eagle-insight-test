// Review Tab - Queue for approving new rules and tags
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, MessageSquare, User } from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';

export const ReviewTab: React.FC = () => {
  const { rules, updateRule } = useCSVData();
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

  // Filter rules by status
  const draftRules = useMemo(() =>
    rules.filter(rule => rule.status === 'draft')
  , [rules]);

  const pendingRules = useMemo(() => 
    rules.filter(rule => rule.status === 'pending-review')
  , [rules]);

  const approvedRules = useMemo(() =>
    rules.filter(rule => rule.status === 'approved')
  , [rules]);

  const rejectedRules = useMemo(() =>
    rules.filter(rule => rule.status === 'rejected')
  , [rules]);

  const handleSubmitForReview = (ruleId: string) => {
    updateRule(ruleId, {
      status: 'pending-review'
    });
  };

  const handleApprove = (ruleId: string) => {
    updateRule(ruleId, { 
      status: 'approved',
      // Add approval metadata
      approvedAt: new Date().toISOString(),
      approvedBy: 'current-user',
      reviewComments: reviewComment || undefined
    });
    setReviewComment('');
    setIsReviewDialogOpen(false);
  };

  const handleReject = (ruleId: string) => {
    if (!reviewComment.trim()) {
      alert('נדרש להוסיף הערה בעת דחיית כלל');
      return;
    }

    updateRule(ruleId, { 
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: 'current-user',
      reviewComments: reviewComment
    });
    setReviewComment('');
    setIsReviewDialogOpen(false);
  };

  const handleRequestChanges = (ruleId: string) => {
    if (!reviewComment.trim()) {
      alert('נדרש להוסיף הערות לשינויים מבוקשים');
      return;
    }

    updateRule(ruleId, { 
      status: 'draft', // Send back to draft
      reviewComments: reviewComment,
      changesRequestedAt: new Date().toISOString(),
      changesRequestedBy: 'current-user'
    });
    setReviewComment('');
    setIsReviewDialogOpen(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const formatRiskScore = (riskMatrix: any) => {
    if (!riskMatrix) return 'N/A';
    const score = riskMatrix.severity * riskMatrix.probability;
    return `${score} (${riskMatrix.severity}×${riskMatrix.probability})`;
  };

  const RuleCard = ({ rule, showActions = true }: { rule: any; showActions?: boolean }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="text-right">
            <CardTitle className="flex items-center gap-2">
              {rule.name}
              <Badge variant={getSeverityBadge(rule.severity) as any}>
                {rule.severity === 'critical' ? 'קריטי' :
                 rule.severity === 'high' ? 'גבוה' :
                 rule.severity === 'medium' ? 'בינוני' : 'נמוך'}
              </Badge>
            </CardTitle>
            <CardDescription className="text-right mt-2">
              {rule.description}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {rule.createdBy}
            </Badge>
            <Badge variant="outline">
              {new Date(rule.createdAt).toLocaleDateString('he-IL')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Conditions Summary */}
        <div>
          <h4 className="font-medium mb-2 text-right">תנאי הכלל:</h4>
          <div className="space-y-2">
            {rule.conditions.map((condition: any, index: number) => (
              <div key={index} className="bg-muted p-3 rounded text-sm" dir="rtl">
                <strong>{condition.parameter}</strong> {condition.operator || condition.type} <strong>{condition.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Scope */}
        {(rule.scope?.tailNumbers?.length > 0 || rule.scope?.phases?.length > 0) && (
          <div>
            <h4 className="font-medium mb-2 text-right">היקף:</h4>
            <div className="flex gap-2 flex-wrap" dir="rtl">
              {rule.scope.tailNumbers?.map((tail: string) => (
                <Badge key={tail} variant="outline">זנב: {tail}</Badge>
              ))}
              {rule.scope.phases?.map((phase: string) => (
                <Badge key={phase} variant="outline">שלב: {phase}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Risk Assessment */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded">
            <div className="font-bold text-lg">{formatRiskScore(rule.riskMatrix)}</div>
            <div className="text-sm text-muted-foreground">ציון סיכון</div>
          </div>
          
          {rule.backtest && (
            <div className="text-center p-3 bg-muted rounded">
              <div className="font-bold text-lg text-green-600">
                {(rule.backtest.precision * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">דיוק</div>
            </div>
          )}
        </div>

        {/* Backtest Results */}
        {rule.backtest && (
          <div>
            <h4 className="font-medium mb-2 text-right">תוצאות בדיקה:</h4>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div>
                <div className="font-semibold text-green-600">{rule.backtest.truePositives}</div>
                <div className="text-muted-foreground">זיהויים נכונים</div>
              </div>
              <div>
                <div className="font-semibold text-orange-600">{rule.backtest.falsePositives}</div>
                <div className="text-muted-foreground">אזעקות שווא</div>
              </div>
              <div>
                <div className="font-semibold text-red-600">{rule.backtest.falseNegatives}</div>
                <div className="text-muted-foreground">החמצות</div>
              </div>
              <div>
                <div className="font-semibold">{(rule.backtest.recall * 100).toFixed(0)}%</div>
                <div className="text-muted-foreground">Recall</div>
              </div>
            </div>
          </div>
        )}

        {/* Review Comments */}
        {rule.reviewComments && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="font-medium">הערות סוקר:</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">{rule.reviewComments}</p>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Dialog open={isReviewDialogOpen && selectedRule?.id === rule.id} onOpenChange={setIsReviewDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRule(rule)}
                  className="flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  סקור
                </Button>
              </DialogTrigger>
              
              <DialogContent className="max-w-2xl" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-right">סקירת כלל: {rule.name}</DialogTitle>
                  <DialogDescription className="text-right">
                    בחר פעולה והוסף הערות אם נדרש
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <Textarea
                    placeholder="הערות לכלל (אופציונלי לאישור, חובה לדחייה או בקשת שינויים)"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="text-right"
                    rows={3}
                  />
                  
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => handleRequestChanges(rule.id)}
                      className="flex items-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      בקש שינויים
                    </Button>
                    
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(rule.id)}
                      className="flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      דחה
                    </Button>
                    
                    <Button
                      onClick={() => handleApprove(rule.id)}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      אשר
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-500" />
              טיוטות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-blue-600">{draftRules.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              ממתינים לסקירה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{pendingRules.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              מאושרים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-green-600">{approvedRules.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              נדחו
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-red-600">{rejectedRules.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Tabs */}
      <Tabs defaultValue="drafts" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="drafts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            טיוטות ({draftRules.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            ממתינים ({pendingRules.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            מאושרים ({approvedRules.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            נדחו ({rejectedRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-4">
          {draftRules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">אין כללים בטיוטה</p>
                <p className="text-sm text-muted-foreground mt-2">צור כלל חדש ב-Rule Composer</p>
              </CardContent>
            </Card>
          ) : (
            draftRules.map(rule => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="text-right">
                      <CardTitle className="flex items-center gap-2">
                        {rule.name}
                        <Badge variant="outline">טיוטה</Badge>
                        <Badge variant={getSeverityBadge(rule.severity) as any}>
                          {rule.severity === 'critical' ? 'קריטי' :
                           rule.severity === 'high' ? 'גבוה' :
                           rule.severity === 'medium' ? 'בינוני' : 'נמוך'}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-right mt-2">
                        {rule.description}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {new Date(rule.createdAt).toLocaleDateString('he-IL')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Conditions Summary */}
                  <div className="mb-4">
                    <h4 className="font-medium mb-2 text-right text-sm">תנאים:</h4>
                    <div className="space-y-1">
                      {rule.conditions.map((condition: any, index: number) => (
                        <div key={index} className="bg-muted p-2 rounded text-sm" dir="rtl">
                          <strong>{condition.parameter}</strong> {condition.operator || condition.type} <strong>{condition.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Backtest Results if available */}
                  {rule.backtest && (
                    <div className="flex gap-4 items-center mb-4 text-sm">
                      <span className="text-muted-foreground">תוצאות Backtest:</span>
                      <Badge variant="outline">
                        דיוק: {(rule.backtest.precision * 100).toFixed(0)}%
                      </Badge>
                      <Badge variant="outline">
                        Recall: {(rule.backtest.recall * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  )}
                  
                  {/* Review comments if returned from review */}
                  {rule.reviewComments && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded border border-orange-200 dark:border-orange-800 mb-4">
                      <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 mb-1">
                        <MessageSquare className="h-4 w-4" />
                        <span className="font-medium">הערות סוקר:</span>
                      </div>
                      <p className="text-sm text-orange-700 dark:text-orange-300">{rule.reviewComments}</p>
                    </div>
                  )}
                  
                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      onClick={() => handleSubmitForReview(rule.id)}
                      className="flex items-center gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      שלח לסקירה
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingRules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">אין כללים הממתינים לסקירה</p>
              </CardContent>
            </Card>
          ) : (
            pendingRules.map(rule => (
              <RuleCard key={rule.id} rule={rule} showActions={true} />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedRules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">אין כללים מאושרים</p>
              </CardContent>
            </Card>
          ) : (
            approvedRules.map(rule => (
              <RuleCard key={rule.id} rule={rule} showActions={false} />
            ))
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedRules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">אין כללים שנדחו</p>
              </CardContent>
            </Card>
          ) : (
            rejectedRules.map(rule => (
              <RuleCard key={rule.id} rule={rule} showActions={false} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};