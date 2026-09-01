# חיבור Search Console (פעם אחת)

המטרה: שהאתר ימשוך בעצמו את נתוני החיפוש שלו כל יום, ושהם יישבו בריפו. אז אפשר לנתח אותם בכל שיחה בלי שאף אחד יחזיק מפתח.

**אל תדביק את המפתח בצ׳אט.** לא כאן ולא בשום שיחה. הוא נכנס ל-GitHub Secrets בלבד. שיחה נשמרת בהיסטוריה, וסביבת העבודה שלי נמחקת בסוף כל סשן, כך שמפתח שיודבק בה גם ייחשף וגם לא ישרוד.

## מה שצריך ממך, חמישה צעדים

### 1. פרויקט ב-Google Cloud

היכנס ל-[console.cloud.google.com](https://console.cloud.google.com). צור פרויקט חדש (או בחר קיים). השם לא משנה, למשל `lalum-seo`.

### 2. הפעלת ה-API

בתפריט: **APIs & Services** ⟵ **Library**. חפש **Google Search Console API** ולחץ **Enable**.

### 3. חשבון שירות

**APIs & Services** ⟵ **Credentials** ⟵ **Create credentials** ⟵ **Service account**.

* שם: `lalum-search-console`
* תפקידים (Roles): **אל תיתן שום תפקיד**. הוא לא צריך הרשאות בענן, רק זהות.
* אחרי היצירה, היכנס לחשבון השירות ⟵ לשונית **Keys** ⟵ **Add key** ⟵ **Create new key** ⟵ **JSON**. יירד קובץ.

בקובץ הזה יש שדה `client_email` שנראה כמו
`lalum-search-console@lalum-seo.iam.gserviceaccount.com`. זו הכתובת לצעד הבא.

### 4. הרשאה ב-Search Console

היכנס ל-[Search Console](https://search.google.com/search-console) ובחר את הנכס `https://lalumapp.com/`.

**Settings** ⟵ **Users and permissions** ⟵ **Add user**:

* Email: אותו `client_email` מהצעד הקודם.
* Permission: **Full**. (גם **Restricted** מספיק לקריאת נתוני ביצועים; אם תעדיף את המצומצם, תן אותו. אם משהו לא יעבוד, זה החשוד הראשון.)

### 5. הסוד ב-GitHub

בריפו: **Settings** ⟵ **Secrets and variables** ⟵ **Actions** ⟵ **New repository secret**.

* Name: `GSC_SERVICE_ACCOUNT_JSON`
* Secret: **כל התוכן של קובץ ה-JSON**, מהסוגר המסולסל הראשון עד האחרון. לא רק המפתח, הקובץ כולו.

זהו. אחרי זה תמחק את הקובץ שהורדת מהמחשב.

## איך יודעים שזה עובד

בריפו: **Actions** ⟵ **Search Console pull** ⟵ **Run workflow**. הריצה אמורה להדפיס משהו כמו:

```
authenticated as lalum-search-console@lalum-seo.iam.gserviceaccount.com
2026-08-04 to 2026-08-29: 412 clicks, 18,930 impressions
1,204 queries, 96 pages, written to data/search-console/2026-08-29.json
```

ומיד אחריה את הדוח עצמו. הנתונים נשמרים ב-`data/search-console/`, ומשם אני קורא אותם.

## אם זה נכשל

הסקריפט מדפיס את הסיבה במקום שגיאה סתומה:

* **`token exchange failed`** ⟵ הסוד אינו קובץ ה-JSON המלא, או שה-API לא הופעל (צעד 2).
* **`This account has no properties`** ⟵ חשבון השירות לא נוסף כמשתמש ב-Search Console (צעד 4). זו הטעות הנפוצה ביותר.
* **`This account can see: ...`** ⟵ הוא נוסף, אבל לנכס אחר. הסקריפט מדפיס בדיוק מה הוא כן רואה; הגדר את זה כ-repository variable בשם `GSC_SITE_URL`.

## מה הצינור עושה

| קובץ | תפקיד |
|------|-------|
| `.github/workflows/search-console.yml` | רץ יומי, קורא את הסוד, מריץ את שני הסקריפטים ומכניס את הנתונים לריפו |
| `lalum-app/scripts/search-console.mjs` | מושך 28 יום של נתונים (שאילתות, עמודים, תאריכים, מדינות) וכותב JSON |
| `lalum-app/scripts/search-console-report.mjs` | קורא את ה-JSON ומפיק את הדוח |
| `data/search-console/` | הנתונים עצמם, מצטברים לאורך זמן |

הסקריפט מבקש הרשאת קריאה בלבד (`webmasters.readonly`). הוא אינו יכול לשנות דבר ב-Search Console.

## מה הדוח עונה עליו

1. **מרחק נגיעה.** שאילתות שכבר מדורגות במקום 5 עד 20. הן במרחק כותרת אחת מעמוד ראשון, וזו התנועה הזולה ביותר שקיימת. בלי הנתונים האלה היא בלתי נראית, כי אף אחד לא מחפש את עצמו במקום 14.
2. **נראה ולא נלחץ.** עמודים עם הרבה הופעות ואחוז הקלקה אפסי. זו לא בעיית דירוג אלא בעיית כותרת ותיאור, והיא נפתרת בעריכה אחת.
3. **ממותג מול נושאי.** כמה מהתנועה היא אנשים שמחפשים את השם, וכמה היא אנשים שמחפשים נושא. הראשון הוא מי שכבר מכיר, השני הוא עבודה חדשה.
4. **שני התחומים.** כל שאילתה נושאית משויכת לנדל״ן, ל-AI או לגישור, כדי להשוות את התנועה בפועל מול המיצוב במקום להניח שהם תואמים.
5. **פורסם ובלתי נראה.** עמוד ב-sitemap בלי אף הופעה בחלון הזמן. או שאינו מאונדקס, או שאינו תחרותי.
