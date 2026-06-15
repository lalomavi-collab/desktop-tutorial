"""
email_agent.py — B2B Outreach Agent for Law Firms
Mode: Creates Outlook DRAFTS only (does not send).
Supports: win32com.client (local Outlook desktop) or O365 (Microsoft Graph)
"""

import csv
import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

# ─────────────────────────────────────────────
# CONFIGURATION — edit these before running
# ─────────────────────────────────────────────

DRY_RUN      = True          # True = print preview only; False = create real drafts
EMAIL_BACKEND = "win32"      # "win32" (local Outlook) | "o365" (Microsoft Graph)
SENDER_EMAIL  = "lalomavi@gmail.com"   # shown in From / used for O365 mailbox
SENDER_NAME   = "DOM Mediation"

# O365 / Azure App credentials (only needed when EMAIL_BACKEND = "o365")
# Paste the values from portal.azure.com — see README below or AZURE_SETUP.md
O365_CLIENT_ID     = os.environ.get("O365_CLIENT_ID", "")
O365_CLIENT_SECRET = os.environ.get("O365_CLIENT_SECRET", "")
O365_TENANT_ID     = os.environ.get("O365_TENANT_ID", "")

# AUTH_FLOW options:
#   "credentials"   — app-only, no browser, needs Mail.Send application permission
#   "authorization" — opens browser once, saves token to o365_token.txt (recommended)
O365_AUTH_FLOW = "authorization"

# Delay between draft creations to avoid hammering the COM server
THROTTLE_SECS = 1.0

LOG_FILE  = "email_agent.log"
DONE_LOG  = "drafted_contacts.json"   # idempotency: tracks already-drafted emails
DATA_FILE = "contacts.csv"

# ─────────────────────────────────────────────
# EMAIL CONTENT — fill in before running
# ─────────────────────────────────────────────

# Subject lines per category
SUBJECT_MAP = {
    "real estate":   "דרך חדשה / פתרון נקודתי לחסמים בתיקים שלכם",
    "urban renewal": "דרך חדשה / פתרון נקודתי לחסמים בתיקים שלכם",
}

# Category-specific paragraph (Hebrew)
CATEGORY_BLURB = {
    "real estate": (
        "בעסקאות נדל\"ן מורכבות — סכסוכי מרובי-צדדים, מחלוקות בעלות, "
        "תביעות קבלנים — הליכים משפטיים ממושכים פוגעים בערך הנכס ובאמון הלקוח. "
        "DOM גישור מציע פתרון מובנה וסודי, המגן על לוחות הזמנים ושומר על קשרים עסקיים."
    ),
    "urban renewal": (
        "פרויקטי תמ\"א 38 ופינוי-בינוי חשופים לקיפאון בין יזמים, דיירים ורשויות. "
        "DOM גישור מתמחה בפריצת קיפאונות אלו ביעילות — "
        "שומר על לוח הזמנים של הפרויקט ומונע פניה יקרה לבתי משפט."
    ),
}

# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("email_agent")

# ─────────────────────────────────────────────
# DATA MODEL
# ─────────────────────────────────────────────

@dataclass
class Contact:
    firm_name:      str
    contact_person: str
    email:          str
    category:       str

# ─────────────────────────────────────────────
# PERSONALIZATION ENGINE
# ─────────────────────────────────────────────

def build_salutation(contact: Contact) -> str:
    if contact.contact_person.strip():
        return f"{contact.contact_person} יקר,"
    return "עו\"ד יקר,"


