# עותק חיצוני מוצפן של קבצי Storage

נכתב ב־24.10.2026, צעד 15 בתוכנית התשתית. הקוד נמצא ב־`scripts/offsite-backup`.

## למה

הגיבוי היומי של Supabase מגבה את מסד הנתונים בלבד. הקבצים שב־Storage לא נכללים בו: במסד נשמר רק המידע עליהם, ושחזור גיבוי ישן לא מחזיר קובץ שנמחק מאז ([מקור](https://supabase.com/docs/guides/platform/backups)). עד עכשיו לא היה לקבצים האלה שום עותק מחוץ ל־Supabase, כך שמחיקה בטעות, באג או מפתח שדלף היו מוחקים אותם לתמיד.

המצב ב־24.10.2026, לפי `storage.objects`:

| bucket | קבצים | נפח | מה יש בו |
|---|---|---|---|
| `matter-originals` | 250 | 65MB | כספת המקורות של התיקים |
| `finance-archive-backup` | 277 | 57MB | גיבוי ארכיון Invoice4U |
| `client-files` | 2 | 219kB | קבצי לקוחות |

סך הכול 529 קבצים, כ־122MB. הסקריפט מוצא את ה־buckets בעצמו בכל ריצה, כך ש־bucket חדש (למשל זה ש־PR 1234 מוסיף) נכנס לגיבוי הבא בלי שינוי בקוד.

## מה הסקריפט עושה

`Backup-LalumStorage.ps1` רץ פעם בשבוע במחשב של אבי:

1. קורא את כל ה־buckets של lalum-app דרך נקודת ה־S3 של Supabase, בקריאה בלבד.
2. מעתיק כל bucket לתמונת מצב חדשה ומתוארכת, `snapshots/<yyyy-MM-dd_HHmmss>/<bucket>`, בתוך תיקייה מוצפנת של rclone (crypt) ב־OneDrive for work של lalum.co. גם שמות הקבצים והתיקיות מוצפנים, כך שב־OneDrive לא רואים אפילו שם של לקוח.
3. משווה את העותק למקור בייט מול בייט (`rclone check --download`), ובודק שמספר הקבצים בעותק לא קטן ממספרם ב־Supabase.
4. שומר בתוך תמונת המצב רשימת MD5 של כל bucket ותקציר של הריצה (`_manifest`). שחזור עתידי נבדק מול הרשימה הזו, כלומר מול מה שהיה ביום הגיבוי.
5. מתריע אם bucket של 10 קבצים ומעלה איבד יותר מ־10% מהם מאז הגיבוי הטוב האחרון, ועל כל bucket שנעלם. כך מגלים מחיקה בטעות כל עוד הגרסה הקודמת שמורה.
6. בסוף מציג הודעת Windows (הצלחה או כישלון), שומר לוג ב־`%LOCALAPPDATA%\LalumBackup\logs` ומוסיף שורה ל־`%LOCALAPPDATA%\LalumBackup\history.jsonl`.

`Restore-LalumStorage.ps1` מציג את תמונות המצב, או מפענח אחת מהן לתיקייה מקומית ובודק כל קובץ מול רשימת ה־MD5.

## מה הסקריפט לא עושה

- **לא כותב ל־Supabase ולא מוחק ממנו.** אין בקוד שום פקודה שכותבת למקור.
- **לא מוחק ולא דורס דבר ביעד.** כל ריצה כותבת לתיקייה חדשה, ו־`--immutable` עוצר את הריצה אם קובץ קיים היה משתנה. תמונות ישנות לא נמחקות אוטומטית (ראו "הגבלות").
- **לא שומר סודות בקוד, בקובץ הגדרות או בלוג.** מפתח ה־S3 ושתי סיסמאות ההצפנה נשמרים ב־Windows Credential Manager, ועוברים ל־rclone רק כמשתני סביבה של התהליך עצמו, שנמחקים בסוף הריצה. סיסמאות ההצפנה עוברות ל־rclone דרך הקלט שלו ולא בשורת הפקודה. אין קובץ `rclone.conf`.

מפתח S3 של Supabase נותן גישה מלאה: "S3 access keys provide full access to all S3 operations across all buckets and bypass RLS policies. These are meant to be used only on the server" ([מקור](https://supabase.com/docs/guides/storage/s3/authentication)). אין מפתח לקריאה בלבד, ולכן הוא נשמר רק ב־Credential Manager של מחשב אחד. אם המחשב אבד, נגנב או הוחלף: מבטלים את המפתח בלוח הבקרה של Supabase מיד, ויוצרים חדש.

## ההצפנה והסיסמאות

ההצפנה היא rclone crypt, של התוכן ושל השמות ([פירוט](https://rclone.org/crypt/)), עם שתי סיסמאות: `lalum-offsite-crypt` (הסיסמה) ו־`lalum-offsite-crypt-salt` (המלח). כל אחת לפחות 20 תווים באנגלית, ספרות וסימנים, בלי רווח בקצוות, ושתיהן שונות זו מזו. אחרת הסקריפט מסרב לרוץ. ההמלצה: 32 תווים של אותיות וספרות מהמחולל של מנהל הסיסמאות.

**לפני ההרצה הראשונה שומרים את שתיהן במנהל הסיסמאות**, ברשומה אחת יחד עם ההגדרות הקבועות:

```
LALUM offsite backup (rclone crypt)
password  = <סיסמה 1>
password2 = <סיסמה 2>
filename_encryption = standard
directory_name_encryption = true
filename_encoding = base32768
```

בלי שתי הסיסמאות וההגדרות האלה אף אחד לא יכול לקרוא את הגיבוי, גם לא אנחנו. אובדן המחשב לא פוגע בגיבוי; אובדן הסיסמאות מוחק אותו בפועל. `base32768` נבחר כי הוא מקצר את השמות המוצפנים, ו־OneDrive מגביל נתיב מלא ל־400 תווים.

## התקנה, פעם אחת (אבי, כ־20 דקות)

צריך מחשב Windows שבו OneDrive for work מחובר עם avraham@lalum.co ומסנכרן. כל הפקודות ב־PowerShell רגיל, לא כמנהל.

1. **rclone:** `winget install Rclone.Rclone`, ואז פותחים חלון PowerShell חדש. `rclone version` צריך להראות 1.60 ומעלה.
2. **הסקריפטים:** מעתיקים את `LalumOffsite.psm1`, `Backup-LalumStorage.ps1` ו־`Restore-LalumStorage.ps1` מ־`scripts/offsite-backup` לתיקייה קבועה, `C:\LALUM\offsite-backup`. תיקייה קבועה, כי המשימה השבועית מצביעה על הנתיב הזה.
3. **מפתח S3:** פותחים https://supabase.com/dashboard/project/meoymkcotomoluwlwues/storage/s3, ובאזור Access keys יוצרים מפתח חדש בשם `lalum-offsite-backup`. ה־Secret מוצג פעם אחת בלבד.
4. **שמירת המפתח:**
   ```
   cmdkey /generic:lalum-supabase-s3 /user:<ACCESS_KEY_ID> /pass
   ```
   במקום `<ACCESS_KEY_ID>` מדביקים את ה־Access key ID. כשמתבקשת סיסמה מדביקים את ה־Secret access key (הוא לא מוצג על המסך), ואז סוגרים את החלון ב־Supabase. ה־Secret לא עובר בצ׳אט, במייל או ב־Chrome.
5. **סיסמאות ההצפנה:** יוצרים ושומרים במנהל הסיסמאות (הסעיף הקודם), ואז מריצים את שתי הפקודות ומדביקים בכל אחת את הסיסמה שלה:
   ```
   cmdkey /generic:lalum-offsite-crypt /user:crypt /pass
   cmdkey /generic:lalum-offsite-crypt-salt /user:crypt /pass
   ```
6. **הרצה יבשה.** בודקת את שלושת הסודות ולא כותבת כלום:
   ```
   cd C:\LALUM\offsite-backup
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Backup-LalumStorage.ps1 -DryRun
   ```
   מצופה: שלושה buckets, עם מספרי קבצים קרובים לטבלה למעלה, ונתיב היעד.
7. **הרצה ראשונה.** כמה דקות, ומסתיימת ב־`Result: ok` ובהודעת Windows "LALUM backup OK":
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Backup-LalumStorage.ps1
   ```
8. **משימה שבועית.** כל יום ראשון ב־10:00, תחת המשתמש של אבי ורק כשהוא מחובר, כי Credential Manager ו־OneDrive שייכים למשתמש. אם המחשב היה כבוי, הריצה מתבצעת בהזדמנות הבאה. ביטול: אותה פקודה עם `-Unregister`.
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Backup-LalumStorage.ps1 -Register
   ```

## אימות אחרי ההרצה הראשונה (חובה)

ספירה לא מספיקה, פותחים קבצים (לקח C10).

1. מציגים את תמונות המצב. מצופה: שורה עם `ok`, מספר הקבצים והנפח.
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Restore-LalumStorage.ps1 -List
   ```
2. מפענחים לתיקייה זמנית. מצופה: `Restored and verified`.
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Restore-LalumStorage.ps1 -Snapshot latest -To C:\Temp\lalum-restore-test
   ```
3. פותחים 3 קבצים אקראיים מכל bucket ובודקים לפי התוכן: המסמך נפתח והוא המסמך הנכון.
4. מוחקים את `C:\Temp\lalum-restore-test` עם Shift+Delete. יש בה קבצי לקוחות לא מוצפנים.

## בדיקה חודשית (2 דקות)

מריצים `Restore-LalumStorage.ps1 -List`. תמונת המצב האחרונה צריכה להיות מיום ראשון האחרון, עם `ok`. משימה שלא רצה בכלל לא מציגה שום הודעה, ולכן הבדיקה הזו היא מה שתופס אותה. פעם ברבעון חוזרים גם על שלבים 2 עד 4 של האימות.

## שחזור אחרי תקלה

- `Restore-LalumStorage.ps1` משחזר לתיקייה מקומית בלבד, ובודק כל קובץ מול רשימת ה־MD5. bucket אחד: `-Bucket matter-originals`. תמונה מסוימת: `-Snapshot` עם שם מתוך `-List`.
- הוא לא נוגע ב־Supabase. החזרת קבצים ל־Supabase היא כתיבה בפרודקשן, דורשת "מאשר" של אבי, ונעשית בנפרד.
- העותק שומר את הקבצים בלבד. המידע עליהם (סוג תוכן, בעלים) נמצא בטבלה `storage.objects`, והקישור לתיקים בטבלאות של האפליקציה, ושניהם בגיבוי של מסד הנתונים. שחזור מלא צריך את שני הגיבויים.

## תקלות נפוצות

| הודעה | מה לעשות |
|---|---|
| `rclone was not found` | `winget install Rclone.Rclone`, ואז חלון PowerShell חדש. |
| `Credential '...' was not found` | מריצים את פקודת `cmdkey` שמופיעה בהודעה. `cmdkey /list:lalum-supabase-s3` מראה אם רשומה קיימת, בלי הסיסמה. |
| `No buckets were found`, או `SignatureDoesNotMatch` או `AccessDenied` בלוג | המפתח בוטל או הודבק לא נכון. יוצרים מפתח חדש ומריצים שוב את `cmdkey` (אותו שם דורס את הרשומה הקודמת). |
| `OneDrive for work was not found` | מתחברים ל־OneDrive עם avraham@lalum.co, או מעבירים `-Destination`. |
| `Another backup or restore is already running` | מחכים לסיום. אם אין ריצה, בודקים ב־Task Manager שאין `powershell.exe` תקוע. |
| `No snapshots were found` בשחזור, למרות שיש גיבויים | הסיסמאות ב־Credential Manager שונות מאלה שהגיבוי נעשה איתן (יש הבדל בין אותיות גדולות לקטנות). מחזירים אותן ממנהל הסיסמאות עם `cmdkey`. |
| `WARNING ... shrank` או `is gone` | בודקים ב־Supabase אם הקבצים נמחקו במכוון. אם לא: לא מוחקים שום תמונה ישנה, ומשחזרים מהתמונה האחרונה שלפני הירידה. |
| `copy failed` או `verification failed` | פותחים את הלוג שבהודעה. ריצה שנכשלה לא מוחקת דבר, ו־`-List` מציג אותה כ־`no summary`. הריצה הבאה כותבת לתיקייה חדשה. |

## הגבלות

- רץ רק כשהמחשב דולק ואבי מחובר. יום ראשון שהוחמץ רץ בהזדמנות הבאה.
- העותק נכתב קודם לתיקיית OneDrive המקומית, ומגיע לענן רק כש־OneDrive מסנכרן. עד אז הוא נמצא רק במחשב.
- כל תמונת מצב היא עותק מלא, כ־125MB היום, כלומר כ־6.5GB בשנה. שום דבר לא נמחק אוטומטית, ובשנים הקרובות גם אין צורך. אם יידרש לפנות תמונות ישנות, זה ייעשה בכלי נפרד ובאישור, כי שמות התיקיות ב־OneDrive מוצפנים.
- זה לא גיבוי של מסד הנתונים; למסד יש את הגיבויים היומיים של Supabase. `pg_dump` שבועי הוא תוספת אפשרית בהמשך.
- Windows בלבד בינתיים (Credential Manager, משימה מתוזמנת והודעות). גרסת Mac אפשרית בהמשך.

## בדיקות

`scripts/offsite-backup/tests/run-tests.sh` (Linux או macOS, עם pwsh 7 ו־rclone) מריץ את הקוד האמיתי מול תיקייה מקומית במקום Supabase ותיקייה זמנית במקום OneDrive, ומחליף רק את הקריאה מ־Credential Manager במשתני סביבה. 31 בדיקות: הרצה יבשה שלא כותבת, גיבוי ואימות, אין שמות גלויים ואין סיסמאות ביעד או בלוג, שחזור זהה למקור כולל שם קובץ בעברית, סירוב לשחזר לתיקייה לא ריקה, שחזור bucket בודד, סיסמה שגויה, רשומה חסרה, סיסמה קצרה, התרעה על bucket שהצטמק, זיהוי קובץ ששונה ביעד, נעילה מפני ריצה כפולה, ותקינות תחבירית ו־ASCII. ב־24.10.2026 עברו 31 מתוך 31 (PowerShell 7.6, rclone 1.60.1).

לא נבדקו כאן: Credential Manager, המשימה המתוזמנת וההודעות של Windows, PowerShell 5.1, ו־Supabase עצמו. ההרצה היבשה וההרצה הראשונה במחשב של אבי הן הבדיקה של אלה.
