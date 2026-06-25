# צילום מסך אוטומטי של כל עמודי האפליקציה

הסקריפט `screenshot-app.mjs` מצלם אוטומטית את כל עמודי LAWDin לתיקייה אחת, כדי לשתף עם הצוות.

האפליקציה היא Single Page App ללא כתובת URL נפרדת לכל עמוד, והכניסה היא Magic Link (ללא סיסמה). לכן התהליך הוא בשני שלבים: התחברות חד פעמית ששומרת את ה-session, ואז צילום של כל העמודים.

## דרישות מקדימות

יש להריץ הכל מתוך תיקיית `ldr/web`, ממחשב שיש לו גישה ל-Supabase (לא מסביבת ה-cloud של Claude שחסומה).

```bash
cd ldr/web
npm install
npm i -D playwright
npx playwright install chromium
```

## הרצה

1. הפעל את שרת הפיתוח בטרמינל נפרד:
   ```bash
   npm run dev
   ```
   (השרת עולה ב-`http://localhost:5173`.)

2. התחברות חד פעמית. ייפתח חלון דפדפן, הקלד בו את המייל שלך והתחבר דרך ה-Magic Link שמגיע למייל. הסקריפט ימתין עד שתסיים (עד 10 דקות) וישמור את ה-session:
   ```bash
   npm run shots:login
   ```

3. צילום כל העמודים:
   ```bash
   npm run shots:capture
   ```

התמונות נשמרות בתיקיית `screenshots/`. כווץ אותה ל-zip ושלח לצוות.

## הערות

- התחבר עם משתמש אדמין (כמו `avraham@lalum.co`) כדי שגם עמוד ה-⚙ אדמין ייכלל.
- מצלמים על רזולוציית מסך רחב (1440 על 900) באיכות גבוהה (deviceScaleFactor 2).
- אם ה-session פג, הרץ שוב את `npm run shots:login`.
- קובץ ה-session (`scripts/.auth-state.json`) ותיקיית `screenshots/` אינם נכנסים ל-Git (ראה `.gitignore`), כי הם מכילים טוקן אישי ותמונות.

## הגדרות (אופציונלי, דרך משתני סביבה)

| משתנה | ברירת מחדל | תיאור |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:5173` | כתובת האפליקציה הרצה (אפשר להפנות לכתובת פרודקשן) |
| `OUT_DIR` | `screenshots` | תיקיית הפלט |
| `STATE` | `scripts/.auth-state.json` | מיקום קובץ ה-session |
