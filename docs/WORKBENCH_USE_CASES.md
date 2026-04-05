# Flight Analysis Workbench - 3 Use Cases מפורטים

## Use Case #1: ניתוח התחממות מנוע בנחיתה - Engine Temperature Analysis

### הקשר
מהנדס תחזוקה מזהה שבמהלך השבוע האחרון היו 3 דיווחי EGT גבוה בשלב נחיתה.
הוא רוצה לבדוק האם זה קשור למנוע ספציפי או לטייס מסוים.

---

### שלב 1: הגדרת Dataset Scope
**פעולה:**
- המהנדס גורר `tail_number` ל-**Dataset Scope Zone**
- בוחר מתוך dropdown: זנבות 123, 124, 125
- גורר `date` ל-**Dataset Scope Zone**
- מגדיר טווח: 7 ימים אחרונים

**תוצאה:**
המערכת מסננת ומביאה 18 טיסות (6 טיסות לכל זנב).

---

### שלב 2: התמקדות בשלב נחיתה
**פעולה:**
- גורר `phase` ל-**Segment Zone**
- בוחר **Focus Mode**: `LAND` only

**תוצאה:**
המערכת מציגה רק samples מהשלב LAND (30-60 שניות האחרונות של כל טיסה).
בסה"כ ~900 נקודות על פני 18 טיסות.

---

### שלב 3: בחירת צירים ומדדים
**פעולה:**
- גורר `timestamp` ל-**X-Axis Zone**
- גורר `EGT_L` ל-**Y-Series Zone**
- גורר `EGT_R` ל-**Y-Series Zone**
- גורר `EGT_Margin` ל-**Y-Series Zone**

**תוצאה:**
המערכת מיישרת את כל הטיסות על ציר זמן יחסי (T-60sec עד touchdown).
מציגה 3 סדרות × 18 טיסות = 54 קווים (overlapping).

---

### שלב 4: השוואה לפי זנב
**פעולה:**
- גורר `tail_number` ל-**Compare/Breakdown Zone**

**תוצאה:**
המערכת מחלקת את הגרף ל-3 שכבות:
- **Layer 1** (זנב 123): EGT_L, EGT_R, Margin בצבע כחול
- **Layer 2** (זנב 124): בצבע ירוק
- **Layer 3** (זנב 125): בצבע אדום

**Auto-Viz Recommendation:**
> "זוהו 3 קבוצות זנב × 3 מדדים. מומלץ: **Multi-line chart** עם legend.  
> חלופה: **Facet view** - גרף נפרד לכל זנב."

---

### שלב 5: זיהוי הבעיה
**מה רואים בגרף:**
- זנב 123, 124: EGT סביב 850-900°C, Margin ~50°C ✅
- זנב 125: EGT עולה ל-950°C, Margin יורד ל-20°C ⚠️

המערכת מציגה אוטומטית:
- **Threshold band** (EGT limit = 930°C) בצבע אדום מנוקד
- **Violation markers** על 4 נקודות שחצו את הסף בזנב 125

---

### שלב 6: נירמול לאיתור מגמה
**פעולה:**
- לוחץ על **Formula Panel**
- בוחר נוסחה: `Normalize 0-1`
- מסמן target series: `EGT_L`, `EGT_R`
- Display mode: `Overlay`

**תוצאה:**
3 קווים חדשים מנורמלים מופיעים על הגרף (stroke עבה יותר, מנוקד):
- `EGT_L (normalized)` - כחול בהיר
- `EGT_R (normalized)` - ירוק בהיר
- עכשיו ברור שזנב 125 יש **slope חד יותר** = מנוע מתחמם מהר

---

### שלב 7: בדיקת אסימטריה L-R
**פעולה:**
- שינוי נוסחה ל-`Difference (L-R)`
- Target series: `EGT_L`, `EGT_R`
- Display mode: `Overlay`

**תוצאה:**
קו חדש: `EGT_L - EGT_R (delta)`.
- זנב 123, 124: הפרש סביב ±5°C (נורמלי) ✅
- זנב 125: הפרש עולה ל-25°C (מנוע ימין חם יותר) ⚠️

---

### המסקנה ההנדסית
**ממצאים:**
1. זנב 125 – מנוע ימין מתחמם יתר על המידה בנחיתה
2. Margin נמוך (20°C) – מתקרב לגבול
3. אסימטריה L-R חריגה (25°C)

