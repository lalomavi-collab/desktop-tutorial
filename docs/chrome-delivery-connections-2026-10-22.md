# הוראות ל-Claude in Chrome: השלמת החיבורים לשליחה אוטומטית של מסמכים

מטרה: להשלים את החיבורים שחסרים כדי שכל מסמך שהופק יישלח ללקוח אוטומטית בדוא"ל וב-WhatsApp. הקוד והמיגרציה כבר במערכת (PR 1219), והפונקציות `lalum-fin-doc-send` ו-`lalum-fin-issue` נפרסו ב-22.10.2026.

## כללי ברזל (חלים על כל הבלוקים)

- **סודות לא עוברים דרך Claude.** Claude in Chrome לא קורא, לא מעתיק ולא מציג ערך של מפתח, טוקן או סוד, ואתה לא מדביק לו אחד. בכל שלב שדורש ערך סודי הוא פותח את הטופס, ממלא רק את **שם** הסוד, ועוצר. **אתה** מדביק את הערך ולוחץ שמירה.
- התחברות, אימות דו שלבי ו-CAPTCHA הם שלך. Claude עוצר ומחכה.
- אם עמוד נראה אחרת ממה שמתואר, Claude עוצר ומדווח, ולא מנחש.
- ההפקה האמיתית של מסמך משפטי אינה חלק מהבדיקות כאן (ראו שלב 6).

## מפת הקישורים

| מה | קישור |
|---|---|
| סודות הפונקציות ב-Supabase | https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets |
| רשימת הפונקציות | https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions |
| מפתחות API ב-Resend | https://resend.com/api-keys |
| דומיינים ב-Resend | https://resend.com/domains |
| Webhooks ב-Resend | https://resend.com/webhooks |
| חשבונות WhatsApp Business ב-Meta | https://business.facebook.com/settings/whatsapp-business-accounts |
| משתמשי מערכת (טוקן קבוע) | https://business.facebook.com/settings/system-users |
| מספרי טלפון ב-WhatsApp Manager | https://business.facebook.com/wa/manage/phone-numbers/ |
| תבניות הודעה ב-WhatsApp Manager | https://business.facebook.com/wa/manage/message-templates/ |
| אפליקציות מפתחים ב-Meta | https://developers.facebook.com/apps |

## שלב 0: מצאי, בלי לשנות כלום

```
היכנס לכתובת https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets
אם צריך להתחבר, עצור וחכה לי.

אל תפתח, אל תחשוף ואל תעתיק ערך של אף סוד. אל תלחץ על שום כפתור ששומר, מוחק או משנה.

רשום לי רק את שמות הסודות שקיימים ברשימה, וסמן לגבי כל אחד מהשמות הבאים אם הוא קיים או חסר:

RESEND_API_KEY
LALUM_FROM_EMAIL
LALUM_REPLY_TO
RESEND_DOCSEND_WEBHOOK_SECRET
WHATSAPP_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_DOCUMENT_TEMPLATE
WHATSAPP_DOCUMENT_LANG
WHATSAPP_DUNNING_TEMPLATE_1
WHATSAPP_DUNNING_TEMPLATE_2
WHATSAPP_DUNNING_TEMPLATE_3
WHATSAPP_VERIFY_TOKEN
FIN_INVOICE4U_ENV
INVOICE4U_API_KEY
FIN_INVOICE4U_QA_KEY

החזר טבלה: שם, קיים או חסר. זה הכול.
```

מה המשמעות: כל מה שחסר ברשימה הוא עבודה בשלבים הבאים. `LALUM_FROM_EMAIL` ו-`LALUM_REPLY_TO` רשאים להיות חסרים, יש להם ברירת מחדל בקוד (`LALUM <no-reply@lalumapp.com>` ו-`avraham@lalum.co`).

## שלב 1: דוא"ל (Resend)

