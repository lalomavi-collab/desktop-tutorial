#!/usr/bin/env python3
"""
Daily Legal Real-Estate Research Agent
מחקר יומי אוטומטי - נדל"ן ומקרקעין

Fetches trending search topics, then generates:
  1. Trend report (trends.md)
  2. Hebrew SEO article (article_he.md)
  3. Q&A pairs (qa.md)
  4. Avatar talking-point script (avatar_script.md)
"""

import os
import json
import datetime
import time
import random
import anthropic

# ─── CONFIG ──────────────────────────────────────────────────────────────────

TOPIC_SEEDS = [
    "עורך דין מקרקעין",
    "עורך דין נדל\"ן",
    "ליווי משפטי רכישת דירה",
    "חוזה מכר דירה",
    "בדיקות נאותות נדל\"ן",
    "ליקויי בנייה תביעה",
    "פינוי שוכר",
    "פינוי בינוי עורך דין",
    "תמ\"א 38 זכויות",
    "מס שבח נדל\"ן",
    "הסכם שיתוף מקרקעין",
    "רישום טאבו",
    "עסקת קומבינציה",
    "ערעור על שומת מס רכישה",
    "תביעה נגד קבלן ליקויים",
    "בית משותף תקנון",
    "עיקול נכס מקרקעין",
    "צו מניעה נדל\"ן",
    "חוזה שכירות בלתי מוגנת",
    "מימוש משכנתה",
]

OUTPUT_DIR = "daily-research"

# ─── GOOGLE TRENDS ────────────────────────────────────────────────────────────


def fetch_trends_pytrends(keywords: list[str]) -> dict[str, int]:
    """Try to pull relative interest scores from Google Trends."""
    try:
        from pytrends.request import TrendReq

        pytrends = TrendReq(hl="iw-IL", tz=120, timeout=(10, 25), retries=2, backoff_factor=0.5)
        scores: dict[str, int] = {}

        # Process in batches of 5 (pytrends limit)
        for i in range(0, len(keywords), 5):
            batch = keywords[i : i + 5]
            try:
                pytrends.build_payload(batch, cat=0, timeframe="now 7-d", geo="IL")
                data = pytrends.interest_over_time()
                if not data.empty:
                    for kw in batch:
                        if kw in data.columns:
                            scores[kw] = int(data[kw].mean())
                time.sleep(random.uniform(2, 4))
            except Exception:
                for kw in batch:
                    scores.setdefault(kw, 0)

        return scores
    except ImportError:
        return {}
    except Exception:
        return {}


def simulate_trend_scores(keywords: list[str]) -> dict[str, int]:
    """
    When pytrends is unavailable, ask Claude to estimate relative popularity.
    Returns a dict of keyword -> estimated_score (0-100).
    """
    client = anthropic.Anthropic()
    kw_list = "\n".join(f"- {kw}" for kw in keywords)
    prompt = f"""
אתה מומחה SEO ישראלי לתחום הנדל"ן והמקרקעין.
הערך את פופולריות החיפוש היחסית (סקאלה 0-100) של כל מילת מפתח בישראל בשבוע האחרון.
השב ב-JSON בלבד, מבנה: {{"keyword": score, ...}}

מילות המפתח:
{kw_list}
"""
    msg = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    # strip markdown fences if present
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])
    return json.loads(text)


def get_trend_scores(keywords: list[str]) -> dict[str, int]:
    scores = fetch_trends_pytrends(keywords)
    if not scores:
        scores = simulate_trend_scores(keywords)
    return scores


# ─── CONTENT GENERATION ──────────────────────────────────────────────────────


