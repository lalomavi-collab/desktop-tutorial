@echo off
rem הרצה חודשית: ב-1 בחודש נאסף החודש שהסתיים, לא החודש שרק התחיל.
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONUNBUFFERED=1
cd /d "%~dp0"
echo [START] %date% %time% > last_monthly_run.log
"C:\Users\lalom\AppData\Local\Programs\Python\Python312\python.exe" -u run_pipeline.py --prev --auto-send >> last_monthly_run.log 2>&1
echo [EXIT] %errorlevel% >> last_monthly_run.log
echo [END] %date% %time% >> last_monthly_run.log
exit /b %errorlevel%