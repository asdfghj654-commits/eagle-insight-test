# Developer Tasks - V8 Production Readiness
## תוכנית עבודה מפורטת לגרסה 8

---

## P0 — חובה לתיקון לפני הדגמה מבצעית

### P0-A: גרפים — Labels, Tooltips, יחידות, שדות לא רלוונטיים

**Symptom:**
Tooltip בגרפים מציג את כל השדות של נקודת הנתונים, כולל `flight_id`, `phase` ולעיתים גם שדות לא רלוונטיים. חסרות יחידות מקצועיות (PSI, °C, kts).

**Rationale:**
בסביבת הנדסה, גרפים הם "עדות". תצוגה לא מקצועית הורסת אמון מיידי.

**Where to fix:**
- `src/components/portal/SignalsTab.tsx` (lines 330-336)
- `src/components/portal/GraphEditor.tsx` (lines 278-284)
- `src/components/portal/DistributionsTab.tsx`
- `src/components/portal/CorrelationsTab.tsx`

**What to change:**
1. הגדר `PARAMETER_UNITS` mapping:
```typescript
const PARAMETER_UNITS: Record<string, string> = {
  altitude: 'ft',
  airspeed: 'kts',
  engine_temp: '°C',
  fuel_flow: 'lbs/hr',
  oil_pressure: 'PSI',
  hydraulic_pressure: 'PSI',
  g_force: 'G',
  vertical_speed: 'ft/min',
  engine_pressure: 'PSI',
  // ... etc
};
```

2. ב-Tooltip formatter:
```typescript
formatter={(value: any, name: string) => {
  const unit = PARAMETER_UNITS[name] || '';
  return [
    `${parseFloat(value).toFixed(2)} ${unit}`,
    name // or translateParameterName(name) for Hebrew
  ];
}}
```

3. ב-YAxis הוסף label עם יחידות:
```typescript
<YAxis 
  yAxisId="left" 
  label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft' }}
/>
```

4. הסר שדות לא רלוונטיים מה-tooltip:
- לא להציג `pilot_name` בגרפים טכניים
- להציג רק: timestamp, parameter name, value, unit, optionally tail/flight_id

**Definition of Done:**
- [ ] אף גרף טכני לא מציג `pilot_name` ב-tooltip/legend
- [ ] כל ציר Y מציג יחידות מקצועיות
- [ ] Tooltip מציג: timestamp, שם פרמטר, ערך + יחידה
- [ ] Legend מציג שמות פרמטרים מקצועיים

---

### P0-B: הפרדת צבעים בגרפים — סדרות חייבות להיות מובחנות

**Symptom:**
כאשר מציגים מספר סדרות, הצבעים לא תמיד מספיק שונים, וקשה להבחין ביניהן.

**Rationale:**
סקירה הנדסית תלויה בהבחנה ויזואלית מהירה בין סדרות.

**Where to fix:**
- `src/components/portal/SignalsTab.tsx` (lines 20-27)
- `src/components/portal/GraphEditor.tsx` (lines 21-32)

**What to change:**
1. הגדל את פלטת הצבעים עם צבעים מובחנים יותר:
```typescript
const PARAMETER_COLORS = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#ca8a04', // Amber
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#be185d', // Pink
  '#4b5563', // Gray
  '#65a30d', // Lime
];
```

2. הוסף pattern/dash לסדרות overlay:
```typescript
strokeDasharray={overlayParams.includes(param) ? "8,4" : "0"}
```

3. הבטח שצבעים נשמרים per-session (לא משתנים בין renders)

**Definition of Done:**
- [ ] בהצגת 2+ סדרות, כל סדרה בצבע שונה בבירור
- [ ] Legend תואם לצבעי הקווים
- [ ] שכבות overlay משתמשות ב-dashed pattern
- [ ] בדיקה עם 5+ סדרות בו-זמנית

---

### P0-C: שכבות — אסור להוסיף שכבה ללא נתונים

**Symptom:**
ה-UI מאפשר להוסיף שכבה גם כשאין נתונים זמינים עבורה, מה שמוביל לגרפים ריקים.

**Rationale:**
שכבה ריקה נראית כמו באג ומבזבזת זמן משתמש.