**פעולות:**
- לפתוח investigation על מנוע ימין, זנב 125
- לבדוק Fuel nozzles, Turbine blades
- להגביל טיסות עד בדיקה

---

---

## Use Case #2: השוואת ביצועי צי לאורך זמן - Fleet Trend Analysis

### הקשר
מפקד טכני רוצה לעקוב אחרי בריאות הצי לאורך החודשיים האחרונים.
מטרה: לזהות האם יש זנב שמדרדר או מגמה כללית של התדרדרות.

---

### שלב 1: בחירת Scope רחב
**פעולה:**
- גורר `squadron` ל-**Dataset Scope**
- בוחר: Squadron 117
- גורר `date` ל-**Dataset Scope**
- טווח: 60 ימים אחרונים

**תוצאה:**
המערכת מביאה 240 טיסות (8 מטוסים × ~30 טיסות).

---

### שלב 2: ציר זמן = Flight Index
**פעולה:**
- גורר `flight_index` ל-**X-Axis**
- גורר `peak_egt_per_flight` ל-**Y-Series**
  (זה KPI מחושב = הערך המקסימלי של EGT בכל טיסה)

**תוצאה:**
המערכת מבינה ש-`peak_egt_per_flight` הוא **per-flight metric** (לא per-sample).
**Auto-Viz:**
> "זוהה KPI per-flight על פני זמן. מומלץ: **Line trend chart** עם X=Flight Index."

הגרף מציג קו אחד עם 240 נקודות (טיסה 1 → 240).

---

### שלב 3: פיצול לפי זנב
**פעולה:**
- גורר `tail_number` ל-**Compare/Breakdown Zone**

**תוצאה:**
המערכת מפצלת ל-8 קווים (אחד לכל זנב):
- כל קו = מגמת Peak EGT לאורך 30 הטיסות של אותו זנב
- Legend מציג: "Tail 121, Tail 122, … Tail 128"

---

### שלב 4: הוספת Envelope
**מה המערכת מציגה אוטומטית:**
- **Fleet Average Envelope** (מעטפת ממוצע צי):
  - Upper band: Mean + 2σ
  - Lower band: Mean - 2σ
  - צבע אפור שקוף
- **Threshold line** (EGT limit = 950°C) בצבע אדום

---

### שלב 5: זיהוי חריגות
**מה רואים:**
- 7 זנבות נמצאים בתוך המעטפת ✅
- **זנב 125** (הקו האדום) חורג מהמעטפת החל מטיסה #18
- **זנב 127** מראה עלייה הדרגתית אך עדיין בגבול

המערכת מסמנת אוטומטית:
- **Violation markers** על 12 טיסות של זנב 125 שחרגו
- **Alert badge** ליד Legend: "⚠️ Tail 125 - 12 violations"

---

### שלב 6: Facet View לבדיקה מעמיקה
**פעולה:**
- שינוי Display mode ב-**Compare Zone**: `Facet` (במקום Overlay)

**תוצאה:**
המערכת מציגה **8 גרפים קטנים** (2×4 grid):
- כל גרף = זנב אחד
- עכשיו ברור:
  - זנב 125: slope חד מטיסה 18 ואילך
  - זנב 127: עלייה הדרגתית אך יציבה
  - שאר הזנבות: יציבים

---

### שלב 7: נירמול למגמה נקייה
**פעולה:**
- Formula: `Z-Score`
- Target: `peak_egt_per_flight` (כל הזנבות)
- Display mode: `Replace`

**תוצאה:**
הגרף עובר ל-"Normalized View":
- Y-axis עכשיו = "סטיות תקן מהממוצע"
- זנב 125: +2.5σ → בהדגשה ⚠️
- זנב 127: +1.2σ → עדיין תקין אך שווה מעקב
- שאר הזנבות: בטווח ±1σ ✅

---

### המסקנה ההנדסית
**ממצאים:**
1. זנב 125 – דרדור ברור מטיסה #18 (תאריך: 15/11)
2. זנב 127 – מגמת עלייה, לא דורש פעולה מיידית אך מעקב שבועי
3. שאר הצי – תקין

**פעולות:**
- זנב 125: לפתוח investigation מלאה (רטרוספקטיבית מ-15/11)
- זנב 127: להוסיף ל-watchlist, לבדוק כל שבוע
- לפרסם דוח מצב צי למפקדה

