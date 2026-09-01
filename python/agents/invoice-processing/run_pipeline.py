#!/usr/bin/env python3
"""
הרצת פייפליין חשבוניות ישירות — ללא ADK/Gemini.
עובד בשני מצבים:
  - מצב MCP (ענן): קורא מקובץ JSON, מוציא תוכן מייל מוכן
  - מצב מקומי: מריץ IMAP + סריקת תיקייה + SMTP עם קובץ .env
"""

from dotenv import load_dotenv
load_dotenv()

import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

from invoice_processing.collectors.folder_collector import collect_from_folder
from invoice_processing.senders.smtp_sender import prepare_accounting_email, send_accounting_email


def previous_month() -> str:
    """
    מחזיר את החודש הקודם בפורמט YYYY-MM.

    ההרצה החודשית מתבצעת ב-1 בחודש, ואז החודש הנוכחי בן יום אחד.
    החומר שנשלח להנהלת חשבונות הוא של החודש שהסתיים.
    """
    today = datetime.now().replace(day=1)
    last = today - timedelta(days=1)
    return last.strftime("%Y-%m")


# סמני "נשלח" יושבים בתוך תיקיית החשבוניות הקבועה (OneDrive), לצד החומר
# עצמו, כך שכל מצב המערכת חי במקום אחד ומסונכרן בין מחשבים.
LEGACY_SENT_DIR = Path(__file__).parent / "data" / "sent"


def _sent_dir() -> Path:
    from invoice_processing.collectors.base_folder import get_base_folder
    return get_base_folder() / "_מערכת" / "נשלח"


def _sent_marker(month: str) -> Path:
    return _sent_dir() / f"{month}.json"


