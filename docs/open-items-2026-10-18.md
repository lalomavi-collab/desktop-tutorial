# משימות פתוחות והוראות סגירה (18.10.2026)

מה שהסשן יכול היה לסגור נסגר. מה שנשאר דורש הרשאה, גישה או החלטה שלך. לכל פריט: מה זה, למה נתקע, ואיך סוגרים. הקישורים הם נקודות מוצא, ויש לוודא מול הממשק החי.

## א. לבצע אתה (פקודה או לחיצה)

### 1. פריסת `lalum-assistant` עם הגבלת הקצב והמונה (דחוף, אבטחה)
- **בעיה:** הפונקציה החיה ציבורית לגמרי וללא מונה. הגבלת הקצב ממוזגת ב-[PR 1002](https://github.com/lalomavi-collab/desktop-tutorial/pull/1002), והמונה ו-31 הרשומות המסונכרנות ב-PR 1003. **יש לפרוס אחרי מיזוג 1003**, ואז הפריסה כוללת את שניהם. הנתונים בפונקציה החיה ישנים: אין בהם את הפסיקה שנוספה ב-987.
- **איך:** מהמחשב שלך, בתיקיית `lalum-app`: `supabase functions deploy lalum-assistant --no-verify-jwt`. מדריך: https://supabase.com/docs/guides/functions/deploy
- **בדיקה:** [לוח הפונקציות](https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions) יציג גרסה חדשה (מעל 58). שלח 31 הודעות מהירות מדפדפן אנונימי: ההודעה ה-31 צריכה להחזיר שגיאה.

### 2. אישור טלגרם לפניות מהאתר
- **מצב:** בבדיקה החיה סומן `notified_at`, כלומר ה-API של טלגרם החזיר הצלחה, והסודות מוגדרים. נותר רק שתאשר שההודעה "ליד חדש מהאתר" הגיעה לצ׳אט שלך.
- **איך:** בדוק בצ׳אט הטלגרם שלך הודעה "ליד חדש מהאתר". אם אין: [סודות הפונקציות](https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets) חייבים לכלול `TELEGRAM_BOT_TOKEN` ו-`TELEGRAM_CHAT_ID`. הרשמה לבוט: שלח לו הודעה ראשונה בעצמך.

### 3. פוסט 016
- **מצב:** הרצה יבשה של 016 ב-18.10 [נכשלה](https://github.com/lalomavi-collab/desktop-tutorial/actions/runs/39168589920) והסיבה ברורה: `[Facebook] skipped, missing: FACEBOOK_ACCESS_TOKEN`. הסקריפט יוצא בשגיאה כשאין מה לפרסם, גם ב-dry run. כך נכשלה גם הריצה מ-17.10. תוכן 016 עצמו תוקן ב-PR 981.
- **איך לסגור:** או (א) להוסיף ב-[Secrets של הריפו](https://github.com/lalomavi-collab/desktop-tutorial/settings/secrets/actions) את `FACEBOOK_PAGE_ID`, `FACEBOOK_ACCESS_TOKEN`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN` ([Facebook Pages API](https://developers.facebook.com/docs/pages-api/getting-started), [LinkedIn Posts API](https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api)) ואז להריץ [את ה-workflow](https://github.com/lalomavi-collab/desktop-tutorial/actions/workflows/publish_post.yml), או (ב) לפרסם ידנית את הטקסט והתמונות מ-`posts/campaign_sept_2026.json` ו-`lalum-app/public/og/016_*`. בכל מקרה: אינסטגרם, טלגרם והוידאו ידנית.

### 4. PR 1003 (הפתיח, הסרת רשומה, מונה)
- [PR 1003](https://github.com/lalomavi-collab/desktop-tutorial/pull/1003) ממוזג. לבדוק את האתר החי אחרי הפריסה האוטומטית של הדף.

## ב. לברר אתה (מידע שרק לך)

### 5. ספקי AI פעילים ותנאי הנתונים
- סוכן החשבוניות משתמש ב-Gemini (`python/agents/invoice-processing/agent.py`), הווידאו היומי ב-Synthesia (`daily-research.yml`), והשיחות הקוליות יכולות לעבור ל-OpenAI.
- **איך:** בדוק ב-[Secrets של הריפו](https://github.com/lalomavi-collab/desktop-tutorial/settings/secrets/actions) אילו מפתחות קיימים (`GEMINI`/`GOOGLE`, `SYNTHESIA_API_KEY`, `OPENAI_API_KEY`). כל מפתח שקיים הוא ספק פעיל.
- **תנאי הנתונים:** [Anthropic, תנאים מסחריים](https://www.anthropic.com/legal/commercial-terms), [Gemini API](https://ai.google.dev/gemini-api/terms). עבור כל ספק: האם הקלט משמש לאימון, כמה זמן נשמר, ומה ההסכם שלך.
- **תוצאה נדרשת:** עדכון `docs/ai-governance/practice-profile.md` ו-`ai-systems.yaml` (מערכות 9 ו-13), ועדכון סעיף 3 במדיניות.

### 6. סעיף ה-AI בהסכם שכר הטרחה
- הדבק את הסעיף. אצליב מול סעיף 3 במדיניות ומול הספקים בפועל.

### 7. מדיניות AI לפרסום
- טיוטה: `docs/ai-governance/ai-policy-draft.he.md`. עבור על כל משפט בסוגריים מרובעים, אשר או מחק, ואמור "מאושר לפרסום". אז אכין עמוד באתר ו-PR לבדיקה.

## ג. החלטות

### 8. PR 987 (פסיקה ורובריקות)
- [PR 987](https://github.com/lalomavi-collab/desktop-tutorial/pull/987) כבר ממוזג (19:24). הרשומה ת״א 30410-10-20 שלא אומתה מפסק הדין עצמו הוסרה ב-PR 1003, בהחלטתך. לאחר המיזוג הרשומה לא תופיע באתר.

### 9. מונה חיפושי הפסיקה בצ׳אט
- נבנה ב-PR 1003: מונה בצד השרת לכל לקוח (גובה יומי: 3 תשובות פסיקה), כך שאי אפשר לעקוף אותו בניקוי ההיסטוריה. נכנס לתוקף רק אחרי פריסה (סעיף 1).

### 10. תרגום לערבית, ספרדית וצרפתית
- דובר שפה צריך לקרוא: כותרת הפתיח, משפט המשנה, שורות המטריצה, ארבע הלשוניות, פתיח הצ׳אט, וטופס הפנייה (כולל נוסח ההסכמה). לשלוח לו את `src/lib/strings/{ar,es,fr}.ts` (שדות `heroH1a`, `heroH1b`, `heroSub`, `heroRows`, `tabs`, `chat.greeting`) ואת `src/lib/leadStrings.ts`.

### 11. חשיפה לאירופה (חלק 2 בראיון)
- ציינת "מעט מאוד" לקוחות. אם יש לקוח או עסקה באירופה, יש לבדוק אם חל GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj וסעיף 50 בחוק ה-AI: https://eur-lex.europa.eu/eli/reg/2024/1689/oj. כל הפניה משפטית מסומנת `[verify]` ודורשת אימות לפי כלל שני המקורות.

## ד. ראיון ה-cold-start
- חלקים 1 עד 6 נענו. נשארו: הערכת השפעה ראשונה (`/ai-governance-legal:aia-generation`), בדיקת ספקים (`/ai-governance-legal:vendor-ai-review`) אחרי סעיפים 5 ו-6, וביקורת שנתית של מלאי המערכות. הקבצים: `docs/ai-governance/`.
