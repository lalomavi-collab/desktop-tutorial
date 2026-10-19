# משימות פתוחות והוראות סגירה (18.10.2026)

מה שהסשן יכול היה לסגור נסגר. מה שנשאר דורש הרשאה, גישה או החלטה שלך. לכל פריט: מה זה, למה נתקע, ואיך סוגרים. הקישורים הם נקודות מוצא, ויש לוודא מול הממשק החי.

## א. לבצע אתה (פקודה או לחיצה)

### 1. פריסת `lalum-assistant` (בוצע ואומת)
- נפרסה גרסה 59 ב-19.10.2026. בדיקת בריאות חיה (`?health=1`) החזירה 31 פסיקות, `rulingsSha` ו-`systemSha` זהים לחישוב המקומי, 2 הודעות לאדם ביום ו-10 ביום לכלל הלקוחות.
- אין צורך בפעולה. לבדיקה עצמית: https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions

### 2. אישור טלגרם לפניות מהאתר
- **מצב:** בבדיקה החיה סומן `notified_at`, כלומר ה-API של טלגרם החזיר הצלחה, והסודות מוגדרים. נותר רק שתאשר שההודעה "ליד חדש מהאתר" הגיעה לצ׳אט שלך.
- **איך:** בדוק בצ׳אט הטלגרם שלך הודעה "ליד חדש מהאתר". אם אין: [סודות הפונקציות](https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets) חייבים לכלול `TELEGRAM_BOT_TOKEN` ו-`TELEGRAM_CHAT_ID`. הרשמה לבוט: שלח לו הודעה ראשונה בעצמך.

