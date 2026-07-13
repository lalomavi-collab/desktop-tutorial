---
name: notebooklm
description: Hebrew natural-language interface for NotebookLM. Use when the user (usually in Hebrew) asks to see their notebooks, ask a question of a notebook, enrich the conversation from a notebook, generate a marketing asset (audio, video, quiz, mind map) from a notebook, or save research and conversation summaries into a NotebookLM "second brain". Routes Hebrew commands to the notebooklm MCP server tools. Do NOT use for local file search or for non-NotebookLM knowledge bases.
license: MIT
compatibility: Works with Claude Code. Requires the notebooklm MCP server (notebooklm/mcp_server.py) and a one-time Google login via notebooklm/setup.sh.
---

# NotebookLM, ממשק עברי

מדריך זה מחבר בקשות בעברית לכלים של שרת ה-MCP בשם `notebooklm`. השרת מוגדר ב-`.mcp.json` ומקורו ב-`notebooklm/mcp_server.py`. לפני השימוש הראשון יש להריץ פעם אחת את `notebooklm/setup.sh` כדי להתחבר לחשבון Google.

## הכלים הזמינים

| כלי MCP | מה הוא עושה |
| --- | --- |
| `list_notebooks` | מחזיר את כל המחברות (notebooks) עם המזהה והכותרת. |
| `ask_notebook` / `enrich_from_notebook` | שואל שאלה חופשית על מחברת ומחזיר תשובה. |
| `create_marketing_asset` | מייצר נכס שיווקי (אודיו, וידאו, חידון, מפת חשיבה) ממחברת. |
| `save_to_brain` | שומר סיכום או תובנה למחברת "המוח השני". |

## מיפוי פקודות בעברית

### 1. הצגת המחברות
דוגמאות ניסוח: "תראה לי את ה-notebooks שלי", "אילו מחברות יש לי", "רשימת המחברות".

פעולה: קרא ל-`list_notebooks` והצג את התוצאה כרשימה בעברית. אם אין מחברות, אמור זאת והצע ליצור מחברת חדשה.

### 2. שאלה או העשרה ממחברת
דוגמאות ניסוח: "מה כתוב במחברת X על Y", "תעשיר את השיחה מהמחברת של סיכומי פגישות", "לפי המחברת של נדל\"ן, מה ההשלכות".

פעולה: קרא ל-`ask_notebook` עם `notebook_name` (כותרת המחברת) ו-`question` (השאלה בעברית). אם שם המחברת לא ודאי, הרץ קודם `list_notebooks` והתאם לפי הכותרת הקרובה ביותר. אל תמציא שם מחברת.

### 3. יצירת נכס שיווקי
דוגמאות ניסוח: "צור מצגת שיווקית מה-notebook של נדל\"ן", "תכין פודקאסט מהמחברת", "בנה חידון מהמחברת של דיני עבודה", "מפת חשיבה מהמחברת".

פעולה: קרא ל-`create_marketing_asset` עם:
- `notebook_name`: כותרת המחברת.
- `asset_type`: אחד מ-`audio` (פודקאסט), `video` (מצגת או סרטון), `quiz` (חידון), `mind_map` (מפת חשיבה). ברירת מחדל: `video` כשמדובר ב"מצגת".
- `instructions`: הנחיות סגנון בעברית, למשל "בעברית, קצר וענייני, בגובה העיניים".
- `save_path`: נתיב מקומי לשמירת הקובץ כשצריך קובץ להורדה, למשל `notebooklm/output/real-estate-video.mp4`.

מיפוי מונחים: "מצגת" או "סרטון" נמפים ל-`video`, "פודקאסט" או "הקלטה" ל-`audio`, "חידון" או "שאלון" ל-`quiz`, "מפת חשיבה" ל-`mind_map`.

### 4. שמירה למוח השני
דוגמאות ניסוח: "שמור את זה למוח שלי", "תשמור את הסיכום ל-NotebookLM", "שמור את המחקר היומי ל-NotebookLM".

פעולה: קרא ל-`save_to_brain` עם `summary` (הטקסט לשמירה, תומך ב-markdown). ברירת המחדל למחברת היעד היא "המוח שלי", וניתן לשנות דרך `notebook_name`. לשמירת תיקיית מחקר יומי שלמה, ראה למטה את זרימת המחקר היומי.

## זרימת המחקר היומי אל NotebookLM

הסוכן היומי (`scripts/daily_research_agent.py`) כותב את התוצרים אל `daily-research/YYYY-MM-DD/`. כדי לדחוף תיקייה כזו אל NotebookLM ללא צריכת טוקנים של Claude, הרץ את העוזר הייעודי:

```bash
python notebooklm/save_daily_research.py            # תאריך היום
python notebooklm/save_daily_research.py 2026-07-13 # תאריך מפורש
```

העוזר מאחד את קובצי ה-markdown של אותו יום (trends, מאמר, שאלות ותשובות, תסריט אווטר) ושומר אותם כמקור אחד במחברת "המוח שלי". אפשר לתזמן אותו בסוף הריצה של `daily-research.yml`.

## כללי איכות (עברית)

- כל טקסט המוצג למשתמש נכתב בעברית, RTL, בלי מקפים כהפרדה בין משפטים או פסוקיות. השתמש בפסיק, נקודה, נקודתיים או סוגריים.
- שמור אסימונים לטיניים וטכניים (כתובות, כתובות דוא"ל, `mp4`, `UTF-8`) מבודדים LTR בתוך טקסט עברי.
- אל תמציא שמות מחברות או מזהים. כשלא בטוח, הרץ `list_notebooks` ואמת מול הרשימה.
- בקבצים שנוצרים למשתמש (docx, html, pdf, פוסטים), החל את תקני העברית RTL וצבעי Prestige Executive כפי שמוגדר ב-CLAUDE.md.

## פתרון תקלות

- "notebooklm-py not found" או "mcp package not found": הרץ `bash notebooklm/setup.sh`.
- בקשה שנכשלת באימות: הרץ שוב `notebooklm login` (הפעלה נשמרת מקומית, פעם אחת).
- מחברת לא נמצאה: הכותרת חייבת להתאים במדויק, הרץ `list_notebooks` וקח את הכותרת המדויקת.
