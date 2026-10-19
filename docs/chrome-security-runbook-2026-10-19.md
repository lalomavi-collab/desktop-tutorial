# ספר הוראות ל-Claude in Chrome: סבב האבטחה לפני ההצגה

עובדים לפי הסדר, שלב אחד בכל פעם. בכל שלב: הדבק את הבלוק ל-Claude in Chrome, חכה לתשובה, והדבק לי כאן את מה שהוא החזיר. אני אפענח, אגיד אם עברנו, ואז עוברים לשלב הבא.

כללים שחלים על כל בלוק, והם כבר כתובים בתוכו:
- אין להזין סיסמאות, מפתחות או קודי אימות. אם מופיעה בקשת התחברות, Claude in Chrome עוצר ומבקש ממך להתחבר בעצמך.
- אין לשנות הגדרה אלא אם השלב אומר במפורש לשנות.
- בכל שלב יש "מה מדביקים לי", ולא צריך להוסיף הסברים.

| שלב | מה בודקים | משנה משהו | חוסם מיזוג |
|---|---|---|---|
| 1 | שתי הפונקציות דוחות סוד שגוי (401) | לא | כן |
| 2 | גרסת ה-preview: אין שגיאות CSP בהתחברות ובפורטל | לא | כן |
| 3 | הגדרות Supabase Auth: מצב קיים | לא | לא |
| 4 | Supabase Auth: הפעלת ההגנות | כן, באישורי | לא |
| 5 | Cloudflare: מצב קיים | לא | לא |
| 6 | תשלום בדיקה ב-QA ובדיקת הלוג | כן, תשלום בדיקה | לא |
| 7 | אחרי המיזוג: כותרות חיות, security.txt, העמוד והחוברת | לא | אחרי מיזוג |

---

## שלב 1: אימות שתי הפונקציות (חוסם מיזוג)

קישורים: [pay-webhook](https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-pay-webhook?t=wrong) · [esign](https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-esign?action=webhook&secret=wrong)

```
פתח כל כתובת בלשונית חדשה, אחת אחרי השנייה, והראה לי את קוד ה-HTTP ואת גוף התשובה המדויק. אל תשנה כלום, אל תזין סיסמה או מפתח, ואל תלחץ על דבר בעמוד.

1. https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-pay-webhook?t=wrong
2. https://meoymkcotomoluwlwues.supabase.co/functions/v1/lalum-esign?action=webhook&secret=wrong

תקין, לכל אחת משתיים: קוד 401 וגוף {"error":"unauthorized"}.
כל תוצאה אחרת היא כשל: דווח מה קיבלת במדויק.
החזר טבלה: כתובת, קוד, גוף התשובה, תקין או לא.
```

מה מדביקים לי: הטבלה.
מה אני עושה: אם שתי השורות 401, שלב 1 עבר. 500 או BOOT_ERROR: חוזרים לגרסה הקודמת. 200: עוצרים מיד.

---

## שלב 2: גרסת ה-preview, בדיקת CSP (חוסם מיזוג)