```
1. פתח https://resend.com/domains . אם צריך להתחבר, עצור וחכה לי.
   בדוק אם הדומיין lalumapp.com מופיע וסטטוסו Verified. דווח לי על הסטטוס המדויק של כל רשומה (SPF, DKIM) כפי שהוא מופיע. אל תשנה רשומות DNS.
   אם הסטטוס אינו Verified, עצור ודווח.

2. פתח https://resend.com/api-keys . דווח לי רק אם קיים מפתח אחד לפחות עם הרשאת Sending access, לפי השם והתאריך שלו. אל תיצור ואל תחשוף מפתח.

3. פתח https://resend.com/webhooks . בדוק אם קיים webhook שמצביע על:
   https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-fin-doc-send-webhook
   אם קיים, דווח אילו אירועים מסומנים בו ומה סטטוס ההגשות האחרונות שלו.
   אם אינו קיים, צור אותו עם הכתובת הזו והאירועים האלה בלבד:
   email.delivered, email.opened, email.bounced, email.complained
   אחרי היצירה עצור. את ה-Signing secret (מתחיל ב-whsec_) אל תקרא ואל תעתיק. אני אעתיק אותו בעצמי בשלב 2.
```

## שלב 2: הזנת סוד ה-webhook ב-Supabase

```
פתח https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets
לחץ להוספת סוד חדש (Add new secret). מלא רק את השם:
RESEND_DOCSEND_WEBHOOK_SECRET
השאר את שדה הערך ריק, ועצור. אני אדביק את הערך בעצמי ואלחץ שמירה.
אחרי ששמרתי, ודא שהשם מופיע ברשימה. אל תפתח את הערך.
```

אם `RESEND_API_KEY` נמצא חסר בשלב 0: אותו תהליך, עם השם `RESEND_API_KEY`, והערך הוא מפתח חדש שאתה יוצר ב-https://resend.com/api-keys בעצמך (הרשאת Sending access בלבד).

## שלב 3: WhatsApp, איסוף המזהים (Meta)

```
1. פתח https://business.facebook.com/settings/whatsapp-business-accounts . אם צריך להתחבר, עצור וחכה לי.
   דווח לי: שם חשבון ה-WhatsApp Business, מזהה החשבון (WABA ID), והסטטוס שלו.

2. פתח https://business.facebook.com/wa/manage/phone-numbers/ .
   דווח לי: מספרי הטלפון, שם התצוגה של כל אחד וסטטוס האישור שלו, ומזהה המספר (Phone number ID) של המספר שמשמש את המשרד.
   אם שם התצוגה אינו Approved או המספר אינו Connected, עצור ודווח.

3. פתח https://developers.facebook.com/apps , בחר את האפליקציה שמחוברת לחשבון הזה, ועבור ל-WhatsApp, ואז API Setup.
   דווח לי רק אם האפליקציה במצב Live (לא Development). אל תחשוף את הטוקן הזמני שמוצג שם.
```

המזהים (WABA ID ו-Phone number ID) אינם סודות. את Phone number ID תזין בשלב 5.

## שלב 4: WhatsApp, טוקן קבוע

הטוקן הזמני של Meta פג תוך שעות ולכן אינו מתאים. נדרש טוקן של משתמש מערכת. את הטוקן עצמו יוצר ומעתיק **אתה**.

```
פתח https://business.facebook.com/settings/system-users . אם צריך להתחבר, עצור וחכה לי.
בדוק אם קיים משתמש מערכת לשליחת הודעות, ולאילו נכסים הוא מוקצה (חשבון ה-WhatsApp Business והאפליקציה) ובאיזו הרשאה.
דווח לי. אל תיצור טוקן ואל תחשוף טוקן קיים.
הרשאות נדרשות לטוקן: whatsapp_business_messaging ו-whatsapp_business_management.
אם אין משתמש מערכת מתאים, אל תיצור כלום, וכתוב לי מה חסר.
```

אם צריך ליצור: במסך משתמש המערכת, "Generate token", בחר את האפליקציה, סמן את שתי ההרשאות, בלי תפוגה, והעתק למקום מאובטח. הטוקן יוזן בשלב 5.

## שלב 5: הזנת סודות WhatsApp ב-Supabase

