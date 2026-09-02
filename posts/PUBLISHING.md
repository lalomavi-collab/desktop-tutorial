# פרסום פוסט לרשתות (LinkedIn + Facebook), הדרך האוטומטית

הפרסום עובר דרך GitHub Actions ו-API של הפלטפורמות (לא Zapier), עם הסודות של
הריפו. ההפעלה ידנית בכוונה, כדי ששום דבר לא ייצא לקהל חי בלי בחירה אנושית.

## שלושה צעדים לפוסט חדש

1. **טקסט.** הוסף רשומה חדשה ל-`posts/campaign_sept_2026.json`, ממוספרת (למשל `"016"`),
   עם השדות: `slug`, `he` (פייסבוק), `en` (לינקדאין), `first_comment_he`,
   `first_comment_en`. בלי מקף כסימן פיסוק, לוגו LALUM אחד בלבד.

2. **תמונות.** צור שני כרטיסי 1200x630 והמר ל-PNG לתוך `lalum-app/public/og/`:
   ```
   python3 scripts/render_card.py <card_he.html> lalum-app/public/og/016_<slug>_he.png
   python3 scripts/render_card.py <card_en.html> lalum-app/public/og/016_<slug>_en.png
   ```
   הסקריפט משתמש ב-Chromium המובנה. `scripts/publish_post.py` נכשל אם חסר כרטיס.

3. **פרסום.** אחרי אישור: הרץ את ה-workflow `Publish campaign post (manual, any number)`
   (הקובץ `.github/workflows/publish_post.yml`) והעבר את מספר הפוסט. אפשר קודם
   עם `dry_run` כדי לבנות ולהדפיס בלי לשלוח.

## זרימת האישור (חובה)

טיוטה, תמונות, עמוד תצוגה מקדימה (`posts/preview.html`), ואישור מפורש
("מאושר") לפני הפעלת ה-workflow. מפורט ב-`CLAUDE.md` וב-`.claude/skills/social-posts`.

## בדיקה מקדימה

`dry_run: true` ב-workflow בונה את הפוסט ומדפיס אותו בלי לשלוח, כדי לוודא
שהטקסט והכרטיסים נכונים לפני שמפרסמים באמת.
