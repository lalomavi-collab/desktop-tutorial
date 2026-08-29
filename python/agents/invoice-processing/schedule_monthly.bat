@echo off
rem הרשמה חד פעמית: משימה מתוזמנת שמכינה את טיוטת החשבוניות ב-01 לכל חודש ב-09:00.
rem ההכנה בלבד רצה אוטומטית. שליחה לרונית נשארת תמיד ידנית (invoices.bat ואישור Y).
chcp 65001 >nul
schtasks /Create /F /TN "LALUM חשבוניות חודשי" /SC MONTHLY /D 1 /ST 09:00 ^
  /TR "cmd /c cd /d \"%~dp0\" && python run_pipeline.py > last_monthly_run.log 2>&1"
if errorlevel 1 (
    echo יצירת המשימה נכשלה. הרץ קובץ זה כמנהל (קליק ימני, Run as administrator).
) else (
    echo המשימה נוצרה: ב-01 לכל חודש ב-09:00 תוכן טיוטת החשבוניות אוטומטית.
    echo התוצאה נשמרת ב-last_monthly_run.log. השליחה עצמה: לחיצה על "חשבוניות LALUM" ואישור Y.
    echo לביטול: schtasks /Delete /TN "LALUM חשבוניות חודשי" /F
)
pause
