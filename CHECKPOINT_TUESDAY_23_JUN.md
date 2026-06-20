# Checkpoint — שלישי 23.6.2026
## מה נשאר לביצוע

---

## ✅ מה הושלם עד כה

### Pipeline מחקר יומי
- `scripts/daily_research_agent.py` — Google Trends + Claude Opus → 4 קבצי פלט יומיים
- `scripts/daily_ceo_report.py` — דוח מנכ"ל + Telegram
- `scripts/daily_avatar_video.py` — וידאו Synthesia יומי
- `.github/workflows/daily-research.yml` — GitHub Actions, 06:00 IST כל יום
- `dashboard/agents.html` — סוכן מחקר+אווטר נוסף תחת אורי מנכ"ל

### NotebookLM
- `.mcp.json` — מוגדר עם שרת `notebooklm` מקומי
- `notebooklm/mcp_server.py` + `notebooklm/setup.sh` — קיימים ב-repo
- אימות בוצע בWindows (`notebooklm login` — עבד)
- **הגבלה**: MCP עובד רק מהמחשב המקומי, לא מענן (Google חוסם IP ענן)

---

## 🔲 צעדים לשלישי

### צעד 1 — GitHub Secrets (5 דקות)
כנס ל: `https://github.com/lalomavi-collab/desktop-tutorial/settings/secrets/actions`

| Secret | מאיפה |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SYNTHESIA_API_KEY` | synthesia.io → Settings → API |
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `TELEGRAM_CHAT_ID` | הצ'אט שלך עם הבוט |

### צעד 2 — אווטר Synthesia
```powershell
# ב-PowerShell (עם SYNTHESIA_API_KEY)
cd C:\Users\lalom\Documents\desktop-tutorial
$env:SYNTHESIA_API_KEY="YOUR_KEY_HERE"
python scripts/avatar_setup.py
```
→ מציג רשימת אווטרים + שומר `avatar-config/soul_config.json` אוטומטית

### צעד 3 — הרצה ידנית של Pipeline
בגיטהב → Actions → "Daily Research Agent" → "Run workflow"
בדוק שכל 4 קבצים נוצרו ב-`daily-research/YYYY-MM-DD/`

### צעד 4 — NotebookLM מקומי (אופציונלי)
פתח Claude Code Desktop בWindows → NotebookLM MCP כבר מחובר
ניתן לבקש: "רשום לי את ה-notebooks" ויעבוד מקומית

---

## מבנה קבצים שנוצרים כל יום
```
daily-research/
  2026-06-23/
    trends.md          ← מגמות Google Trends
    article_he.md      ← כתבת SEO עברית
    qa.md              ← שאלות ותשובות
    avatar_script.md   ← תסריט לאווטר
    ceo_report.md      ← דוח מנכ"ל → Telegram
    avatar_video.json  ← קישור וידאו Synthesia
```

---

## Branch פעיל
`claude/keen-knuth-l46yh` — PR מוזג ל-main
