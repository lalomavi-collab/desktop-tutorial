# LAWDin — חזית האפליקציה

אפליקציית React + Vite + TypeScript ל-**LAWDin** (Professional Social Network for Attorneys Only), מחוברת ל-Supabase
(Auth + Postgres + RLS). עיצוב **Prestige Executive**, RTL מלא בעברית.

## הרצה מקומית

```bash
cd ldr/web
npm install
npm run dev        # http://localhost:5173
```

קובץ `.env` כבר מוגדר עם פרטי ה-Supabase (מפתח publishable — בטוח לחשיפה בדפדפן;
ה-RLS הוא שמגן על המידע).

## הצטרפות חברים (Easy Join)

- כניסה ב-**Magic Link**: המשתמש מקליד מייל ומקבל קישור כניסה חד-פעמי (ללא סיסמה).
- **לינקי הזמנה**: ממסך "הזמנות" מייצרים `?invite=<token>` לשליחה לקולגות.
- **שיתוף משרד**: עו"ד יוצר "משרד" ומזמין קולגה — לכיסוי הדדי (`visibility = firm`).

> ⚙️ **חשוב לפני שליחה לחברים:** ב-Supabase → Authentication → URL Configuration
> יש להוסיף את כתובת הפריסה (וגם `http://localhost:5173`) ל-**Redirect URLs**,
> אחרת קישור ה-Magic Link לא יחזיר את המשתמש לאפליקציה.

## אבטחת מידע

- 🔐 **Zero-Knowledge בצד הלקוח** — `src/lib/anonymizer.ts` משחיר ישויות וממיר סכומים
  לטווחים *לפני* כל שליחה. רק `proposed_strategy` נקי נשמר.
- 🛡️ **RLS על כל טבלה** — משתמש רואה רק: תיקים שלו, תיקי המשרד שלו, ותיקים קהילתיים.
- 🔒 **בידוד פונקציות SECURITY DEFINER** — פונקציות העזר וה-triggers יושבות בסכמה `private`
  שאינה נחשפת ב-REST/RPC, כך שלא ניתן לקרוא להן ישירות מה-API (אומתה ב-Supabase advisors).
- 🪪 **כניסה ללא סיסמה** — Magic Link (OTP) בלבד, אין סיסמאות לאחסן או לדלוף.
- 🎁 **השקה חינמית** — בשלב זה הגישה הקהילתית פתוחה ומלאה לבניית קהילה. שכבת ה-reciprocity
  (גישה תמורת תרומה) קיימת ב-DB (`contribution_count`, `reputation`) ומוכנה להפעלה בהמשך.

## פריסה (כדי שחברים יוכלו להיכנס מכל מקום)

```bash
npm run build      # יוצר dist/
```
פרסו את `dist/` לכל אחסון סטטי (Vercel / Netlify / Cloudflare Pages / Firebase Hosting),
והוסיפו את הכתובת ל-Redirect URLs ב-Supabase.

## מבנה

```
src/
  lib/
    supabase.ts     # client + טיפוסים + תוויות בעברית
    anonymizer.ts   # גבול ה-Zero-Knowledge (client-side)
    riskEngine.ts   # Risk Score לתצוגה מיידית
  components/
    Auth.tsx        # נחיתה + Magic Link + הזמנה
    Dashboard.tsx   # חדר ההחלטות + הצבעת עמיתים
    NewCase.tsx     # הגשת תיק עם אנונימיזציה חיה
    Invite.tsx      # הזמנות, משרד, מוניטין
  App.tsx           # session, ניווט, קבלת הזמנות
```
