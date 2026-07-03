"""
סריקת תיקיית החודש לקבצי חשבוניות קיימים.
"""

from datetime import datetime
from pathlib import Path

from .base_folder import get_base_folder


INVOICE_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".xml"}


def collect_from_folder(month: str | None = None) -> dict:
    """
    סורק את תיקיית החודש ומחזיר רשימת קבצים.
    month: "YYYY-MM" — ברירת מחדל = החודש הנוכחי.
    """
    if month is None:
        month = datetime.now().strftime("%Y-%m")

    base = get_base_folder()
    month_folder = base / month
    month_folder.mkdir(parents=True, exist_ok=True)

    files = []
    if month_folder.exists():
        for f in sorted(month_folder.iterdir()):
            if f.is_file() and f.suffix.lower() in INVOICE_EXTENSIONS:
                files.append({
                    "filename": f.name,
                    "path": str(f),
                    "size_kb": round(f.stat().st_size / 1024, 1),
                    "source": "folder",
                    "has_attachment": True,
                })

    return {
        "month": month,
        "month_folder": str(month_folder),
        "files": files,
        "count": len(files),
    }
