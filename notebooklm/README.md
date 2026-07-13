<div dir="rtl" lang="he">

# NotebookLM, ממשק עברי

חיבור של NotebookLM אל Claude דרך שרת MCP. מאפשר לראות מחברות, לשאול שאלות, להעשיר שיחות, לייצר נכסים שיווקיים (אודיו, וידאו, חידון, מפת חשיבה) ולבנות "מוח שני" של סיכומים ומחקר.

## מה יש כאן

| קובץ | תפקיד |
| --- | --- |
| `mcp_server.py` | שרת ה-MCP שחושף את הכלים ל-Claude. |
| `setup.sh` | התקנה חד פעמית והתחברות לחשבון Google. |
| `save_daily_research.py` | דוחף תיקיית מחקר יומי אל המחברת "המוח שלי". |

השרת רשום ב-`.mcp.json` בשורש הריפו. הממשק בעברית (מיפוי פקודות טבעיות אל הכלים) נמצא ב-`.claude/skills/notebooklm/SKILL.md`.

## התקנה (פעם אחת)

```bash
bash notebooklm/setup.sh
```

הסקריפט מתקין את `notebooklm-py[browser]` ואת `mcp`, מתקין דפדפן Chromium ל-Playwright, ופותח חלון התחברות ל-Google. ההפעלה נשמרת מקומית, כך שההתחברות נדרשת פעם אחת.

## הכלים

1. `list_notebooks`, רשימת כל המחברות עם מזהה וכותרת.
2. `ask_notebook` / `enrich_from_notebook`, שאלה חופשית על מחברת.
3. `create_marketing_asset`, יצירת נכס שיווקי: `audio`, `video`, `quiz`, `mind_map`.
4. `save_to_brain`, שמירת סיכום או תובנה למחברת "המוח שלי".

## דוגמאות שימוש

שלוש הבקשות הנפוצות, בעברית טבעית:

<div dir="ltr">

```
"תראה לי את ה-notebooks שלי"
"צור מצגת שיווקית מה-notebook של נדל\"ן"
"שמור את המחקר היומי ל-NotebookLM"
```

</div>

- הראשונה מפעילה את `list_notebooks`.
- השנייה מפעילה את `create_marketing_asset` עם `asset_type=video`.
- השלישית שומרת את המחקר היומי, ראו למטה.

## שמירת מחקר יומי

הסוכן היומי כותב תוצרים אל `daily-research/YYYY-MM-DD/`. כדי לשמור יום שלם אל NotebookLM:

<div dir="ltr">

```bash
python notebooklm/save_daily_research.py             # היום
python notebooklm/save_daily_research.py 2026-07-13  # תאריך מפורש
```

</div>

העוזר מאחד את קובצי ה-markdown של אותו יום (מגמות, מאמר, שאלות ותשובות, תסריט אווטר) ושומר אותם כמקור אחד במחברת "המוח שלי". אפשר לתזמן אותו כצעד אחרון בתהליך `daily-research.yml`.

## פתרון תקלות

- הודעה "notebooklm-py not found" או "mcp package not found": הריצו שוב `bash notebooklm/setup.sh`.
- כשל אימות: הריצו `notebooklm login`.
- "מחברת לא נמצאה": הכותרת חייבת להתאים במדויק. הריצו `list_notebooks` וקחו את הכותרת המדויקת.

## הערה

זהו כלי עזר. אין בו ייעוץ משפטי ואין בתוצריו התחייבות מקצועית.

</div>
