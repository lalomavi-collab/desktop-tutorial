# משימות פתוחות והוראות סגירה (18.10.2026)

מה שהסשן יכול היה לסגור נסגר. מה שנשאר דורש הרשאה, גישה או החלטה שלך. לכל פריט: מה זה, למה נתקע, ואיך סוגרים. הקישורים הם נקודות מוצא, ויש לוודא מול הממשק החי.

## סטטוס סוף יום, 19.10.2026

**נסגר ואומת חי:** `lalum-assistant` v63 (31 פסיקות, התחברות חובה, 2 ו-10), `lalum-whatsapp-webhook` v31 (פרטיות, מגבלת שולח, בקשת מחיקה), `lalum-lead` v32 ו-`lalum-lead-submit` v3 (תקרות), `analyze-contract` ו-`compare-contracts` v26 (תקרה יומית 30). מסד: מיגרציות 0051 עד 0055 (שמירה 30 יום, פלייבוקים ותצ׳אט קבוצתי לחברי משרד, היפוך נאמנות). הערכות השפעה למערכות 1 ו-4, סקירת ספקים, בדיקת אבטחה (`docs/security-check-2026-10-19.md`).

**נשאר, רק אתה (הוראות Chrome בסעיף ו׳):**
1. אישור שמפתח Anthropic שייך לארגון API.
2. Gemini: פעיל? בפרויקט עם חיוב?
3. Synthesia: איזו גרסת DPA חלה, והאווטאר שלך.
4. הגנת סיסמאות דלופות ב-Supabase.
5. בדיקת הודעת וואטסאפ ראשונה אמיתית.
6. טלגרם, סודות פרסום ופוסט 016, סעיף ה-AI בהסכם, אישור מדיניות AI ונוסח ההסכמה, דוברי שפה (ar, es, fr), וניקוי מיזוג מקומי בתיקייה הישנה.
7. `pii-gateway`: דרישת טוקן ל-`/health?deep=1` (הקוד אינו בריפו הזה).

## א. לבצע אתה (פקודה או לחיצה)

### 1. פריסת `lalum-assistant` (דחוף: הגרסה החיה ללא פסיקות)
- **מצב ב-19.10.2026:** בגרסה החיה (62) מאגר הפסיקות ריק (`rulings: 0`). העוזר לא ימציא פסיקה, אבל גם לא יצטט את 31 הרשומות המאומתות. הקוד בריפו תקין. הסיבה: פריסה דרך הממשק הידני של Supabase לא העבירה את קובץ הפסיקות המלא.
- **תיקון (כשלושים שניות), מהמחשב שלך בתיקיית הריפו:** `cd lalum-app && supabase functions deploy lalum-assistant --no-verify-jwt`. מדריך: https://supabase.com/docs/guides/functions/deploy
- **בדיקה:** פתח `https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-assistant?health=1`. התוצאה התקינה: `rulings` ‏31, `rulingsSha` שמתחיל ב-`fc8f566c`.
- הגרסה כוללת גם: חובת התחברות לעוזר, מגבלת 2 לאדם ו-10 ביום.
- **אותו דבר ל-WhatsApp:** `supabase functions deploy lalum-whatsapp-webhook --no-verify-jwt` (בוצע ב-19.10 עד גרסה 30; יש לפרוס שוב אחרי מיזוג PR של שורת הפרטיות, ההגבלה לשולח ובקשת המחיקה).

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

## ו. הוראות ל-Claude in Chrome: אישורי חשבונות ואבטחה

### משימה ה. סוג חשבון Anthropic
```
פתח https://console.anthropic.com/settings/organization
דווח לי: שם הארגון, וסוג החשבון (Organization / Individual).
פתח https://console.anthropic.com/settings/privacy (או Settings, Privacy) ודווח אם מופיעה הגדרת Data retention.
אל תשנה דבר ואל תציג מפתחות.
```
תקין אם זה ארגון API תחת Commercial Terms.

