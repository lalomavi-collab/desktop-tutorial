@echo off
rem סוכן חשבוניות LALUM. לחיצה כפולה: אוסף ממיילים ומהתיקייה ומציג טיוטה.
rem שליחה לרונית רק אחרי אישור מפורש כאן.
chcp 65001 >nul
cd /d "%~dp0"

python run_pipeline.py
if errorlevel 1 (
    echo.
    echo ההרצה נכשלה, בדוק את ההודעות למעלה.
    pause
    exit /b 1
)

echo.
set /p answer=לשלוח את המייל לרונית עכשיו? (כן = Y):
if /i "%answer%"=="Y" (
    python run_pipeline.py --send
) else (
    echo לא נשלח. אפשר להריץ שוב בכל עת.
)
echo.
pause
