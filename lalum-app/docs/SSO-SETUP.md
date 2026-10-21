# חיבור התחברות מהירה: Google ו-Microsoft (OAuth דרך Supabase)

מדריך להפעלת כפתורי "התחברות עם Google" ו"התחברות עם Microsoft" בעמוד הכניסה (`/login`). הקוד כבר קיים באפליקציה (ראו `src/pages/Login.tsx` ו-`src/context/AuthContext.tsx`). מה שנשאר הוא הגדרה חד פעמית בצד הספקים וב-Supabase.

הרעיון המרכזי: בשני הספקים רושמים **כתובת callback אחת של Supabase**. את כתובת האפליקציה (`/portal`) רושמים רק בתוך Supabase. אל תתבלבלו ביניהן, זו הטעות הנפוצה ביותר.

## שלב 0: כתובת ה-callback של Supabase

ב-Supabase Dashboard: Authentication, Providers, לחצו על Google או Azure. בראש ההגדרות מופיעה שורה "Callback URL (for OAuth)" בצורה:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

העתיקו אותה. זו הכתובת שתירשם אצל Google ואצל Microsoft. ה-`project-ref` הוא המזהה של הפרויקט שלכם ב-Supabase.

## חלק א: Google OAuth client

1. היכנסו ל-`console.cloud.google.com`, צרו או בחרו פרויקט.
2. תפריט, APIs & Services, OAuth consent screen:
   * User type: External, לחצו Create.
   * App name: LALUM. User support email ו-Developer contact: המייל שלכם.
   * Authorized domains: הוסיפו `supabase.co` וגם `lalumapp.com`.
   * Scopes: הוסיפו `openid`, `email`, `profile`. שמרו.
   * Publishing status: לחצו Publish app, אחרת רק משתמשי בדיקה שתוסיפו ידנית יוכלו להתחבר.
3. APIs & Services, Credentials, Create Credentials, OAuth client ID:
   * Application type: Web application.
   * Name: LALUM Web.
   * Authorized redirect URIs, Add URI: הדביקו את כתובת ה-callback של Supabase מ-שלב 0.
   * אופציונלי, Authorized JavaScript origins: `https://lalumapp.com`.
   * לחצו Create.
4. העתיקו את ה-Client ID ואת ה-Client Secret.

## חלק ב: Microsoft (Entra ID, לשעבר Azure AD)

1. היכנסו ל-`entra.microsoft.com` (או `portal.azure.com`), עברו אל Microsoft Entra ID, App registrations, New registration.
2. Name: LALUM Login.
3. Supported account types: בחרו "Accounts in any organizational directory and personal Microsoft accounts", כך גם חשבונות ארגוניים וגם חשבונות Microsoft אישיים יוכלו להתחבר.
4. Redirect URI: בחרו פלטפורמה Web, והדביקו את כתובת ה-callback של Supabase מ-שלב 0.
5. לחצו Register. בעמוד Overview העתיקו את Application (client) ID.
6. Certificates & secrets, Client secrets, New client secret: תנו תיאור ותוקף, לחצו Add, והעתיקו **מיד** את ה-Value של הסוד. שימו לב: מעתיקים את ה-Value ולא את ה-Secret ID, וה-Value מוצג פעם אחת בלבד.
7. API permissions: Microsoft Graph, ההרשאות מסוג delegated של `openid`, `email`, `profile`, `User.Read` קיימות כברירת מחדל. אם קיים כפתור Grant admin consent, לחצו עליו.

## חלק ג: חיבור ב-Supabase

1. Authentication, Providers, Google: הפעילו (Enable), הדביקו את ה-Client ID וה-Client Secret מחלק א, שמרו.
2. Authentication, Providers, Azure: הפעילו, והדביקו:
   * Client ID: ה-Application (client) ID מחלק ב.
   * Secret: ה-Value של הסוד מחלק ב.
   * Azure Tenant URL: `https://login.microsoftonline.com/common`, מתאים לבחירה הרב ארגונית מ-שלב 3.
   * שמרו.
3. Authentication, URL Configuration:
   * Site URL: `https://lalumapp.com`.
   * Redirect URLs, הוסיפו: `https://lalumapp.com/portal`. אם תרצו לבדוק בתצוגות מקדימות, הוסיפו גם את דומיין ה-preview של Cloudflare.

## חלק ד: הדלקת הכפתורים באפליקציה

בהגדרות הבנייה (Cloudflare Pages או Vercel), הוסיפו משתנה סביבה:

```
VITE_ENABLE_SSO=true
```

ואז Redeploy. מרגע זה הכפתורים יופיעו ויעבדו. בלי הדגל הם מוסתרים, כדי שלא יופיע כפתור שאינו מסוגל להשלים התחברות.

## בדיקה מהירה

פתחו את `https://lalumapp.com/login`, לחצו "התחברות עם Google", אשרו בחלון של Google, ואתם אמורים לחזור מחוברים ל-`/portal`. אותו הדבר עם Microsoft.

## טעויות נפוצות

* `redirect_uri_mismatch` אצל Google או Microsoft: כתובת ה-callback שרשמתם אצלם אינה זהה בדיוק לזו של Supabase. העתיקו שוב מ-שלב 0, בלי רווח ובלי סלאש מיותר.
* "provider is not enabled": הספק לא הופעל ב-Supabase, או שהדגל `VITE_ENABLE_SSO` עדיין לא דלוק.
* המשתמש חוזר לעמוד הבית במקום ל-`/portal`: הכתובת `https://lalumapp.com/portal` חסרה ברשימת ה-Redirect URLs ב-Supabase.

## היכן זה בקוד

* `src/context/AuthContext.tsx`: הפונקציה `signInWithProvider('google' | 'azure')`, שקוראת ל-`supabase.auth.signInWithOAuth` עם הפניה חזרה ל-`/portal`.
* `src/pages/Login.tsx`: הכפתורים, מוגנים מאחורי `SSO_ENABLED` (הנגזר מ-`VITE_ENABLE_SSO`).
* `src/vite-env.d.ts`: ההצהרה על משתנה הסביבה `VITE_ENABLE_SSO`.

הערה: אין צורך בשינוי CSP. ההפניה היא ניווט ברמת הדף אל Supabase ואז אל הספק, ו-CSP אינו מגביל ניווטים ברמת הדף.
