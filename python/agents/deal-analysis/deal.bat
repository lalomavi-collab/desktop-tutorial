@echo off
rem ניתוח עסקת נדל"ן, LALUM. לחיצה כפולה מציגה את רשימת העסקאות לבחירה.
chcp 65001 >nul
cd /d "%~dp0"
python run_deal.py %*
echo.
pause
