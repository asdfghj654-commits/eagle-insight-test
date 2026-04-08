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
    <Card className="overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-sm" dir="rtl">
      <CardHeader className="border-b bg-gradient-to-l from-primary/5 via-primary/5 to-transparent px-4 pb-4 pt-4">
        <CardTitle className="flex flex-row-reverse items-center gap-3 text-right text-sm leading-snug">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Database className="h-4 w-4 text-primary" />
          </span>
          <span className="flex-1 break-words text-sm font-semibold">איכות נתונים</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 text-sm">
        {/* Summary row */}
        <div className={`rounded-xl border px-3 py-3 text-right ${quality.bg}`}>
          <div className="flex flex-row-reverse items-center justify-between gap-3">
            <span className={`rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold ${quality.color}`}>
              {quality.label}
            </span>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">פרמטרים זמינים</p>
              <p className={`mt-1 text-base font-bold leading-none ${quality.color}`}>
                {present.length}/{parameterStatuses.length}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {missing.length === 0
              ? 'כל הפרמטרים הנדרשים זמינים לניתוח.'
              : `${missing.length} פרמטר(ים) חסרים ו-${uniqueBlockedRules.length} כללים עשויים להיות מושפעים.`
            }
          </p>
        </div>

        {/* Present parameters — flat list, no collapsible */}
        {present.length > 0 && (
          <div className="space-y-2 rounded-xl border border-green-200/70 bg-green-50/40 p-3">
            <div className="flex flex-row-reverse items-center justify-between gap-3 border-b border-green-200/70 pb-2">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                {present.length}
              </span>
              <p className="flex flex-row-reverse items-center gap-1 text-xs font-medium text-green-700 text-right">
                <CheckCircle2 className="h-3.5 w-3.5" />
                זמינים
              </p>
            </div>
            <div className="space-y-1">
              {present.map(p => (
                <div key={p.name} className="flex flex-row-reverse items-center gap-3 rounded-lg border border-white/70 bg-white/70 px-2.5 py-2 text-xs text-right">
                  <Badge variant="outline" className="min-w-[78px] justify-center text-center text-xs text-green-700 border-green-300">
                    {p.systemHe}
                  </Badge>
                  <span className="flex-1 leading-relaxed text-foreground">{p.nameHe}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing parameters */}
        {missing.length > 0 && (
          <div className="space-y-2 rounded-xl border border-orange-200/70 bg-orange-50/40 p-3">
              <div className="flex flex-row-reverse items-center justify-between gap-3 border-b border-orange-200/70 pb-2">
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                  {missing.length}
                </span>
                <p className="flex flex-row-reverse items-center gap-1 text-xs font-medium text-orange-700 text-right">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  פרמטרים חסרים
                </p>
              </div>
              <div className="space-y-1">
              {missing.map(p => (
                <div key={p.name} className="flex flex-row-reverse items-center gap-3 rounded-lg border border-white/70 bg-white/70 px-2.5 py-2 text-xs text-right">
                  <Badge variant="outline" className="min-w-[78px] justify-center text-center text-xs text-orange-700 border-orange-300 shrink-0">
                    {p.systemHe}
                  </Badge>
                  <span className="flex-1 leading-relaxed text-foreground">{p.nameHe}</span>
                </div>
              ))}
              </div>
            </div>
        )}

        {/* Blocked rules */}
        {uniqueBlockedRules.length > 0 && (
          <div className="space-y-2 rounded-xl border border-red-200/70 bg-red-50/40 p-3">
              <div className="flex flex-row-reverse items-center justify-between gap-3 border-b border-red-200/70 pb-2">
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  {uniqueBlockedRules.length}
                </span>
                <p className="flex flex-row-reverse items-center gap-1 text-xs font-medium text-red-700 text-right">
                  <XCircle className="h-3.5 w-3.5" />
                  כללים שלא יכלו לרוץ
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-right leading-relaxed">
                כללים אלה לא הפיקו ממצאים כי הפרמטרים הנדרשים חסרים בקובץ.
              </p>
              <div className="mt-1 flex flex-row-reverse flex-wrap gap-1">
                {uniqueBlockedRules.map(r => (
                  <Badge key={r} variant="outline" className="text-xs text-red-700 border-red-300">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
        )}

        {/* Coverage note */}
        <div className="space-y-1.5 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="flex flex-row-reverse items-center gap-2 text-right">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background/80">
              <Shield className="h-3 w-3" />
            </span>
            <span className="font-medium">הערת כיסוי:</span>
          </div>
          <p className="text-right leading-relaxed">
            {present.length === parameterStatuses.length
              ? 'כל הפרמטרים הנדרשים לכללי הבסיס זמינים. הערכת כללים מלאה.'
              : `${uniqueBlockedRules.length} כלל(ים) לא הוערכו. ממצאים ממערכות ללא נתונים לא נוצרו.`
            }
          </p>
          {dataStats.parameterCount > 0 && (
            <p className="text-right text-muted-foreground">
              סה"כ {dataStats.parameterCount} פרמטרים בקובץ.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataQualityPanel;
