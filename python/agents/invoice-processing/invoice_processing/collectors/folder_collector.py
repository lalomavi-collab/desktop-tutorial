"""איסוף חשבוניות מתיקיית החודש המקומית."""
import os
from pathlib import Path
from invoice_processing.collectors.month_path import get_month_folder

def collect_from_folder(month: str = "") -> dict:
    """סורק את תיקיית החודש ומחזיר רשימת קבצי חשבוניות."""
    folder = Path(get_month_folder(month))
    exts = [e.strip().lower() for e in os.environ.get(
        "INVOICE_ALLOWED_EXT", ".pdf").split(",") if e.strip()]
    files = [str(p) for p in folder.glob("**/*")
             if p.is_file() and p.suffix.lower() in exts]
    return {"month_folder": str(folder), "files": files, "count": len(files)}
