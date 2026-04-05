/**
 * Commander Dashboard - Fleet Readiness View
 * 
 * מסך מפקד גף טכני - כשירות צי
 * 
 * PRD Requirements:
 * - תמונת כשירות צי (Go/No-Go snapshot)
 * - Top blockers + סיכונים קריטיים S1/S2
 * - תקלות חוזרות בצי (Aggregation)
 * - מי מטפל במה + מה תקוע + ETA
 * - מצב חירום שמשנה התנהגות מערכת
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plane,
  ShieldAlert,
  ShieldCheck,
  Shield,
  User,
  ArrowRight,
  ExternalLink,
  Users,
  Layers,
} from 'lucide-react';
import { useFlightDossier } from '@/contexts/FlightDossierContext';
import { SEVERITY_CONFIG, SeverityLevel, UserRole } from '@/types/core';
import { useRole } from '@/components/dashboard/RoleProvider';

// =============================================================================
// FLEET STATUS CARD
// =============================================================================

const FleetStatusCard: React.FC = () => {
  const { getFleetReadiness } = useFlightDossier();
  const readiness = getFleetReadiness();

  const getStatusColor = () => {
    if (readiness.groundedAircraft > 0) return 'text-red-600';
    if (readiness.degradedAircraft > 0) return 'text-orange-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (readiness.groundedAircraft > 0) return <ShieldAlert className="h-8 w-8 text-red-600" />;
    if (readiness.degradedAircraft > 0) return <Shield className="h-8 w-8 text-orange-600" />;
    return <ShieldCheck className="h-8 w-8 text-green-600" />;
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-xl">כשירות צי</CardTitle>
              <CardDescription>Fleet Readiness Status</CardDescription>
            </div>
          </div>
          <div className="text-left">
            <div className={`text-4xl font-bold ${getStatusColor()}`}>
              {readiness.readinessPercentage}%
            </div>
            <div className="text-sm text-muted-foreground">מוכנות</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress 
          value={readiness.readinessPercentage} 
          className="h-3"
        />
        
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{readiness.totalAircraft}</div>
            <div className="text-xs text-muted-foreground">סה״כ מטוסים</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {readiness.readyAircraft}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">מוכנים</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {readiness.degradedAircraft}
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400">מוגבלים</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {readiness.groundedAircraft}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400">מושבתים</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// =============================================================================
// EMERGENCY MODE BANNER
// =============================================================================

const EmergencyModeBanner: React.FC = () => {
  const { emergencyMode, setEmergencyMode } = useFlightDossier();
  const { currentUser } = useRole();

  if (!emergencyMode) return null;

  const handleDeactivate = () => {
    const result = setEmergencyMode(false, 'ביטול ידני של מצב חירום', currentUser.id, 'commander');
    if (!result.success) {
      alert(result.errorHe || result.error);
    }
  };

  return (
    <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg font-bold">מצב חירום פעיל</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>כל הפעולות מתועדפות לפי דחיפות. הרשאות מורחבות פעילות.</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDeactivate}
          className="border-red-500 text-red-600 hover:bg-red-100"
        >
          צא ממצב חירום
        </Button>
      </AlertDescription>
    </Alert>
  );
};

// =============================================================================
// AGGREGATED FINDINGS CARD (Recurring issues across fleet)
// =============================================================================

const AggregatedFindingsCard: React.FC = () => {
  const { getAggregatedFindings } = useFlightDossier();
  const aggregated = getAggregatedFindings();

  // Only show items that appear on multiple aircraft
  const recurring = aggregated.filter(a => a.tailNumbers.length > 1 || a.totalOccurrences > 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">ממצאים חוזרים בצי</CardTitle>
          </div>
          {recurring.length > 0 && (
            <Badge variant="secondary">{recurring.length} סוגים</Badge>
          )}
        </div>
        <CardDescription>אותו ממצא על מספר מטוסים</CardDescription>
      </CardHeader>
      <CardContent>
        {recurring.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span>אין ממצאים חוזרים</span>
          </div>
        ) : (
          <div className="space-y-3">
            {recurring.slice(0, 5).map((item) => (
              <div 
                key={item.key}
                className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800"
              >
                <SeverityBadge severity={item.severity} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{item.titleHe}</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{item.tailNumbers.length} מטוסים:</span>
                    <span className="font-mono">{item.tailNumbers.join(', ')}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.totalOccurrences} מופעים סה״כ
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// BLOCKERS CARD
// =============================================================================

const BlockersCard: React.FC = () => {
  const { getBlockers } = useFlightDossier();
  const blockers = getBlockers();

  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <CardTitle className="text-lg">חוסמים קריטיים (S1)</CardTitle>
        </div>
        <CardDescription>מטוסים מושבתים - דורשים פעולה מיידית</CardDescription>
      </CardHeader>
      <CardContent>
        {blockers.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 py-4">
            <CheckCircle2 className="h-5 w-5" />
            <span>אין חוסמים קריטיים</span>
          </div>
        ) : (
          <div className="space-y-3">
            {blockers.map((blocker) => (
              <div 
                key={blocker.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <Plane className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-700 dark:text-red-400">
                      זנב {blocker.tailNumber}
                    </span>
                    <SeverityBadge severity={blocker.severity} />
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {blocker.descriptionHe}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {blocker.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {blocker.assignedTo}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      מושבת מ-{new Date(blocker.blockedSince).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="flex-shrink-0">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// RISK QUEUE CARD
// =============================================================================

const RiskQueueCard: React.FC = () => {
  const { getRiskQueue, acknowledgeFinding } = useFlightDossier();
  const { currentUser } = useRole();
  const riskQueue = getRiskQueue();

  // Filter to show top 5
  const topRisks = riskQueue.slice(0, 5);

  const handleAcknowledge = (findingId: string) => {
    const result = acknowledgeFinding(findingId, currentUser.id, currentUser.role as UserRole);
    if (!result.success) {
      alert(result.errorHe || result.error);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">תור סיכונים</CardTitle>
          </div>
          <Badge variant="outline">{riskQueue.length} פתוחים</Badge>
        </div>
        <CardDescription>ממצאים S1/S2 הדורשים טיפול</CardDescription>
      </CardHeader>
      <CardContent>
        {topRisks.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 py-4">
            <CheckCircle2 className="h-5 w-5" />
            <span>אין סיכונים פתוחים</span>
          </div>
        ) : (
          <div className="space-y-2">
            {topRisks.map((risk, index) => (
              <div 
                key={risk.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <SeverityBadge severity={risk.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{risk.descriptionHe}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    זנב: {risk.tailNumbers.join(', ')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={risk.status} />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleAcknowledge(risk.findingId)}
                    disabled={risk.status !== 'new'}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {riskQueue.length > 5 && (
              <Button variant="link" className="w-full text-sm">
                הצג עוד {riskQueue.length - 5} ממצאים
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// AIRCRAFT STATUS GRID
// =============================================================================

const AircraftStatusGrid: React.FC = () => {
  const { getFleetReadiness } = useFlightDossier();
  const readiness = getFleetReadiness();

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
      case 'degraded':
        return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
      case 'grounded':
        return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'grounded':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          <CardTitle className="text-lg">סטטוס מטוסים</CardTitle>
        </div>
        <CardDescription>מצב כל מטוסי הצי</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {readiness.aircraftStatus.map((aircraft) => (
            <div
              key={aircraft.tailNumber}
              className={`p-2 rounded-lg border ${getStatusStyles(aircraft.status)} cursor-pointer hover:opacity-80 transition-opacity`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">{aircraft.tailNumber}</span>
                {getStatusIcon(aircraft.status)}
              </div>
              <div className="text-xs text-muted-foreground">
                {aircraft.openFindings > 0 && (
                  <span className="block">
                    {aircraft.openFindings} ממצאים
                  </span>
                )}
                {aircraft.openTasks > 0 && (
                  <span className="block">
                    {aircraft.openTasks} משימות
                  </span>
                )}
                {aircraft.openFindings === 0 && aircraft.openTasks === 0 && (
                  <span className="text-green-600">תקין</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-4" />
        
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>מוכן</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>מוגבל</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>מושבת</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const SeverityBadge: React.FC<{ severity: SeverityLevel }> = ({ severity }) => {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge className={`${config.bgColor} ${config.color} border-0`}>
      {severity}
    </Badge>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    acknowledged: 'bg-purple-100 text-purple-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    escalated: 'bg-orange-100 text-orange-800',
    resolved: 'bg-green-100 text-green-800',
    rejected: 'bg-gray-100 text-gray-800',
    closed: 'bg-gray-200 text-gray-600',
  };

  const statusLabels: Record<string, string> = {
    new: 'חדש',
    acknowledged: 'הוכר',
    in_progress: 'בטיפול',
    escalated: 'הוסלם',
    resolved: 'נפתר',
    rejected: 'נדחה',
    closed: 'נסגר',
  };

  return (
    <Badge className={`${statusColors[status] || 'bg-gray-100'} border-0 text-xs`}>
      {statusLabels[status] || status}
    </Badge>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CommanderDashboard: React.FC = () => {
  const { emergencyMode, setEmergencyMode, isInitialized } = useFlightDossier();
  const { currentUser } = useRole();
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [emergencyReasonInput, setEmergencyReasonInput] = useState('');

  const handleActivateEmergency = () => {
    if (!emergencyReasonInput.trim()) {
      alert('נדרשת סיבה להפעלת מצב חירום');
      return;
    }
    const result = setEmergencyMode(true, emergencyReasonInput, currentUser.id, 'commander');
    if (result.success) {
      setEmergencyDialogOpen(false);
      setEmergencyReasonInput('');
    } else {
      alert(result.errorHe || result.error);
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Emergency Mode Banner */}
      <EmergencyModeBanner />

      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">דשבורד מפקד</h2>
          <p className="text-muted-foreground">תמונת מצב כשירות צי - {new Date().toLocaleDateString('he-IL')}</p>
        </div>
        <div className="flex items-center gap-2">
          {!emergencyMode && (
            <Button 
              variant="destructive"
              onClick={() => setEmergencyDialogOpen(true)}
            >
              <ShieldAlert className="h-4 w-4 ml-2" />
              הפעל מצב חירום
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Fleet Status - spans 2 columns */}
        <FleetStatusCard />
        
        {/* Blockers */}
        <BlockersCard />
        
        {/* Risk Queue */}
        <RiskQueueCard />

        {/* Aggregated Findings */}
        <AggregatedFindingsCard />
        
        {/* Aircraft Grid - spans 2 columns */}
        <AircraftStatusGrid />
      </div>

      {/* Emergency Mode Dialog */}
      <Dialog open={emergencyDialogOpen} onOpenChange={setEmergencyDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              הפעלת מצב חירום
            </DialogTitle>
            <DialogDescription>
              מצב חירום משנה התנהגות המערכת: תיעדוף אוטומטי, הרשאות מורחבות, התראות מוגברות.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                פעולה זו תתועד ב-Audit Log ותישלח התראה לכל הגורמים הרלוונטיים.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="emergency-reason">
                סיבה להפעלת מצב חירום <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="emergency-reason"
                placeholder="תאר את הסיבה להפעלת מצב חירום..."
                value={emergencyReasonInput}
                onChange={(e) => setEmergencyReasonInput(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEmergencyDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleActivateEmergency}
              disabled={!emergencyReasonInput.trim()}
            >
              <ShieldAlert className="h-4 w-4 ml-2" />
              הפעל מצב חירום
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommanderDashboard;
