#!/usr/bin/env python3
"""
המערכת החודשית האחת של LALUM להנהלת חשבונות.

מריצה קצה-אל-קצה:
  1. קוראת את מסמכי החודש מתיקיית החשבוניות
  2. מחלצת סכומים ומסווגת: הכנסות / הוצאות / זיכויים / חשבונות עסקה
  3. מחשבת רווח ומע"מ חודשי לתשלום
  4. כותבת דוח מפורט לתיקיית החודש
  5. מכינה מייל להנהלת חשבונות דרך Outlook — טיוטה כברירת מחדל

שימוש:
    python monthly_report.py --prev            # החודש הקודם, טיוטה ב-Outlook
    python monthly_report.py --month 2026-08   # חודש מסוים
    python monthly_report.py --prev --send     # שליחה בפועל (דורש שער אימות נקי)
    python monthly_report.py --prev --no-mail  # דוח בלבד, בלי לגעת ב-Outlook
"""

from dotenv import load_dotenv

load_dotenv()

import argparse
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from invoice_processing.accounting import build_month_report
from invoice_processing.senders.outlook_com_sender import (
    draft_via_outlook,
    send_via_outlook,
)

SENT_DIR = Path(__file__).parent / "data" / "sent"


def previous_month() -> str:
    first = datetime.now().replace(day=1)
    return (first - timedelta(days=1)).strftime("%Y-%m")


def _marker(month: str) -> Path:
    return SENT_DIR / f"{month}-report.json"


def already_sent(month: str) -> dict | None:
    p = _marker(month)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"when": "unknown"}


def mark_sent(month: str, result: dict):
    SENT_DIR.mkdir(parents=True, exist_ok=True)
    _marker(month).write_text(json.dumps({
        "when": datetime.now().isoformat(timespec="seconds"),
        "to": result.get("to"),
        "attachments": result.get("attachments_sent", []),
    }, ensure_ascii=False, indent=2), encoding="utf-8")


def blockers(result: dict) -> list[str]:
    """מה מונע שליחה אוטומטית. רשימה ריקה = הכול נקי."""
    out = []
    rows = result["rows"]
    if not rows:
        out.append("לא נמצאו מסמכים בתיקיית החודש")
    for r in rows:
        if r.total == 0:
            out.append(f"לא חולץ סכום: {r.file}")
        elif r.estimated:
            out.append(f"סכום משוער, טעון אימות: {r.file}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--month", default=None, help="YYYY-MM")
    ap.add_argument("--prev", action="store_true", help="החודש הקודם (ברירת המחדל בהרצה החודשית)")
    ap.add_argument("--send", action="store_true", help="שלח בפועל במקום טיוטה")
    ap.add_argument("--force", action="store_true", help="שלח גם אם החודש כבר נשלח")
    ap.add_argument("--no-mail", action="store_true", help="הפק דוח בלבד")
    ap.add_argument("--no-collect", action="store_true",
                    help="דלג על איסוף מהמיילים, קרא רק את מה שכבר בתיקייה")
    args = ap.parse_args()

    month = args.month or (previous_month() if args.prev else datetime.now().strftime("%Y-%m"))

    print("=" * 60)
    print(f"  דוח הנהלת חשבונות LALUM — {month}")
    print("=" * 60)

    # שלב 0: איסוף מהמיילים לתיקיית החודש. השלב הזה חי בצינור הישן
    # והדוח קורא רק את התיקייה, בלעדיו התיקייה לא מתמלאת מעולם.
    if not args.no_collect:
        try:
            from invoice_processing.collectors.email_collector import collect_from_emails
            collected = collect_from_emails(month)
            if collected.get("error"):
                print(f"⚠️  איסוף מהמיילים: {collected['error']}")
                print("   ממשיך עם מה שכבר בתיקייה")
            else:
                print(f"📨 נאספו מהמיילים {collected.get('total', 0)} פריטים לתיקיית החודש")
        except Exception as e:
            print(f"⚠️  איסוף מהמיילים נכשל ({e}), ממשיך עם מה שכבר בתיקייה")

    result = build_month_report(month)

    # התאמה כפולה מול דפי הבנק (תת-תיקיית _בנק). הדפים עצמם חסויים:
    # לא נסרקים כחשבוניות ולא מצורפים למייל, רק תוצאת ההתאמה נכנסת לדוח.
    from invoice_processing.bank_reconciliation import reconcile, build_reconciliation_block
    from pathlib import Path as _P
    rec = reconcile(result["rows"], _P(result["folder"]))
    rec_block = build_reconciliation_block(rec)
    result["body"] = result["body"] + "\n\n" + rec_block

    print(f"\n📁 {result['folder']}")
    print(f"   {len(result['rows'])} מסמכים\n")
    print(result["body"])
    print(f"\n📄 דוח מפורט: {result['report_path']}")

    issues = blockers(result)
    if issues:
        print(f"\n⚠️  {len(issues)} פריטים לבדיקה:")
        for i in issues:
            print(f"   • {i}")

    if args.no_mail:
        print("\n⏸  --no-mail: לא נוצר מייל.")
        return

    to = os.environ.get("ACCOUNTING_EMAIL", "office@ronitkolani.co.il")
    mail = {
        "to": to,
        "subject": f"הנהלת חשבונות {month} — LALUM | הכנסות, הוצאות, רווח ומע\"מ",
        "body": result["body"],
        "attachments": result["attachments"],
    }
    from_account = os.environ.get("SMTP_USER")

    if args.send:
        prev = already_sent(month)
        if prev and not args.force:
            print(f"\n🛑 החודש {month} כבר נשלח ב-{prev.get('when')} אל {prev.get('to')}. --force לשליחה חוזרת.")
            return
        if issues:
            print("\n🛑 שליחה בוטלה — יש פריטים לא מאומתים. תקן, או הרץ בלי --send ליצירת טיוטה.")
            return
        print(f"\n🚀 שולח ל-{to} דרך Outlook...")
        res = send_via_outlook(mail, from_account=from_account)
        if res.get("sent"):
            mark_sent(month, res)
            print(f"✅ נשלח. {len(res['attachments_sent'])} צרופות.")
        else:
            print(f"❌ {res.get('error')}")
        return

    print(f"\n✉️  יוצר טיוטה ב-Outlook עבור {to}...")
    res = draft_via_outlook(mail, from_account=from_account)
    if res.get("drafted"):
        print(f"✅ הטיוטה מוכנה בתיקיית 'טיוטות' ב-Outlook. {len(res['attachments_sent'])} צרופות.")
        print("   פתח, בדוק את הפריטים המסומנים, ולחץ שלח.")
    else:
        print(f"❌ {res.get('error')}")


if __name__ == "__main__":
    main()
