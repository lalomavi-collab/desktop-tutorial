"""
שליחת המייל להנהלת חשבונות דרך Outlook Desktop ב-COM.

למה לא SMTP: smtp.office365.com דורש SMTP AUTH, שמיקרוסופט מכבה כברירת
מחדל, והוא דורש סיסמה שצריך לאחסן. COM שולח מהפרופיל המחובר, בלי סיסמה,
והעותק נשמר ב"פריטים שנשלחו" כמו כל מייל אחר.
"""

from pathlib import Path


def _build(draft: dict, from_account: str | None):
    """בונה MailItem מלא ב-Outlook. מחזיר (mail, שמות הצרופות)."""
    import win32com.client

    app = win32com.client.Dispatch("Outlook.Application")
    mail = app.CreateItem(0)  # olMailItem
    mail.To = draft["to"]
    mail.Subject = draft["subject"]
    mail.Body = draft["body"]

    if from_account:
        try:
            for i in range(1, app.Session.Accounts.Count + 1):
                acc = app.Session.Accounts.Item(i)
                if (acc.SmtpAddress or "").lower() == from_account.lower():
                    mail._oleobj_.Invoke(*(64209, 0, 8, 0, acc))  # SendUsingAccount
                    break
        except Exception:
            pass

    names = []
    for path_str in draft.get("attachments", []):
        mail.Attachments.Add(str(Path(path_str)))
        names.append(Path(path_str).name)
    return mail, names


def _guard(draft: dict) -> dict | None:
    try:
        import pythoncom  # noqa: F401
        import win32com.client  # noqa: F401
    except ImportError:
        return {"sent": False, "error": "pywin32 לא מותקן"}
    missing = [p for p in draft.get("attachments", []) if not Path(p).exists()]
    if missing:
        return {"sent": False, "error": f"קבצים לא נמצאו בדיסק: {', '.join(missing)}"}
    return None


def send_via_outlook(draft: dict, from_account: str | None = None) -> dict:
    err = _guard(draft)
    if err:
        return err

    import pythoncom
    pythoncom.CoInitialize()
    try:
        mail, sent_names = _build(draft, from_account)
        mail.Send()
        return {
            "sent": True,
            "to": draft["to"],
            "subject": draft["subject"],
            "attachments_sent": sent_names,
            "via": "Outlook COM",
        }
    except Exception as e:
        return {"sent": False, "error": f"Outlook COM: {e}"}
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


def draft_via_outlook(draft: dict, from_account: str | None = None) -> dict:
    """
    יוצר את המייל בתיקיית הטיוטות של Outlook — בלי לשלוח.
    זו ברירת המחדל: אברהם פותח, בודק, ולוחץ שלח.
    """
    err = _guard(draft)
    if err:
        return {**err, "drafted": False}

    import pythoncom
    pythoncom.CoInitialize()
    try:
        mail, names = _build(draft, from_account)
        mail.Save()  # נשמר ב"טיוטות"
        return {
            "drafted": True,
            "sent": False,
            "to": draft["to"],
            "subject": draft["subject"],
            "attachments_sent": names,
            "via": "Outlook COM (טיוטה)",
        }
    except Exception as e:
        return {"drafted": False, "sent": False, "error": f"Outlook COM: {e}"}
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass