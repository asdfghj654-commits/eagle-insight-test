# Developer Tickets - מגן דוד לאחזקה V7.2
## Production-Ready Operational Demo

---

## סיכום מנהלים

מסמך זה מגדיר משימות פיתוח מסודרות לפי סדרי עדיפויות (P0/P1/P2) להפיכת הדמו לראוי להדגמה מבצעית.

**מצב נוכחי:** דמו עובד עם ליקויים משמעותיים ב-UX ועקביות נתונים
**יעד:** דמו אמין שמרגיש כמו מערכת מבצעית

---

## P0 — Must Fix (קריטי להדגמה)

### P0-A: גרפים מקצועיים - Labels, Units, Tooltips

**סימפטום:**
- Tooltip בגרפים לא מציג יחידות (PSI, °C, ft, kts)
- ציר Y לא כולל שם פרמטר + יחידה
- Legend מציג שם גולמי של עמודה במקום תווית ידידותית

**רציונל:**
בסביבה הנדסית, גרף עם תוויות לא ברורות מאבד אמינות מיידית. מהנדס צריך לראות "Hydraulic Pressure (PSI)" ולא "hydraulic_pressure".

**מיקום בקוד:**

| קובץ | פונקציה/רכיב |
|------|--------------|
| `src/components/portal/SignalsTab.tsx` | `<ChartTooltip>` (שורות 330-336) |
| `src/components/portal/GraphEditor.tsx` | `<Tooltip>` (שורות 278-284), `<YAxis>` (שורות 275-276) |
| `src/components/portal/DistributionsTab.tsx` | כל הגרפים |
| `src/components/portal/CorrelationsTab.tsx` | Scatter plots |
| `src/lib/parameter-categories.ts` | להרחיב עם יחידות |

**שינוי נדרש:**

1. **הרחב `parameter-categories.ts`:**
```typescript
// הוסף מיפוי יחידות
export const PARAMETER_UNITS: Record<string, string> = {
  'hydraulic_pressure': 'PSI',
  'engine_temp': '°C',
  'altitude': 'ft',
  'airspeed': 'kts',
  'fuel_flow': 'lbs/hr',
  'oil_pressure': 'PSI',
  'egt': '°C',
  'g_force': 'G',
  // ... default: ''
};

export const getParameterLabel = (param: string): string => {
  // Returns human-readable label with unit
  const unit = PARAMETER_UNITS[param.toLowerCase()] || '';
  const category = getParameterCategory(param);
  return unit ? `${param} (${unit})` : param;
};
```

2. **עדכן SignalsTab.tsx:**
```typescript
<ChartTooltip 
  labelFormatter={(value) => {
    const date = new Date(value).toLocaleString('he-IL');
    return `זמן: ${date}`;
  }}
  formatter={(value: any, name: string) => {
    const unit = PARAMETER_UNITS[name] || '';
    const formattedValue = value !== null ? parseFloat(value).toFixed(2) : 'N/A';
    return [`${formattedValue} ${unit}`, getParameterLabel(name)];
  }}
  contentStyle={{ direction: 'rtl' }}
/>

<YAxis 
  label={{ 
    value: selectedParameters.length === 1 ? getParameterLabel(selectedParameters[0]) : 'ערך',
    angle: -90,
    position: 'insideLeft'
  }}
/>
```

3. **עדכן GraphEditor.tsx באותו אופן**

**Definition of Done:**
- [ ] כל tooltip מציג: `ערך | יחידה | שם פרמטר מקצועי`
- [ ] ציר Y כולל תווית עם יחידה כשיש פרמטר יחיד
- [ ] Legend מציג שמות מקצועיים
- [ ] אין שום גרף שמציג שם עמודה גולמי

---

### P0-B: הפרדת צבעים בגרפים (Series Distinction)

**סימפטום:**
צבעים של קווים לא מספיק מובחנים כשיש 4+ סדרות.

**רציונל:**
מהנדס צריך להבחין בין סדרות במבט מהיר.

**מיקום בקוד:**

| קובץ | מקום |
|------|------|
| `src/components/portal/SignalsTab.tsx` | `PARAMETER_COLORS` (שורות 20-27) |
| `src/components/portal/GraphEditor.tsx` | `PARAMETER_COLORS` (שורות 21-32) |

**שינוי נדרש:**

1. **צור קובץ ריכוזי `src/lib/chart-colors.ts`:**
```typescript
// Color palette optimized for accessibility and distinction
export const CHART_COLORS = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#ea580c', // Orange
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#ca8a04', // Yellow
  '#be185d', // Pink
  '#4f46e5', // Indigo
  '#059669', // Teal
];

export const getSeriesColor = (index: number): string => {
  return CHART_COLORS[index % CHART_COLORS.length];
};

// For accessibility - ensure contrast
export const getContrastColor = (bgColor: string): string => {
  // Light background = dark text, dark = light text
  return '#ffffff'; // Simplified for now
};
```

2. **עדכן את שני הקבצים לייבא מ-`chart-colors.ts`**

**Definition of Done:**
- [ ] כל גרף עם 2+ סדרות מציג צבעים שונים בבירור
- [ ] צבעים עקביים בין renders
- [ ] Legend תואם לצבעי הקווים

---

### P0-C: מניעת שכבות ריקות (Empty Layer Prevention)

**סימפטום:**
ניתן להוסיף שכבה בעורך גרפים גם כשאין נתונים - התוצאה גרף ריק מבלבל.

**רציונל:**
שכבה ריקה נראית כמו באג ומבזבזת זמן למשתמש.

**מיקום בקוד:**

| קובץ | מקום |
|------|------|
| `src/components/portal/GraphEditor.tsx` | `handleParameterToggle` (שורות 76-92) |
| `src/components/portal/SignalsTab.tsx` | Parameter selection |

**שינוי נדרש:**

1. **הוסף בדיקת נתונים לפני הוספת פרמטר:**
```typescript
// In GraphEditor.tsx
const hasDataForParameter = useCallback((param: string): boolean => {
  return initialData.some(point => 
    point[param] !== null && 
    point[param] !== undefined
  );
}, [initialData]);

// In parameter selection UI:
{params.map((param) => {
  const hasData = hasDataForParameter(param);
  return (
    <div key={param} className="flex items-center gap-2">
      <Checkbox
        checked={selectedParameters.includes(param)}
        onCheckedChange={() => handleParameterToggle(param)}
        disabled={!hasData && !selectedParameters.includes(param)}
        className="h-4 w-4"
      />
      <span className={`text-xs ${!hasData ? 'opacity-50' : ''}`}>
        {param}
        {!hasData && ' (אין נתונים)'}
      </span>
    </div>
  );
})}
```

2. **הוסף Tooltip להסבר:**
```typescript
<Tooltip>
  <TooltipTrigger>
    <span className="text-xs opacity-50">{param} (אין נתונים)</span>
  </TooltipTrigger>
  <TooltipContent>
    <p>אין נקודות נתונים לפרמטר זה בטווח הנבחר</p>
  </TooltipContent>
</Tooltip>
```

**Definition of Done:**
- [ ] פרמטר ללא נתונים מנוטרל (disabled) או מסומן ברור
- [ ] לא ניתן להוסיף שכבה שתיצור גרף ריק
- [ ] Tooltip מסביר למה פרמטר לא זמין

---

### P0-D: מצב חירום - הרשאות ותצוגה גלובלית

**סימפטום:**
- כפתור "מצב חירום" מופיע בפורטל הנדסי (`SafetyBanner`) ללא הרשאות
- משתמשים לא-מפקדים יכולים לראות את הכפתור כלחיץ
- אין סנכרון בין מצב חירום בדשבורד מפקד לפורטל

**רציונל:**
מצב חירום הוא החלטה פיקודית. UI חייב לשקף סמכות.

**מיקום בקוד:**

| קובץ | מקום |
|------|------|
| `src/pages/EngineeringPortal.tsx` | `SafetyBanner` (שורות 36-89) |
| `src/components/dashboard/CommanderDashboard.tsx` | `EmergencyModeBanner` (שורות 128-156) |
| `src/contexts/FlightDossierContext.tsx` | `emergencyMode` state |

**שינוי נדרש:**

1. **עדכן SafetyBanner בפורטל הנדסי:**
```typescript
const SafetyBanner = () => {
  const { emergencyMode, emergencyReason } = useFlightDossier();
  const { currentUser } = useRole();
  const isCommander = currentUser.role === 'commander';

  // Safety status derived from fleet readiness (not toggleable)
  const { getFleetReadiness } = useFlightDossier();
  const readiness = getFleetReadiness();
  
  const safetyStatus = useMemo(() => {
    if (readiness.groundedAircraft > 0) return 'danger';
    if (readiness.degradedAircraft > 0) return 'caution';
    return 'safe';
  }, [readiness]);

  return (
    <div className={`px-4 py-2 flex items-center ${getStatusColor()}`} dir="rtl">
      <div className="flex-1">
        {/* Emergency indicator - read only for non-commanders */}
        {emergencyMode && (
          <Badge variant="destructive" className="animate-pulse">
            מצב חירום פעיל: {emergencyReason}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 justify-center">
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>
      <div className="flex-1 flex items-center gap-2 justify-end">
        {/* Only commander sees active button */}
        {isCommander && !emergencyMode && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {/* Open emergency dialog */}}
            className="text-xs h-7 bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            הפעל מצב חירום
          </Button>
        )}
        
        {/* Risk Matrix - always visible but may be read-only */}
        <RiskMatrixButton />
      </div>
    </div>
  );
};
```

2. **הסר את ה-toggle המקומי של `incidentMode`** - הוא לא מחובר לשום דבר

**Definition of Done:**
- [ ] רק מפקד רואה כפתור הפעלה/ביטול של מצב חירום
- [ ] כל התפקידים רואים אינדיקטור קריאה-בלבד כשמצב חירום פעיל
- [ ] מצב חירום משפיע על UI (למשל: צבע רקע, סדר תצוגה)
- [ ] אין toggles מנותקים

---

### P0-E: סטטוס בטיחות נגזר מלוגיקה (לא Toggle)

**סימפטום:**
`SafetyBanner` בפורטל מציג "מצב בטיחות תקין" עם toggle פנימי (`safetyStatus` state) שלא קשור לשום נתון אמיתי.

**רציונל:**
סטטוס בטיחות צריך להיגזר מממצאים (S1/S2/S3/S4) כמתועד ב-`GROUNDING_LOGIC.md`.

**מיקום בקוד:**
`src/pages/EngineeringPortal.tsx` שורות 36-63

**שינוי נדרש:**

ראה P0-D - הסטטוס צריך להיגזר מ-`getFleetReadiness()` ולא מ-state מקומי.

**Definition of Done:**
- [ ] אין `useState` לסטטוס בטיחות
- [ ] סטטוס נגזר מ-`getFleetReadiness()` או מספירת ממצאים פתוחים
- [ ] עקביות עם `GROUNDING_LOGIC.md`

---

### P0-F: כפתור מטריצת סיכון - עובד או מוסר

**סימפטום:**
כפתור "מטריצת סיכון" לא עושה כלום.

**רציונל:**
כפתור מת = אובדן אמון מיידי.

**מיקום בקוד:**
`src/pages/EngineeringPortal.tsx` שורה 83-86

**שינוי נדרש (בחר אחד):**

**אופציה A - הטמע מטריצה בסיסית:**
```typescript
const RiskMatrixButton = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { findings } = useFlightDossier();

  // Count findings by severity
  const severityCounts = useMemo(() => ({
    S1: findings.filter(f => f.severity === 'S1' && f.status !== 'resolved').length,
    S2: findings.filter(f => f.severity === 'S2' && f.status !== 'resolved').length,
    S3: findings.filter(f => f.severity === 'S3' && f.status !== 'resolved').length,
    S4: findings.filter(f => f.severity === 'S4' && f.status !== 'resolved').length,
  }), [findings]);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
        מטריצת סיכון
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מטריצת סיכון - התפלגות חומרות</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 p-4">
            <div className="text-center p-4 bg-red-100 rounded">
              <div className="text-2xl font-bold text-red-600">{severityCounts.S1}</div>
              <div className="text-sm">S1 - השבתה</div>
            </div>
            {/* ... S2, S3, S4 */}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
```

**אופציה B - הסר מהממשק:**
```typescript
// פשוט הסר את הכפתור מ-SafetyBanner
```

**Definition of Done:**
- [ ] כפתור פותח מטריצה עובדת **או** כפתור לא קיים
- [ ] אין כפתורים מתים

---

### P0-G: שלבי טיסה מקצועיים (לא מספרים 1-11)

**סימפטום:**
בחלק מהמקומות שלבי טיסה מוצגים כמספרים (1, 2, 3...) במקום שמות מקצועיים.

**רציונל:**
משתמשי תעופה מצפים ל-TAXI, TAKEOFF, CLIMB וכו'.

**מיקום בקוד:**

| קובץ | מיקום |
|------|-------|
| `src/contexts/CSVDataContext.tsx` | `phaseMap` (שורות 223-231) - **כבר מטפל!** |
| `src/lib/sample-data.ts` | שלבים בעברית (שורות 23, 44-49) |

**מצב נוכחי:**
- CSVDataContext כבר ממפה שלבים עבריים לאנגליים
- sample-data משתמש בעברית ('טקסי', 'המראה'...)

**שינוי נדרש:**

1. **ודא שכל מקום שמציג phase משתמש במיפוי:**
```typescript
// src/lib/flight-phases.ts (חדש)
export const FLIGHT_PHASES = {
  taxi: { en: 'TAXI', he: 'טקסי', order: 1 },
  takeoff: { en: 'TAKEOFF', he: 'המראה', order: 2 },
  climb: { en: 'CLIMB', he: 'עלייה', order: 3 },
  cruise: { en: 'CRUISE', he: 'טיסת שיוט', order: 4 },
  descent: { en: 'DESCENT', he: 'ירידה', order: 5 },
  approach: { en: 'APPROACH', he: 'גישה', order: 6 },
  landing: { en: 'LANDING', he: 'נחיתה', order: 7 },
} as const;

export type FlightPhase = keyof typeof FLIGHT_PHASES;

export const getPhaseLabel = (phase: string, lang: 'he' | 'en' = 'he'): string => {
  const normalized = phase.toLowerCase();
  return FLIGHT_PHASES[normalized]?.[lang] || phase;
};
```

2. **סרוק ותקן:**
```bash
grep -rn "phase" src/components/portal/*.tsx
```
ודא שכל מקום שמציג `record.phase` משתמש ב-`getPhaseLabel(record.phase)`.

**Definition of Done:**
- [ ] אף מסך לא מציג phase כמספר
- [ ] כל phase מוצג כטקסט מקצועי (עברית או אנגלית)
- [ ] פילטרים משתמשים באותם שמות

---

## P1 — Very Important (אחרי P0)

### P1-A: הפרדת Demo/CSV - מקור נתונים אחיד

**סימפטום:**
חלק מהמסכים מציגים mockup קבוע (INS-00X) גם אחרי העלאת CSV.

**רציונל:**
הסיפור צריך להיות: "אני מעלה נתונים → אני רואה תובנות רלוונטיות".

**מיקום בקוד:**

| קובץ | בעיה |
|------|------|
| `src/components/dashboard/TechnicianMaintenanceView.tsx` | `pendingInsights` הוא mockup קבוע |
| `src/components/dashboard/RoleBasedInsights.tsx` | מקבל `insights` מבחוץ - תקין |
| `src/pages/Index.tsx` | מנהל את ה-flow |

**שינוי נדרש:**

1. **הוסף "Data Mode" indicator:**
```typescript
// In CSVDataContext
const hasRealData = rawData.length > 0;
const dataMode: 'demo' | 'live' = hasRealData ? 'live' : 'demo';
```

2. **ב-TechnicianMaintenanceView:**
```typescript
const { dataMode, insights } = useCSVData();
const { findings, tasks } = useFlightDossier();

// If live data, show real findings/tasks
// If demo mode, can show demo data with clear label
const displayedTasks = dataMode === 'live' 
  ? tasks.filter(t => t.assignedRole === 'technician')
  : demoTasks; // With clear "Demo" badge
```

**Definition of Done:**
- [ ] כשיש CSV, כל המסכים מציגים נתונים נגזרים או "אין נתונים"
- [ ] אם מוצג דמו, יש Badge ברור "נתוני הדגמה"
- [ ] לא מוצגים INS-00X לא רלוונטיים אחרי העלאת CSV

---

### P1-B: עקביות תהליך Review בכללים

**סימפטום:**
מחזור חיים של כלל (Draft → Review → Active) לא עקבי בין מסכים.

**מיקום בקוד:**

| קובץ | תפקיד |
|------|-------|
| `src/components/portal/ReviewTab.tsx` | מסך Review |
| `src/components/portal/RuleComposerTab.tsx` | יצירת כלל |
| `src/components/dashboard/RuleManagementTab.tsx` | ניהול כללים |
| `src/contexts/CSVDataContext.tsx` | Rule state management |

**Definition of Done:**
- [ ] כלל עובר Draft → pending-review → approved/rejected
- [ ] סטטוס אחיד בכל המסכים
- [ ] Backtest metrics מוצגים רק אם חושבו

---

## Smoke Test Script

### תסריט בדיקה ידנית מקצה לקצה

```
=== PHASE 1: Login & Navigation ===
1. פתח http://localhost:5173
2. התחבר כמהנדס (6012345 / eng123)
3. ודא ניווט לפורטל הנדסי
4. ✅ Safety Banner מציג סטטוס נגזר (לא toggle)
5. ✅ כפתור "מצב חירום" לא מופיע (לא מפקד)

=== PHASE 2: Data Upload ===
6. לחץ "העלאת נתונים"
7. העלה קובץ CSV תקין
8. ✅ הודעת הצלחה
9. ✅ סטטיסטיקות מתעדכנות

=== PHASE 3: Graphs ===
10. עבור ללשונית "סיגנלים"
11. בחר 3 פרמטרים שונים
12. ✅ כל קו בצבע שונה
13. ✅ Legend מציג שמות מקצועיים + יחידות
14. Hover על נקודה בגרף
15. ✅ Tooltip מציג: זמן | ערך | יחידה | שם פרמטר
16. ✅ לא מוצג pilot_name ב-tooltip

=== PHASE 4: Empty Layer Prevention ===
17. פתח "עריכה מתקדמת" בגרף
18. חפש פרמטר שאין לו נתונים
19. ✅ הפרמטר מנוטרל או מסומן "(אין נתונים)"
20. נסה להוסיף אותו
21. ✅ לא ניתן להוסיף שכבה ריקה

=== PHASE 5: Flight Phases ===
22. סנן לפי שלב טיסה
23. ✅ אפשרויות הן TAXI/TAKEOFF/CLIMB וכו' (לא מספרים)
24. בדוק tooltip - ✅ phase מוצג כטקסט

=== PHASE 6: Emergency Mode (Commander) ===
25. התנתק
26. התחבר כמפקד (5001234 / cmd123)
27. ✅ כפתור "הפעל מצב חירום" גלוי
28. הפעל מצב חירום עם סיבה
29. ✅ באנר אדום מופיע
30. עבור לפורטל הנדסי (אם יש גישה)
31. ✅ מצב חירום מוצג כ-read-only

=== PHASE 7: Risk Matrix ===
32. לחץ על "מטריצת סיכון"
33. ✅ Dialog נפתח עם התפלגות חומרות **או** הכפתור לא קיים

=== PHASE 8: Data Consistency ===
34. התחבר כטכנאי (8234567 / tech123)
35. ✅ אם יש CSV - מוצגות משימות רלוונטיות או "אין משימות"
36. ✅ אין INS-00X mockup אם יש נתונים אמיתיים
```

---

## סדר עדיפויות מומלץ לפיתוח

| שלב | משימות | זמן משוער |
|-----|--------|----------|
| 1 | P0-D + P0-E (Emergency/Safety) | 2-3 שעות |
| 2 | P0-F (Risk Matrix) | 1-2 שעות |
| 3 | P0-A (Graph Labels/Units) | 3-4 שעות |
| 4 | P0-B (Colors) | 1 שעה |
| 5 | P0-C (Empty Layers) | 1-2 שעות |
| 6 | P0-G (Flight Phases) | 1 שעה |
| 7 | P1-A (Data Mode) | 3-4 שעות |
| 8 | P1-B (Rule Lifecycle) | 2-3 שעות |

**סה"כ משוער: 14-20 שעות פיתוח**

---

## קבצים שנוצרו/יש לעדכן

### קבצים חדשים:
- `src/lib/chart-colors.ts` - פלטת צבעים לגרפים
- `src/lib/flight-phases.ts` - מיפוי שלבי טיסה

### קבצים לעדכון:
- `src/lib/parameter-categories.ts` - הוסף יחידות
- `src/pages/EngineeringPortal.tsx` - SafetyBanner
- `src/components/portal/SignalsTab.tsx` - Tooltips
- `src/components/portal/GraphEditor.tsx` - Tooltips + Layer validation
- `src/components/dashboard/TechnicianMaintenanceView.tsx` - Data mode
- `src/contexts/CSVDataContext.tsx` - Data mode flag