def already_sent(month: str) -> dict | None:
    """
    מחזיר את פרטי השליחה הקודמת לחודש, או None אם טרם נשלח.
    סמן שנמצא רק במיקום הישן (בריפו) מועתק אוטומטית למיקום הקבוע
    ב-OneDrive, כך שמחיקת הריפו או התיקייה הישנה לא מוחקת את ההגנה.
    """
    primary = _sent_marker(month)
    legacy = LEGACY_SENT_DIR / f"{month}.json"
    for marker in (primary, legacy):
        if not marker.exists():
            continue
        try:
            data = json.loads(marker.read_text(encoding="utf-8"))
        except Exception:
            data = {"when": "unknown"}
        # ביקורת: סמן תקין שנכתב על ידי המערכת מחזיק רשימת שמות קבצים.
        atts = data.get("attachments")
        if not isinstance(atts, list) or any(not str(a).lower().endswith(".pdf") for a in atts):
            data["integrity_warning"] = (
                "מבנה הסמן אינו תואם כתיבה של המערכת (ייתכן שנכתב ידנית), "
                "מומלץ לאמת מול תיקיית פריטים שנשלחו בתיבת המייל"
            )
        if marker == legacy and not primary.exists():
            try:
                primary.parent.mkdir(parents=True, exist_ok=True)
                primary.write_text(json.dumps({**data, "migrated_from": str(legacy)},
                                              ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception:
                pass
        return data
    return None


def content_hash(attachments: list) -> str:
    """טביעת אצבע של תוכן השליחה: שמות הקבצים הממוינים."""
    import hashlib
    names = sorted(Path(str(a)).name for a in attachments)
    return hashlib.sha256("|".join(names).encode("utf-8")).hexdigest()[:16]


def mark_sent(month: str, result: dict):
    _sent_dir().mkdir(parents=True, exist_ok=True)
    result = {**result, "content_hash": content_hash(result.get("attachments_sent", []))}
    _sent_marker(month).write_text(
        json.dumps({
            "when": datetime.now().isoformat(timespec="seconds"),
            "to": result.get("to"),
            "attachments": result.get("attachments_sent", []),
            "content_hash": result["content_hash"],
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_from_json(path: str) -> list[dict]:
    """טוען נתוני חשבוניות מקובץ JSON (מצב MCP)."""
    with open(path) as f:
        raw = json.load(f)
    items = []
    for r in raw:
        items.append({
            "filename": f"{r.get('doc_number') or r['id']}.pdf" if r["has_pdf"] else None,
            "path": None,
            "subject": r["subject"],
            "sender": r["sender"],
            "date": r["date"],
            "source": r["source"],
            "has_attachment": r["has_pdf"],
            "type": r.get("type", "unknown"),
            "client": r.get("client", ""),
            "amount": r.get("amount"),
            "currency": r.get("currency"),
        })
    return items


def merge_items(email_items: list[dict], folder_files: list[dict]) -> list[dict]:
    """
    ממזג פריטים מהמייל עם קבצים מהתיקייה.
    קובץ מהתיקייה — מעדכן path של פריט קיים (לפי שם קובץ), או מוסיף כרשומה חדשה.
    """
    folder_by_name = {f["filename"]: f for f in folder_files}
    result = list(email_items)

    for item in result:
        fname = item.get("filename")
        if not fname:
            continue
        # התאמה מדויקת לפי שם קובץ
        if fname in folder_by_name:
            item["path"] = folder_by_name.pop(fname)["path"]
            item["has_attachment"] = True
        else:
            # התאמה חלקית — מספר מסמך או מזהה בתוך שם הקובץ, ללא תלות ברישיות
            # למשל "70119" בתוך "InvoiceReceipt_70119.pdf", או "gett" (מ-"exp_gett") בתוך "Gett_76.50_ILS.pdf"
            stem = fname.rsplit(".", 1)[0].lower()
            if stem.startswith("exp_") or stem.startswith("inv_"):
                stem = stem[4:]
            for folder_fname, fdata in list(folder_by_name.items()):
                if stem in folder_fname.lower():
                    item["path"] = fdata["path"]
                    item["has_attachment"] = True
                    folder_by_name.pop(folder_fname)
                    break

    # פריט מייל בלי צרופה: חיפוש קובץ בתיקייה לפי מספר המסמך שבנושא.
    # למשל "קבלה 20010" מול "Receipt_20010 (2).pdf".
    for item in result:
        if item.get("path"):
            continue
        numbers = re.findall(r"\d{4,}", item.get("subject") or "")
        matched = None
        for num in numbers:
            for folder_fname in folder_by_name:
                if num in folder_fname:
                    matched = folder_fname
                    break
            if matched:
                break
        if matched:
            fdata = folder_by_name.pop(matched)
            item["filename"] = fdata["filename"]
            item["path"] = fdata["path"]
            item["has_attachment"] = True

    # קבצים שנמצאו רק בתיקייה (לא ממייל)
    for fname, fdata in folder_by_name.items():
        result.append({
            "filename": fdata["filename"],
            "path": fdata["path"],
            "subject": fdata["filename"],
            "sender": "",
            "date": "",
            "source": "folder",
            "has_attachment": True,
            "type": "unknown",
            "client": "",
            "amount": None,
            "currency": None,
        })

    return result


def build_summary(items: list[dict]) -> str:
    income = [i for i in items if i.get("type") == "income"]
    expenses = [i for i in items if i.get("type") == "expense"]
    other = [i for i in items if i.get("type") not in ("income", "expense")]

    lines = []
    if income:
        lines.append(f"הכנסות ({len(income)}):")
        for i in income:
            doc = i["subject"].split("מספר")[-1].split("שהופק")[0].strip() if "מספר" in i["subject"] else i["subject"][:30]
            lines.append(f"  • {doc} — {i['client']} | {i['date']}")

    if expenses:
        lines.append(f"\nהוצאות ({len(expenses)}):")
        for e in expenses:
            amount_str = f" | {e['currency']} {e['amount']}" if e.get("amount") else ""
            pdf_str = "PDF ✅" if e["has_attachment"] else "קישור בלבד ⚠️"
            lines.append(f"  • {e['client']}{amount_str} | {e['date']} | {pdf_str}")

    if other:
        lines.append(f"\nאחר ({len(other)}):")
        for o in other:
            lines.append(f"  • {o['filename'] or o['subject']}")

    return "\n".join(lines)


def print_table(items: list[dict]):
    income = [i for i in items if i.get("type") == "income"]
    expenses = [i for i in items if i.get("type") == "expense"]
    other = [i for i in items if i.get("type") not in ("income", "expense")]

    if income:
        print("\n📥 הכנסות")
        print(f"{'מס׳/נושא':<35} {'לקוח':<25} {'תאריך':<12} {'PDF':<5} {'מקור':<10}")
        print("-" * 90)
        for i in income:
            doc = i["subject"].split("מספר")[-1].split("שהופק")[0].strip() if "מספר" in i["subject"] else i["subject"][:30]
            pdf = "✅" if i["has_attachment"] else "⚠️"
            print(f"{doc:<35} {i['client']:<25} {i['date']:<12} {pdf:<5} {i['source']:<10}")

    if expenses:
        print("\n📤 הוצאות")
        print(f"{'ספק':<30} {'סכום':<12} {'תאריך':<12} {'PDF':<8} {'מקור':<10}")
        print("-" * 75)
        for e in expenses:
            amount_str = f"{e['currency']} {e['amount']}" if e.get("amount") else "—"
            pdf = "✅" if e["has_attachment"] else "⚠️ קישור"
            print(f"{e['client']:<30} {amount_str:<12} {e['date']:<12} {pdf:<8} {e['source']:<10}")

    if other:
        print("\n📂 קבצים מהתיקייה")
        for o in other:
            print(f"  • {o['filename']}")


def validate_for_auto_send(items: list[dict], collect_error: str | None) -> list[str]:
    """
    שער האימות לשליחה אוטומטית. מחזיר רשימת כשלים, ריקה = מותר לשלוח.
    התנאים: האיסוף הצליח, יש פריטים, ולכל פריט יש קובץ PDF בתיקייה.
    """
    failures = []
    if collect_error:
        failures.append(f"האיסוף מהמייל נכשל: {collect_error}")
    if not items:
        failures.append("לא נאספו חשבוניות כלל החודש")
    missing = [i for i in items
               if not (i.get("has_attachment") and i.get("path"))]
    for m in missing:
        label = m.get("client") or m.get("subject") or m.get("filename") or "פריט"
        failures.append(f"חסר קובץ PDF עבור: {label}")
    return failures


def run(month: str | None = None, json_path: str | None = None, confirm_send: bool = False,
        auto_send: bool = False, force: bool = False):
    month = month or datetime.now().strftime("%Y-%m")
    print(f"\n{'='*55}")
    print(f"  סוכן חשבוניות LALUM — {month}")
    print(f"{'='*55}")

    # שלב 1: תיקייה
    folder_result = collect_from_folder(month)
    print(f"\n📁 תיקייה: {folder_result['month_folder']} ({folder_result['count']} קבצים)")

    # שלב 2: נתוני מייל
    collect_error = None
    if json_path and Path(json_path).exists():
        print(f"📨 טוען נתוני מייל מ: {json_path}")
        email_items = load_from_json(json_path)
    else:
        from invoice_processing.collectors.email_collector import collect_from_emails
        print("📨 מתחבר לתיבות המייל דרך IMAP...")
        result = collect_from_emails(month)
        if result.get("error"):
            print(f"⚠️  {result['error']}")
            collect_error = result["error"]
        email_items = result["items"]

    # שלב 3: מיזוג — מייל + תיקייה
    items = merge_items(email_items, folder_result["files"])

    pdf_count = sum(1 for i in items if i.get("has_attachment") and i.get("path"))
    print(f"✅ נאספו {len(items)} פריטים ({pdf_count} עם PDF בתיקייה)\n")
    print_table(items)

    # שלב 4: הכנת טיוטה
    from invoice_processing.reporting.finance_summary import build_finance_block, summarize
    finance_block = build_finance_block(items, month)
    fin = summarize(items)
    # בלוק הכספים נכנס לגוף המייל רק אם זוהה לפחות סכום אחד אמיתי.
    # דוח "הכל 0.00" על חודש עם מסמכים הוא הצהרה כספית שגויה, גרוע
    # מאי-דיווח, ולכן במקרה כזה הבלוק מוצג במסך בלבד עם אזהרה.
    amounts_detected = fin["income_ils"] > 0 or bool(fin["expenses_by_currency"])
    if amounts_detected:
        summary = build_summary(items) + "\n\n" + finance_block
    else:
        summary = build_summary(items)
        print("\n⚠️  לא זוהה אף סכום בפריטי החודש, בלוק החישובים לא ייכלל במייל")
        print("   (נדרש חילוץ סכומים מה-PDF, ראה invoice_processing/accounting.py)")
    print(f"\n{finance_block}")
    draft = prepare_accounting_email(items, month, summary)

    print(f"\n{'='*55}")
    print("✉️  טיוטת מייל:")
    print(f"  נמען:    {draft['to']}")
    print(f"  נושא:    {draft['subject']}")
    print(f"  צרופות:  {draft['attachment_count']} PDF")
    print(f"  ללא PDF: {draft['no_pdf_count']} פריטים")
    print(f"\n--- גוף ---\n{draft['body']}\n{'='*55}")

    # שלב 5א: שליחה אוטומטית, רק אם שער האימות עובר במלואו
    if auto_send:
        failures = validate_for_auto_send(items, collect_error)
        if failures:
            print("\n🛑 שליחה אוטומטית בוטלה, הבדיקה מצאה חוסרים:")
            for f in failures:
                print(f"  • {f}")
            print("השלם את החסר והרץ שוב, או שלח ידנית עם invoices.bat ואישור Y.")
            return draft
        print("\n✅ שער האימות עבר: כל הפריטים עם PDF, האיסוף תקין. שולח אוטומטית...")
        confirm_send = True

    # שלב 5: שליחה
    if confirm_send:
        prev = already_sent(month)
        if prev and not force:
            print(f"\n🛑 החודש {month} כבר נשלח ב-{prev.get('when')} אל {prev.get('to')}.")
            print(f"   {len(prev.get('attachments', []))} צרופות. לא נשלח שוב.")
            if prev.get("integrity_warning"):
                print(f"   ⚠️  {prev['integrity_warning']}")
            print("   לשליחה חוזרת מכוונת: --force")
            return draft
        if draft["attachment_count"] == 0:
            print("\n❌ לא נשלח — אין קבצי PDF מצורפים. הורד קבצים לתיקייה ונסה שוב.")
            return draft
        # מנעול שליחה מקדים: נכתב לפני ה-SMTP, לא אחריו. שתי הרצות בהפרש
        # שניות (מה שקרה ב-30.8) ייחסמו גם אם הראשונה עוד באוויר.
        lock = _sent_dir() / f"{month}.lock"
        lock.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, datetime.now().isoformat(timespec="seconds").encode())
            os.close(fd)
        except FileExistsError:
            print(f"\n🛑 שליחה לחודש {month} כבר מתבצעת ברגעים אלה (קיים {lock.name}).")
            print("   אם ההרצה הקודמת קרסה באמצע, מחק את קובץ הנעילה ונסה שוב.")
            return draft
        print("\n🚀 שולח...")
        result = {"sent": False}
        try:
            result = send_accounting_email(draft, confirm="true")
        finally:
            if result.get("sent"):
                mark_sent(month, result)
            lock.unlink(missing_ok=True)
        if result["sent"]:
            print(f"✅ נשלח ל-{result['to']}")
            print(f"   צרופות: {result['attachments_sent']}")
        else:
            print(f"❌ שגיאה: {result.get('error') or result.get('reason')}")
    else:
        print("\n⏸  לא נשלח — הוסף --send להרצה אמיתית")

    return draft


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", default=None, help="YYYY-MM, ברירת מחדל: החודש הנוכחי")
    parser.add_argument("--prev", action="store_true",
                        help="החודש הקודם. זו ברירת המחדל של ההרצה החודשית ב-1 בחודש")
    parser.add_argument("--json", default=None, help="נתיב לקובץ JSON (מצב ענן/MCP)")
    parser.add_argument("--send", action="store_true", help="שלח את המייל")
    parser.add_argument("--force", action="store_true",
                        help="שלח שוב גם אם החודש כבר נשלח")
    parser.add_argument("--auto-send", action="store_true",
                        help="שלח אוטומטית רק אם שער האימות עובר (כל הפריטים עם PDF)")
    args = parser.parse_args()
    month = args.month or (previous_month() if args.prev else None)
    run(month=month, json_path=args.json, confirm_send=args.send,
        auto_send=args.auto_send, force=args.force)
