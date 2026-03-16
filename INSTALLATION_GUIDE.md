# מדריך התקנת NotebookLM-py על Windows

## שלב 1 - התקנת Python

Python נדרש כדי להשתמש ב-pip ובחבילות Python.

### אפשרות א - התקנה דרך PowerShell (מומלץ)

```powershell
winget install Python.Python.3.12
```

### אפשרות ב - התקנה ידנית

1. היכנסו לאתר: https://www.python.org/downloads/
2. הורידו את הגרסה האחרונה של Python 3
3. **חשוב מאוד**: בזמן ההתקנה סמנו את התיבה **"Add Python to PATH"**
4. לחצו "Install Now"

## שלב 2 - סגירה ופתיחה מחדש של PowerShell

לאחר ההתקנה, **סגרו את PowerShell לחלוטין ופתחו חלון חדש**.
זה נדרש כדי שהמערכת תזהה את Python ו-pip.

## שלב 3 - בדיקה שהתקנת Python הצליחה

```powershell
python --version
pip --version
```

אם שתי הפקודות מחזירות מספר גרסה - הכל תקין.

### פתרון בעיות

אם `pip` עדיין לא מזוהה לאחר ההתקנה, נסו:

```powershell
python -m pip --version
```

אם גם `python` לא מזוהה, יש להוסיף את Python ל-PATH באופן ידני:

```powershell
# בדיקה היכן Python מותקן
Get-Command python -ErrorAction SilentlyContinue
# או חיפוש ידני
ls "$env:LOCALAPPDATA\Programs\Python"
```

## שלב 4 - התקנת notebooklm-py

```powershell
pip install "notebooklm-py[browser]"
```

## שלב 5 - התקנת Playwright (דפדפן)

```powershell
playwright install chromium
```

## שגיאות נפוצות

| שגיאה | פתרון |
|-------|-------|
| `pip is not recognized` | Python לא מותקן או לא נוסף ל-PATH. חזרו לשלב 1 |
| `python is not recognized` | סגרו ופתחו PowerShell מחדש, או התקינו Python מחדש עם "Add to PATH" |
| `Access denied` | הריצו PowerShell כמנהל מערכת (Run as Administrator) |
