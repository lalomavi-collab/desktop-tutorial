#!/usr/bin/env python3
"""
Daily CEO Report Generator
דוח יומי למנכ"ל אורי — מסכם את פעילות סוכן המחקר + אווטר

Reads today's research outputs and generates a concise executive summary
saved to daily-research/YYYY-MM-DD/ceo_report.md
"""

import os
import json
import datetime
import anthropic

OUTPUT_DIR = "daily-research"


def load_today_outputs(today: str) -> dict[str, str]:
    base = os.path.join(OUTPUT_DIR, today)
    files = {
        "summary": "summary.json",
        "trends": "trends.md",
        "article": "article_he.md",
        "qa": "qa.md",
        "avatar": "avatar_script.md",
    }
    result = {}
    for key, fname in files.items():
        path = os.path.join(base, fname)
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                result[key] = f.read()
    return result


def generate_ceo_report(today: str, data: dict[str, str]) -> str:
    client = anthropic.Anthropic()

    summary_json = json.loads(data.get("summary", "{}"))
    top_topics = summary_json.get("top_topics", [])
    scores = summary_json.get("scores", {})

    topics_line = " | ".join(
        f"{t} ({scores.get(t,0)})" for t in top_topics[:5]
    )

    article_preview = data.get("article", "")[:400]
    qa_preview = data.get("qa", "")[:300]
    avatar_preview = data.get("avatar", "")[:300]

    prompt = f"""
אתה מנהל תפעול של משרד עורכי דין נדל"ן ומקרקעין.
כתוב דוח מנכ"ל יומי קצר ומדויק בעברית עבור אורי המנכ"ל.

נתונים לתאריך {today}:
- נושאים מובילים: {topics_line}
- תצוגת מאמר: {article_preview}...
- תצוגת Q&A: {qa_preview}...
- תצוגת תסריט אווטר: {avatar_preview}...

המבנה הנדרש:
# דוח יומי — {today}
## סוכן מחקר + אווטר | מדווח לאורי מנכ"ל

### 🎯 נושא יום זה
[משפט אחד: הנושא המוביל ולמה הוא רלוונטי היום]

### 📊 מה הופק היום
- ✅ מאמר SEO: [כותרת המאמר]
- ✅ שאלות-תשובות: 7 זוגות על [נושא]
- ✅ תסריט אווטר: [נושא התסריט] — [60/90] שניות
- ✅ דוח מגמות: [2-3 מילים]

### 💡 המלצת יום
[המלצה אחת קצרה: מה כדאי לפרסם היום ועל איזו פלטפורמה]

### 📈 פוטנציאל לידים
[הערכה: אם ינוצל תוכן זה — כמה פניות צפויות? למה?]

### ⏭️ מחר
[נושא מוצע למחקר מחר על בסיס המגמות]

---
*נוצר אוטומטית ע"י סוכן מחקר + אווטר | {today} 06:00*
"""

    msg = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


def save_report(today: str, report: str) -> str:
    path = os.path.join(OUTPUT_DIR, today, "ceo_report.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(report)
    return path


def send_telegram(report: str, today: str):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return

    import urllib.request
    import urllib.parse

    # Trim for Telegram (4096 char limit)
    msg = f"📋 *דוח מנכ\"ל יומי — {today}*\n\n" + report[:3500]

    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "Markdown",
    }).encode()

    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        print("  ✅ Telegram notification sent")
    except Exception as e:
        print(f"  ⚠️  Telegram failed: {e}")


def main():
    today = datetime.date.today().isoformat()
    print(f"\n📋 CEO Report Generator — {today}")
    print("=" * 50)

    data = load_today_outputs(today)
    if not data:
        print(f"  ❌ No research data found for {today}. Run daily_research_agent.py first.")
        return

    print("  ⟳ Generating CEO report...")
    report = generate_ceo_report(today, data)

    path = save_report(today, report)
    print(f"  ✅ Saved: {path}")

    send_telegram(report, today)

    print("\n--- REPORT PREVIEW ---")
    print(report[:600])
    print("...")


if __name__ == "__main__":
    main()
