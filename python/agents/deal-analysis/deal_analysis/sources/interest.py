"""ריבית בנק ישראל הנוכחית, לברירת מחדל של ריבית המימון בעסקה."""

from .http import get_json

BOI_URL = "https://www.boi.org.il/PublicApi/GetInterest"

# מרווח טיפוסי של בנק מסחרי מעל ריבית בנק ישראל בהלוואות נדל"ן
DEFAULT_BANK_SPREAD = 0.015


def fetch_boi_rate() -> dict:
    """
    מחזיר {"ok": bool, "boi_rate": float|None, "suggested_loan_rate": float|None, "error": str|None}
    הריביות כשבר עשרוני (0.045 = 4.5%).
    """
    try:
        payload = get_json(BOI_URL)
        rate_pct = payload.get("currentInterest")
        if rate_pct is None:
            return {"ok": False, "boi_rate": None, "suggested_loan_rate": None,
                    "error": "תגובת בנק ישראל ללא שדה ריבית"}
        boi = float(rate_pct) / 100.0
        return {
            "ok": True,
            "boi_rate": boi,
            "suggested_loan_rate": round(boi + DEFAULT_BANK_SPREAD, 4),
            "error": None,
        }
    except Exception as e:
        return {"ok": False, "boi_rate": None, "suggested_loan_rate": None,
                "error": f"שגיאה בגישה לבנק ישראל: {e}"}
