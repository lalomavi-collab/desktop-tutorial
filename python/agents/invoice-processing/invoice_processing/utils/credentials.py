"""
אחסון סודות מאובטח.

הסיסמאות לא יושבות בקובץ .env ולא בשום קובץ טקסט. הן נשמרות ב-Windows
Credential Manager (מוצפן ב-DPAPI לפי חשבון המשתמש) ונקראות דרך keyring.

הזנה חד פעמית: setup_credentials.bat
"""

import os

SERVICE = "LALUM-invoice-agent"

SECRET_KEYS = ("IMAP1_PASS", "IMAP2_PASS", "SMTP_PASS")


def get_secret(name: str) -> str | None:
    """
    מחזיר סוד לפי שם. סדר: Credential Manager, ואם אין, משתנה סביבה.
    משתנה הסביבה נשאר כמוצא אחרון לתאימות, לא לשימוש שוטף.
    """
    try:
        import keyring

        value = keyring.get_password(SERVICE, name)
        if value:
            return value
    except Exception:
        pass
    return os.environ.get(name) or None


def set_secret(name: str, value: str) -> None:
    import keyring

    keyring.set_password(SERVICE, name, value)


def delete_secret(name: str) -> None:
    import keyring

    try:
        keyring.delete_password(SERVICE, name)
    except Exception:
        pass


def missing_secrets(names) -> list[str]:
    return [n for n in names if not get_secret(n)]