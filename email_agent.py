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
O365_CLIENT_ID     = os.environ.get("O365_CLIENT_ID", "")
O365_CLIENT_SECRET = os.environ.get("O365_CLIENT_SECRET", "")
O365_TENANT_ID     = os.environ.get("O365_TENANT_ID", "")

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
    "real estate":   "יישוב סכסוכי נדל\"ן מורכבים במהירות וביעילות — DOM גישור",
    "urban renewal": "פתרון עיכובים בפרויקטי התחדשות עירונית — DOM גישור",
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
        return f"שלום {contact.contact_person},"
    return "שלום שותף נכבד,"


def build_email(contact: Contact) -> tuple[str, str]:
    """Returns (subject, html_body). Replace the body template below with your text."""
    cat_key    = contact.category.strip().lower()
    subject    = SUBJECT_MAP.get(cat_key, "DOM גישור — פתרון סכסוכים עסקיים")
    blurb      = CATEGORY_BLURB.get(cat_key, "")
    salutation = build_salutation(contact)

    # ══════════════════════════════════════════
    # >>> REPLACE THIS BLOCK WITH YOUR TEXT <<<
    # ══════════════════════════════════════════
    html_body = f"""\
<html>
<body dir="rtl" style="font-family: Arial, sans-serif; color: #1B1B1B; max-width: 640px; margin: auto;">

  <p>{salutation}</p>

  <p>
    שמי {SENDER_NAME}, ואני פונה אליך בשם <strong>DOM גישור</strong> —
    משרד גישור בוטיק המתמחה אך ורק במגזר המשפטי והנדל"ן בישראל.
  </p>

  <p>{blurb}</p>

  <p>
    אני מאמין כי <strong>{contact.firm_name}</strong> ולקוחותיו יוכלו
    להפיק תועלת מפתרון מהיר וחסכוני יותר מהתדיינות משפטית ממושכת.
    התהליך שלנו חסוי לחלוטין, בר-אכיפה, ומשיג תוצאות
    <em>מהר פי 3–6</em> ממהלכים בבית משפט.
  </p>

  <p>
    אשמח לשיחה קצרה של 20 דקות לבדיקת ההתאמה.
    ניתן להשיב למייל זה או לקבוע ישירות דרך הקישור:
  </p>

  <p>
    <a href="https://dom-mediation.co.il/schedule" style="
        background:#D4AF37; color:#1B1B1B; padding:10px 20px;
        text-decoration:none; border-radius:4px; font-weight:bold;">
      קביעת פגישה
    </a>
  </p>

  <br>
  <p>בכבוד רב,<br>
  <strong>{SENDER_NAME}</strong><br>
  DOM גישור<br>
  <a href="mailto:{SENDER_EMAIL}">{SENDER_EMAIL}</a>
  </p>

  <hr style="border:none; border-top:1px solid #D4AF37; margin-top:32px;">
  <p style="font-size:11px; color:#888; direction:rtl;">
    אתה מקבל הודעה זו משום ש-{contact.firm_name} עוסק בתחומים
    בהם גישור עשוי לשרת את לקוחותיך. להסרה מהרשימה, השב "הסר".
  </p>

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


def create_draft_o365(contact: Contact, subject: str, body: str,
                      _cache: dict = {}) -> None:
    """Save draft via Microsoft Graph (O365 library)."""
    from O365 import Account  # type: ignore

    if "account" not in _cache:
        account = Account(
            (O365_CLIENT_ID, O365_CLIENT_SECRET),
            auth_flow_type="credentials",
            tenant_id=O365_TENANT_ID,
        )
        if not account.authenticate():
            raise RuntimeError("O365 authentication failed — check credentials.")
        _cache["account"] = account

    mailbox = _cache["account"].mailbox(resource=SENDER_EMAIL)
    draft = mailbox.new_message()
    draft.to.add(contact.email)
    draft.subject   = subject
    draft.body      = body
    draft.body_type = "HTML"
    draft.save_draft()   # saves to Drafts; never calls send()

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
