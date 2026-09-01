"""
מנוע הדוח החשבונאי החודשי של LALUM.

קורא את קבצי ה-PDF מתיקיית החודש, מחלץ סכומים (לפני מע"מ / מע"מ / סה"כ),
מסווג כל מסמך, ומחשב: הכנסות, הוצאות, רווח, ומע"מ חודשי לתשלום.

מבנה התיקייה שהמנוע מצפה לו:
    <בסיס>/YYYY-MM חודש/                  ← מסמכי הוצאה (ספקים)
    <בסיס>/YYYY-MM חודש/_הופק ללקוחות/    ← מסמכי הכנסה (הופקו ללקוחות)

חילוץ הסכומים לא מסתמך על מיקום בעמוד — טקסט עברי ב-PDF יוצא הפוך
ומפוזר. במקום זה נאספים כל המספרים ומחפשים שלשה (נטו, מע"מ, סה"כ)
שמקיימת נטו+מע"מ=סה"כ ומע"מ/נטו=שיעור המע"מ. זה עמיד לכל תבנית מסמך.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .collectors.month_path import HEBREW_MONTHS, resolve_month_folder

VAT_RATES = (0.18, 0.17)
INCOME_SUBFOLDER = "_הופק ללקוחות"
REPORT_PREFIX = "דוח-הנהלת-חשבונות"

_NUM = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}")

# מסמך שהופק מחשבון invoice4u של LALUM: מספר בן 5 ספרות (10xxx/70xxx/90xxx)
_OUR_DOC = re.compile(r"_(?:1|7|9)\d{4}(?:\s|\.|\(|$)")

# שיעורי המע"מ עצמם מופיעים כמספר בגוף המסמך ("מע\"מ 18.00%") ואינם סכום
_RATE_NOISE = {18.0, 17.0}

# סיווג לפי תוכן המסמך. הבדיקה לפי הסדר, הראשון שמתאים קובע.
_CREDIT_HINTS = ("חשבונית זיכוי", "זיכוי מרכזת", "תעודת זיכוי")
_PROFORMA_HINTS = ("חשבון עסקה", "חשבונית עסקה", "proforma", "pro forma")
_NO_VAT_HINTS = ("ארנונה", "אגרה", "מס רכוש")

# מסמך שאינו חשבונית מס — חשבון תקופתי של ספק תשתית (סלקום, חשמל, מים).
# החוק אוסר ניכוי מס תשומות לפני שהחשבון שולם; חשבונית המס מונפקת רק
# אחרי התשלום. ה-OCR מחליף לעיתים ב/כ בעברית, לכן שתי הצורות.
_NOT_TAX_INVOICE_RE = re.compile(r"חש[בכ]ון תקופתי|אינו מהווה חש[בכ]ונית מס")


@dataclass
class Row:
    """שורה אחת בדוח — מסמך אחד."""
    file: str
    path: str
    category: str          # income | expense | credit | proforma_out | proforma_in | expense_no_vat
    currency: str          # ILS | USD | EUR
    net: float = 0.0
    vat: float = 0.0
    total: float = 0.0
    estimated: bool = False
    note: str = ""

    @property
    def sign(self) -> int:
        return -1 if self.category == "credit" else 1


@dataclass
class Totals:
    """התוצאה המחושבת של החודש."""
    month: str
    income_net: float = 0.0
    income_vat: float = 0.0
    expense_net: float = 0.0
    expense_vat: float = 0.0
    expense_no_vat: float = 0.0
    foreign: dict = field(default_factory=dict)   # {"USD": 100.0, "EUR": 78.67}
    excluded: list = field(default_factory=list)  # שורות שלא נכנסו לחישוב

    @property
    def income_gross(self) -> float:
        return self.income_net + self.income_vat

    @property
    def expense_gross(self) -> float:
        return self.expense_net + self.expense_vat + self.expense_no_vat

    @property
    def profit(self) -> float:
        """רווח גולמי: הכנסות לפני מע"מ פחות כלל ההוצאות לפני מע"מ (כולל אלה ללא תשומות)."""
        return self.income_net - (self.expense_net + self.expense_no_vat)

    @property
    def vat_due(self) -> float:
        """מע"מ לתשלום: מע"מ עסקאות פחות מע"מ תשומות. שלילי = החזר."""
        return self.income_vat - self.expense_vat


