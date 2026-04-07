/**
 * Data Quality Panel — Engineering Portal
 *
 * Shows the engineer what parameters are present, missing, and which rules
 * ran vs. couldn't run due to missing data. This replaces the current opacity
 * where rules silently skip when parameters are absent.
 *
 * Placed in the DataNavigator sidebar of the investigation workbench.
 * Only visible when CSV data is loaded.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Shield,
} from 'lucide-react';
import { useCSVData } from '@/contexts/CSVDataContext';

// Known parameters from the rule engine — these are the ones rules expect to find
// This should eventually be driven by the rule definitions from the server
const EXPECTED_PARAMETERS: Record<string, { nameHe: string; system: string; systemHe: string; requiredByRules: string[] }> = {
  hydraulic_pressure_psi: {
    nameHe: 'לחץ הידראולי',
    system: 'Hydraulics',
    systemHe: 'מערכת הידראולית',
    requiredByRules: ['HYD_001', 'HYD_002'],
  },
  egt_celsius: {
    nameHe: 'טמפרטורת גזי פליטה',
    system: 'Engine',
    systemHe: 'מנוע',
    requiredByRules: ['ENG_001'],
  },
  oil_pressure: {
    nameHe: 'לחץ שמן',
    system: 'Engine',
    systemHe: 'מנוע',
    requiredByRules: ['ENG_002'],
  },
  brake_temp_celsius: {
    nameHe: 'טמפרטורת בלמים',
    system: 'Brakes',
    systemHe: 'מערכת בלמים',
    requiredByRules: ['BRK_001'],
  },
  fuel_flow_pph: {
    nameHe: 'קצב צריכת דלק',
    system: 'Fuel',
    systemHe: 'מערכת דלק',
    requiredByRules: ['ENG_003'],
  },
  g_force: {
    nameHe: 'עומס G',
    system: 'Structure',
    systemHe: 'מבנה',
    requiredByRules: ['STRUC_001'],
  },
  fuel_remaining_lbs: {
    nameHe: 'דלק נותר',
    system: 'Fuel',
    systemHe: 'מערכת דלק',
    requiredByRules: ['FUEL_001'],
  },
};

interface ParameterStatus {
  name: string;
  nameHe: string;
  system: string;
  systemHe: string;
  present: boolean;
  requiredByRules: string[];
}

export const DataQualityPanel: React.FC = () => {
  const { availableParameters, dataStats } = useCSVData();

  const parameterStatuses = useMemo((): ParameterStatus[] => {
    const availableSet = new Set(availableParameters.map(p => p.toLowerCase()));
    return Object.entries(EXPECTED_PARAMETERS).map(([key, meta]) => ({
      name: key,
      nameHe: meta.nameHe,
      system: meta.system,
      systemHe: meta.systemHe,
      present: availableSet.has(key.toLowerCase()),
      requiredByRules: meta.requiredByRules,
    }));
  }, [availableParameters]);

  const present = parameterStatuses.filter(p => p.present);
  const missing = parameterStatuses.filter(p => !p.present);
  const rulesBlocked = missing.flatMap(p => p.requiredByRules);
  const uniqueBlockedRules = [...new Set(rulesBlocked)];

  const qualityScore = present.length / parameterStatuses.length;
  const getQualityLabel = () => {
    if (qualityScore >= 0.85) return { label: 'טובה', color: 'text-green-600', bg: 'bg-green-50' };
    if (qualityScore >= 0.5)  return { label: 'חלקית', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { label: 'חסרה', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const quality = getQualityLabel();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4" />
          איכות נתונים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Summary row */}
        <div className={`flex items-center justify-between p-2 rounded-lg ${quality.bg}`}>
          <span className="text-xs font-medium">פרמטרים זמינים</span>
          <span className={`font-bold text-sm ${quality.color}`}>
            {present.length}/{parameterStatuses.length} ({quality.label})
          </span>
        </div>

        {/* Present parameters — flat list, no collapsible */}
        {present.length > 0 && (
          <div>
            <p className="text-xs font-medium flex items-center gap-1 text-green-700 mb-1.5">
              <CheckCircle2 className="h-3 w-3" />
              זמינים ({present.length})
            </p>
            <div className="space-y-1">
              {present.map(p => (
                <div key={p.name} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">{p.nameHe}</span>
                  <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                    {p.systemHe}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing parameters */}
        {missing.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-medium flex items-center gap-1 text-orange-700">
                <AlertTriangle className="h-3 w-3" />
                פרמטרים חסרים ({missing.length})
              </p>
              {missing.map(p => (
                <div key={p.name} className="flex items-start justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">{p.nameHe}</span>
                  <Badge variant="outline" className="text-xs text-orange-700 border-orange-300 flex-shrink-0">
                    {p.systemHe}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Blocked rules */}
        {uniqueBlockedRules.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-medium flex items-center gap-1 text-red-700">
                <XCircle className="h-3 w-3" />
                כללים שלא יכלו לרוץ ({uniqueBlockedRules.length})
              </p>
              <p className="text-xs text-muted-foreground">
                כללים אלה לא הפיקו ממצאים כי הפרמטרים הנדרשים חסרים בקובץ.
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {uniqueBlockedRules.map(r => (
                  <Badge key={r} variant="outline" className="text-xs text-red-700 border-red-300">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Coverage note */}
        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span className="font-medium">הערת כיסוי:</span>
          </div>
          <p>
            {present.length === parameterStatuses.length
              ? 'כל הפרמטרים הנדרשים לכללי הבסיס זמינים. הערכת כללים מלאה.'
              : `${uniqueBlockedRules.length} כלל(ים) לא הוערכו. ממצאים ממערכות ללא נתונים לא נוצרו.`
            }
          </p>
          {dataStats.parameterCount > 0 && (
            <p className="text-muted-foreground">
              סה"כ {dataStats.parameterCount} פרמטרים בקובץ.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataQualityPanel;
