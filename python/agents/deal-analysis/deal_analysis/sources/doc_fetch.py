"""הורדת מסמכים מקישור ישירות לתיקיית העסקה (קבלות, נסחים מקוונים)."""

import re
from pathlib import Path
from urllib.parse import urlparse, unquote

from .http import get_bytes


def _safe_filename(url: str, fallback: str = "downloaded_document.pdf") -> str:
    """שם קובץ בטוח מה-URL: רק שם בסיס, ללא נתיבים, תווים מסוכנים מוחלפים."""
    name = unquote(Path(urlparse(url).path).name) or fallback
    name = re.sub(r"[^\w\.\- אבגדהוזחטיכלמנסעפצקרשתםןץףך]", "_", name)
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    return name


def fetch_document(url: str, dest_folder: str) -> dict:
    """
    מוריד PDF מ-URL לתיקיית העסקה.
    מחזיר {"ok": bool, "path": str|None, "error": str|None}. לא דורס קובץ קיים.
    """
    if not url.lower().startswith("https://"):
        return {"ok": False, "path": None, "error": "רק קישורי https נתמכים"}
    try:
        content = get_bytes(url)
        if not content.startswith(b"%PDF"):
            return {"ok": False, "path": None,
                    "error": "התוכן שהתקבל אינו PDF (ייתכן שהקישור מוביל לדף אינטרנט)"}
        dest = Path(dest_folder).expanduser()
        dest.mkdir(parents=True, exist_ok=True)
        path = dest / _safe_filename(url)
        if path.exists():
            return {"ok": True, "path": str(path), "error": None,
                    "note": "הקובץ כבר קיים, לא הורד מחדש"}
        path.write_bytes(content)
        return {"ok": True, "path": str(path), "error": None}
    except Exception as e:
        return {"ok": False, "path": None, "error": f"שגיאה בהורדה: {e}"}
