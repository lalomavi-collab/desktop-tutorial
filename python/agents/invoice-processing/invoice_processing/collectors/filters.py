"""
זיהוי מייל שהוא באמת מסמך חשבונאי, בנפרד מרעש שיווקי.

הכלל הישן חיפש שמות ספקים ("anthropic", "google ads") בכל נושא, ולכן כל
ניוזלטר של אותם ספקים נספר כחשבונית. כיוון שהשער דורש PDF לכל פריט,
רעש כזה חוסם את השליחה האוטומטית לצמיתות.
"""

# מילים שמעידות על מסמך חשבונאי ממש
DOC_KEYWORDS = [
    "חשבונית", "קבלה", "חשבון עסקה", "פקטורה", "דרישת תשלום",
    "invoice", "receipt", "proforma", "justificante", "factura",
]

# שמות ספקים. לבדם אינם מספיקים, נדרשת גם צרופת PDF.
VENDOR_KEYWORDS = ["google ads", "gett", "anthropic", "openai", "microsoft 365"]

# שולחים שהם רעש שיווקי או מערכתי
NOISE_SENDERS = [
    "donotreply@wordpress.com", "wordpress.com",
    "notifications.wix.com", "notification.wix.com",
    "send.vpcontact.com", "vpcontact.com",
    "no-reply@mail.anthropic.com",
    "mailer-daemon", "postmaster@",
]

# ביטויים בנושא שמעידים על הודעה תפעולית, לא מסמך
NOISE_SUBJECTS = [
    "התחבר אל", "אימות", "קוד אימות", "איפוס סיסמה",
    "log in", "sign in", "verify your", "reset your password",
    "campaign is ready", "has been canceled", "has been cancelled",
    "subscription", "newsletter", "webinar", "unsubscribe",
    "קיץ שווה", "מבצע", "הטבה",
]

REPLY_PREFIXES = ("re:", "fw:", "fwd:", "תגובה:", "השב:")


def is_invoice_email(subject: str, sender: str = "", has_pdf: bool = False) -> bool:
    """
    מחזיר True רק אם המייל נראה כמו מסמך חשבונאי אמיתי.

    subject  נושא המייל
    sender   כתובת השולח
    has_pdf  האם יש צרופת PDF במייל
    """
    s = (subject or "").strip().lower()
    f = (sender or "").strip().lower()

    if not s:
        return False

    if any(n in f for n in NOISE_SENDERS):
        return False

    if any(n in s for n in NOISE_SUBJECTS):
        return False

    # תשובה או העברה בשרשור היא שיחה, לא המסמך עצמו, אלא אם צורף PDF
    if s.startswith(REPLY_PREFIXES) and not has_pdf:
        return False

    if any(k in s for k in DOC_KEYWORDS):
        return True

    # שם ספק בלבד מתקבל רק עם צרופה
    if has_pdf and any(k in s for k in VENDOR_KEYWORDS):
        return True

    return False

# ---------------------------------------------------------------------------
# הפרדה בין מסמך שהתקבל (הוצאה) לבין מסמך שהופק ללקוח (הכנסה).
# להנהלת החשבונות נשלחות רק ההוצאות.
# ---------------------------------------------------------------------------

# מערכת החשבוניות של המשרד. כל מה שיוצא ממנה הוא מסמך שהופק ללקוח.
OWN_ISSUING_SENDERS = ["invoice4u.co.il"]

# כתובות המשרד. מסמך ששלחתי בעצמי אינו הוצאה שהתקבלה.
OWN_ADDRESSES = ["avraham@lalum.co", "lalomavi@gmail.com", "lalum.co"]

# ניסוחים שמעידים על מסמך שהופק ללקוח
ISSUED_MARKERS = ["שהופק עבור", "הופק עבור", "עבור הלקוח"]

# ניסוחים שמעידים שהמסמך התקבל אצלנו, גוברים על הסימנים שלמעלה
RECEIVED_MARKERS = ["שלח לך", "שלחה לך", "נשלח אליך", "מאת "]


def is_issued_by_us(subject: str, sender: str = "") -> bool:
    """
    True אם המסמך הופק על ידי המשרד ללקוח, כלומר הכנסה ולא הוצאה.

    הקובע הוא ניסוח הנושא, לא השולח. ספקים של המשרד משתמשים באותן
    מערכות הפקה (invoice4u ואחרות), ולכן סיווג לפי שולח פוסל בטעות
    הוצאות אמיתיות. "שהופק עבור X" = הפקנו ללקוח. "שלח לך" = קיבלנו.
    """
    subj = subject or ""
    f = (sender or "").lower()

    if any(m in subj for m in RECEIVED_MARKERS):
        return False
    if any(m in subj for m in ISSUED_MARKERS):
        return True
    if any(a in f for a in OWN_ADDRESSES):
        return True
    return False


def is_expense_document(subject: str, sender: str = "", has_pdf: bool = False) -> bool:
    """
    True רק עבור קבלה או חשבונית שהמשרד קיבל מספק.
    מסמכים שהמשרד הפיק ללקוחות נדחים.
    """
    if not is_invoice_email(subject, sender, has_pdf=has_pdf):
        return False
    return not is_issued_by_us(subject, sender)
