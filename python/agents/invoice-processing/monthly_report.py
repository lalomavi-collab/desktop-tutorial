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

from invoice_processing.accounting import (
    FX_RATES,
    HOME_UTILITY_FROM,
    HOME_UTILITY_RATE,
    _month_title,
    build_month_report,
)
from invoice_processing.reporting.excel_summary import build_workbook
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


# קודי יציאה. המשימה המתוזמנת ו-run_monthly.bat נשענים עליהם, ולכן
# הרצה שנחסמה חייבת להיראות שונה מהרצה שהצליחה ביומן המשימות.
# הערכים מתחילים ב-10 בכוונה: פייתון עצמו מחזיר 1 על חריגה שלא נתפסה
# ו-2 על שגיאת ארגומנטים. קוד משלנו שיתנגש בהם יגרום להתראה שקרית.
EXIT_SENT = 0         # נשלח, או שכבר נשלח קודם
EXIT_DRAFT = 11       # טיוטה מוכנה ב-Outlook, ממתינה לאישור ידני
EXIT_BLOCKED = 12     # התבקשה שליחה ונחסמה: פריטים לא מאומתים
EXIT_NO_DOCS = 13     # לא נמצאו מסמכים בתיקיית החודש
EXIT_MAIL_ERROR = 14  # Outlook החזיר שגיאה


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

    # טבלת החישוב לרואת החשבון: אותם נתונים בדיוק, בגיליון שאפשר
    # למיין ולסכם בו. הסיכום בגיליון בנוי בנוסחאות על גיליון הפירוט,
    # כך שתיקון סכום אצלה מתעדכן מיד בשורה התחתונה.
    xlsx_path = None
    try:
        xlsx_path = Path(result["folder"]) / f"טבלת חישוב {month}.xlsx"
        build_workbook(result["rows"], result["totals"], _month_title(month),
                       xlsx_path, home_rate=HOME_UTILITY_RATE,
                       home_from=HOME_UTILITY_FROM, fx_rates=FX_RATES)
        result["attachments"].append(str(xlsx_path))
        print(f"📊 טבלת חישוב: {xlsx_path.name}")
    except Exception as e:                        # noqa: BLE001
        xlsx_path = None
        print(f"⚠️  טבלת החישוב לא נבנתה ({e}), הדוח המילולי אינו מושפע")

    # התאמה כפולה מול דפי הבנק (תת-תיקיית _בנק). הדפים עצמם חסויים:
    # לא נסרקים כחשבוניות ולא מצורפים למייל, רק תוצאת ההתאמה נכנסת לדוח.
    from invoice_processing.bank_reconciliation import reconcile, build_reconciliation_block
    from pathlib import Path as _P
    rec = reconcile(result["rows"], _P(result["folder"]))
    rec_block = build_reconciliation_block(rec)
    # ההתאמה היא כלי עבודה פנימי, לא הצהרה להנהלת החשבונות. ההתאמה כיום
    # לפי סכום בלבד: _parse_csv לוקח את הסכום המספרי הראשון בשורה ואינו
    # מבחין בין חובה לזכות, ולכן חשבונית הכנסה עשויה להיות מותאמת לחיוב
    # באותו סכום. עד שיתווספו כיוון התנועה וחלון תאריכים, התוצאה מוצגת
    # במסך ונכתבת לקובץ בתיקיית החודש, ואינה נכנסת לגוף המייל לרונית.
    if rec.statements_found:
        (_P(result["folder"]) / f"התאמת-בנק-{month}.md").write_text(
            rec_block, encoding="utf-8")

    print(f"\n📁 {result['folder']}")
    print(f"   {len(result['rows'])} מסמכים\n")
    print(result["body"])
    print(f"\n📄 דוח מפורט: {result['report_path']}")

    issues = blockers(result)
    if issues:
        print(f"\n⚠️  {len(issues)} פריטים לבדיקה:")
        for i in issues:
            print(f"   • {i}")

    if not result["rows"]:
        print("\n🛑 לא נמצא אף מסמך בתיקיית החודש. אין מה לשלוח.")
        return EXIT_NO_DOCS

    if args.no_mail:
        print("\n⏸  --no-mail: לא נוצר מייל.")
        return EXIT_SENT

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
            return EXIT_SENT
        if issues:
            print("\n🛑 שליחה בוטלה — יש פריטים לא מאומתים. תקן, או הרץ בלי --send ליצירת טיוטה.")
            return EXIT_BLOCKED
        print(f"\n🚀 שולח ל-{to} דרך Outlook...")
        res = send_via_outlook(mail, from_account=from_account)
        if res.get("sent"):
            mark_sent(month, res)
            print(f"✅ נשלח. {len(res['attachments_sent'])} צרופות.")
            return EXIT_SENT
        print(f"❌ {res.get('error')}")
        return EXIT_MAIL_ERROR

    print(f"\n✉️  יוצר טיוטה ב-Outlook עבור {to}...")
    res = draft_via_outlook(mail, from_account=from_account)
    if res.get("drafted"):
        print(f"✅ הטיוטה מוכנה בתיקיית 'טיוטות' ב-Outlook. {len(res['attachments_sent'])} צרופות.")
        print("   פתח, בדוק את הפריטים המסומנים, ולחץ שלח.")
        return EXIT_DRAFT
    print(f"❌ {res.get('error')}")
    return EXIT_MAIL_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
