# סעיף 8: Rule Authoring (יצירת כללים)

## סקירה כללית

המערכת תומכת בשני מסלולים ליצירת כללי אחזקה:

### א) יצירת כלל מתבנית מוכנה
בחירה מרשימת תבניות עם ערכים מומלצים מהספרות האחזקתית.

**תבניות זמינות:**
| תבנית | פרמטר | סף | חומרה |
|--------|---------|-----|---------|
| טמפרטורת מנוע גבוהה | `egt_celsius` | > 650°C | קריטי |
| לחץ הידראולי נמוך | `hydraulic_pressure_psi` | < 2800 PSI | גבוה |
| עומסי G יתר | `g_load` | > 7.5G | בינוני |
| התחממות בלמים | `brake_temp_celsius` | > 350°C | בינוני |

### ב) יצירת כלל מאפס (From Scratch)
בחירת פרמטר מ-Schema Browser, הגדרת תנאי/סף, והרצת Backtest על נתונים אמיתיים.

**שלבי התהליך:**
1. **בחירת פרמטר** - מרשימת הפרמטרים הזמינים בסכמה
2. **הגדרת תנאי** - סוג התנאי (threshold, range, consecutive, etc.)
3. **הגדרת סף** - ערך הסף והאופרטור (גדול מ-, קטן מ-, בין)
4. **הגדרת היקף** - זנבות, שלבי טיסה, תאריכים (אופציונלי)
5. **הרצת Backtest** - בדיקה על נתונים היסטוריים

---

## Backtest דינמי

### דרישות
הבדיקה חייבת לרוץ על נתוני טיסות שנטענו למערכת (לא mock data).

### פלט הבדיקה
```typescript
interface BacktestResult {
  totalTests: number;      // מספר הטיסות שנבדקו
  truePositives: number;   // זיהויים נכונים
  falsePositives: number;  // אזעקות שווא
  falseNegatives: number;  // פספוסים
  trueNegatives: number;   // שליליים נכונים
  precision: number;       // דיוק (0-1)
  recall: number;          // כיסוי (0-1)
  f1Score: number;         // F1 Score
  examples: Example[];     // דוגמאות מפורטות
}
```

### סף איכות מומלץ
- **Precision** ≥ 70% - הכלל מדויק מספיק
- **Recall** ≥ 50% - הכלל מזהה מספיק מקרים

---

## Governance Flow

### מצבי כלל (Rule Status)
```
draft → pending_approval → active
  ↓           ↓              ↓
rejected    paused      deprecated
```

### תהליך האישור

| שלב | סטטוס | פעולה נדרשת |
|-----|--------|------------|
| 1 | `draft` | כלל חדש שנוצר ע"י מהנדס |
| 2 | `pending_approval` | הוגש לאישור |
| 3 | `active` | אושר ע"י מהנדס בכיר |

### הרשאות
- **טכנאי**: צפייה בכללים פעילים בלבד
- **מומחה**: צפייה + הצעת כללים חדשים
- **מהנדס**: יצירה + עריכה + אישור
- **מפקד**: צפייה + דוחות

---

## סכמת הנתונים

### פרמטרים זמינים ליצירת כללים

**מנוע (Engine):**
- `egt_celsius` - טמפרטורת גזי פליטה
- `engine_rpm` - סל"ד מנוע
- `oil_pressure_psi` - לחץ שמן
- `oil_temp_celsius` - טמפרטורת שמן
- `fuel_flow_lph` - צריכת דלק

**הידראוליקה (Hydraulics):**
- `hydraulic_pressure_psi` - לחץ הידראולי
- `hydraulic_temp_celsius` - טמפרטורת נוזל

**מבנה (Structure):**
- `g_load` - עומס G
- `aoa_degrees` - זווית תקיפה
- `airspeed_kts` - מהירות אוויר

**בלמים (Brakes):**
- `brake_temp_celsius` - טמפרטורת בלמים
- `brake_pressure_psi` - לחץ בלימה

---

## שימוש ב-API

### יצירת כלל חדש
```typescript
const newRule = {
  name: 'כלל חדש',
  description: 'תיאור הכלל',
  conditions: [{
    parameter: 'egt_celsius',
    type: 'threshold',
    value: '650',
    operator: 'greater_than'
  }],
  scope: {
    tailNumbers: ['123', '124'], // אופציונלי
    phases: ['takeoff', 'climb']  // אופציונלי
  },
  severity: 'high',
  riskMatrix: {
    severity: 8,
    probability: 5
  }
};

// הכלל נשמר כ-Draft
createRule(newRule);
```

### הגשה לאישור
```typescript
submitForApproval(ruleId, userId);
```

### אישור כלל (מהנדס בכיר בלבד)
```typescript
approveRule(ruleId, approverUserId);
```

---

## חיבור ל-Compliance Engine

| Rule (חריגה) | Requirement (עמידה) |
|--------------|---------------------|
| מוגדר ידנית ב-Composer | מיובא מספרות + Bulk Import |
| Backtest על דאטה היסטורי | Compliance check על evidence |
| Output: Finding | Output: ComplianceResult → Finding |

---

## דוגמת קוד - Backtest דינמי

```typescript
const runDynamicBacktest = (conditions, flights) => {
  let truePositives = 0;
  let falsePositives = 0;
  
  flights.forEach(flight => {
    for (const condition of conditions) {
      const values = flight.records.map(r => r[condition.parameter]);
      const threshold = parseFloat(condition.value);
      
      const hasViolation = values.some(v => {
        switch (condition.operator) {
          case 'greater_than': return v > threshold;
          case 'less_than': return v < threshold;
          default: return false;
        }
      });
      
      // Update confusion matrix based on known issues
      if (hasViolation && hasKnownIssue(flight)) truePositives++;
      if (hasViolation && !hasKnownIssue(flight)) falsePositives++;
    }
  });
  
  return {
    precision: truePositives / (truePositives + falsePositives),
    // ...
  };
};
```

---

## סיכום סטטוס

| פריט | סטטוס |
|------|--------|
| יצירה מתבנית | ✅ מוכן |
| יצירה מאפס | ✅ מוכן |
| בחירת פרמטר מ-Schema | ✅ מוכן |
| Backtest דינמי | ✅ מוכן |
| שמירה כ-Draft | ✅ מוכן |
| תהליך Review/Approval | ✅ מוכן |
