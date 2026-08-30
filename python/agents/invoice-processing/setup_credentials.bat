@echo off
rem הזנה חד פעמית של סיסמאות לכספת של Windows. ההקלדה מוסתרת, שום סיסמה לא נכתבת לקובץ.
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
python setup_credentials.py %*
pause