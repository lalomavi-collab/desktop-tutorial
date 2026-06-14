"""חישוב נתיב תיקיית החודש בתוך התיקייה הכללית."""
import os
from pathlib import Path
from datetime import datetime

_HEBREW_MONTHS = {
    1: "ינואר", 2: "פברואר", 3: "מרץ", 4: "אפריל",
    5: "מאי", 6: "יוני", 7: "יולי", 8: "אוגוסט",
    9: "ספטמבר", 10: "אוקטובר", 11: "נובמבר", 12: "דצמבר",
}

def get_month_folder(month: str = "") -> str:
    """מחזיר את נתיב תיקיית החודש (יוצר אם חסרה). month ריק = החודש הנוכחי."""
    base = Path(os.environ["INVOICE_BASE_FOLDER"])
    name = month.strip() if month.strip() else _HEBREW_MONTHS[datetime.now().month]
    target = base / name
    target.mkdir(parents=True, exist_ok=True)
    return str(target)
