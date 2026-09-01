@echo off
rem הרצה חודשית: ב-1 בחודש נאסף החודש שהסתיים, לא החודש שרק התחיל.
rem בונה את הדוח מתוך ה-PDF, ומכין טיוטה ב-Outlook. הטיוטה ולא שליחה:
rem כל חודש כולל קבלות ללא מע"מ ומסמכים סרוקים, ואלה מסומנים estimated,
rem ו-blockers() מבטל שליחה אוטומטית כל עוד קיים ולו פריט אחד כזה.
rem --send כאן היה יוצר משימה שלא שולחת דבר, בשקט, מדי חודש.
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONUNBUFFERED=1
set TESSDATA_PREFIX=C:\Users\lalom\tessdata
set PATH=%PATH%;C:\Program Files\Tesseract-OCR
cd /d "%~dp0"
echo [START] %date% %time% > last_monthly_run.log
"C:\Users\lalom\AppData\Local\Programs\Python\Python312\python.exe" -u monthly_report.py --prev >> last_monthly_run.log 2>&1
echo [EXIT] %errorlevel% >> last_monthly_run.log
echo [END] %date% %time% >> last_monthly_run.log
exit /b %errorlevel%