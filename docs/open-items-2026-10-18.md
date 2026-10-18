# משימות פתוחות והוראות סגירה (18.10.2026)

מה שהסשן יכול היה לסגור נסגר. מה שנשאר דורש הרשאה, גישה או החלטה שלך. לכל פריט: מה זה, למה נתקע, ואיך סוגרים. הקישורים הם נקודות מוצא, ויש לוודא מול הממשק החי.

## א. לבצע אתה (פקודה או לחיצה)

### 1. פריסת `lalum-assistant` עם הגבלת הקצב (דחוף, אבטחה)
- **בעיה:** הפונקציה החיה ציבורית לגמרי וללא מונה. התיקון ממוזג ב-[PR 1002](https://github.com/lalomavi-collab/desktop-tutorial/pull/1002) אך לא פרוס.
- **איך:** מהמחשב שלך, בתיקיית `lalum-app`: `supabase functions deploy lalum-assistant --no-verify-jwt`. מדריך: https://supabase.com/docs/guides/functions/deploy
- **בדיקה:** [לוח הפונקציות](https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions) יציג גרסה חדשה (מעל 58). שלח 31 הודעות מהירות מדפדפן אנונימי: ההודעה ה-31 צריכה להחזיר שגיאה.

### 2. אישור טלגרם לפניות מהאתר
- **בעיה:** בבדיקה החיה סומן `notified_at`, כלומר נשלחה הודעה, ולא ראיתי שהגיעה.
- **איך:** בדוק בצ׳אט הטלגרם שלך הודעה "ליד חדש מהאתר". אם אין: [סודות הפונקציות](https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets) חייבים לכלול `TELEGRAM_BOT_TOKEN` ו-`TELEGRAM_CHAT_ID`. הרשמה לבוט: שלח לו הודעה ראשונה בעצמך.

### 3. פוסט 016
- **איך:** [הרצת workflow `publish_post.yml`](https://github.com/lalomavi-collab/desktop-tutorial/actions/workflows/publish_post.yml) עם `016`, תחילה `dry_run` ואז הרצה אמיתית. אינסטגרם, טלגרם והוידאו ידנית.

### 4. מיזוג PR 1003 (הפתיח)
- [PR 1003](https://github.com/lalomavi-collab/desktop-tutorial/pull/1003). לאשר אחרי הצילומים, ולהחליט אם להשאיר את ההחרגות (מטריצה כ"דוגמה", עברית ישרה).

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

### 8. PR 987 (פסיקה ורובריקות, סשן אחר)
- [PR 987](https://github.com/lalomavi-collab/desktop-tutorial/pull/987). הרשומה ת״א 30410-10-20 נקראה מדיווח ולא מסוף פסק הדין, בניגוד לכלל האימות הכפול. **אפשרויות:** להשיג את פסק הדין המלא ולאמת, או להסיר את הרשומה ולמזג את השאר. החלטה שלך.

### 9. מגבלת חיפושי הפסיקה בצ׳אט
- נספרת מהיסטוריה שהלקוח שולח, וקל לעקוף. דורש מונה בצד השרת (למשל בטבלה). אפתח משימה כשתחליט אם זה חשוב.

### 10. תרגום לערבית, ספרדית וצרפתית
- דובר שפה צריך לקרוא: כותרת הפתיח, משפט המשנה, שורות המטריצה, ארבע הלשוניות, פתיח הצ׳אט, וטופס הפנייה (כולל נוסח ההסכמה). לשלוח לו את `src/lib/strings/{ar,es,fr}.ts` (שדות `heroH1a`, `heroH1b`, `heroSub`, `heroRows`, `tabs`, `chat.greeting`) ואת `src/lib/leadStrings.ts`.

### 11. חשיפה לאירופה (חלק 2 בראיון)
- ציינת "מעט מאוד" לקוחות. אם יש לקוח או עסקה באירופה, יש לבדוק אם חל GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj וסעיף 50 בחוק ה-AI: https://eur-lex.europa.eu/eli/reg/2024/1689/oj. כל הפניה משפטית מסומנת `[verify]` ודורשת אימות לפי כלל שני המקורות.

## ד. ראיון ה-cold-start
- חלקים 1 עד 6 נענו. נשארו: הערכת השפעה ראשונה (`/ai-governance-legal:aia-generation`), בדיקת ספקים (`/ai-governance-legal:vendor-ai-review`) אחרי סעיפים 5 ו-6, וביקורת שנתית של מלאי המערכות. הקבצים: `docs/ai-governance/`.