```
פתח https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets
עבור כל אחד מהשמות הבאים שחסרים (לפי שלב 0), פתח את טופס הסוד החדש ומלא רק את השם, ואז עצור כדי שאני אדביק את הערך ואשמור, ורק אז עבור לשם הבא:

1. WHATSAPP_TOKEN (הערך: הטוקן הקבוע של משתמש המערכת, אני מדביק)
2. WHATSAPP_PHONE_NUMBER_ID (הערך: מזהה המספר משלב 3, אני מדביק)

אל תקרא ואל תעתיק שום ערך.
```

## שלב 6: WhatsApp, תבנית המסמך

התבנית חייבת אישור Meta. שתי דרכים, בחר אחת.

**דרך א, מהמחשב שלך (מומלצת).** בטרמינל בתיקיית `lalum-app`, כשהמשתנים `WHATSAPP_TOKEN` ו-`WHATSAPP_BUSINESS_ACCOUNT_ID` מוגדרים רק שם:

```
node scripts/whatsapp-dunning-templates.mjs --submit
node scripts/whatsapp-dunning-templates.mjs --status
```

הפקודה מגישה את `lalum_document_sent` ואת שלוש תבניות התזכורת שעוד לא קיימות.

**דרך ב, דרך Claude in Chrome:**

```
פתח https://business.facebook.com/wa/manage/message-templates/ . אם צריך להתחבר, עצור וחכה לי.
בדוק אם קיימת תבנית בשם lalum_document_sent ומה סטטוסה. אם קיימת, דווח ואל תיצור כפולה.
אם אינה קיימת, צור תבנית חדשה בדיוק כך:

שם: lalum_document_sent
קטגוריה: Utility
שפה: Hebrew (he)
כותרת, כותרת תחתונה וכפתורים: אין
גוף ההודעה, בדיוק כך ובשורה אחת:
שלום, ממשרד LALUM נשלח אליך מסמך חדש: {{1}} מספר {{2}}. אפשר לצפות בו ולהוריד אותו בקישור הבא: {{3}} לשאלות אפשר להשיב להודעה זו.

דוגמאות למשתנים (שדה הדוגמה של Meta):
{{1}} = חשבונית מס קבלה
{{2}} = 70145
{{3}} = https://newview.invoice4u.co.il/Views/PDF.aspx?cipher=abc123

שלח לאישור, ודווח לי את הסטטוס (Pending, Approved או Rejected). אם Rejected, העתק לי את הסיבה המדויקת.
```

אחרי **Approved** בלבד: בשלב 7.

## שלב 7: הפעלת תבנית המסמך

```
פתח https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/secrets
הוסף סוד חדש בשם WHATSAPP_DOCUMENT_TEMPLATE והשאר את הערך ריק, ועצור. אני אכתוב lalum_document_sent ואשמור.
```

אל תגדיר את הסוד לפני אישור Meta: כל עוד הוא חסר, המערכת שולחת דוא"ל ומדלגת על WhatsApp בצורה מסודרת (`template_not_configured`). אחרי שהוגדר והתבנית לא אושרה, שליחות ה-WhatsApp ייכשלו ויירשמו כנכשלות.

### אופציונלי: תבניות התזכורת לגבייה

אותו תהליך, שלוש תבניות (`lalum_dunning_1`, `lalum_dunning_2`, `lalum_dunning_3`), קטגוריה Utility, שפה he, שלושה משתנים: `{{1}}` שם הלקוח, `{{2}}` סכום החוב, `{{3}}` ימי איחור. הנוסח המדויק של כל אחת ב-`lalum-app/scripts/whatsapp-dunning-templates.json`, ולכן הדרך הבטוחה היא דרך א למעלה. אחרי אישור: סודות `WHATSAPP_DUNNING_TEMPLATE_1` עד `_3` בשמות התבניות. נוסח דרגה 3 עוד לא אושר על ידך מקצועית.

## שלב 8: אימות שהפונקציות חיות