---

---

## Use Case #3: ניתוח Phase-by-Phase - טמפרטורה לפי שלבי טיסה

### הקשר
מהנדס רוצה להבין באילו שלבי טיסה המנוע מתחמם הכי הרבה.
במקום לראות time-series, הוא רוצה **ערך מאוחד לכל שלב** (TO/CLB/CRZ/DESC/LAND).

---

### שלב 1: Dataset Scope
**פעולה:**
- גורר `tail_number` ל-**Dataset Scope**
- בוחר: זנב 123
- גורר `date`: 30 ימים אחרונים

**תוצאה:**
המערכת מביאה 25 טיסות.

---

### שלב 2: הפעלת Phase-View Mode
**פעולה:**
- גורר `phase` ל-**X-Axis Zone** (!)
  (זה שונה מהמקרים הקודמים – Phase הופך להיות ציר קטגורי)

**תוצאה:**
המערכת מזהה שזה Phase-View ומציגה **Alert**:
> "⚠️ Phase-View Mode מופעל.  
> X-Axis הוא עכשיו שלבי טיסה (קטגוריה).  
> Y-Series יאוחד לערך אחד לכל שלב (max/avg/min לפי הגדרה)."

---

### שלב 3: בחירת מדדים
**פעולה:**
- גורר `EGT` ל-**Y-Series**
- גורר `N1` ל-**Y-Series**

**תוצאה:**
המערכת מציגה **Bar Chart**:
- X-Axis: `TO | CLB | CRZ | DESC | LAND` (5 עמודות)
- Y-Axis: טמפרטורה (°C)
- כל עמודה = **Peak EGT** באותו שלב (ממוצע על פני 25 טיסות)
- Bar נוסף (צבע שונה) = **Avg N1** באותו שלב

**Auto-Viz:**
> "זוהה Phase-View עם 2 מדדים. מומלץ: **Grouped Bar Chart**."

---

### שלב 4: השוואה לפי Engine
**פעולה:**
- גורר `engine_id` ל-**Compare Zone**
  (נניח שיש שדה שמפריד בין Left/Right)

**תוצאה:**
המערכת מפצלת כל עמודה ל-2:
- עמודה כחולה = EGT_L per Phase
- עמודה אדומה = EGT_R per Phase

עכשיו רואים:
- **TO**: L=920°C, R=925°C (הפרש קטן) ✅
- **CLB**: L=900°C, R=905°C ✅
- **CRZ**: L=850°C, R=850°C ✅
- **DESC**: L=800°C, R=810°C ✅
- **LAND**: L=950°C, R=980°C (הפרש 30°C!) ⚠️

---

### שלב 5: Drill-down לשלב LAND
**פעולה:**
- לוחץ על עמודת **LAND** בגרף
- המערכת מציעה: "🔍 Drill into LAND phase (time-series view)"
- מאשר

**תוצאה:**
המערכת עוברת ל-**Time-Series View** עבור LAND בלבד:
- X-Axis חוזר להיות `timestamp` (T-60 → T0)
- Y-Series: `EGT_L`, `EGT_R`
- **Phase Zone** מתעדכן ל-`Focus: LAND`
- המערכת מציגה את כל 25 הטיסות overlapped בשלב LAND

---

### שלב 6: נוסחה - יחס EGT/N1
**פעולה:**
- חוזר ל-Phase-View (לוחץ "Back to Phase-View")
- Formula Panel: `Ratio`
- Target: `EGT / N1`
- Display mode: `Overlay`

**תוצאה:**
בר חדש (צבע סגול) מופיע על הגרף:
- שם: `EGT/N1 Ratio`
- ערכים לפי Phase:
  - TO: 18.4
  - CLB: 16.2
  - CRZ: 14.8
  - DESC: 14.1
  - **LAND: 19.7** (הכי גבוה!) ⚠️

זה מראה שבנחיתה המנוע עובד קשה (EGT גבוה) אך לא מייצר thrust פרופורציונלי (N1 נמוך יחסית).

---

### שלב 7: יצוא תוצאות
**פעולה:**
- לוחץ על "📊 Export Phase Summary"
- המערכת יוצרת טבלה:

