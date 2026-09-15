@echo off
rem ============================================================
rem  LALUM - הרצה חודשית של סוכן החשבוניות
rem ============================================================
rem  ב-1 בחודש נאסף החודש שהסתיים, לא החודש שרק התחיל.
rem
rem  מצב נוכחי: טיוטה. הדוח וטבלת החישוב נוצרים ומצורפים לטיוטה
rem  ב-Outlook, שאברהם פותח, מוודא ושולח בעצמו.
rem  למעבר לשליחה אוטומטית: הוסף --send לשורת ההרצה. שער האימות
rem  נשאר בתוקף גם אז, ויחסום חודש שיש בו סכומים לא מאומתים.
rem
rem  בסיום נשלחת התראה לתיבת המשרד עם תוצאת ההרצה. בלעדיה, הרצה
rem  שנכשלה נראית בדיוק כמו הרצה שהצליחה: שקטה.
rem
rem  קודי יציאה: 0 נשלח | 11 טיוטה | 12 נחסם | 13 תיקייה ריקה
rem               14 שגיאת Outlook | 1 קריסה
rem ============================================================
chcp 65001 >/dev/null
set PYTHONIOENCODING=utf-8
set PYTHONUNBUFFERED=1
set "PY=C:\Users\lalom\AppData\Local\Programs\Python\Python312\python.exe"
cd /d "%~dp0"

echo [START] %date% %time% > last_monthly_run.log
"%PY%" -u monthly_report.py --prev >> last_monthly_run.log 2>&1
set RC=%errorlevel%
echo [EXIT] %RC% >> last_monthly_run.log
echo [END] %date% %time% >> last_monthly_run.log

rem ההתראה רצה תמיד, גם על הצלחה. כישלון שלה לא משנה את קוד היציאה.
"%PY%" -u notify_run.py %RC% "%~dp0last_monthly_run.log" >> last_monthly_run.log 2>&1

exit /b %RC%
