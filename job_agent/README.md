# Worker — סוכן הגשת קורות חיים אוטונומי
### ד"ר אברהם (אבי) לאלום · AI Law · Autonomous Systems

---

## מבנה המערכת המלא

```
job_agent/
│
├── 📄 profile_context.json        ← פרופיל מלא (JSON) — פרטים, העדפות, שכר
├── 📄 resume.docx                 ← קורות חיים (נשמר קבוע — לא נדרש העלאה חוזרת)
│
├── profile/                       ← פרופיל מובנה (markdown)
│   ├── 01-candidate-profile.md   ← השכלה, ניסיון, פרסומים
│   ├── 02-behavioral-profile.md  ← סגנון עבודה, מוטיבציות, יעדי קריירה
│   ├── 03-writing-style.md       ← כללי כתיבת מכתבי מועמדות
│   ├── 04-job-evaluation.md      ← מסגרת ציון 1-10 עם אותות מילות מפתח
│   └── 07-interview-prep.md      ← דוגמאות STAR + שאלות למרואיין
│
├── applications/
│   └── tracker.csv               ← יומן כל ההגשות (תאריך, חברה, ציון, סטטוס)
│
├── logs/
│   └── application_log.jsonl     ← לוג JSON של כל החלטה
│
├── job_scraper.py                 ← סורק משרות (AllJobs / Drushim / LinkedIn / Indeed)
├── job_scorer.py                  ← ציון AI למשרות (Claude API, 1-10)
├── field_mapper.py                ← מיפוי שדות טופס -> ערכי פרופיל (Claude API)
├── browser_apply.py               ← מילוי טפסים והגשה (Playwright)
├── approval_flow.py               ← Human-in-the-Loop CLI (y/n/d)
├── resume_parser.py               ← קריאת DOCX/PDF ללא תלויות כבדות
├── main.py                        ← נקודת כניסה ראשית (argparse)
└── run_worker.py                  ← מצב עצמאי (ללא ANTHROPIC_API_KEY)

.claude/commands/                  ← פקודות Claude Code slash
├── apply.md                      ← /apply — Drafter->Reviewer->הגשה
├── scrape.md                     ← /scrape — חיפוש חי + אישור
├── expand.md                     ← /expand — העשרת פרופיל מ-ORCID/lalum.co
└── upskill.md                    ← /upskill — ניתוח פערי מיומנויות
```

---

## זרימת העבודה

```
[1] SCRAPE — חיפוש משרות
    AllJobs.co.il    (עברית: "יועץ משפטי בינה מלאכותית")
    Drushim.co.il    (עברית: "דירקטור משפטי טכנולוגיה")
    LinkedIn Israel  (geoId=ישראל)
    LinkedIn/Indeed  (Remote — AI law, autonomous systems legal)
              |
[2] SCORE — ציון AI (Claude API)
    כל משרה מקבלת ציון 1-10
    9-10=מושלם, 7-8=טוב, 5-6=בינוני, <5=דחייה אוטומטית
    בונוס +0.5 למשרות בישראל
    רק משרות >=7 ממשיכות
              |
[3] APPROVE — אישור אנושי
    y = אשר והגש
    n = דלג (נרשם ביומן)
    d = הצג תיאור מלא
              |
[4] APPLY — הגשה אוטומטית (Playwright)
    פותח Chrome
    מזהה שדות הטופס
    Claude ממפה שדות -> ערכי פרופיל
    ממלא: שם, אימייל, טלפון, LinkedIn, קורות חיים
    מכתב מועמדות מותאם
    מגיש ושומר צילום מסך
              |
[5] LOG — תיעוד
    applications/tracker.csv
    logs/application_log.jsonl
```

---

## התקנה על המחשב (Windows PowerShell)

### שלב 1 — שכפל את הריפו (פעם אחת בלבד)

```powershell
git clone https://github.com/lalomavi-collab/desktop-tutorial
cd desktop-tutorial
git checkout claude/wonderful-ritchie-5g8mje
```

