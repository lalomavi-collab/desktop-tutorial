# העלאת LALUM לחנויות האפליקציות

האפליקציה של LALUM היא PWA (Progressive Web App). מסמך זה מסביר מה כבר הוכן בקוד, ומה נותר לבצע ידנית כדי לפרסם אותה ב-Google Play וב-App Store. עבודת החתימה ופתיחת החשבונות היא באחריות בעל האפליקציה.

## מה כבר מוכן בקוד (בוצע)

- **Service Worker** (`public/sw.js`), רשום מ-`src/main.tsx` בפרודקשן בלבד. הוא הופך את האתר ל-PWA שניתן להתקנה ומספק מסך לא מקוון (`public/offline.html`). המדיניות בטוחה לעדכונים: עמודים נטענים network first (המבקר תמיד מקבל את הגרסה החדשה), קבצי הבנייה עם ה-hash נשמרים cache first, וכל בקשה חוצת דומיין עוברת ישר לרשת.
- **manifest מלא** (`public/manifest.webmanifest`) עם `id`, `scope`, `name`, `short_name`, `description`, `categories`, אייקונים (192 ו-512, כולל maskable), `shortcuts`, ו-`screenshots` (בפורמט narrow ו-wide) שנדרשים לפרסום.
- **צילומי מסך** אמיתיים של האפליקציה (`public/screenshots/`).
- **assetlinks.json** בשלד (`public/.well-known/assetlinks.json`), לאימות הדומיין ב-Android. צריך למלא בו את שם החבילה ואת טביעת האצבע של מפתח החתימה (ראו למטה).
- כותרות תומכות ב-`public/_headers`: `worker-src 'self'`, ו-`Cache-Control: no-cache` ל-`sw.js` כדי שעדכונים יתפשטו מהר.

## מה נותר לבצע ידנית

### שלב 0: אימות שה-PWA עובר

1. לאחר שהשינוי מתפרסם ל-production, פתחו את `https://lalumapp.com` ב-Chrome במחשב.
2. DevTools, לשונית Application, בדקו: Manifest ללא שגיאות, Service Workers מציג worker פעיל.
3. או השתמשו ב-Lighthouse (קטגוריית PWA) לוודא "Installable".

### שלב 1: Google Play (מסלול TWA)

המסלול המומלץ ל-PWA הוא Trusted Web Activity: אפליקציית Android דקה שפותחת את ה-PWA במסך מלא.

הכלי הפשוט ביותר הוא **PWABuilder** (`https://www.pwabuilder.com`):

1. הזינו את הכתובת `https://lalumapp.com` ולחצו Start.
2. עברו ל-Package For Stores, בחרו Android, ולחצו Generate.
3. בחרו שם חבילה (למשל `co.lalum.app`). שמרו אותו, הוא קבוע לכל חיי האפליקציה.
4. PWABuilder ייצר קובץ `.aab` (Android App Bundle) וקובץ `signing.keystore` עם סיסמאות. **שמרו את ה-keystore ואת הסיסמאות במקום בטוח, אין דרך לשחזר אותם.**
5. PWABuilder גם ייתן לכם את טביעת האצבע SHA-256 של החתימה. העתיקו אותה.

חלופה למתקדמים: **Bubblewrap CLI** (`npm i -g @bubblewrap/cli`, ואז `bubblewrap init --manifest https://lalumapp.com/manifest.webmanifest`).

#### מילוי assetlinks.json

1. ערכו את `lalum-app/public/.well-known/assetlinks.json`:
   - `package_name`: שם החבילה שבחרתם (למשל `co.lalum.app`).
   - `sha256_cert_fingerprints`: טביעת האצבע SHA-256 מהחתימה.
2. אם תשתמשו ב-Play App Signing (מומלץ), הוסיפו גם את טביעת האצבע של מפתח החתימה של Google (מופיע ב-Play Console, לשונית App integrity), כך שיהיו שתי טביעות אצבע ברשימה.
3. פרסמו מחדש, ובדקו ש-`https://lalumapp.com/.well-known/assetlinks.json` מחזיר את הערכים הנכונים. בלי זה, ה-TWA יציג שורת כתובת URL במקום מסך מלא.

#### פרסום ב-Play Console

1. פתחו חשבון ב-Google Play Console (עלות חד-פעמית של 25$).
2. צרו אפליקציה חדשה, העלו את קובץ ה-`.aab`.
3. מלאו את עמוד החנות: תיאור, אייקון, צילומי מסך (אפשר להשתמש בקבצים מ-`public/screenshots/`), מדיניות פרטיות (קישור ל-`https://lalumapp.com/legal`), ודירוג תוכן.
4. שלחו לבדיקה. אישור ראשוני לוקח בדרך כלל כמה ימים.

### שלב 2: App Store (iOS)

חשוב לדעת: אפל נוקשה כלפי עטיפות של אתרים (הנחיה 4.2, minimum functionality). כדי לעבור, האפליקציה צריכה להרגיש כאפליקציה אמיתית, לא רק דפדפן. ה-PWA שלנו עם ההתקנה, מצב לא מקוון וה-shortcuts עוזר, אבל כדאי להיערך לאפשרות של סבב תיקונים מול הבודק.

1. פתחו חשבון Apple Developer (99$ לשנה). צריך גם מחשב Mac עם Xcode.
2. ב-PWABuilder, בחרו iOS ולחצו Generate. תקבלו פרויקט Xcode שעוטף את ה-PWA ב-WKWebView.
3. פתחו את הפרויקט ב-Xcode, הגדירו את חשבון המפתח, שם החבילה (Bundle ID, למשל `co.lalum.app`), והאייקונים.
4. בנו והריצו על סימולטור או מכשיר לבדיקה.
5. העלו ל-App Store Connect דרך Xcode, מלאו את עמוד החנות (תיאור, צילומי מסך למכשירים השונים, מדיניות פרטיות), ושלחו ל-TestFlight ואז ל-App Review.

טיפ לעמידה בהנחיה 4.2: הדגישו בתיאור ובפועל את הערך הייחודי (מבדק המוכנות, קביעת פגישות, מרכז הידע, מצב לא מקוון), ולא רק "אתר בתוך אפליקציה".

## עדכונים לאחר הפרסום

- **תוכן**: כל פרסום רגיל של האתר מתעדכן אוטומטית באפליקציות, כי הן טוענות את ה-PWA החי. אין צורך בהעלאה מחדש לחנות בשביל שינוי תוכן.
- **מעטפת**: רק שינוי בשם, באייקון, בהרשאות או בגרסת המעטפת מצריך בנייה והעלאה מחדש של ה-`.aab` או פרויקט ה-iOS.

## סיכום עלויות וחשבונות

| פריט | עלות | הערה |
| --- | --- | --- |
| Google Play Console | 25$ חד-פעמי | נדרש לפרסום ב-Android |
| Apple Developer Program | 99$ לשנה | נדרש לפרסום ב-iOS, וגם מחשב Mac |
| PWABuilder / Bubblewrap | חינם | ייצור החבילות |
