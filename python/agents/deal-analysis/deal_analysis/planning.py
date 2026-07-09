"""סקירה תכנונית: ניתוח מסמכי תכנון (תב"ע, זכויות בנייה, היתרים).

סורק את המסמכים שסווגו כתכנוניים ומפיק צ'ק-ליסט מצב תכנוני,
דגלים אדומים ופערים שדורשים בדיקה של איש מקצוע.
"""

import re

CHECKLIST = [
    ("registry", "נסח טאבו עדכני", ["נסח", "טאבו", "רישום מקרקעין"]),
    ("registry", "בדיקת הערות אזהרה", ["הערת אזהרה", "הערות אזהרה"]),
    ("registry", "בדיקת שעבודים ומשכנתאות", ["שעבוד", "משכנתא", "עיקול"]),
    ("planning", "תב\"ע בתוקף", ["תב\"ע", "תכנית בניין עיר", "תכנית מפורטת"]),
    ("planning", "זכויות בנייה", ["זכויות בנייה", "אחוזי בנייה", "שטח עיקרי"]),
    ("planning", "היתר בנייה", ["היתר בנייה", "היתר"]),
    ("planning", "חריגות בנייה", ["חריגה", "חריגות", "צו הריסה"]),
    ("appraisal", "חוות דעת שמאי", ["שמאות", "שמאי", "הערכת שווי"]),
    ("tax", "אומדן מיסוי", ["מס שבח", "מס רכישה", "היטל השבחה"]),
    ("contract", "הסכם / טיוטת הסכם", ["הסכם מכר", "חוזה", "טיוטה"]),
    ("financing", "אישור מימון", ["אישור עקרוני", "משכנתא", "הלוואה"]),
]

RED_FLAGS = [
    ("צו הריסה", "קיים אזכור לצו הריסה"),
    ("עיקול", "קיים אזכור לעיקול על הנכס"),
    ("הערת אזהרה", "קיימות הערות אזהרה, נדרשת בדיקה מי הזכאי"),
    ("חריגות בנייה", "אזכור לחריגות בנייה"),
    ("הפקעה", "אזכור להפקעה או ייעוד ציבורי"),
    ("היטל השבחה", "צפוי היטל השבחה, יש לתמחר"),
    ("דייר מוגן", "אזכור לדיירות מוגנת"),
    ("צו מניעה", "קיים צו מניעה או הליך משפטי תלוי"),
]


def review(documents: list[dict]) -> dict:
    """מפיק סקירה תכנונית ומשפטית מרשימת מסמכי intake."""
    full_text = "\n".join(d.get("text", "") for d in documents)
    categories = {d["category"] for d in documents}

    checklist = []
    for cat, item, keywords in CHECKLIST:
        found = any(kw in full_text for kw in keywords) or cat in categories
        checklist.append({"item": item, "category": cat, "found": found})

    flags = [{"keyword": kw, "warning": msg} for kw, msg in RED_FLAGS if kw in full_text]

    # חילוץ זכויות בנייה אם מופיעות
    rights = {}
    m = re.search(r'(?:אחוזי בנייה|זכויות בנייה)[^\d]{0,20}([\d.]+)\s*%', full_text)
    if m:
        rights["building_pct"] = float(m.group(1))
    m = re.search(r'(?:שטח עיקרי)[^\d]{0,20}([\d,]+)', full_text)
    if m:
        rights["main_area_sqm"] = float(m.group(1).replace(",", ""))

    missing = [c["item"] for c in checklist if not c["found"]]
    score = round(100 * sum(1 for c in checklist if c["found"]) / len(checklist))

    return {
        "checklist": checklist,
        "red_flags": flags,
        "building_rights": rights,
        "missing_documents": missing,
        "completeness_pct": score,
    }
