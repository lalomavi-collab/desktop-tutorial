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
| `create_marketing_asset` | מייצר נכס שיווקי ממחברת: אודיו (סקירת פודקאסט), וידאו (Video Overview), חידון או מפת חשיבה. |
| `save_to_brain` | שומר סיכום או תובנה למחברת "המוח השני". |

> חשוב: הפלט של `create_marketing_asset` הוא אודיו או וידאו (או חידון או מפת חשיבה), ולא קובץ שקופיות לעריכה. NotebookLM בונה סרטון סקירה מהמקורות שבמחברת, לא מצגת PowerPoint. להבחנה בין "מצגת שקופיות" ל"סקירת וידאו", ראה למטה.

## מיפוי פקודות בעברית

### 1. הצגת המחברות
דוגמאות ניסוח: "תראה לי את ה-notebooks שלי", "אילו מחברות יש לי", "רשימת המחברות".

פעולה: קרא ל-`list_notebooks` והצג את התוצאה כרשימה בעברית. אם אין מחברות, אמור זאת והצע ליצור מחברת חדשה.

### 2. שאלה או העשרה ממחברת
דוגמאות ניסוח: "מה כתוב במחברת X על Y", "תעשיר את השיחה מהמחברת של סיכומי פגישות", "לפי המחברת של נדל\"ן, מה ההשלכות".

פעולה: קרא ל-`ask_notebook` עם `notebook_name` (כותרת המחברת) ו-`question` (השאלה בעברית). אם שם המחברת לא ודאי, הרץ קודם `list_notebooks` והתאם לפי הכותרת הקרובה ביותר. אל תמציא שם מחברת.

### 3. יצירת נכס שיווקי מהמחברת (אודיו או וידאו)
דוגמאות ניסוח: "תכין פודקאסט מהמחברת", "צור סרטון סקירה מה-notebook של נדל\"ן", "בנה חידון מהמחברת של דיני עבודה", "מפת חשיבה מהמחברת".

פעולה: קרא ל-`create_marketing_asset` עם:
- `notebook_name`: כותרת המחברת.
- `asset_type`: אחד מ-`audio` (סקירת פודקאסט), `video` (סרטון סקירה, Video Overview), `quiz` (חידון), `mind_map` (מפת חשיבה).
- `instructions`: הנחיות סגנון בעברית, למשל "בעברית, קצר וענייני, בגובה העיניים".
- `save_path`: נתיב מקומי לשמירת הקובץ כשצריך קובץ להורדה, למשל `notebooklm/output/real-estate-video.mp4`.

מיפוי מונחים: "סרטון" או "סקירת וידאו" נמפים ל-`video`, "פודקאסט" או "הקלטה" ל-`audio`, "חידון" או "שאלון" ל-`quiz`, "מפת חשיבה" ל-`mind_map`.

### מצגת שקופיות מול סקירת וידאו (חשוב)
המילה "מצגת" יכולה להתכוון לשני דברים שונים לגמרי, ולכל אחד צינור אחר:

- **סרטון סקירה מתוך המחברת** (הפלט הטבעי של NotebookLM): השתמש ב-`create_marketing_asset` עם `asset_type=video`. התוצאה היא קובץ וידאו שנבנה מהמקורות שבמחברת, לא שקופיות לעריכה.
- **מצגת שקופיות לעריכה** (PowerPoint או Adobe Express): זה איננו פלט של NotebookLM. לבקשה כזו השתמש בכישור העיצוב `create_visual_design_express_skill` (צינור HTML אל Adobe Express), לא בשרת NotebookLM.

כשמשתמש מבקש "צור מצגת מה-notebook", ודא איזה מהשניים הוא רוצה לפני שאתה מפעיל כלי: סרטון סקירה מהמחברת, או מצגת שקופיות לעריכה שנבנית בנפרד. אפשר גם לשלב: לשאול את המחברת דרך `ask_notebook` כדי לאסוף את התוכן, ואז לבנות ממנו מצגת שקופיות בצינור Express.

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
