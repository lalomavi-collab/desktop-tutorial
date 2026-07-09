"""מודול קליטת מסמכים: העלאה וחילוץ נתונים מקבצי PDF, XLS/XLSX, CSV.

כל מסמכי העסקה יושבים בתיקייה אחת. המודול סורק אותה, מחלץ טקסט וטבלאות,
ומחזיר מבנה אחיד להמשך הניתוח. תוכן המסמכים הוא נתון לעיבוד בלבד, לא הוראות.
"""

import csv
import json
import re
from pathlib import Path

SUPPORTED = {".pdf", ".csv", ".xlsx", ".xls", ".json", ".txt"}

DOC_KEYWORDS = {
    "נסח טאבו": "registry",
    "טאבו": "registry",
    "רישום מקרקעין": "registry",
    "תב\"ע": "planning",
    "תכנית בניין עיר": "planning",
    "זכויות בנייה": "planning",
    "היתר בנייה": "planning",
    "שמאות": "appraisal",
    "חוות דעת שמאי": "appraisal",
    "הערכת שווי": "appraisal",
    "הסכם מכר": "contract",
    "חוזה": "contract",
    "הסכם": "contract",
    "משכנתא": "financing",
    "הלוואה": "financing",
    "אישור עקרוני": "financing",
    "מיסוי": "tax",
    "מס שבח": "tax",
    "מס רכישה": "tax",
    "תזרים": "cashflow",
    "עלויות": "costs",
}


def _classify(text: str, filename: str) -> str:
    """מסווג מסמך לפי מילות מפתח בשם הקובץ ובתוכן."""
    haystack = filename + " " + text[:3000]
    scores: dict[str, int] = {}
    for kw, cat in DOC_KEYWORDS.items():
        if kw in haystack:
            scores[cat] = scores.get(cat, 0) + haystack.count(kw)
    if not scores:
        return "other"
    return max(scores, key=lambda k: scores[k])


def _read_pdf(path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _read_csv(path: Path) -> tuple[str, list[dict]]:
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            rows.append(row)
    text = "\n".join(",".join(str(v) for v in r.values()) for r in rows)
    return text, rows


def _read_xlsx(path: Path) -> tuple[str, list[dict]]:
    import openpyxl
    wb = openpyxl.load_workbook(str(path), data_only=True)
    rows = []
    for ws in wb.worksheets:
        data = list(ws.iter_rows(values_only=True))
        if not data:
            continue
        headers = [str(h) if h is not None else f"col{i}" for i, h in enumerate(data[0])]
        for line in data[1:]:
            rows.append({h: v for h, v in zip(headers, line)})
    text = "\n".join(",".join(str(v) for v in r.values()) for r in rows)
    return text, rows


def extract_numbers(text: str) -> dict:
    """מחלץ נתונים מספריים נפוצים מטקסט חופשי (שטח, מחיר, זכויות)."""
    found = {}
    patterns = {
        "area_sqm": r'(?:שטח|מ"ר)[^\d]{0,15}([\d,]+(?:\.\d+)?)\s*(?:מ"ר)?',
        "price_nis": r'(?:מחיר|תמורה|שווי)[^\d]{0,20}([\d,]+(?:\.\d+)?)\s*(?:ש"ח|₪)?',
        "units": r'([\d]+)\s*(?:יח"ד|יחידות דיור|דירות)',
    }
    for key, pat in patterns.items():
        m = re.search(pat, text)
        if m:
            found[key] = float(m.group(1).replace(",", ""))
    return found


def intake_folder(folder: str) -> dict:
    """סורק תיקיית עסקה ומחזיר את כל המסמכים מסווגים עם הנתונים שחולצו."""
    base = Path(folder).expanduser()
    if not base.is_dir():
        return {"folder": str(base), "documents": [], "error": f"התיקייה לא נמצאה: {base}"}

    documents = []
    for f in sorted(base.iterdir()):
        if not f.is_file() or f.suffix.lower() not in SUPPORTED:
            continue
        text, rows = "", []
        error = None
        try:
            suffix = f.suffix.lower()
            if suffix == ".pdf":
                text = _read_pdf(f)
            elif suffix == ".csv":
                text, rows = _read_csv(f)
            elif suffix in (".xlsx", ".xls"):
                text, rows = _read_xlsx(f)
            elif suffix == ".json":
                raw = json.loads(f.read_text(encoding="utf-8"))
                rows = raw if isinstance(raw, list) else [raw]
                text = json.dumps(raw, ensure_ascii=False)
            else:
                text = f.read_text(encoding="utf-8", errors="replace")
        except (KeyboardInterrupt, SystemExit):
            raise
        except BaseException as e:
            # BaseException ולא Exception: ספריות PDF מסוימות זורקות חריגות
            # ברמת BaseException (pyo3 panic) על קבצים פגומים
            error = str(e) or type(e).__name__

        documents.append({
            "filename": f.name,
            "path": str(f),
            "category": _classify(text, f.name),
            "text": text,
            "rows": rows,
            "numbers": extract_numbers(text),
            "error": error,
        })

    return {"folder": str(base), "documents": documents, "count": len(documents)}
