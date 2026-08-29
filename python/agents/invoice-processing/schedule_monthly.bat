@echo off
rem הרשמה חד פעמית: משימה מתוזמנת ב-01 לכל חודש ב-09:00 שאוספת, בונה טבלה,
rem ואם שער האימות עובר (כל הפריטים עם PDF והאיסוף תקין) שולחת אוטומטית לרונית.
rem אם משהו חסר, לא נשלח דבר והסיבות נרשמות ב-last_monthly_run.log.
chcp 65001 >nul
schtasks /Create /F /TN "LALUM חשבוניות חודשי" /SC MONTHLY /D 1 /ST 09:00 ^
  /TR "cmd /c cd /d \"%~dp0\" && python run_pipeline.py --auto-send > last_monthly_run.log 2>&1"
if errorlevel 1 (
    echo יצירת המשימה נכשלה. הרץ קובץ זה כמנהל (קליק ימני, Run as administrator).
) else (
    echo המשימה נוצרה: ב-01 לכל חודש ב-09:00 איסוף, אימות, ושליחה אוטומטית אם הכל תקין.
    echo אם חסר PDF או שהאיסוף נכשל, לא נשלח דבר, הסיבות ב-last_monthly_run.log,
    echo ואז משלימים ושולחים ידנית עם "חשבוניות LALUM" ואישור Y.
    echo לביטול: schtasks /Delete /TN "LALUM חשבוניות חודשי" /F
)
pause