**Where to fix:**
- `src/components/portal/GraphEditor.tsx` (lines 76-91)
- `src/components/portal/SignalsTab.tsx` (handleParameterToggle)

**What to change:**
1. לפני הוספת פרמטר, בדוק אם יש נתונים:
```typescript
const hasDataForParameter = (param: string): boolean => {
  return chartData.some(point => 
    point[param] !== undefined && 
    point[param] !== null
  );
};
```

2. השבת checkbox/button אם אין נתונים:
```typescript
<Checkbox
  checked={selectedParameters.includes(param)}
  disabled={!hasDataForParameter(param)}
  onCheckedChange={() => handleParameterToggle(param)}
/>
{!hasDataForParameter(param) && (
  <Tooltip content="אין נתונים זמינים לפרמטר זה בטווח הנבחר" />
)}
```

3. הוסף הסבר למשתמש:
```typescript
{!hasDataForParameter(param) && (
  <span className="text-xs text-muted-foreground">
    (אין נתונים)
  </span>
)}
```

**Definition of Done:**
- [ ] לא ניתן להוסיף שכבה עם 0 נקודות נתונים
- [ ] פרמטרים ללא נתונים מושבתים ויזואלית
- [ ] Tooltip מסביר למה פרמטר מושבת
- [ ] הצעה: "נסה להרחיב טווח זמן"

---

### P0-D: מצב חירום — מקושר למצב גלובלי של מפקד

**Symptom:**
כפתור "מצב חירום" בפורטל ההנדסי (`EngineeringPortal.tsx` line 74-79) מנותק ממצב החירום הגלובלי ב-`FlightDossierContext`.

**Rationale:**
מצב חירום הוא החלטה פיקודית. ה-UI חייב לשקף סמכות והקשר גלובלי.

**Where to fix:**
- `src/pages/EngineeringPortal.tsx` (SafetyBanner component, lines 36-90)
- `src/components/dashboard/CommanderDashboard.tsx` (EmergencyModeBanner already correct)
- `src/components/layout/AppLayout.tsx` (optional: add global banner)

**What to change:**
1. ב-SafetyBanner, החלף state מקומי בחיבור ל-context:
```typescript
const SafetyBanner = () => {
  const { emergencyMode, emergencyReason, setEmergencyMode } = useFlightDossier();
  const { currentUser } = useRole();
  const isCommander = currentUser.role === 'commander';
```

2. הצג כפתור הפעלה רק למפקד:
```typescript
{isCommander ? (
  <Button onClick={() => setEmergencyDialogOpen(true)}>
    {emergencyMode ? "בטל מצב חירום" : "הפעל מצב חירום"}
  </Button>
) : emergencyMode ? (
  <Badge variant="destructive">
    מצב חירום פעיל: {emergencyReason}
  </Badge>
) : null}
```

3. כשמצב חירום פעיל, הצג banner לכל התפקידים:
```typescript
{emergencyMode && (
  <Alert variant="destructive" className="mb-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>מצב חירום פעיל</AlertTitle>
    <AlertDescription>
      {emergencyReason} • הופעל על ידי {activatedBy}
    </AlertDescription>
  </Alert>
)}
```

**Definition of Done:**
- [ ] רק מפקד יכול להפעיל/לבטל מצב חירום
- [ ] כל התפקידים רואים indicator read-only כשפעיל
- [ ] מצב חירום משפיע על לפחות התנהגות אחת (למשל: מיון S1/S2 ראשון)
- [ ] הסיבה והזמן מוצגים לכולם

---

### P0-E: סטטוס בטיחות — חייב להיות נגזר מלוגיקת כשירות

**Symptom:**
Toggle "מצב בטיחות תקין" ב-SafetyBanner (`EngineeringPortal.tsx` lines 37-62) הוא toggle חופשי שלא מחובר ללוגיקת S1/S2/S3/S4.

**Rationale:**
סטטוס בטיחות חייב להיות נגזר מ-evidence (חומרת ממצאים), עקבי עם לוגיקת הקרקעה. לא ניתן להיות "toggle סתמי".

**Where to fix:**
- `src/pages/EngineeringPortal.tsx` (SafetyBanner)

