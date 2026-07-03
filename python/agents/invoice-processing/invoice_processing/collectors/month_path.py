"""חישוב נתיב תיקיית החודש בתוך התיקייה הכללית."""
from datetime import datetime

from .base_folder import get_base_folder


def get_month_folder(month: str = "") -> str:
    """מחזיר את נתיב תיקיית החודש בפורמט YYYY-MM (יוצר אם חסרה). month ריק = החודש הנוכחי."""
    base = get_base_folder()
    name = month.strip() if month.strip() else datetime.now().strftime("%Y-%m")
    target = base / name
    target.mkdir(parents=True, exist_ok=True)
    return str(target)