# ---------------------------------------------------------------- חילוץ


def extract_text(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""
    try:
        reader = PdfReader(str(path))
        return "\n".join((p.extract_text() or "") for p in reader.pages)
    except Exception:
        return ""


def extract_text_ocr(path: Path) -> str:
    """
    OCR עברית+אנגלית ל-PDF סרוק ללא שכבת טקסט (כמו קבלות Gett).
    דורש: pip install pytesseract pdf2image ותוכנת Tesseract עם חבילת heb.
    כשהתלויות חסרות מחזיר מחרוזת ריקה והקובץ נשאר מסומן לטיפול ידני.
    """
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError:
        return ""
    try:
        pages = convert_from_path(str(path), dpi=300)
        return "\n".join(pytesseract.image_to_string(p, lang="heb+eng") for p in pages)
    except Exception:
        return ""


# פורמט אלפים אירופאי: "1.000.00" (קארדקום) הוא 1,000.00. מזוהה לפי
# נקודה כמפריד אלפים ואחריה נקודה עשרונית, ומנורמל לפני החילוץ.
_EURO_NUM = re.compile(r"(?<![\d.])\d{1,3}(?:\.\d{3})+\.\d{2}(?!\d)")


def _normalize_euro_thousands(text: str) -> str:
    def fix(m: re.Match) -> str:
        whole, dec = m.group().rsplit(".", 1)
        return whole.replace(".", "") + "." + dec
    return _EURO_NUM.sub(fix, text)


def _numbers(text: str) -> list[float]:
    text = _normalize_euro_thousands(text)
    out = []
    for m in _NUM.finditer(text):
        try:
            v = float(m.group().replace(",", ""))
        except ValueError:
            continue
        if 0 < v < 10_000_000:
            out.append(round(v, 2))
    return out


def find_amounts(text: str) -> tuple[float, float, float, bool]:
    """
    מחזיר (נטו, מע"מ, סה"כ, האם משוער).

    מחפש שלשה שמקיימת נטו+מע"מ≈סה"כ ומע"מ≈נטו*שיעור. אם נמצאו כמה —
    נבחרת בעלת הסה"כ הגדול ביותר, שהוא סכום החשבונית.
    """
    nums = _numbers(text)
    if not nums:
        return 0.0, 0.0, 0.0, False

    uniq = sorted(set(nums))
    pool = set(uniq)
    best = None
    for net in uniq:
        for rate in VAT_RATES:
            vat = round(net * rate, 2)
            total = round(net + vat, 2)
            # מע"מ בסובלנות אגורות, אך סה"כ בסובלנות של עד שקל שלם:
            # מסמכים ישראליים מעגלים את הסה"כ לשקל (9,720+1,749.60=11,469.60
            # מודפס 11,470.00) והשלשה עדיין תקפה.
            if any(abs(vat - c) <= 0.02 for c in pool) and any(abs(total - c) <= 1.00 for c in pool):
                if best is None or total > best[2]:
                    best = (net, vat, total)
    if best:
        return best[0], best[1], best[2], False

    # אין שלשה: מסמך ללא מע"מ (ספק זר, ארנונה, קבלה בלבד) או תבנית חריגה.
    # מסננים את שיעור המע"מ עצמו, שאינו סכום אלא אחוז.
    candidates = [n for n in uniq if n not in _RATE_NOISE]
    total = max(candidates) if candidates else 0.0
    return total, 0.0, total, True


def detect_currency(text: str) -> str:
    if "$" in text or "USD" in text:
        return "USD"
    if "€" in text or "EUR" in text:
        return "EUR"
    return "ILS"


# ---------------------------------------------------------------- סיווג


def classify(path: Path, text: str, is_income_folder: bool) -> tuple[str, str]:
    """מחזיר (קטגוריה, הערה)."""
    name = path.name.lower()
    low = text.lower()

    if is_income_folder:
        # רק מסמכים שהופקו מחשבון ה-invoice4u של LALUM הם הכנסה. מספרי
        # המסמכים שלנו הם בני 5 ספרות (10xxx / 70xxx / 90xxx). מסמך ספק
        # שהועתק לכאן בטעות (מספר בן 6-7 ספרות) הוא הוצאה, לא הכנסה.
        if not _OUR_DOC.search(path.name):
            return "expense", "מסמך ספק שנמצא בתיקיית ההכנסות — סווג כהוצאה"
        if "proforma" in name or any(h in low for h in _PROFORMA_HINTS):
            return "proforma_out", "חשבון עסקה — טרם הכנסה לצורכי מע\"מ"
        return "income", ""

    if any(h in text for h in _CREDIT_HINTS) or re.match(r"^cr\d", name):
        return "credit", "חשבונית זיכוי — מקטינה את ההוצאה"
    if any(h in low for h in _PROFORMA_HINTS):
        return "proforma_in", "חשבון עסקה — אינו חשבונית מס, לא ניתן לנכות תשומות"
    if _NOT_TAX_INVOICE_RE.search(text):
        return "expense_no_vat", "חשבון תקופתי — אינו חשבונית מס, ניכוי תשומות אסור לפני תשלום"
    if any(h in text for h in _NO_VAT_HINTS):
        return "expense_no_vat", "ללא מע\"מ — אינו מזכה בניכוי תשומות"
    return "expense", ""


# ---------------------------------------------------------------- בנייה


def build_rows(month: str) -> tuple[list[Row], Path]:
    folder = resolve_month_folder(month, create=False)
    rows: list[Row] = []
    if not folder.is_dir():
        return rows, folder

    root_names = {p.name for p in folder.glob("*.pdf")}

    for path in sorted(folder.rglob("*.pdf")):
        is_income = INCOME_SUBFOLDER in path.parts
        # אותו קובץ גם בשורש וגם ב"הופק ללקוחות" = מסמך ספק שהועתק בטעות.
        # השורש קובע, כדי לא לספור הוצאה כהכנסה.
        if is_income and path.name in root_names:
            continue

        text = extract_text(path)
        used_ocr = False
        if not text.strip():
            # אין שכבת טקסט (PDF מצולם/סרוק): ניסיון OCR לפני ויתור.
            text = extract_text_ocr(path)
            used_ocr = bool(text.strip())
        category, note = classify(path, text, is_income)
        net, vat, total, estimated = find_amounts(text)
        currency = detect_currency(text)

        if total == 0:
            # PDF סרוק, פגום, או תבנית שלא נקראה. חייב טיפול ידני —
            # אסור שיישאר שקוף בדוח.
            note = "🛑 לא חולץ סכום מה-PDF — נדרשת הזנה ידנית"
            estimated = True
        elif used_ocr:
            # סכום שחולץ ב-OCR הוא לעולם משוער וטעון אימות אנושי.
            estimated = True
            note = note or "סכומים חולצו ב-OCR ממסמך סרוק — לאימות"
        elif category == "expense" and vat == 0 and currency == "ILS":
            category = "expense_no_vat"
            note = note or "לא זוהה מע\"מ במסמך — לאימות"

        rows.append(Row(
            file=path.name,
            path=str(path),
            category=category,
            currency=currency,
            net=net, vat=vat, total=total,
            estimated=estimated, note=note,
        ))

    # קבצי תמונה (חשבוניות מצולמות): לעולם לא שקופים. כל תמונה מקבלת
    # שורה מסומנת שחוסמת שליחה אוטומטית עד טיפול ידני או OCR.
    image_exts = {".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff", ".bmp", ".webp"}
    for path in sorted(folder.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in image_exts:
            continue
        is_income = INCOME_SUBFOLDER in path.parts
        rows.append(Row(
            file=path.name,
            path=str(path),
            category="income" if is_income else "expense",
            currency="ILS",
            net=0.0, vat=0.0, total=0.0,
            estimated=True,
            note="🛑 חשבונית מצולמת (תמונה) — לא נקראה, נדרשת הזנה ידנית",
        ))
    return rows, folder


def compute(rows: list[Row], month: str) -> Totals:
    t = Totals(month=month)
    for r in rows:
        if r.currency != "ILS":
            if r.category in ("expense", "expense_no_vat"):
                t.foreign[r.currency] = round(t.foreign.get(r.currency, 0.0) + r.total, 2)
            continue
        if r.category == "income":
            t.income_net += r.net
            t.income_vat += r.vat
        elif r.category == "expense":
            t.expense_net += r.net
            t.expense_vat += r.vat
        elif r.category == "credit":
            t.expense_net -= r.net
            t.expense_vat -= r.vat
        elif r.category == "expense_no_vat":
            t.expense_no_vat += r.total
        else:  # proforma_in / proforma_out
            t.excluded.append(r)

    for f in ("income_net", "income_vat", "expense_net", "expense_vat", "expense_no_vat"):
        setattr(t, f, round(getattr(t, f), 2))
    return t


# ---------------------------------------------------------------- תצוגה


def _ils(v: float) -> str:
    return f"{v:,.2f} ₪"


def _month_title(month: str) -> str:
    y, m = month.split("-")
    return f"{HEBREW_MONTHS[int(m)]} {y}"


def _table(rows: list[Row]) -> list[str]:
    if not rows:
        return ["_אין מסמכים בקטגוריה זו._", ""]
    out = ["| מסמך | לפני מע\"מ | מע\"מ | סה\"כ | הערה |",
           "|------|-----------|------|------|------|"]
    for r in rows:
        cur = "" if r.currency == "ILS" else f" {r.currency}"
        note = r.note
        if r.estimated and not note:
            note = "⚠️ סכום לאימות"
        out.append(f"| {r.file} | {r.net:,.2f}{cur} | {r.vat:,.2f} | {r.total:,.2f}{cur} | {note} |")
    out.append("")
    return out


def render_report(rows: list[Row], t: Totals, folder: Path) -> str:
    title = _month_title(t.month)
    today = datetime.now().strftime("%d.%m.%Y")
    by = lambda c: [r for r in rows if r.category == c]  # noqa: E731

    L = [
        "---",
        f"**דוח הנהלת חשבונות — {title}**",
        "",
        f"LALUM — עו\"ד אברהם ללום  |  תאריך הפקה: {today}",
        "",
        f"תיקיית המקור: `{folder}`  |  {len(rows)} מסמכים",
        "",
        "---",
        "",
        "## 1. תקציר מנהלים",
        "",
        f"• **הכנסות לפני מע\"מ:** {_ils(t.income_net)}  (מע\"מ עסקאות {_ils(t.income_vat)})",
        f"• **הוצאות מוכרות לפני מע\"מ:** {_ils(t.expense_net)}  (מע\"מ תשומות {_ils(t.expense_vat)})",
        f"• **הוצאות ללא תשומות:** {_ils(t.expense_no_vat)}",
        f"• **רווח גולמי:** {_ils(t.profit)}",
        f"• **מע\"מ לתשלום:** {_ils(t.vat_due)}" + ("  _(שלילי = החזר)_" if t.vat_due < 0 else ""),
    ]
    if t.foreign:
        fx = " · ".join(f"{k} {v:,.2f}" for k, v in sorted(t.foreign.items()))
        L.append(f"• **הוצאות מט\"ח (מחוץ לחישוב המע\"מ):** {fx}")
    L += ["", "---", "", "## 2. חישוב המע\"מ החודשי", "",
          "| רכיב | סכום |", "|------|------|",
          f"| מע\"מ עסקאות (על הכנסות) | {_ils(t.income_vat)} |",
          f"| מע\"מ תשומות (על הוצאות) | {_ils(t.expense_vat)} |",
          f"| **מע\"מ לתשלום** | **{_ils(t.vat_due)}** |", "",
          "חישוב הרווח:", "",
          "| רכיב | סכום |", "|------|------|",
          f"| הכנסות לפני מע\"מ | {_ils(t.income_net)} |",
          f"| בניכוי הוצאות מוכרות לפני מע\"מ | {_ils(-t.expense_net)} |",
          f"| בניכוי הוצאות ללא תשומות | {_ils(-t.expense_no_vat)} |",
          f"| **רווח גולמי** | **{_ils(t.profit)}** |", "",
          "---", "", "## 3. פירוט המסמכים", "", "### הכנסות"]
    L += _table(by("income"))
    L += ["### הוצאות מוכרות"]
    L += _table(by("expense"))
    L += ["### זיכויים"]
    L += _table(by("credit"))
    L += ["### הוצאות ללא ניכוי תשומות"]
    L += _table(by("expense_no_vat"))
    L += ["### מחוץ לחישוב — חשבונות עסקה"]
    L += _table(by("proforma_in") + by("proforma_out"))
    L += [
        "---",
        "",
        "## 4. משימות ואחריות",
        "",
        "| דדליין | משימה | אחראי |",
        "|--------|-------|-------|",
        "| לפני שליחה | אימות שורות המסומנות ⚠️ מול המסמך המקורי | אברהם ללום |",
        "| 15 לחודש | דיווח ותשלום מע\"מ | הנהלת חשבונות |",
        "| לפי הצורך | המרת חשבונות עסקה לחשבוניות מס | ספקים |",
        "",
        "---",
        f"*הופק אוטומטית ממסמכי התיקייה  |  {today}*",
        "",
    ]
    return "\n".join(L)


def render_email_body(t: Totals, rows: list[Row], attach_count: int) -> str:
    title = _month_title(t.month)
    n = lambda c: len([r for r in rows if r.category == c])  # noqa: E731
    L = [
        "שלום רונית,",
        "",
        f"מצורפים מסמכי הנהלת החשבונות של LALUM לחודש {title}, יחד עם חישוב מקדים.",
        "",
        "תקציר:",
        f"  הכנסות לפני מע\"מ:        {_ils(t.income_net)}   ({n('income')} מסמכים)",
        f"  מע\"מ עסקאות:             {_ils(t.income_vat)}",
        f"  הוצאות מוכרות לפני מע\"מ: {_ils(t.expense_net)}   ({n('expense')} מסמכים, {n('credit')} זיכויים)",
        f"  מע\"מ תשומות:             {_ils(t.expense_vat)}",
        f"  הוצאות ללא תשומות:       {_ils(t.expense_no_vat)}   ({n('expense_no_vat')} מסמכים)",
        "",
        f"  רווח גולמי:              {_ils(t.profit)}",
        f"  מע\"מ לתשלום:             {_ils(t.vat_due)}",
    ]
    if t.foreign:
        L.append("")
        for k, v in sorted(t.foreign.items()):
            L.append(f"  הוצאות {k}: {v:,.2f}  (מחוץ לחישוב המע\"מ)")
    flagged = [r for r in rows if r.estimated or r.category in ("proforma_in", "proforma_out")]
    if flagged:
        L += ["", "לתשומת לבך — מסמכים הדורשים בדיקה:"]
        for r in flagged:
            L.append(f"  • {r.file} — {r.note or 'סכום לאימות'}")
    L += [
        "",
        f"מצורפים {attach_count} קבצים, וכן דוח מפורט בקובץ Markdown.",
        "החישוב מקדים ונועד לחסוך זמן — הקובע הוא הרישום בספרים.",
        "",
        "בברכה,",
        "אברהם ללום",
        "LALUM — חברת עורכי דין",
    ]
    return "\n".join(L)


# ---------------------------------------------------------------- API


def build_month_report(month: str) -> dict:
    """
    בונה את הדוח לחודש ושומר אותו בתיקיית החודש.
    מחזיר dict עם השורות, הסיכומים, נתיב הדוח וגוף המייל.
    """
    rows, folder = build_rows(month)
    t = compute(rows, month)
    report = render_report(rows, t, folder)

    report_path = folder / f"{REPORT_PREFIX}-{month}.md"
    if folder.is_dir():
        report_path.write_text(report, encoding="utf-8")

    attachments = [r.path for r in rows]
    if report_path.exists():
        attachments.append(str(report_path))

    return {
        "month": month,
        "folder": str(folder),
        "rows": rows,
        "totals": t,
        "report_path": str(report_path),
        "report": report,
        "attachments": attachments,
        "body": render_email_body(t, rows, len(attachments)),
    }