```
פתח כל כתובת בלשונית חדשה, אחת אחרי השנייה, והראה לי את קוד ה-HTTP ואת גוף התשובה המדויק. אל תשנה כלום ואל תזין שום מפתח.

1. https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-fin-doc-send
2. https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-fin-issue
3. https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-fin-doc-send-webhook

תוצאה תקינה:
- כתובות 1 ו-2: קוד 401 (חסרה הרשאה). פירוש הדבר שהפונקציה חיה ושהגישה מוגנת.
- כתובת 3: קוד 405 עם {"code":"method_not_allowed"}. פירוש הדבר שהפונקציה חיה ושהיא מקבלת POST חתום בלבד.

כל תוצאה אחרת (404, 500, BOOT_ERROR, function not found) היא כשל. דווח לי במדויק.
החזר טבלה: כתובת, קוד, גוף, תקין או לא.
```

אחר כך, ב-https://resend.com/webhooks , פתח את ה-webhook ושלח אירוע בדיקה (אם הממשק מציע). הגשה בקוד 200 מוכיחה שהסוד נכון. 401 פירושו שהסוד שהוזן שגוי: להזין מחדש בשלב 2.

## שלב 9: בדיקת שליחה בלי מערכת ההנפקה

בלשונית הלקוחות יש כרטיס "בדיקת שליחה אוטומטית". היא לא מפיקה מסמך, לא פונה ל-Invoice4U ולא כותבת דבר למסד, ולכן אין מה למחוק אחריה.

1. לחץ "שלחו לי דוא"ל בדיקה". אמורה להגיע אליך הודעה עם קובץ PDF לדוגמה מצורף. זה מוכיח את `RESEND_API_KEY`, את הדומיין ואת נתיב הצרופה.
2. ל-WhatsApp: פתח כרטיס לקוח שהנייד שלו הוא שלך, עם הסכמה רשומה, ולחץ "הודעת WhatsApp בדיקה". זה שולח את תבנית המסמכים האמיתית עם ערכים לדוגמה, ולכן עובד רק אחרי אישור התבנית והגדרת `WHATSAPP_DOCUMENT_TEMPLATE`.
3. קודי כשל: `mail_not_configured`, `no_own_email`, `whatsapp_not_configured`, `template_not_configured`, `no_whatsapp_consent`, `no_mobile`, או `send_failed` עם פירוט.

## שלב 10: בדיקה מקצה לקצה עם הפקה (שלך, לא של Claude in Chrome)

הפקה היא פעולה משפטית ועוברת דרך Invoice4U, ולכן את הבדיקה הזו אתה מבצע בעצמך באפליקציה, ורק אחרי שלב 9.

1. ודא מה מצב ההפקה: אם `FIN_INVOICE4U_ENV` אינו `prod`, מסמך שיופק הוא מסמך בדיקה ולא יספר בדוחות, והוא יישלח **רק לכתובת שלך**. אם הוא `prod`, **אל תפיק מסמך בדיקה**: כל הפקה היא מסמך אמיתי עם מספר רץ.
2. בלשונית הלקוחות פתח לקוח בדיקה עם הכתובת והנייד שלך, וסמן הסכמה ל-WhatsApp.
3. הפק חשבונית מס קבלה. התוצאה הצפויה במסך: "נשלח ללקוח בדוא"ל" (ובמסמך אמיתי גם "וגם ב-WhatsApp").
4. ביומן השליחות של המסמך אמורה להופיע שורה אחת לכל ערוץ. דוא"ל אמור להתעדכן ל"נמסר" תוך דקות.
5. אם משהו נכשל, המסך אומר איזה ערוץ ולמה. קודי הכשל: `mail_not_configured` (חסר `RESEND_API_KEY`), `whatsapp_not_configured` (חסר טוקן או מזהה מספר), `template_not_configured` (חסר שלב 7), `no_whatsapp_consent` או `no_mobile` (כרטיס הלקוח).

## סיכום מה נשאר בידיים שלך

| מה | למה לא Claude in Chrome |
|---|---|
| הדבקת כל ערך סודי ב-Supabase | סודות לא עוברים דרכו |
| יצירת הטוקן הקבוע ב-Meta | הטוקן מוצג פעם אחת וסודי |
| אישור הנוסח של התבניות | החלטה מקצועית שלך |
| בדיקת הפקה מקצה לקצה | פעולה משפטית |