def generate_content(top_topics: list[str], all_scores: dict[str, int], today: str) -> dict[str, str]:
    client = anthropic.Anthropic()

    topics_block = "\n".join(f"{i+1}. {t} (ציון: {all_scores.get(t, 0)})" for i, t in enumerate(top_topics))
    main_topic = top_topics[0]

    system = """
אתה עורך דין ומומחה שיווק תוכן בתחום הנדל"ן והמקרקעין בישראל.
כתיבתך מדויקת משפטית, נגישה לציבור הרחב, ומותאמת SEO לגוגל ישראל.
כתוב בעברית רהוטה ומקצועית.
"""

    # ── SEO Article ───────────────────────────────────────────────────────────
    article_prompt = f"""
כתוב מאמר SEO באורך 1,000-1,200 מילה על הנושא: "{main_topic}".

מבנה:
1. כותרת H1 מושכת עם מילת המפתח
2. מבוא (100 מילה) - מסביר למה הנושא רלוונטי
3. 3-4 תתי-כותרות (H2) עם תוכן עשיר
4. סעיף "מה לבדוק לפני שבוחרים עורך דין" (עם bullet points)
5. סיום עם קריאה לפעולה (CTA) לפנות לייעוץ ראשוני

כלול טבעית את מילות המפתח: {', '.join(top_topics[:5])}

פורמט: Markdown
"""

    # ── Q&A ───────────────────────────────────────────────────────────────────
    qa_prompt = f"""
צור 7 שאלות-תשובות (FAQ) שאנשים שואלים בגוגל על "{main_topic}".
השאלות צריכות להיות בדיוק מה שאנשים מקלידים בגוגל.

פורמט לכל Q&A:
### ש: [שאלה]
**ת:** [תשובה מפורטת 80-120 מילה, מדויקת משפטית]

---

נושאים נוספים לכסות (בחר שאלות גם מהם): {', '.join(top_topics[1:5])}
"""

    # ── Avatar Script ─────────────────────────────────────────────────────────
    avatar_prompt = f"""
כתוב תסריט לוידאו קצר (60-90 שניות) לאווטר וידאו AI על הנושא: "{main_topic}".

מבנה התסריט:
[HOOK - 10 שניות] - משפט פותח חזק שגורם לאנשים להישאר
[בעיה - 15 שניות] - הצגת הבעיה שאנשים נתקלים בה
[פתרון - 25 שניות] - מה עורך הדין עושה בשבילך
[הוכחה - 15 שניות] - דוגמא/מקרה כללי (ללא פרטים אישיים)
[CTA - 15 שניות] - קריאה לפעולה ברורה

הנחיות:
- כתוב בשפה דבורה, לא קריאה
- משפטים קצרים (עד 12 מילה)
- סמן [הפסקה] בין קטעים
- סמן את הזמן המשוער בסוגריים
"""

    # ── Trends Report ─────────────────────────────────────────────────────────
    trends_prompt = f"""
כתוב דוח מגמות קצר (300-400 מילה) על חיפושים בנדל"ן ומקרקעין לתאריך {today}.

נושאים מובילים השבוע:
{topics_block}

כלול:
1. ניתוח קצר של כל נושא (מדוע אנשים מחפשים אותו)
2. המלצות תוכן לשבוע הקרוב
3. כותרות מוצעות לפוסטים ברשתות חברתיות (3 כותרות לפייסבוק, 3 לאינסטגרם)

פורמט: Markdown
"""

    # Run all in parallel would be ideal but keeping sequential for simplicity
    print("  ⟳ Generating trend report...")
    trends_msg = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": trends_prompt}],
    )

    print("  ⟳ Generating SEO article...")
    article_msg = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=3000,
        system=system,
        messages=[{"role": "user", "content": article_prompt}],
    )

    print("  ⟳ Generating Q&A...")
    qa_msg = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2500,
        system=system,
        messages=[{"role": "user", "content": qa_prompt}],
    )

    print("  ⟳ Generating avatar script...")
    avatar_msg = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1200,
        system=system,
        messages=[{"role": "user", "content": avatar_prompt}],
    )

    return {
        "trends": trends_msg.content[0].text,
        "article": article_msg.content[0].text,
        "qa": qa_msg.content[0].text,
        "avatar": avatar_msg.content[0].text,
    }


# ─── FILE WRITING ─────────────────────────────────────────────────────────────


def save_outputs(today: str, top_topics: list[str], all_scores: dict[str, int], content: dict[str, str]) -> str:
    out_dir = os.path.join(OUTPUT_DIR, today)
    os.makedirs(out_dir, exist_ok=True)

    # Metadata header for all files
    header = f"""---
date: {today}
topic: {top_topics[0]}
generated_by: daily_research_agent
---

"""

    # trends.md
    with open(os.path.join(out_dir, "trends.md"), "w", encoding="utf-8") as f:
        f.write(header + content["trends"])

    # article_he.md
    with open(os.path.join(out_dir, "article_he.md"), "w", encoding="utf-8") as f:
        f.write(header + content["article"])

    # qa.md
    with open(os.path.join(out_dir, "qa.md"), "w", encoding="utf-8") as f:
        f.write(header + content["qa"])

    # avatar_script.md
    with open(os.path.join(out_dir, "avatar_script.md"), "w", encoding="utf-8") as f:
        f.write(header + content["avatar"])

    # summary JSON (machine-readable)
    summary = {
        "date": today,
        "top_topics": top_topics,
        "scores": {k: all_scores.get(k, 0) for k in top_topics},
        "files": ["trends.md", "article_he.md", "qa.md", "avatar_script.md"],
    }
    with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    return out_dir


# ─── MAIN ─────────────────────────────────────────────────────────────────────


def main():
    today = datetime.date.today().isoformat()
    print(f"\n🔍 Daily Research Agent — {today}")
    print("=" * 50)

    # 1. Fetch trend scores
    print("\n📊 Fetching trend scores...")
    scores = get_trend_scores(TOPIC_SEEDS)

    # 2. Pick top 8 topics
    sorted_topics = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_topics = [t for t, _ in sorted_topics[:8]]
    print(f"   Top topic: {top_topics[0]} (score: {scores.get(top_topics[0], 0)})")

    # 3. Generate content
    print("\n✍️  Generating content...")
    content = generate_content(top_topics, scores, today)

    # 4. Save files
    out_dir = save_outputs(today, top_topics, scores, content)
    print(f"\n✅ Saved to: {out_dir}/")
    print("   trends.md | article_he.md | qa.md | avatar_script.md | summary.json")


if __name__ == "__main__":
    main()
