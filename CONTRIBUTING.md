# מדריך עבודת צוות (Contributing)

מסמך זה מסביר איך מתכנת חדש מתחיל לעבוד על אפליקציית **LAWDin** ואיך עובדים יחד בלי לשבור את הפרודקשן.

## מה צריך להתקין מראש

- **Node.js** גרסה 18 ומעלה (מומלץ 20).
- **npm** (מגיע עם Node).
- חשבון **GitHub** עם הרשאת Write על הריפו.
- חשבון **Supabase** עם הזמנה לפרויקט (תפקיד Developer).

## הרצה מקומית של חזית האפליקציה

האפליקציה נמצאת בתיקייה `ldr/web`.

```bash
cd ldr/web
npm install
npm run dev
```

האפליקציה תעלה בכתובת `http://localhost:5173`.

### משתני סביבה


כדי להתחיל, העתיקו את קובץ הדוגמה ומלאו בו את הערכים שלכם:

```bash
cp .env.example .env
```
יש ליצור קובץ `.env` בתוך `ldr/web` (יש דוגמה ב-`.env.example`):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```

את הערכים מקבלים מ-Supabase: Project Settings, ואז API. המפתח הוא publishable (anon), בטוח לחשיפה בדפדפן כי שכבת ה-RLS היא שמגנה על המידע. אין להכניס לקובץ זה מפתחות service_role או סודות אחרים.

חשוב: ב-Supabase תחת Authentication, ואז URL Configuration, יש לוודא ש-`http://localhost:5173` נמצא ברשימת ה-Redirect URLs, אחרת קישור ה-Magic Link לא יחזיר אתכם לאפליקציה.

## סקריפטים שימושיים

| פקודה | מה היא עושה |
| --- | --- |
| `npm run dev` | מריץ שרת פיתוח מקומי על פורט 5173 |
| `npm run build` | בונה גרסת פרודקשן לתיקייה `dist/` |
| `npm run preview` | תצוגה מקומית של תוצר ה-build |

לפני פתיחת Pull Request, ודאו ש-`npm run build` עובר בלי שגיאות (הוא מריץ גם בדיקת טיפוסים של TypeScript).

## תהליך העבודה (Git Flow)

1. עדכנו את `main` המקומי: `git checkout main && git pull`.
2. פתחו branch חדש לכל משימה: `git checkout -b feature/<תיאור-קצר>`.
3. בצעו commits קטנים וברורים תוך כדי העבודה.
4. דחפו את ה-branch: `git push -u origin feature/<תיאור-קצר>`.
5. פתחו **Pull Request** ל-`main` דרך GitHub.
6. בקשו review. רק אחרי אישור אפשר לעשות merge.
7. אין לדחוף ישירות ל-`main`. ה-branch מוגן.

מומלץ למזג בשיטת squash merge, כך שההיסטוריה של main תישאר נקייה.

## מבנה הפרויקט (חזית)

```
ldr/web/src/
  lib/
    supabase.ts     client, טיפוסים, ותוויות בעברית
    anonymizer.ts   גבול ה-Zero-Knowledge בצד הלקוח
    riskEngine.ts   חישוב Risk Score לתצוגה מיידית
  components/
    Auth.tsx        נחיתה, Magic Link, והזמנות
    Dashboard.tsx   חדר ההחלטות והצבעת עמיתים
    NewCase.tsx     הגשת תיק עם אנונימיזציה חיה
    Invite.tsx      הזמנות, משרד, ומוניטין
  App.tsx           ניהול session, ניווט, וקבלת הזמנות
```

## כללי כתיבה

- אין להשתמש בקו מפריד (dash) כסימן פיסוק בקוד, בהערות, או בקבצים שנוצרים. במקום זאת השתמשו בפסיק, נקודה, נקודתיים, או סוגריים. מקף שהוא חלק אינטגרלי ממילה, מזהה, תאריך, או כתובת נשאר כרגיל.
- מסמכים בעברית: כיוון RTL, גופן תומך עברית, וטוקנים לטיניים (כתובות, קוד) נשארים מבודדים LTR.

## אבטחה

- לעולם לא להכניס סודות (service_role, טוקנים, סיסמאות) לקוד או ל-Git. רק משתני סביבה מקומיים.
- שמרו על שכבת ה-RLS. כל טבלה חדשה צריכה policy מתאים.

אם מפתח אמיתי נחשף בטעות, החליפו אותו מיד בלוח הבקרה של Supabase (Rotate) ועדכנו את הקובץ המקומי.
