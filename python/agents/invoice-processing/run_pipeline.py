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
import sys
from datetime import datetime
from pathlib import Path

from invoice_processing.collectors.folder_collector import collect_from_folder
from invoice_processing.senders.smtp_sender import prepare_accounting_email, send_accounting_email


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


def run(month: str | None = None, json_path: str | None = None, confirm_send: bool = False):
    month = month or datetime.now().strftime("%Y-%m")
    print(f"\n{'='*55}")
    print(f"  סוכן חשבוניות LALUM — {month}")
    print(f"{'='*55}")

    # שלב 1: תיקייה
    folder_result = collect_from_folder(month)
    print(f"\n📁 תיקייה: {folder_result['month_folder']} ({folder_result['count']} קבצים)")

    # שלב 2: נתוני מייל
    if json_path and Path(json_path).exists():
        print(f"📨 טוען נתוני מייל מ: {json_path}")
        email_items = load_from_json(json_path)
    else:
        from invoice_processing.collectors.email_collector import collect_from_emails
        print("📨 מתחבר לתיבות המייל דרך IMAP...")
        result = collect_from_emails(month)
        if result.get("error"):
            print(f"⚠️  {result['error']}")
        email_items = result["items"]

    # שלב 3: מיזוג — מייל + תיקייה
    items = merge_items(email_items, folder_result["files"])

    pdf_count = sum(1 for i in items if i.get("has_attachment") and i.get("path"))
    print(f"✅ נאספו {len(items)} פריטים ({pdf_count} עם PDF בתיקייה)\n")
    print_table(items)

    # שלב 4: הכנת טיוטה
    summary = build_summary(items)
    draft = prepare_accounting_email(items, month, summary)

    print(f"\n{'='*55}")
    print("✉️  טיוטת מייל:")
    print(f"  נמען:    {draft['to']}")
    print(f"  נושא:    {draft['subject']}")
    print(f"  צרופות:  {draft['attachment_count']} PDF")
    print(f"  ללא PDF: {draft['no_pdf_count']} פריטים")
    print(f"\n--- גוף ---\n{draft['body']}\n{'='*55}")

    # שלב 5: שליחה
    if confirm_send:
        if draft["attachment_count"] == 0:
            print("\n❌ לא נשלח — אין קבצי PDF מצורפים. הורד קבצים לתיקייה ונסה שוב.")
            return draft
        print("\n🚀 שולח...")
        result = send_accounting_email(draft, confirm="true")
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
    parser.add_argument("--json", default=None, help="נתיב לקובץ JSON (מצב ענן/MCP)")
    parser.add_argument("--send", action="store_true", help="שלח את המייל")
    args = parser.parse_args()
    run(month=args.month, json_path=args.json, confirm_send=args.send)