### 3. פוסט 016
- **מצב:** הרצה יבשה של 016 ב-18.10 [נכשלה](https://github.com/lalomavi-collab/desktop-tutorial/actions/runs/39168589920) והסיבה ברורה: `[Facebook] skipped, missing: FACEBOOK_ACCESS_TOKEN`. הסקריפט יוצא בשגיאה כשאין מה לפרסם, גם ב-dry run. כך נכשלה גם הריצה מ-17.10. תוכן 016 עצמו תוקן ב-PR 981.
- **איך לסגור:** או (א) להוסיף ב-[Secrets של הריפו](https://github.com/lalomavi-collab/desktop-tutorial/settings/secrets/actions) את `FACEBOOK_PAGE_ID`, `FACEBOOK_ACCESS_TOKEN`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN` ([Facebook Pages API](https://developers.facebook.com/docs/pages-api/getting-started), [LinkedIn Posts API](https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api)) ואז להריץ [את ה-workflow](https://github.com/lalomavi-collab/desktop-tutorial/actions/workflows/publish_post.yml), או (ב) לפרסם ידנית את הטקסט והתמונות מ-`posts/campaign_sept_2026.json` ו-`lalum-app/public/og/016_*`. בכל מקרה: אינסטגרם, טלגרם והוידאו ידנית.

### 4. פתיח דף הבית: הוחזר לגרסה שלפני השיפוץ
- לפי הנחיית הבעלים הוחזר הפתיח (קליפ, כותרת "להגן עליו", ערכת הצבעים והלשוניות הקודמות). השיפוץ המלא נשאר בהיסטוריה ב-[PR 1003](https://github.com/lalomavi-collab/desktop-tutorial/pull/1003) (קומיט `dacf0b9`) וניתן להחזירו. הסרת הרשומה והמונה נשארו.

### 4א. PR 1003 המקורי (הפתיח, הסרת רשומה, מונה)
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
- נבנה ב-PR 1003: מונה בצד השרת לכל לקוח (כל הודעה בצ׳אט נספרת: 2 ביום לאדם ו-10 ביום לכלל הלקוחות יחד), כך שאי אפשר לעקוף אותו בניקוי ההיסטוריה. נכנס לתוקף רק אחרי פריסה (סעיף 1).

### 10. תרגום לערבית, ספרדית וצרפתית
- דובר שפה צריך לקרוא: כותרת הפתיח, משפט המשנה, שורות המטריצה, ארבע הלשוניות, פתיח הצ׳אט, וטופס הפנייה (כולל נוסח ההסכמה). לשלוח לו את `src/lib/strings/{ar,es,fr}.ts` (שדות `heroH1a`, `heroH1b`, `heroSub`, `heroRows`, `tabs`, `chat.greeting`) ואת `src/lib/leadStrings.ts`.

### 11. חשיפה לאירופה (חלק 2 בראיון)
- ציינת "מעט מאוד" לקוחות. אם יש לקוח או עסקה באירופה, יש לבדוק אם חל GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj וסעיף 50 בחוק ה-AI: https://eur-lex.europa.eu/eli/reg/2024/1689/oj. כל הפניה משפטית מסומנת `[verify]` ודורשת אימות לפי כלל שני המקורות.

## ד. ראיון ה-cold-start
- חלקים 1 עד 6 נענו. נשארו: הערכת השפעה ראשונה (`/ai-governance-legal:aia-generation`), בדיקת ספקים (`/ai-governance-legal:vendor-ai-review`) אחרי סעיפים 5 ו-6, וביקורת שנתית של מלאי המערכות. הקבצים: `docs/ai-governance/`.

## ה. הוראות ל-Claude in Chrome (משימות שדורשות אותך)

הדבק כל בלוק כפי שהוא ל-Claude in Chrome. הוא ייעצר ויבקש ממך כל הזנת סוד או אישור. אל תדביק לו ערכי סודות בצ׳אט.

### משימה א. סודות פרסום ופוסט 016
```
פתח https://github.com/lalomavi-collab/desktop-tutorial/settings/secrets/actions
בדוק אילו מהסודות הבאים קיימים: FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN, LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN.
דווח לי רק אילו חסרים. אל תציג ערכים.
לכל סוד חסר, לחץ New repository secret, הזן את השם, ועצור כדי שאני אדביק את הערך בעצמי.
אחרי שהסודות קיימים, פתח https://github.com/lalomavi-collab/desktop-tutorial/actions/workflows/publish_post.yml
לחץ Run workflow, בחר dry_run=true והפעל. המתן לסיום ודווח אם הצליח.
אל תפעיל ריצה אמיתית בלי אישור שלי.
```

### משימה ב. אישור טלגרם
```
פתח את הצ׳אט שלי עם הבוט בטלגרם (web.telegram.org) וחפש הודעה "ליד חדש מהאתר". דווח אם קיימת ומתי.
אם לא קיימת, פתח https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets
ובדוק ששני השמות TELEGRAM_BOT_TOKEN ו-TELEGRAM_CHAT_ID קיימים. דווח רק על השמות.
```

### משימה ג. ספקי AI והסכם שכר הטרחה
```
פתח https://github.com/lalomavi-collab/desktop-tutorial/settings/secrets/actions
רשום אילו שמות קיימים מתוך: GEMINI_API_KEY, GOOGLE_API_KEY, SYNTHESIA_API_KEY, OPENAI_API_KEY. שמות בלבד.
אחר כך פתח https://www.anthropic.com/legal/commercial-terms ו-https://ai.google.dev/gemini-api/terms
וסכם לכל ספק: האם הקלט משמש לאימון, תקופת שמירה, ומה צריך לעשות כדי לבטל אימון. ציין את הציטוט המדויק ואת הכתובת.
```
בסיום, שלח לי בצ׳אט הזה את הרשימה ואת סעיף ה-AI בהסכם שכר הטרחה, ואעדכן את `practice-profile.md`, `ai-systems.yaml` ואת המדיניות.

### משימה ד. בדיקת אתר חי
```
פתח https://lalumapp.com בחלון 390 פיקסלים. ודא: סרגל עליון ישר עם שורת פקודה, פתיח עם הקליפ והכותרת "AI שאפשר להגן עליו.", ושבתחתית יש שבע לשוניות.
בצ׳אט שלח שלוש הודעות. הראשונות שתיים אמורות להיענות, והשלישית אמורה להחזיר: "השירות נמצא כרגע בשלב פיילוט ולכן השימוש בו מוגבל".
דווח מה קרה. אם ההודעה השלישית נענתה, זה כשל.
```
