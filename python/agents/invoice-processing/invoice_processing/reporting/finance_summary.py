"""חישובים מקדימים לדוח הנהלת החשבונות החודשי.

מסכם הכנסות, הוצאות, רווח גולמי ואומדן מע"מ חודשי מתוך פריטי החודש,
ומפיק בלוק טקסט מסודר שנכנס לגוף המייל להנהלת החשבונות.

הכל אומדן מקדים בלבד על בסיס הסכומים שזוהו במיילים. פריטים ללא סכום
מסומנים לאימות. אין בזה ייעוץ מס, החישוב הסופי אצל הנהלת החשבונות.
"""

# שיעור המע"מ בישראל (18% מ-2025). לעדכן כאן אם ישתנה.
VAT_RATE = 0.18


def _to_float(v) -> float | None:
    try:
        f = float(str(v).replace(",", ""))
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def summarize(items: list[dict]) -> dict:
    """
    מחזיר סיכום כספי:
    {
      "income_ils": float, "expenses_by_currency": {"ILS": x, "USD": y, ...},
      "gross_profit_ils": float,
      "vat_on_income": float, "vat_on_expenses": float, "vat_due": float,
      "missing_amounts": [שמות פריטים ללא סכום],
    }
    ההנחה: הסכומים שזוהו כוללים מע"מ (חשבוניות מס קבלה). מע"מ תשומות
    מחושב על הוצאות בש"ח בלבד, הוצאות מט"ח מוצגות בנפרד לטיפול ידני.
    """
    income_ils = 0.0
    expenses = {}
    missing = []

    for it in items:
        amount = _to_float(it.get("amount"))
        currency = (it.get("currency") or "ILS").upper()
        if currency in ("₪", "NIS", "שח", 'ש"ח'):
            currency = "ILS"
        label = it.get("client") or it.get("subject") or it.get("filename") or "פריט"

        if it.get("type") == "income":
            if amount is None:
                missing.append(f"הכנסה: {label}")
            else:
                income_ils += amount
        elif it.get("type") == "expense":
            if amount is None:
                missing.append(f"הוצאה: {label}")
            else:
                expenses[currency] = expenses.get(currency, 0.0) + amount
        else:
            missing.append(f"לא מסווג: {label}")

    ils_expenses = expenses.get("ILS", 0.0)
    vat_factor = VAT_RATE / (1 + VAT_RATE)
    vat_on_income = income_ils * vat_factor
    vat_on_expenses = ils_expenses * vat_factor

    return {
        "income_ils": round(income_ils, 2),
        "expenses_by_currency": {c: round(v, 2) for c, v in sorted(expenses.items())},
        "gross_profit_ils": round(income_ils - ils_expenses, 2),
        "vat_on_income": round(vat_on_income, 2),
        "vat_on_expenses": round(vat_on_expenses, 2),
        "vat_due": round(vat_on_income - vat_on_expenses, 2),
        "missing_amounts": missing,
    }


def _ils(v: float) -> str:
    return f'{v:,.2f} ש"ח'


def build_finance_block(items: list[dict], month: str) -> str:
    """בלוק הטקסט שנכנס לגוף המייל להנהלת החשבונות."""
    s = summarize(items)
    lines = [
        f"חישובים מקדימים לחודש {month} (אומדן על בסיס הסכומים שזוהו):",
        "",
        f'סה"כ הכנסות (כולל מע"מ): {_ils(s["income_ils"])}',
    ]
    for cur, v in s["expenses_by_currency"].items():
        label = 'סה"כ הוצאות (כולל מע"מ)' if cur == "ILS" else f'סה"כ הוצאות {cur} (מט"ח, לטיפול בנפרד)'
        val = _ils(v) if cur == "ILS" else f"{v:,.2f} {cur}"
        lines.append(f"{label}: {val}")
    lines += [
        f'רווח גולמי משוער (ש"ח בלבד): {_ils(s["gross_profit_ils"])}',
        "",
        f'אומדן מע"מ ({int(VAT_RATE * 100)}%):',
        f'  מע"מ עסקאות (מההכנסות): {_ils(s["vat_on_income"])}',
        f'  מע"מ תשומות (מהוצאות בש"ח): {_ils(s["vat_on_expenses"])}',
        f'  מע"מ לתשלום משוער: {_ils(s["vat_due"])}',
    ]
    if s["missing_amounts"]:
        lines += ["", "פריטים ללא סכום מזוהה, נא לאמת מול הקבצים המצורפים:"]
        lines += [f"  • {m}" for m in s["missing_amounts"]]
    lines += [
        "",
        "הערה: אומדן מקדים בלבד לפי הנתונים שזוהו אוטומטית, אינו ייעוץ מס.",
        "החישוב המחייב יבוצע על ידי הנהלת החשבונות.",
    ]
    return "\n".join(lines)
