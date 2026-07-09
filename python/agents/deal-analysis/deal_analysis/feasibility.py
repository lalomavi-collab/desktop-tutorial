"""מחשבון כדאיות כלכלית לעסקת נדל"ן.

מקבל פרמטרים של עסקה (מחיר, עלויות, מימון, שווי צפוי) ומחזיר
ניתוח מלא: סך השקעה, מיסוי, עלויות מימון, רווח צפוי, תשואה ורגישות.

הערה: החישובים הם כלי עזר לניתוח ראשוני, לא ייעוץ משפטי, שמאי או מימוני.
"""

from dataclasses import dataclass, field, asdict


# מדרגות מס רכישה (מבוסס על מדרגות 2025, מתעדכנות מדי שנה לפי מדד, יש לעדכן כאן)
# דירה יחידה: (תקרת מדרגה, שיעור). None = ללא תקרה
SINGLE_HOME_BRACKETS = [
    (1_978_745, 0.00),
    (2_347_040, 0.035),
    (6_055_070, 0.05),
    (20_183_565, 0.08),
    (None, 0.10),
]
# דירה נוספת / משקיע
INVESTOR_BRACKETS = [
    (6_055_070, 0.08),
    (None, 0.10),
]

# שיעור מס שבח על הרווח הריאלי
CAPITAL_GAINS_RATE = 0.25


@dataclass
class DealInputs:
    """פרמטרי העסקה. סכומים בש"ח אלא אם צוין אחרת."""
    price: float                          # מחיר רכישה / עלות קרקע
    expected_value: float                 # שווי צפוי במכירה / בגמר
    renovation_cost: float = 0.0          # שיפוץ / בנייה / השבחה
    other_costs: float = 0.0              # תיווך, עו"ד, שמאי, אגרות
    equity: float = 0.0                   # הון עצמי (0 = ללא מימון)
    loan_rate: float = 0.05               # ריבית שנתית על ההלוואה
    loan_years: float = 2.0               # משך המימון בשנים (תקופת הפרויקט)
    monthly_rent: float = 0.0             # שכירות חודשית צפויה (לנכס מניב)
    is_single_home: bool = False          # דירה יחידה (מדרגות מס מקלות)
    purchase_tax_override: float | None = None  # מס רכישה ידני אם ידוע
    betterment_levy: float = 0.0          # היטל השבחה צפוי (אם רלוונטי)


def purchase_tax_brackets(price: float, is_single_home: bool) -> list[dict]:
    """
    מחשב מס רכישה לפי מדרגות ומחזיר פירוט לכל מדרגה:
    [{"from": x, "to": y, "rate": r, "amount": a}, ...]
    אומדן בלבד, לא ייעוץ מס. המדרגות מתעדכנות מדי שנה.
    """
    brackets = SINGLE_HOME_BRACKETS if is_single_home else INVESTOR_BRACKETS
    detail = []
    prev_cap = 0.0
    for cap, rate in brackets:
        upper = price if cap is None else min(price, cap)
        if upper <= prev_cap:
            break
        taxable = upper - prev_cap
        detail.append({
            "from": round(prev_cap),
            "to": round(upper),
            "rate": rate,
            "amount": round(taxable * rate),
        })
        prev_cap = upper if cap is None else cap
        if cap is not None and price <= cap:
            break
    return detail


def purchase_tax(price: float, is_single_home: bool) -> float:
    """אומדן מס רכישה כולל (סכום כל המדרגות)."""
    return sum(b["amount"] for b in purchase_tax_brackets(price, is_single_home))


def analyze(inputs: DealInputs) -> dict:
    """מחזיר ניתוח כדאיות מלא כמילון מוכן להצגה ולדוח."""
    if inputs.purchase_tax_override is not None:
        tax = inputs.purchase_tax_override
        tax_detail = []
    else:
        tax_detail = purchase_tax_brackets(inputs.price, inputs.is_single_home)
        tax = sum(b["amount"] for b in tax_detail)

    total_cost_before_finance = (
        inputs.price + tax + inputs.betterment_levy
        + inputs.renovation_cost + inputs.other_costs
    )

    loan_amount = max(0.0, total_cost_before_finance - inputs.equity)
    finance_cost = loan_amount * inputs.loan_rate * inputs.loan_years

    total_investment = total_cost_before_finance + finance_cost

    gross_profit = inputs.expected_value - total_investment
    capital_gains_tax = max(0.0, gross_profit) * CAPITAL_GAINS_RATE
    net_profit = gross_profit - capital_gains_tax

    equity_base = inputs.equity if inputs.equity > 0 else total_investment
    roi = net_profit / equity_base if equity_base else 0.0
    annual_roi = roi / inputs.loan_years if inputs.loan_years else roi

    rental_yield = (inputs.monthly_rent * 12 / total_investment) if (inputs.monthly_rent and total_investment) else 0.0

    # ניתוח רגישות: מה קורה אם שווי המכירה סוטה
    sensitivity = []
    for delta in (-0.10, -0.05, 0.0, 0.05, 0.10):
        value = inputs.expected_value * (1 + delta)
        gp = value - total_investment
        np_ = gp - max(0.0, gp) * CAPITAL_GAINS_RATE
        sensitivity.append({
            "value_change_pct": round(delta * 100),
            "expected_value": round(value),
            "net_profit": round(np_),
            "roi_pct": round(np_ / equity_base * 100, 1) if equity_base else 0,
        })

    verdict = "כדאית" if annual_roi >= 0.12 else ("גבולית" if annual_roi >= 0.06 else "לא כדאית")

    return {
        "inputs": asdict(inputs),
        "purchase_tax": round(tax),
        "purchase_tax_detail": tax_detail,
        "betterment_levy": round(inputs.betterment_levy),
        "total_cost_before_finance": round(total_cost_before_finance),
        "loan_amount": round(loan_amount),
        "finance_cost": round(finance_cost),
        "total_investment": round(total_investment),
        "gross_profit": round(gross_profit),
        "capital_gains_tax": round(capital_gains_tax),
        "net_profit": round(net_profit),
        "roi_pct": round(roi * 100, 1),
        "annual_roi_pct": round(annual_roi * 100, 1),
        "rental_yield_pct": round(rental_yield * 100, 2),
        "sensitivity": sensitivity,
        "verdict": verdict,
    }
