"""
הורדת מסמכים שנשלחים כקישור ולא כצרופה.

חלק מהספקים (ezcount ודומיו) שולחים מייל עם קישור להורדה. כיוון ששער
האימות דורש PDF לכל פריט, מסמכים כאלה חוסמים את השליחה האוטומטית בכל חודש.
המודול מאתר את הקישור בגוף המייל, מוריד את הקובץ ושומר אותו בתיקיית החודש.
"""

import re
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
TIMEOUT = 45

# ספק: (תבנית לאיתור הקישור, פונקציה שמייצרת את כתובת ההורדה הישירה, קידומת לשם הקובץ)
PROVIDERS = [
    (
        "ezcount",
        re.compile(r"https://files\.ezcount\.co\.il/front/documents/get/([0-9a-f\-]{36})"),
        lambda doc_id: f"https://files.ezcount.co.il/front/documents/get/{doc_id}?nc=1",
    ),
]


def _fetch(url: str) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = resp.read()
        return data if data[:4] == b"%PDF" else None
    except Exception:
        return None


def _name_for(prefix: str, subject: str, doc_id: str) -> str:
    numbers = re.findall(r"\d{4,}", subject or "")
    stem = numbers[0] if numbers else doc_id[:8]
    return f"{prefix}_{stem}.pdf"


def download_document_from_body(body: str, html: str, subject: str, dest: Path) -> dict | None:
    """
    מחפש קישור למסמך בגוף המייל, מוריד ושומר.
    מחזיר {"filename", "path"} או None אם לא נמצא קישור מוכר או שההורדה נכשלה.
    """
    text = f"{body or ''}\n{html or ''}"

    for prefix, pattern, to_direct in PROVIDERS:
        match = pattern.search(text)
        if not match:
            continue

        filename = _name_for(prefix, subject, match.group(1))
        target = dest / filename
        if target.exists():
            return {"filename": filename, "path": str(target)}

        # אם המסמך כבר קיים בתיקייה תחת שם אחר (הורד ידנית בעבר),
        # משתמשים בו במקום להוריד עותק כפול.
        numbers = re.findall(r"\d{4,}", subject or "")
        for num in numbers:
            for existing in dest.glob("*.pdf"):
                if num in existing.name:
                    return {"filename": existing.name, "path": str(existing)}

        data = _fetch(to_direct(match.group(1)))
        if not data:
            return None

        target.write_bytes(data)
        return {"filename": filename, "path": str(target)}

    return None