**What to change:**
1. החלף toggle בתצוגה נגזרת:
```typescript
const SafetyStatusDisplay = () => {
  const { getFleetReadiness, findings } = useFlightDossier();
  const readiness = getFleetReadiness();
  
  // Derive safety status from findings
  const hasS1 = findings.some(f => f.severity === 'S1' && f.status !== 'closed');
  const hasS2 = findings.some(f => f.severity === 'S2' && f.status !== 'closed');
  
  const safetyStatus = hasS1 ? 'danger' : hasS2 ? 'caution' : 'safe';
  const statusText = {
    safe: `מצב בטיחות תקין (${readiness.readinessPercentage}% כשירות)`,
    caution: `זהירות - ${findings.filter(f => f.severity === 'S2').length} ממצאי S2 פתוחים`,
    danger: `סיכון - ${findings.filter(f => f.severity === 'S1').length} ממצאי S1 פתוחים`
  };
```

2. הסר את ה-toggle והצג indicator בלבד:
```typescript
<div className="flex items-center gap-2">
  {getStatusIcon()}
  <span className="font-medium">{statusText[safetyStatus]}</span>
  <Badge variant="outline" className="text-xs">
    נכון ל: {new Date().toLocaleTimeString('he-IL')}
  </Badge>
</div>
```

3. אם חייב override ידני — רק למפקד עם audit:
```typescript
{isCommander && (
  <Button variant="outline" size="sm" onClick={openOverrideDialog}>
    דריסה ידנית (עם סיבה)
  </Button>
)}
```

**Definition of Done:**
- [ ] אף משתמש לא יכול להחליף סטטוס בטיחות ב-toggle פשוט
- [ ] סטטוס נגזר מ-S1/S2 findings לפי GROUNDING_LOGIC.md
- [ ] אם יש override — רק למפקד + audit log

---

### P0-F: כפתור מטריצת סיכון — חייב לעבוד או להיות מושבת

**Symptom:**
כפתור "מטריצת סיכון" (`EngineeringPortal.tsx` line 84-86) לא עושה כלום.

**Rationale:**
כפתור שלא עובד במסך פיקודי/הנדסי הורס אמינות.

**Where to fix:**
- `src/pages/EngineeringPortal.tsx` (line 84-86)

**What to change:**

**אופציה א' — יישום מינימלי:**
```typescript
const [riskMatrixOpen, setRiskMatrixOpen] = useState(false);

<Button onClick={() => setRiskMatrixOpen(true)}>
  מטריצת סיכון
</Button>

<Dialog open={riskMatrixOpen} onOpenChange={setRiskMatrixOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>מטריצת סיכון - מיפוי חומרות</DialogTitle>
    </DialogHeader>
    <RiskMatrixView />
  </DialogContent>
</Dialog>
```

```typescript
const RiskMatrixView = () => {
  const { findings } = useFlightDossier();
  
  const severityCounts = {
    S1: findings.filter(f => f.severity === 'S1' && f.status !== 'closed').length,
    S2: findings.filter(f => f.severity === 'S2' && f.status !== 'closed').length,
    S3: findings.filter(f => f.severity === 'S3' && f.status !== 'closed').length,
    S4: findings.filter(f => f.severity === 'S4' && f.status !== 'closed').length,
  };
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {/* 4x4 matrix grid */}
      </div>
      <div className="text-sm text-muted-foreground">
        * S1 = השבתה מיידית | S2 = הגבלות טיסה | S3 = נדחה | S4 = מידעי
      </div>
    </div>
  );
};
```

**אופציה ב' — השבתה:**
```typescript
<Button 
  variant="ghost" 
  size="sm" 
  disabled
  title="לא זמין בגרסה זו"
>
  מטריצת סיכון
</Button>
```

**Definition of Done:**
- [ ] כפתור פותח modal עם מטריצה פעילה, או
- [ ] כפתור מושבת עם tooltip "לא זמין בגרסה זו"
- [ ] אין כפתור שנראה פעיל ולא עושה כלום

---

### P0-G: שלבי טיסה — מחרוזות מקצועיות, לא מספרים