קישורים: [בדיקת Cloudflare Pages](https://github.com/lalomavi-collab/desktop-tutorial/runs/118070334436) · [לוח הפריסה](https://dash.cloudflare.com/?to=/632cabc07be2569b0398635f38f336c2/pages/view/desktop-tutorial/905ecff8-6048-4664-a5e3-0fe54c1a0c73)

```
המטרה: לבדוק שגרסת ה-preview של ענף claude/vigilant-feynman-tzlie7 פועלת בלי שגיאות Content Security Policy. אל תשנה הגדרות ואל תזין סיסמאות.

1. פתח https://dash.cloudflare.com/?to=/632cabc07be2569b0398635f38f336c2/pages/view/desktop-tutorial/905ecff8-6048-4664-a5e3-0fe54c1a0c73 . אם נדרשת התחברות, עצור וביקש ממני להתחבר.
2. מצא בעמוד הפריסה את כתובת ה-preview (הכתובת המסתיימת ב-pages.dev) והעתק אותה אליי.
3. פתח את כתובת ה-preview. פתח את כלי הפיתוח (F12), לשונית Console, ורענן.
4. נווט לפי הסדר: דף הבית, /security/, /login/. בכל אחד רשום כל הודעה שמכילה "Content Security Policy", "Refused to" או "blocked".
5. אם אני מתחבר בעצמי (תבקש ממני), פתח גם את הפורטל ואת סביבת העבודה, וחזור על הבדיקה בקונסולה. בלשונית Network סנן לפי "supabase" וודא שהבקשות מחזירות 200 או 401, לא "blocked".

החזר: כתובת ה-preview, ובכל דף: "נקי" או רשימת השגיאות המדויקת. אל תסיק מסקנות.
```

מה מדביקים לי: כתובת ה-preview ולכל דף "נקי" או השגיאות.
מה אני עושה: נקי בכל הדפים, שלב 2 עבר. שגיאה על supabase.co: מתקנים את `_headers` לפני מיזוג.

---

## שלב 3: Supabase Auth, מצב קיים (לקריאה בלבד)

קישורים (אם קישור עמוק לא נפתח, נכנסים לפרויקט ומנווטים ב-Authentication): [פרויקט](https://supabase.com/dashboard/project/meoymkcotomoluwlwues) · [Auth](https://supabase.com/dashboard/project/meoymkcotomoluwlwues/auth/users)

```
קרא בלבד, ואל תשנה כלום. אם נדרשת התחברות, עצור וביקש ממני להתחבר.

פתח https://supabase.com/dashboard/project/meoymkcotomoluwlwues ונווט לתפריט Authentication. רשום לי את הערך הנוכחי של כל פריט, בדיוק כפי שהוא מופיע, ואם הפריט לא קיים בתוכנית שלי כתוב "לא זמין":

1. Sign In / Providers, ספק Email: אורך סיסמה מינימלי, דרישות מורכבות, "Prevent use of leaked passwords" (מופעל או כבוי), "Confirm email".
2. Attack Protection או CAPTCHA: האם CAPTCHA מופעל, ואיזה ספק.
3. Rate Limits: כל המספרים שמופיעים (שליחות מייל, ניסיונות כניסה, אימות, הרשמות).
4. Sessions: "Time-box user sessions", "Inactivity timeout", "Single session per user".
5. JWT Settings (Settings, JWT או Authentication, Sessions): "JWT expiry" בשניות, "Refresh token rotation" (מופעל או כבוי), "Reuse interval".
6. Multi-Factor Authentication: האם TOTP מופעל.
7. Authentication, URL Configuration: Site URL ורשימת ה-Redirect URLs.

החזר רשימה ממוספרת של ערכים. אל תמליץ ואל תשנה.
```

מה מדביקים לי: הרשימה.
מה אני עושה: מחליט אילו הגדרות לשנות ובאיזה סדר, ומכין את שלב 4.

---

## שלב 4: Supabase Auth, הפעלת ההגנות (משנה הגדרות, רק אחרי שראיתי את שלב 3)

אכתוב את הבלוק המדויק אחרי שאקבל את תוצאות שלב 3, כדי שלא נשנה הגדרה שכבר תקינה או שלא זמינה בתוכנית. ההגדרות המועמדות: Leaked Password Protection, CAPTCHA (Turnstile), Refresh Token Rotation, וקיצור JWT expiry.

---

## שלב 5: Cloudflare, מצב קיים (לקריאה בלבד)

קישור: [Cloudflare](https://dash.cloudflare.com/632cabc07be2569b0398635f38f336c2/home)

```
קרא בלבד, ואל תשנה כלום. אם נדרשת התחברות, עצור וביקש ממני להתחבר.

פתח https://dash.cloudflare.com/632cabc07be2569b0398635f38f336c2/home , בחר את הדומיין lalumapp.com, ורשום לי את הערך הנוכחי של כל פריט. אם הפריט לא קיים בתוכנית כתוב "לא זמין":

1. SSL/TLS, Overview: מצב ההצפנה (Full או Full strict).
2. SSL/TLS, Edge Certificates: "Always Use HTTPS", "Minimum TLS Version", "TLS 1.3", "HSTS" (מופעל או כבוי, ואם מופעל: max-age, includeSubDomains, preload), "Automatic HTTPS Rewrites".
3. Security, Settings או Bots: "Bot Fight Mode" ו"Super Bot Fight Mode" (מופעל או כבוי).
4. Security, WAF: האם Managed Rules מופעלים, ורשימת כללים מותאמים אישית (שם ופעולה). כמו כן Rate limiting rules אם יש.
5. DNS, Settings: DNSSEC (מופעל או כבוי), ורשומת CAA אם קיימת.
6. Rules, Redirect Rules: כללים שקיימים (הכלל של www).
7. תוכנית ה-Cloudflare של הדומיין (Free, Pro וכן הלאה).

החזר רשימה ממוספרת. אל תמליץ ואל תשנה.
```

מה מדביקים לי: הרשימה.
מה אני עושה: מכין בלוק שינוי מצומצם (שלב 5ב) לפי מה שחסר.

---

## שלב 6: תשלום בדיקה ב-QA ובדיקת הלוג

קישורים: [לוג pay-webhook](https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/lalum-pay-webhook/logs) · [לוג pay-create](https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/lalum-pay-create/logs)

חלק א (אתה, לא Claude in Chrome): הרץ תשלום בדיקה על אבן דרך בסביבת ה-QA של Invoice4U, עם כרטיס הבדיקה שלהם. Claude in Chrome לא מזין פרטי כרטיס.

חלק ב (אחרי שהתשלום בוצע):

```
קרא בלבד, ואל תשנה כלום. אם נדרשת התחברות, עצור וביקש ממני להתחבר.

1. פתח https://supabase.com/dashboard/project/meoymkcotomoluwlwues/functions/lalum-pay-webhook/logs
2. הראה לי את כל השורות מה-30 דקות האחרונות שמכילות INVOICE4U_CALLBACK, PAY_AMOUNT_UNVERIFIED, PAY_AMOUNT_MISMATCH או PAY_WEBHOOK_UNAUTHORIZED. העתק אותן כפי שהן.
3. אל תעתיק שורות אחרות ואל תעתיק שמות, טלפונים או מיילים אם יופיעו.

החזר את השורות ואת שעת כל אחת.
```

מה מדביקים לי: השורות.
מה אני עושה: `PAY_AMOUNT_UNVERIFIED` אומר שהספק לא שולח סכום מוכר והבדיקה החדשה אינה פעילה (התשלום עדיין מתקבל). `PAY_AMOUNT_MISMATCH` בתשלום תקין אומר שיש להתאים את הבדיקה. `PAY_WEBHOOK_UNAUTHORIZED` אומר שהסוד ב-CallBackUrl לא תואם, וצריך לבדוק את `PAY_WEBHOOK_SECRET`.

---

## שלב 7: אחרי המיזוג, בדיקה חיה

קישורים: [האתר](https://lalumapp.com/) · [עמוד האבטחה](https://lalumapp.com/security/) · [security.txt](https://lalumapp.com/.well-known/security.txt) · [חוברת](https://lalumapp.com/downloads/lalum-avtachat-meida.pdf) · [סקריפט](https://lalumapp.com/downloads/lalum-supabase-security-audit.sql)

```
קרא בלבד, ואל תשנה כלום.

1. פתח https://lalumapp.com/ , F12, לשונית Network, סמן "Disable cache", רענן. לחץ על הבקשה הראשונה (המסמך) ופתח Response Headers. העתק לי את הערכים המדויקים של: strict-transport-security, content-security-policy, x-content-type-options, x-frame-options, referrer-policy, permissions-policy, cross-origin-opener-policy. בתוך ה-CSP אני צריך את המחרוזת המלאה של connect-src.
2. בלשונית Console רשום כל הודעת "Content Security Policy" או "Refused to".
3. פתח https://lalumapp.com/security/ והחזר: קוד התשובה, כותרת ה-H1, ומספר כרטיסי הטענות שמופיעים (צפוי 19).
4. פתח https://lalumapp.com/.well-known/security.txt והעתק את התוכן כפי שהוא.
5. פתח https://lalumapp.com/downloads/lalum-avtachat-meida.pdf והחזר: האם נפתח, וכמה עמודים.
6. פתח https://lalumapp.com/downloads/lalum-supabase-security-audit.sql והחזר: האם נפתח כטקסט, והשורה הראשונה.

החזר את הכול כרשימה ממוספרת.
```

מה מדביקים לי: הרשימה.
מה אני עושה: משווה את הכותרות החיות ל-`_headers` ולרשומת האימות, ומתקן את מה שאינו תואם.
