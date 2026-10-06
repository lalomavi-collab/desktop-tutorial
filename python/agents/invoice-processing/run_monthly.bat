@echo off
rem ============================================================
rem  LALUM - הרצה חודשית של סוכן החשבוניות
rem ============================================================
rem  ב-1 בחודש נאסף החודש שהסתיים, לא החודש שרק התחיל.
rem
rem  מצב נוכחי: שליחה אוטומטית. הדוח וטבלת החישוב נשלחים
rem  להנהלת החשבונות בלי התערבות, בכפוף לשני שערים:
rem    1. שער האימות - חוסם חודש שיש בו סכום שלא חולץ או סכום משוער.
rem    2. סמן הכפילות - חוסם חודש שכבר נשלח, גם בהרצה חוזרת.
rem  פריט שאומת ידנית משוחרר דרך יומן האישורים:
rem    python monthly_report.py --month YYYY-MM --ack FILE --ack-note "נימוק"
rem  שחרור הוא מעשה מפורש ומתועד. אין לעקוף את השער עצמו.
rem
rem  לחזרה למצב טיוטה: הסר --send משורת ההרצה.
rem
rem  אין להוסיף כאן chcp. שינוי דף קוד בתוך קובץ אצווה שמכיל
rem  עברית משבש את הפירוק של שאר השורות ב-cmd.exe. פלט פייתון
rem  נשלט דרך PYTHONIOENCODING ו-PYTHONUTF8, ולכן chcp מיותר.
rem
rem  בסיום נשלחת התראה לתיבת המשרד עם תוצאת ההרצה. בלעדיה, הרצה
rem  שנכשלה נראית בדיוק כמו הרצה שהצליחה: שקטה.
rem
rem  קודי יציאה: 0 נשלח | 11 טיוטה | 12 נחסם | 13 תיקייה ריקה
rem               14 שגיאת Outlook | 15 נשלח קודם | 1 קריסה
rem ============================================================
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
set PYTHONUNBUFFERED=1
set TESSDATA_PREFIX=C:\Users\lalom\tessdata
set "PATH=%PATH%;C:\Program Files\Tesseract-OCR"
set "PY=C:\Users\lalom\AppData\Local\Programs\Python\Python312\python.exe"
cd /d "%~dp0"

echo [START] %date% %time% > last_monthly_run.log
"%PY%" -u monthly_report.py --prev --send >> last_monthly_run.log 2>&1
set RC=%errorlevel%
echo [EXIT] %RC% >> last_monthly_run.log
echo [END] %date% %time% >> last_monthly_run.log

rem ההתראה רצה תמיד, גם על הצלחה. כישלון שלה לא משנה את קוד היציאה.
"%PY%" -u notify_run.py %RC% "%~dp0last_monthly_run.log" >> last_monthly_run.log 2>&1

exit /b %RC%