# Full-Cycle Job Application Agent

סוכן אוטונומי למציאה, ציון, ואפליקציה אוטומטית למשרות — עם אישור אנושי לפני כל פעולה.

## ארכיטקטורה

```
[רשימת משרות (JSON)] 
        ↓
[job_scorer.py] — מציין כל משרה 1-10 ע"י LLM
        ↓ (ציון >= 8 בלבד)
[approval_flow.py] — שואל אישור ממך (y/n)
        ↓ (אם y)
[field_mapper.py] — LLM ממפה שדות טופס → ערכי פרופיל
        ↓
[browser_apply.py] — Playwright ממלא ושולח
        ↓
[screenshot saved] + [log entry written]
```

## הכנה

### 1. התקנת תלויות
```bash
pip install playwright pdfplumber pypdf rich anthropic
playwright install chromium
```

### 2. עדכון הפרופיל
ערוך את `profile_context.json` עם הפרטים האישיים שלך.

### 3. הוספת קורות חיים
שמור קובץ בשם `resume.pdf` בתיקיית `job_agent/`.

## הפעלה

### מצב דמו (ללא CV אמיתי)
```bash
python -m job_agent.main --demo --dry-run
```

### עם משרות אמיתיות
```bash
python -m job_agent.main --jobs job_agent/sample_jobs.json --resume job_agent/resume.pdf --min-score 8
```

### עם דפדפן גלוי (מומלץ לפעמים ראשונות)
```bash
python -m job_agent.main --jobs job_agent/sample_jobs.json --resume job_agent/resume.pdf --headed
```

### Dry Run (ציון + אישור בלי אפליקציה בפועל)
```bash
python -m job_agent.main --jobs job_agent/sample_jobs.json --dry-run
```

## מבנה קבצים

```
job_agent/
  __init__.py
  main.py              # נקודת כניסה + orchestrator
  profile_context.json # פרטי מועמד + תשובות לשאלות סינון
  resume_parser.py     # חילוץ טקסט מ-PDF
  job_scorer.py        # ציון משרות ע"י LLM
  field_mapper.py      # מיפוי שדות טופס ← LLM
  browser_apply.py     # Playwright אוטומציה
  approval_flow.py     # Human-in-the-Loop CLI
  sample_jobs.json     # משרות לדוגמה
  screenshots/         # צילומי מסך אחרי שליחה
  logs/
    application_log.jsonl  # יומן כל ההחלטות
```

## פרמטרים

| Flag | Default | תיאור |
|------|---------|--------|
| `--jobs` | — | נתיב לקובץ JSON עם משרות |
| `--resume` | `resume.pdf` | נתיב ל-PDF של קורות חיים |
| `--min-score` | `8.0` | ציון מינימלי להציג למשתמש |
| `--headed` | headless | הצג חלון דפדפן |
| `--dry-run` | False | ציון + אישור, ללא אפליקציה בפועל |
| `--demo` | False | השתמש במשרות לדוגמה |
