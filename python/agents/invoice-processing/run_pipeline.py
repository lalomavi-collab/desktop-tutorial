#!/usr/bin/env python3
"""
הרצת פייפליין חשבוניות ישירות — ללא ADK/Gemini.
עובד בשני מצבים:
  - מצב MCP (ענן): קורא מקובץ JSON, מוציא תוכן מייל מוכן
  - מצב מקומי: מריץ IMAP + SMTP עם קובץ .env
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
            "filename": f"{r.get('doc_number', r['id'])}.pdf" if r["has_pdf"] else None,
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


def build_summary(items: list[dict]) -> str:
    income = [i for i in items if i["type"] == "income"]
    expenses = [i for i in items if i["type"] == "expense"]

    lines = []
    lines.append(f"הכנסות ({len(income)}):")
    for i in income:
        lines.append(f"  • {i['subject'].split('מספר')[-1].split('שהופק')[0].strip()} — {i['client']} | {i['date']}")

    lines.append(f"\nהוצאות ({len(expenses)}):")
    for e in expenses:
        amount_str = f" | {e['currency']} {e['amount']}" if e.get("amount") else ""
        pdf_str = "PDF ✅" if e["has_attachment"] else "קישור בלבד ⚠️"
        lines.append(f"  • {e['client']}{amount_str} | {e['date']} | {pdf_str}")

    return "\n".join(lines)


def print_table(items: list[dict]):
    income = [i for i in items if i["type"] == "income"]
    expenses = [i for i in items if i["type"] == "expense"]

    print("\n📥 הכנסות")
    print(f"{'מס׳/נושא':<35} {'לקוח':<25} {'תאריך':<12} {'מקור':<10}")
    print("-" * 85)
    for i in income:
        doc = i["subject"].split("מספר")[-1].split("שהופק")[0].strip() if "מספר" in i["subject"] else i["subject"][:30]
        print(f"{doc:<35} {i['client']:<25} {i['date']:<12} {i['source']:<10}")

    print("\n📤 הוצאות")
    print(f"{'ספק':<30} {'סכום':<12} {'תאריך':<12} {'PDF':<8} {'מקור':<10}")
    print("-" * 75)
    for e in expenses:
        amount_str = f"{e['currency']} {e['amount']}" if e.get("amount") else "—"
        pdf = "✅" if e["has_attachment"] else "⚠️ קישור"
        print(f"{e['client']:<30} {amount_str:<12} {e['date']:<12} {pdf:<8} {e['source']:<10}")


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
        items = load_from_json(json_path)
    else:
        # מצב IMAP מקומי
        from invoice_processing.collectors.email_collector import collect_from_emails
        print("📨 מתחבר לתיבות המייל דרך IMAP...")
        result = collect_from_emails(month)
        items = result["items"]

    print(f"✅ נאספו {len(items)} פריטים ({sum(1 for i in items if i['has_attachment'])} עם PDF)\n")
    print_table(items)

    # שלב 3: הכנת טיוטה
    summary = build_summary(items)
    draft = prepare_accounting_email(items, month, summary)

    print(f"\n{'='*55}")
    print("✉️  טיוטת מייל:")
    print(f"  נמען:    {draft['to']}")
    print(f"  נושא:    {draft['subject']}")
    print(f"  צרופות:  {draft['attachment_count']} PDF")
    print(f"  ללא PDF: {draft['no_pdf_count']} פריטים")
    print(f"\n--- גוף ---\n{draft['body']}\n{'='*55}")

    # שלב 4: שליחה (רק אם אושר ויש קבצים)
    if confirm_send:
        if draft["attachment_count"] == 0:
            print("\n❌ לא נשלח — אין קבצי PDF מצורפים. הורד קבצים לתיקיית החודש ונסה שוב.")
            return draft
        print("\n🚀 שולח...")
        result = send_accounting_email(draft, confirm="true")
        if result["sent"]:
            print(f"✅ נשלח ל-{result['to']}")
            print(f"   צרופות: {result['attachments_sent']}")
        else:
            print(f"❌ שגיאה: {result.get('error') or result.get('reason')}")
    else:
        print("\n⏸  לא נשלח — הוסף confirm_send=True להרצה אמיתית")

    return draft


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", default=None, help="YYYY-MM, ברירת מחדל: החודש הנוכחי")
    parser.add_argument("--json", default=None, help="נתיב לקובץ JSON (מצב MCP)")
    parser.add_argument("--send", action="store_true", help="שלח את המייל")
    args = parser.parse_args()
    run(month=args.month, json_path=args.json, confirm_send=args.send)