def build_email(contact: Contact) -> tuple[str, str]:
    """Returns (subject, html_body). Replace the body template below with your text."""
    cat_key    = contact.category.strip().lower()
    subject    = SUBJECT_MAP.get(cat_key, "DOM גישור — פתרון סכסוכים עסקיים")
    blurb      = CATEGORY_BLURB.get(cat_key, "")
    salutation = build_salutation(contact)

    html_body = f"""\
<html>
<body dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; color: #1B1B1B; max-width: 660px; margin: auto; line-height: 1.7;">

  <p>{salutation}</p>

  <p>
    רציתי לשתף אותך באופן אישי בדרך חדשה שיצאתי אליה: אחרי 20 שנה בתחום,
    החלטתי להתרכז אך ורק במה שאני הכי אוהב ומרגיש בו סיפוק עצום –
    לסייע לצדדים להגיע להסכמות מהירות בפרויקטים מורכבים
    ולהביא את הניסיון שלי לידי ביטוי.
  </p>

  <p>
    לשם כך גיבשתי מודל של <strong>גישור נדל"ן מכוון הכרעה או בוררות</strong>.
    המטרה שלי היא לא לייצר הליכים ארוכים, אלא להפך: לסייע לרכבת שלכם לעצור
    עצירה קטנה ממש, לפתור את החסם או הסרבנות המקומית, ולהמשיך לדהור קדימה
    בלי להתעכב.
  </p>

  <p>
    מדובר בהליך מובנה ומתוחם בזמן, שמטרתו לסיים מחלוקות בטווח הקצר ביותר
    ובאופן המקצועי ביותר על בסיס ניסיון פרקטי מהשטח.
    המנגנון כולל שימוש בכלים חדשניים שיש בהם כדי לשפר, לייעל
    ולהביא להליכים יצירתיים ומהירים.
  </p>

  <p>
    אשמח מאוד להפנות אותך ל<a href="https://lalum.co.il" style="color:#800020;">אתר המשרד</a>,
    הכולל פירוט רחב יותר על שיטת גישור מכוון הכרעה ובכלל.
  </p>

  <p>
    מצ"ב למטה סעיף קצר שאשמח מאוד אם תעביר
    <strong>למחלקת הנדל"ן וההתחדשות העירונית</strong> אצלכם.
    אפשר להטמיע אותו כבר בשלב ההסכמים כדי לייצר מנגנון קבוע ושוטף
    שיחלץ כל מחלוקת עתידית בפרויקטים.
  </p>

  <p>אשמח מאוד לשמוע מה דעתך עליו.</p>

  <p>
    ניתן לדבר איתי אישית בטלפון
    <a href="tel:0522490420" style="color:#800020;">052-2490420</a>
    או למשרד
    <a href="tel:0333104959" style="color:#800020;">03-3104959</a>.
  </p>

  <br>
  <p>בברכה קולגיאלית,</p>

  <table style="border-collapse:collapse; font-family: Arial, sans-serif; font-size:13px; color:#1B1B1B; margin-top:8px;">
    <tr>
      <td style="padding-right:16px; vertical-align:top;">
        <p style="margin:0;"><strong>Dr. Avraham Lalum, Adv.</strong></p>
        <p style="margin:2px 0; color:#555;">Attorney | Arbitrator &amp; Mediator | Expert in Law, Economics &amp; AI</p>
        <p style="margin:6px 0 2px 0;">Herzliya Business Park, Building G</p>
        <p style="margin:0;">85 Medinat HaYehudim St., 3rd Floor, Herzliya Pituach 4676670, Israel</p>
        <p style="margin:6px 0 2px 0;">
          Office: <a href="tel:+97233104959" style="color:#800020;">+972 3-3104959</a> &nbsp;|&nbsp;
          Cell: <a href="tel:+97252490420" style="color:#800020;">+972 52-2490420</a>
        </p>
        <p style="margin:2px 0;">
          ✉️ <a href="mailto:avraham@lalum.co" style="color:#800020;">avraham@lalum.co</a> &nbsp;|&nbsp;
          🌐 <a href="https://www.lalum.co" style="color:#800020;">www.lalum.co</a>
        </p>
        <p style="margin:6px 0 2px 0;">
          📚 <a href="https://www.lalum.co/courses" style="color:#800020;">Master Course: Real Estate Transactions, AI &amp; Body Language</a>
        </p>
        <p style="margin:2px 0;">
          🔬 <a href="https://www.lalum.co" style="color:#800020;">Access my latest peer-reviewed research article</a>
        </p>
      </td>
    </tr>
  </table>

  <hr style="border:none; border-top:1px solid #ccc; margin: 16px 0;">
  <p style="font-size:11px; color:#888; line-height:1.6;">
    <em>Email Confidentiality Notice:</em><br>
    This email and its attachments are confidential and intended solely for the named recipient(s).
    If you are not the intended recipient, any disclosure, copying, or distribution is strictly prohibited.
    If received in error, please notify us immediately and delete this email. Thank you.
  </p>

  <hr style="border:none; border-top:2px solid #D4AF37; margin: 32px 0 16px 0;">

  <p style="font-size:13px; color:#444;">
    <strong>הסעיף להטמעה — מנגנון יישוב סכסוכים (מודל DOM):</strong>
  </p>

  <blockquote style="
      border-right: 4px solid #D4AF37;
      margin: 0;
      padding: 12px 16px;
      background: #FFFDD0;
      font-size: 13px;
      color: #333;
      line-height: 1.8;">
    "כל מחלוקת או סכסוך שיתגלעו בין הצדדים בקשר עם הסכם זה, אשר לא יבואו
    על פתרונם תוך 14 ימים, יופנו באופן מיידי להליך גישור נדל"ן ממוקד
    ומכוון הכרעה או בוררות בפני ד"ר אברהם ללום, עו"ד (או מי מטעמו),
    המשלב כלים חדשניים ופתרונות יצירתיים, במטרה להביא לפתרון מהיר של
    החסם ולאפשר את המשך התקדמותו הרציפה של הפרויקט."
  </blockquote>

</body>
</html>"""

    return subject, html_body

# ─────────────────────────────────────────────
# IDEMPOTENCY LOG
# ─────────────────────────────────────────────

def load_done_log() -> set:
    if not Path(DONE_LOG).exists():
        return set()
    with open(DONE_LOG, encoding="utf-8") as f:
        return set(json.load(f).get("drafted", []))


def record_done(email_address: str, done_set: set) -> None:
    done_set.add(email_address)
    with open(DONE_LOG, "w", encoding="utf-8") as f:
        json.dump({"drafted": sorted(done_set)}, f, ensure_ascii=False, indent=2)

