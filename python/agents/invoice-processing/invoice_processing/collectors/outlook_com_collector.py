"""
איסוף חשבוניות מ-Outlook Desktop דרך COM, מכל התיבות המחוברות בפרופיל.

למה COM ולא IMAP: מיקרוסופט חסמה התחברות בסיסמה ל-IMAP ב-Exchange Online,
השרת מכריז LOGINDISABLED ושום סיסמה לא תעבוד. COM עובד מול פרופיל Outlook
שכבר מחובר במחשב: בלי סיסמה, בלי OAuth, בלי רישום אפליקציה ב-Azure.
האיסוף מוגבל לתיבות שמפורטות ב-OUTLOOK_STORES, וברירת המחדל היא כל התיבות בפרופיל.

דרישות: Outlook Desktop מותקן ומוגדר, pywin32.
"""

import os
import re
from datetime import datetime

from .filters import is_expense_document, is_invoice_email
from .link_downloader import download_document_from_body
from .month_path import resolve_month_folder

OL_FOLDER_INBOX = 6
OL_MAIL_ITEM = 43

def _safe(name: str) -> str:
    return re.sub(r"[^\w\.\-]", "_", name)


def _month_bounds(month: str):
    year, mon = int(month[:4]), int(month[5:7])
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)
    return start, end


def _scan_inbox(inbox, start, end, dest, label, collected, seen):
    """סורק תיבה אחת. הפריטים ממוינים יורד, ולכן עוצרים בפריט הראשון שלפני החודש."""
    # Restrict ב-DASL אינו תלוי בהגדרות השפה של המערכת, בניגוד ל-[ReceivedTime]
    # עם תאריך מקומי. בלעדיו, תיבת IMAP עם עשרות אלפי פריטים מחזירה אפס.
    dasl = (
        "@SQL=\"urn:schemas:httpmail:datereceived\" >= '{}' "
        "AND \"urn:schemas:httpmail:datereceived\" < '{}'"
    ).format(start.strftime("%Y-%m-%d %H:%M"), end.strftime("%Y-%m-%d %H:%M"))

    try:
        items = inbox.Items.Restrict(dasl)
        _ = items.Count
    except Exception:
        items = inbox.Items

    for item in items:
        try:
            if getattr(item, "Class", 0) != OL_MAIL_ITEM:
                continue
            rt = item.ReceivedTime
            day = datetime(rt.year, rt.month, rt.day)
            if not (start <= day < end):
                continue

            subject = item.Subject or ""
            try:
                sender = item.SenderEmailAddress or item.SenderName or ""
            except Exception:
                sender = ""

            # בודקים אם יש PDF לפני ההחלטה, בלי לשמור עדיין
            pdf_att = None
            try:
                for att in item.Attachments:
                    if (att.FileName or "").lower().endswith(".pdf"):
                        pdf_att = att
                        break
            except Exception:
                pass

            if not is_expense_document(subject, sender, has_pdf=pdf_att is not None):
                continue

            # מפתח ייחודי לפי מזהה הפריט. מפתח לפי נושא+תאריך איחד בטעות
            # שתי קבלות נפרדות מאותו ספק באותו יום.
            try:
                key = item.EntryID
            except Exception:
                key = (subject.strip(), day.date(), getattr(pdf_att, "FileName", None))
            if key in seen:
                continue
            seen.add(key)

            pdf = None
            if pdf_att is not None:
                try:
                    target = dest / _safe(pdf_att.FileName)
                    if not target.exists():
                        pdf_att.SaveAsFile(str(target))
                    pdf = {"filename": target.name, "path": str(target)}
                except Exception:
                    pdf = None

            # אין צרופה: ספקים מסוימים שולחים קישור להורדה
            if pdf is None:
                try:
                    pdf = download_document_from_body(
                        item.Body or "", item.HTMLBody or "", subject, dest
                    )
                except Exception:
                    pdf = None

            collected.append({
                "filename": pdf["filename"] if pdf else None,
                "path": pdf["path"] if pdf else None,
                "subject": subject,
                "sender": sender,
                "date": day.strftime("%Y-%m-%d"),
                "source": label,
                "has_attachment": pdf is not None,
                "type": "unknown",
                "client": "",
                "amount": None,
                "currency": None,
            })
        except Exception:
            continue