**Symptom:**
אם CSV מכיל מספרים לשלבי טיסה (1-11), הם עלולים להופיע כמספרים ב-UI.

**Rationale:**
משתמשי תעופה/אחזקה מצפים לשלבים סטנדרטיים.

**Where to fix:**
- `src/contexts/CSVDataContext.tsx` (line 222-231 - already has mapping!)
- `src/lib/sample-data.ts` (uses Hebrew phases)
- `src/components/portal/PhaseBandsToggle.tsx` (has proper FLIGHT_PHASES)

**What to change:**
1. וודא שה-mapping קיים ומלא:
```typescript
const PHASE_MAP: Record<string | number, FlightPhase> = {
  // Hebrew
  'טקסי': 'taxi',
  'המראה': 'takeoff',
  'עלייה': 'climb',
  'טיסת שיוט': 'cruise',
  'ירידה': 'descent',
  'נחיתה': 'landing',
  // Numeric (1-11 standard)
  1: 'taxi',
  2: 'takeoff',
  3: 'climb',
  4: 'cruise',
  5: 'cruise',
  6: 'cruise',
  7: 'descent',
  8: 'descent',
  9: 'approach',
  10: 'landing',
  11: 'taxi', // post-landing
  // English
  'taxi': 'taxi',
  'takeoff': 'takeoff',
  // ... etc
};
```

2. הוסף תצוגה בעברית:
```typescript
const PHASE_DISPLAY: Record<FlightPhase, string> = {
  taxi: 'גלגול',
  takeoff: 'המראה',
  climb: 'עלייה',
  cruise: 'שיוט',
  descent: 'ירידה',
  approach: 'גישה',
  landing: 'נחיתה',
};
```

3. השתמש ב-display function בכל מקום:
```typescript
const displayPhase = (phase: string): string => {
  return PHASE_DISPLAY[phase as FlightPhase] || phase;
};
```

**Definition of Done:**
- [ ] אף מסך לא מציג מספר כשלב טיסה
- [ ] כל הפילטרים/tooltips משתמשים בשמות מקצועיים
- [ ] בדיקה עם CSV שמכיל מספרים 1-11

---

## P1 — חשוב מאוד (אחרי P0)

### P1-A: הסר פיצול CSV vs Mockup — מקור נתונים אחיד

**Symptom:**
חלקים גדולים מה-UI מציגים mockup קבוע שלא קשור ל-CSV שהועלה.

**Rationale:**
לדמו, הסיפור חייב להיות עקבי: "אני מעלה נתונים → אני רואה תובנות רלוונטיות".

**Where to fix:**
- `src/components/dashboard/TechnicianMaintenanceView.tsx` (hardcoded insights)
- `src/components/dashboard/RoleBasedInsights.tsx` (mock insights)
- `src/pages/Index.tsx` (fleet view tabs)

**What to change:**
1. הגדר "Data Mode":
```typescript
const DataMode = () => {
  const { processedFlights } = useCSVData();
  const hasUploadedData = processedFlights.length > 0;
  
  if (hasUploadedData) {
    return <DataDrivenView />;
  }
  return <DemoModeView />;
};
```

2. המר רשימות mockup לנגזרות מנתונים או הצג empty state:
```typescript
{insights.length === 0 ? (
  <EmptyState 
    title="אין תובנות"
    description="העלה נתוני טיסה לקבלת תובנות"
    action={<UploadButton />}
  />
) : (
  <InsightsList insights={insights} />
)}
```

**Definition of Done:**
- [ ] העלאת CSV → כל המסכים מציגים נתונים נגזרים או empty state
- [ ] אין mockup "INS-00x" לא קשור

---

### P1-B: עקביות תהליך Review (lifecycle כללים + backtest)

**Symptom:**
שדות backtest לא עקביים; אישורים לא משתקפים נכון.

**Rationale:**
פורטל הנדסי חייב להתנהג כ-workflow מבוקר.

**Where to fix:**
- `src/components/portal/ReviewTab.tsx`
- `src/components/portal/RuleComposerTab.tsx`
- `src/contexts/CSVDataContext.tsx` (rule status model)