# ─────────────────────────────────────────────
# DRAFT BACKENDS
# ─────────────────────────────────────────────

def create_draft_win32(contact: Contact, subject: str, body: str) -> None:
    """Save draft in locally installed Outlook (Windows only)."""
    import win32com.client  # type: ignore
    outlook = win32com.client.Dispatch("Outlook.Application")
    mail = outlook.CreateItem(0)   # 0 = olMailItem
    mail.To       = contact.email
    mail.Subject  = subject
    mail.HTMLBody = body
    mail.Save()   # Save() → goes to Drafts folder; Send() would send immediately


def _get_o365_account(_cache: dict = {}) -> object:
    """Return authenticated O365 Account, authenticating once per process."""
    from O365 import Account, FileSystemTokenBackend  # type: ignore

    if "account" in _cache:
        return _cache["account"]

    token_backend = FileSystemTokenBackend(
        token_path=".", token_filename="o365_token.txt"
    )
    account = Account(
        (O365_CLIENT_ID, O365_CLIENT_SECRET),
        auth_flow_type=O365_AUTH_FLOW,
        tenant_id=O365_TENANT_ID,
        token_backend=token_backend,
    )

    if not account.is_authenticated:
        if O365_AUTH_FLOW == "authorization":
            # Opens browser once — paste the redirect URL back in the terminal
            log.info("Opening browser for Microsoft login…")
            account.authenticate(
                scopes=["https://graph.microsoft.com/Mail.Send",
                        "https://graph.microsoft.com/Mail.ReadWrite"]
            )
        else:
            account.authenticate()

    _cache["account"] = account
    return account


def create_draft_o365(contact: Contact, subject: str, body: str) -> None:
    """Save draft via Microsoft Graph (O365 library)."""
    account = _get_o365_account()
    mailbox = account.mailbox(resource=SENDER_EMAIL)
    draft = mailbox.new_message()
    draft.to.add(contact.email)
    draft.subject   = subject
    draft.body      = body
    draft.body_type = "HTML"
    draft.save_draft()


def send_via_o365(contact: Contact, subject: str, body: str) -> None:
    """Send immediately via Microsoft Graph (O365 library)."""
    account = _get_o365_account()
    mailbox = account.mailbox(resource=SENDER_EMAIL)
    message = mailbox.new_message()
    message.to.add(contact.email)
    message.subject   = subject
    message.body      = body
    message.body_type = "HTML"
    message.send()

# ─────────────────────────────────────────────
# DATA LOADING
# ─────────────────────────────────────────────

def load_contacts() -> list[Contact]:
    if not Path(DATA_FILE).exists():
        raise FileNotFoundError(f"{DATA_FILE} not found. Create the file first.")
    contacts = []
    with open(DATA_FILE, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            email = row.get("Email", "").strip()
            if not email:
                continue
            contacts.append(Contact(
                firm_name      = row.get("Firm_Name", "").strip(),
                contact_person = row.get("Contact_Person", "").strip(),
                email          = email,
                category       = row.get("Category", "").strip(),
            ))
    return contacts

# ─────────────────────────────────────────────
# MAIN LOOP
# ─────────────────────────────────────────────

def run() -> None:
    contacts = load_contacts()
    done_set = load_done_log()

    mode = "DRY-RUN (preview only)" if DRY_RUN else f"LIVE — creating Outlook DRAFTS via [{EMAIL_BACKEND}]"
    log.info(f"Starting — {mode} — {len(contacts)} contacts loaded")

    stats = {"drafted": 0, "skipped": 0, "errors": 0}

    for i, contact in enumerate(contacts, start=1):
        tag = f"[{i:03d}/{len(contacts)}] {contact.email}"

        if contact.email in done_set:
            log.info(f"{tag}  → SKIPPED (already drafted)")
            stats["skipped"] += 1
            continue

        subject, body = build_email(contact)

        if DRY_RUN:
            print("\n" + "═" * 72)
            print(f"  [{i:03d}] TO      : {contact.email}")
            print(f"        FIRM    : {contact.firm_name}")
            print(f"        CATEGORY: {contact.category}")
            print(f"        SUBJECT : {subject}")
            print(f"        SALUTE  : {build_salutation(contact)}")
            print("        BODY    : [HTML — edit build_email() to change content]")
            print("═" * 72)
            stats["drafted"] += 1
            continue

        try:
            if EMAIL_BACKEND == "win32":
                create_draft_win32(contact, subject, body)
            else:
                create_draft_o365(contact, subject, body)

            record_done(contact.email, done_set)
            log.info(f"{tag}  → DRAFT SAVED ✓")
            stats["drafted"] += 1

        except Exception as exc:
            log.error(f"{tag}  → ERROR: {exc}")
            stats["errors"] += 1

        if i < len(contacts):
            time.sleep(THROTTLE_SECS)

    log.info(
        f"\nDone — drafted={stats['drafted']}  "
        f"skipped={stats['skipped']}  errors={stats['errors']}"
    )
    if not DRY_RUN:
        log.info("All drafts saved to Outlook Drafts folder. Review and send manually.")


if __name__ == "__main__":
    run()
