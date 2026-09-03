"""חישוב נתיב תיקיית החודש בתוך התיקייה הכללית.

המוסכמה במשרד: תיקייה לכל חודש בפורמט "YYYY-MM שם" (למשל "2026-07 יולי").
הפונקציה מזהה גם מוסכמות ישנות ("יולי", "יולי 2026", "2026-07") כדי לא
ליצור כפילות, ויוצרת במוסכמה הנוכחית אם אין תיקייה קיימת.
"""

from datetime import datetime
from pathlib import Path

from .base_folder import get_base_folder

HEBREW_MONTHS = {
    1: "ינואר", 2: "פברואר", 3: "מרץ", 4: "אפריל",
    5: "מאי", 6: "יוני", 7: "יולי", 8: "אוגוסט",
    9: "ספטמבר", 10: "אוקטובר", 11: "נובמבר", 12: "דצמבר",
}


def resolve_month_folder(month: str = "", create: bool = True) -> Path:
    """
    מחזיר את תיקיית החודש. month בפורמט "YYYY-MM", ריק = החודש הנוכחי.
    מחפש תיקייה קיימת בכל המוסכמות שהיו בשימוש, ואם אין — יוצר
    במוסכמה הנוכחית "YYYY-MM שם" (create=True).
    """
    if not month.strip():
        month = datetime.now().strftime("%Y-%m")
    year, mon = month.split("-")
    hebrew = HEBREW_MONTHS[int(mon)]

    base = get_base_folder()
    # מזהה כל מוסכמת שם קיימת כדי לא ליצור תיקייה כפולה לאותו חודש:
    # "אוגוסט", "אוגוסט 2026", "2026-08", "2026-08 אוגוסט"
    candidates = [hebrew, f"{hebrew} {year}", month, f"{month} {hebrew}"]
    for name in candidates:
        target = base / name
        if target.is_dir():
            return target

    # יצירה במוסכמה הנוכחית. יצירה בשם העברי בלבד הייתה מייצרת תיקייה
    # שנייה לאותו חודש לצד תיקיות "YYYY-MM שם" הקיימות, והמסמכים היו מתפצלים.
    target = base / f"{month} {hebrew}"
    if create:
        target.mkdir(parents=True, exist_ok=True)
    return target


def get_month_folder(month: str = "") -> str:
    """תאימות לאחור: מחזיר נתיב כמחרוזת."""
    return str(resolve_month_folder(month))