**What to change:**
1. הגדר מודל סטטוס קנוני:
```typescript
type RuleStatus = 'draft' | 'pending-review' | 'approved' | 'rejected' | 'archived';

const RULE_STATUS_TRANSITIONS: Record<RuleStatus, RuleStatus[]> = {
  'draft': ['pending-review'],
  'pending-review': ['approved', 'rejected'],
  'approved': ['archived'],
  'rejected': ['draft'],
  'archived': [],
};
```

2. השתמש בכל מקום:
```typescript
const canTransitionTo = (currentStatus: RuleStatus, newStatus: RuleStatus): boolean => {
  return RULE_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};
```

**Definition of Done:**
- [ ] כלל עובר Draft → Review → Active בעקביות
- [ ] מסך Review לא מציג undefined metrics
- [ ] כפתורי פעולה מתאימים לסטטוס

---

## Smoke Test Script (Manual Testing)

### בדיקת P0:

```markdown
## 1. בדיקת גרפים (P0-A, P0-B, P0-C)

1. התחבר כמהנדס (6012345 / eng123)
2. פתח פורטל הנדסי
3. העלה CSV עם נתוני טיסה
4. בחר 3+ פרמטרים להצגה
5. **בדוק:** 
   - [ ] Tooltip מציג ערך + יחידות (לא pilot_name)
   - [ ] כל סדרה בצבע שונה
   - [ ] Legend תואם לצבעים
6. נסה לבחור פרמטר שאין לו נתונים
7. **בדוק:** 
   - [ ] פרמטר מושבת
   - [ ] הסבר מופיע

## 2. בדיקת מצב חירום (P0-D)

1. התחבר כמפקד (5001234 / cmd123)
2. הפעל מצב חירום עם סיבה
3. **בדוק:**
   - [ ] Banner מופיע עם סיבה וזמן
4. התנתק, התחבר כטכנאי
5. **בדוק:**
   - [ ] Banner קיים (read-only)
   - [ ] אין כפתור הפעלה/ביטול

## 3. בדיקת סטטוס בטיחות (P0-E)

1. פתח פורטל הנדסי
2. **בדוק:**
   - [ ] אין toggle חופשי
   - [ ] סטטוס משקף S1/S2 findings
3. צור ממצא S1
4. **בדוק:**
   - [ ] סטטוס משתנה ל-"danger"

## 4. בדיקת מטריצת סיכון (P0-F)

1. לחץ על "מטריצת סיכון"
2. **בדוק:**
   - [ ] Modal נפתח עם מטריצה, או
   - [ ] כפתור מושבת עם הסבר

## 5. בדיקת שלבי טיסה (P0-G)

1. העלה CSV עם flight_phase מספרי
2. **בדוק:**
   - [ ] תצוגה: "גלגול", "המראה" וכו'
   - [ ] לא מספרים 1-11
```

---

## קבצים עיקריים לשינוי

| תיקון | קבצים |
|-------|--------|
| P0-A | `SignalsTab.tsx`, `GraphEditor.tsx`, `DistributionsTab.tsx` |
| P0-B | `SignalsTab.tsx`, `GraphEditor.tsx` |
| P0-C | `GraphEditor.tsx`, `SignalsTab.tsx` |
| P0-D | `EngineeringPortal.tsx`, `AppLayout.tsx` |
| P0-E | `EngineeringPortal.tsx` |
| P0-F | `EngineeringPortal.tsx` |
| P0-G | `CSVDataContext.tsx`, `PhaseBandsToggle.tsx` |
| P1-A | `TechnicianMaintenanceView.tsx`, `RoleBasedInsights.tsx`, `Index.tsx` |
| P1-B | `ReviewTab.tsx`, `RuleComposerTab.tsx`, `CSVDataContext.tsx` |

---

## הערות מיוחדות

1. **אל תוסיף קוד** — מסמך זה לתכנון בלבד
2. **עדיפות P0** — כל ה-P0 חייבים להיות מושלמים לפני הדגמה
3. **בדיקות ידניות** — עקוב אחרי Smoke Test Script
4. **עקביות עם מסמכים קיימים:**
   - `docs/GROUNDING_LOGIC.md` — לוגיקת S1/S2/S3/S4
   - `docs/V7_FIXES_SUMMARY.md` — תיקונים קודמים