| Phase | Avg EGT_L | Avg EGT_R | Delta L-R | Avg N1 | EGT/N1 Ratio |
|-------|-----------|-----------|-----------|--------|--------------|
| TO    | 920       | 925       | -5        | 95%    | 18.4         |
| CLB   | 900       | 905       | -5        | 92%    | 16.2         |
| CRZ   | 850       | 850       | 0         | 88%    | 14.8         |
| DESC  | 800       | 810       | -10       | 85%    | 14.1         |
| LAND  | 950       | 980       | **-30**   | 90%    | **19.7**     |

---

### המסקנה ההנדסית
**ממצאים:**
1. **LAND Phase** – מנוע ימין מתחמם יותר (980°C vs 950°C)
2. יחס EGT/N1 הכי גבוה בנחיתה (19.7) – מנוע לא יעיל
3. אסימטריה L-R חריגה בנחיתה בלבד (-30°C)

**פעולות:**
- לבדוק fuel nozzles במנוע ימין
- לבחון הגדרות Thrust Reverser (ייתכן שמפעיל לא אחיד)
- לבצע Ground test עם focus על Landing power settings

---

---

## סיכום הדרישות הטכניות מ-3 ה-Use Cases

### תכונות שחייבות להתממש:

#### 1. Role-Based Drag & Drop
- ✅ `dataset_attr` → רק ל-Dataset Scope / Compare
- ✅ `segment` → רק ל-Segment Zone / X-Axis (למצב Phase-View)
- ✅ `axis_candidate` → רק ל-X-Axis
- ✅ `measurement` → רק ל-Y-Series

#### 2. Phase Handling
- ✅ **Overlay Mode**: Phase כרקע צבעוני על time-series
- ✅ **Focus Mode**: הצגת samples רק משלב אחד
- ✅ **Split Mode**: גרף נפרד לכל Phase
- ✅ **Phase-View Mode**: Phase כ-X-Axis (aggregate per phase)

#### 3. Auto-Viz Recommender
- ✅ Time + Measurement → Line chart
- ✅ Phase-View → Bar/Grouped bar chart
- ✅ Compare by Tail → Multi-line / Facet
- ✅ Per-flight KPI + FlightIndex → Trend line
- ✅ זיהוי אוטומטי של סוג הדאטה (per-sample vs per-flight)

#### 4. Automatic Overlays
- ✅ Threshold bands
- ✅ Fleet envelopes (Mean ± 2σ)
- ✅ Violation markers
- ✅ Event/maintenance markers
- ✅ Alert badges בlegend

#### 5. Formula Stage (Post-Processing)
- ✅ Normalize 0-1
- ✅ Z-Score
- ✅ Ratio (EGT/N1)
- ✅ Difference (L-R)
- ✅ Unit conversion
- ✅ Display modes: Overlay / Replace
- ✅ עובד על BaseSeries (אחרי כל הפילטרים)

#### 6. Compare & Breakdown
- ✅ Multi-line layers (Tail/Engine)
- ✅ Facet view (small multiples)
- ✅ Legend עם status badges
- ✅ Drill-down (מ-Phase-View ל-Time-Series)

#### 7. Export & Documentation
- ✅ יצוא טבלת סיכום
- ✅ שמירת View configuration
- ✅ צילום מסך + annotations

---

## מה לא נדרש ב-MVP

- ❌ Sandbox/Draft mode
- ❌ שמירת נוסחאות כ-Metrics רשמיים
- ❌ Promote/Versioning
- ❌ Backfill היסטורי
- ❌ שיתוף Views עם permissions
- ❌ Real-time updates
- ❌ חיבור ל-Maintenance System לפתיחת Task אוטומטית

---

## בדיקות קבלה (Acceptance Criteria)

אחרי המימוש, המערכת צריכה לאפשר למהנדס:

1. ✅ לשחזר **Use Case #1** (Engine + Landing) ב-7 דקות
2. ✅ לשחזר **Use Case #2** (Fleet Trend) ב-5 דקות
3. ✅ לשחזר **Use Case #3** (Phase-by-Phase) ב-6 דקות
4. ✅ לזהות violation אוטומטית ב-3 clicks
5. ✅ להפעיל נוסחה על גרף קיים ב-2 clicks
6. ✅ לעבור בין Overlay → Facet → Phase-View בלחיצה אחת
7. ✅ לייצא סיכום לטבלה/CSV ללא עריכה ידנית

---

זה מכסה את כל מה שצריך כדי לממש את ה-Workbench החדש! 🚀