# תיקיות שאין בהן מסמכים חשבונאיים, ואין טעם לסרוק
_SKIP_FOLDERS = (
    "פריטים שנמחקו", "deleted items", "דואר זבל", "junk",
    "טיוטות", "drafts", "לוח שנה", "calendar", "אנשי קשר", "contacts",
    "פריטים שנשלחו", "sent items", "בעיות סינכרון", "sync issues",
    "outbox", "דואר יוצא", "rss",
)


def _folders_to_scan(store, inbox, store_name: str, max_depth: int = 2):
    """
    מחזיר (תיקייה, תווית) לדואר הנכנס, לתיקיות המשנה שלו, ולארכיון.
    """
    out = [(inbox, store_name)]

    def walk(parent, prefix, depth):
        if depth > max_depth:
            return
        try:
            subs = list(parent.Folders)
        except Exception:
            return
        for f in subs:
            try:
                fname = f.Name or ""
            except Exception:
                continue
            if any(sk in fname.lower() for sk in _SKIP_FOLDERS):
                continue
            out.append((f, f"{prefix}/{fname}"))
            walk(f, f"{prefix}/{fname}", depth + 1)

    walk(inbox, store_name, 1)

    # הארכיון יושב לצד הדואר הנכנס, לא בתוכו
    try:
        for f in inbox.Parent.Folders:
            fname = f.Name or ""
            low = fname.lower()
            if any(sk in low for sk in _SKIP_FOLDERS):
                continue
            if "ארכיון" in fname or "archive" in low:
                out.append((f, f"{store_name}/{fname}"))
                walk(f, f"{store_name}/{fname}", 1)
    except Exception:
        pass

    return out


def collect_from_outlook_com(month: str) -> list[dict]:
    """
    סורק את תיבות הדואר הנכנס של כל החשבונות בפרופיל Outlook לחודש הנתון,
    שומר צרופות PDF לתיקיית החודש ומחזיר רשימה בפורמט של שאר הקולקטורים.

    OUTLOOK_STORES ב-.env מגביל לתיבות מסוימות, מופרד בפסיקים.
    ברירת מחדל: כל התיבות בפרופיל.
    """
    try:
        import pythoncom
        import win32com.client
    except ImportError:
        return [{
            "error": "pywin32 לא מותקן. הרץ: pip install pywin32",
            "source": "Outlook", "has_attachment": False, "filename": None,
            "path": None, "subject": "pywin32 חסר", "sender": "", "date": "",
            "type": "unknown", "client": "", "amount": None, "currency": None,
        }]

    start, end = _month_bounds(month)
    dest = resolve_month_folder(month)
    collected: list[dict] = []
    seen: set = set()

    wanted = [s.strip().lower() for s in os.environ.get("OUTLOOK_STORES", "").split(",") if s.strip()]

    pythoncom.CoInitialize()
    try:
        ns = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")
        for i in range(1, ns.Stores.Count + 1):
            try:
                store = ns.Stores.Item(i)
                name = store.DisplayName or f"store{i}"
                if wanted and name.lower() not in wanted:
                    continue
                inbox = store.GetDefaultFolder(OL_FOLDER_INBOX)
            except Exception:
                continue

            # סריקת הדואר הנכנס, תיקיות המשנה שלו, והארכיון. מסמך שתויק
            # לתיקייה ("הנה\"ח מאי 2026") היה נעלם מהדוח לחלוטין כשנסרק
            # השורש בלבד, וזו בדיוק התמונה החלקית שהדוח אמור למנוע.
            for folder, label in _folders_to_scan(store, inbox, name):
                _scan_inbox(folder, start, end, dest, label, collected, seen)
    except Exception as e:
        collected.append({
            "error": str(e), "source": "Outlook", "has_attachment": False,
            "filename": None, "path": None, "subject": f"שגיאת Outlook COM: {e}",
            "sender": "", "date": "", "type": "unknown", "client": "",
            "amount": None, "currency": None,
        })
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass

    return collected