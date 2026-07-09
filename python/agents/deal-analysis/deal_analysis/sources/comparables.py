"""עסקאות השוואה מאתר מידע נדל"ן הממשלתי (nadlan.gov.il).

מביא עסקאות אחרונות לפי כתובת ומחשב חציון מחיר למ"ר,
לצורך בדיקת סבירות של השווי הצפוי בעסקה.
"""

import statistics

from .http import get_json

SEARCH_URL = "https://www.nadlan.gov.il/Nadlan.REST/Main/GetDataByQuery"
DEALS_URL = "https://www.nadlan.gov.il/Nadlan.REST/Main/GetAssestAndDeals"

# פער מהחציון שמעליו מסומן דגל צהוב בדוח
VALUE_GAP_WARN_PCT = 15


def _parse_deals(payload: dict) -> list[dict]:
    """מחלץ עסקאות מתגובת ה-API. שדות בשם משתנה בין גרסאות, מטפלים בשניהם."""
    deals = []
    for item in payload.get("AllResults") or payload.get("Results") or []:
        try:
            price = float(str(item.get("DEALAMOUNT", "0")).replace(",", ""))
            area = float(str(item.get("DEALNATURE", "0")).replace(",", ""))
            if price > 0 and area > 0:
                deals.append({
                    "price": price,
                    "area_sqm": area,
                    "price_per_sqm": round(price / area),
                    "date": item.get("DEALDATE", ""),
                    "address": item.get("FULLADRESS", ""),
                    "rooms": item.get("ASSETROOMNUM", ""),
                })
        except (ValueError, TypeError):
            continue
    return deals


def fetch_comparables(address: str, max_deals: int = 30) -> dict:
    """
    מביא עסקאות השוואה לכתובת. מחזיר תמיד dict, גם בכשל:
    {"ok": bool, "deals": [...], "median_per_sqm": int|None, "error": str|None}
    """
    try:
        search = get_json(SEARCH_URL, data={"query": address})
        deals_payload = get_json(DEALS_URL, data=search)
        deals = _parse_deals(deals_payload)[:max_deals]
        if not deals:
            return {"ok": False, "deals": [], "median_per_sqm": None,
                    "error": "לא נמצאו עסקאות השוואה לכתובת שהוזנה"}
        per_sqm = [d["price_per_sqm"] for d in deals]
        return {
            "ok": True,
            "deals": deals,
            "median_per_sqm": round(statistics.median(per_sqm)),
            "min_per_sqm": min(per_sqm),
            "max_per_sqm": max(per_sqm),
            "count": len(deals),
            "error": None,
        }
    except Exception as e:
        return {"ok": False, "deals": [], "median_per_sqm": None,
                "error": f"שגיאה בגישה למידע נדל\"ן: {e}"}


def value_sanity_check(expected_value: float, area_sqm: float, comparables: dict) -> dict | None:
    """
    משווה את השווי הצפוי לחציון השוק.
    מחזיר dict אזהרה אם הפער עולה על הסף, אחרת None.
    """
    if not comparables.get("ok") or not area_sqm:
        return None
    implied_per_sqm = expected_value / area_sqm
    median = comparables["median_per_sqm"]
    gap_pct = round((implied_per_sqm - median) / median * 100, 1)
    if abs(gap_pct) > VALUE_GAP_WARN_PCT:
        direction = "גבוה" if gap_pct > 0 else "נמוך"
        return {
            "gap_pct": gap_pct,
            "implied_per_sqm": round(implied_per_sqm),
            "median_per_sqm": median,
            "warning": (
                f"השווי הצפוי משקף {round(implied_per_sqm):,} ש\"ח למ\"ר, "
                f"{direction} ב-{abs(gap_pct)}% מחציון השוק ({median:,} ש\"ח למ\"ר). "
                f"מומלץ לבחון עם שמאי."
            ),
        }
    return None