### משימה ו. Gemini
```
פתח https://aistudio.google.com/app/apikey
רשום לכל מפתח: שם, והפרויקט ב-Google Cloud שאליו הוא מקושר. אל תציג את ערכי המפתחות.
לכל פרויקט פתח https://console.cloud.google.com/billing ודווח אם יש חשבון חיוב פעיל מקושר.
אם אין מפתחות, דווח "אין".
```

### משימה ז. Synthesia
```
פתח https://app.synthesia.io/#/settings (הגדרות החשבון) ודווח: סוג התוכנית, תאריך פתיחת החשבון, ואם מופיע קישור ל-DPA או Data Processing Agreement, את תאריך הגרסה.
דווח אם האווטאר ברשימה הוא אווטאר אישי (Personal Avatar) ושל מי.
אל תשנה דבר.
```

### משימה ח. הגנת סיסמאות דלופות
```
פתח https://supabase.com/dashboard/project/meoymkcotomoluwlwues/auth/providers
ב-Email, אתר את ההגדרה Prevent use of leaked passwords. דווח אם היא זמינה במסלול שלי ואם היא פעילה.
אם היא זמינה וכבויה, הדלק אותה ושמור. אם אינה זמינה, דווח "לא זמינה במסלול".
```

### משימה ט. הודעת וואטסאפ ראשונה
שלח הודעה כלשהי לבוט הוואטסאפ של המשרד ממספר שלא שוחח איתו. בדוק שבתשובה הראשונה מופיעים: גילוי שזה עוזר דיגיטלי מבוסס בינה מלאכותית, הודעת הפרטיות (30 יום, ספק חיצוני, בקשת מחיקה), והבקשה לא לשלוח מספרי זהות או מסמכים סודיים.

### משימה י. פוסט 016 (פרסום בפייסבוק ובלינקדאין)
לפי הנוהל בריפו, שום פוסט לא מפורסם לפני שאתה כותב "מאושר" בצ׳אט עם Claude Code. ההוראה ל-Chrome מכינה הכול ומריצה רק dry run.
```
1. פתח https://github.com/lalomavi-collab/desktop-tutorial/settings/secrets/actions
   רשום לי אילו מהשמות הבאים קיימים (שמות בלבד, בלי ערכים): FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN, LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN.
2. לכל סוד חסר, הוסף אותו כך (עצור ובקש ממני להדביק את הערך, אל תנחש):
   - FACEBOOK_PAGE_ID: פתח את עמוד העסק בפייסבוק, About, Page transparency, Page ID.
   - FACEBOOK_ACCESS_TOKEN: פתח https://developers.facebook.com/tools/explorer/ , בחר את האפליקציה, User or Page = Page access token של העמוד, הרשאות pages_manage_posts ו-pages_read_engagement. הפק טוקן ארוך טווח לפי https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/
   - LINKEDIN_ACCESS_TOKEN ו-LINKEDIN_AUTHOR_URN: לפי https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api . ה-URN הוא urn:li:person:<id> או urn:li:organization:<id>.
   להוספה: New repository secret, שם, ערך, Add secret.
3. פתח https://github.com/lalomavi-collab/desktop-tutorial/actions/workflows/publish_post.yml
   לחץ Run workflow, number = 016, סמן dry_run = true, Run workflow.
4. המתן לסיום ופתח את הריצה. דווח לי: הצלחה או כישלון, ואת שורת ה-Facebook ושורת ה-LinkedIn מהפלט (הצלחה, או skipped ואיזה סוד חסר).
5. אל תריץ בלי dry_run. אל תפרסם.
```
אחרי שה-dry run עבר, כתוב לי כאן "016 מאושר". אז אריץ או אכין לך את ההרצה האמיתית. אינסטגרם, טלגרם והוידאו נשארים ידניים, כמו בסעיף 3 למעלה.