### שלב 2 — התקן תלויות Python

```powershell
pip install anthropic playwright rich python-docx pdfplumber
playwright install chromium
```

**מה כל חבילה עושה:**
- `anthropic` — חיבור ל-Claude API לציון ומיפוי שדות
- `playwright` — שליטה בדפדפן Chrome להגשת טפסים
- `rich` — תצוגה יפה בטרמינל (צבעים, טבלאות)
- `python-docx` + `pdfplumber` — קריאת קורות החיים

### שלב 3 — הגדר את מפתח ה-API

```powershell
# זמני (לסשן הנוכחי בלבד):
$env:ANTHROPIC_API_KEY="sk-ant-..."

# קבוע (מומלץ — שמור בין הפעלות):
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY","sk-ant-...","User")
```

> צור מפתח חדש בכתובת: https://console.anthropic.com/settings/api-keys

### שלב 4 — הרץ

#### ריצה מומלצת — ישראל ראשון

```powershell
python -m job_agent.main --scrape --resume job_agent/resume.docx --headed --min-score 7
```

**מה קורה:**
1. נפתח Chrome — תראה אותו סורק AllJobs, Drushim, LinkedIn
2. Claude מציין כל משרה שנמצאת
3. מוצגות רק משרות עם ציון >=7
4. לכל משרה: y=הגש / n=דלג / d=פרטים

#### ריצה מהירה — רק ישראל

```powershell
python -m job_agent.main --scrape --sources alljobs,drushim --resume job_agent/resume.docx --headed --min-score 6
```

#### ריצה בינלאומית — Remote בלבד

```powershell
python -m job_agent.main --scrape --no-israel --resume job_agent/resume.docx --headed --min-score 7
```

#### שאילתות מותאמות

```powershell
python -m job_agent.main --scrape --queries "AI law Israel,legal tech counsel,Mobileye legal" --headed --min-score 6
```

#### בדיקה מהירה (ללא סריקה — משרות לדוגמה)

```powershell
python -m job_agent.main --demo --dry-run
```

---

## פקודות Claude Code (בתוך claude CLI)

פתח PowerShell בתיקיית הפרויקט והרץ `claude`:

```powershell
cd C:\Users\lalom\desktop-tutorial
claude
```

בתוך Claude Code הרץ:

```
/scrape          <- חיפוש משרות חי + אישור אינטראקטיבי

/apply https://waymo.com/careers/...    <- הגשה למשרה ספציפית
/apply                                  <- הדבק תיאור משרה ישירות

/expand          <- סרוק ORCID + lalum.co + Google Scholar -> עדכן פרופיל

/upskill         <- ניתוח פערי מיומנויות vs. משרות שנצפו
```

---

## כללי האוטונומיה

| ציון | חברה מאושרת? | פעולה |
|------|-------------|-------|
| >=9.5 | כן | הגשה אוטומטית — ללא שאלה |
| 7.0-9.4 | לא משנה | מחכה לאישורך |
| <7.0 | לא משנה | דילוג שקט |

**חברות מאושרות לאוטו-הגשה:**
Waymo, Tesla, Mercedes, Mobileye, ECB, OECD, Microsoft, Google

---

## פתרון בעיות

| בעיה | פתרון |
|------|-------|
| `ANTHROPIC_API_KEY not set` | `$env:ANTHROPIC_API_KEY="sk-ant-..."` |
| `playwright not found` | `pip install playwright && playwright install chromium` |
| `No jobs scored >= 7` | הוסף `--min-score 5` או שנה `--queries` |
| AllJobs לא מחזיר תוצאות | הרץ `--headed` ובדוק את הדפדפן בעצמך |
| קורות חיים לא נמצאו | וודא נתיב: `job_agent/resume.docx` |
| `ModuleNotFoundError` | `pip install anthropic playwright rich` |
