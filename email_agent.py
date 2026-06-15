"""
email_agent.py — B2B Outreach Agent for Law Firms
Supports: win32com.client (local Outlook) or O365 (cloud/Office 365)
"""

import csv
import json
import logging
import os
import random
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# ─────────────────────────────────────────────
# CONFIGURATION — edit these before running
# ─────────────────────────────────────────────

DRY_RUN = True                        # Set False to actually send emails
EMAIL_BACKEND = "o365"                # "win32" | "o365"
SENDER_EMAIL = "your@email.com"       # Your sending address
SENDER_NAME  = "Your Name"

# O365 / Azure App credentials (only needed when EMAIL_BACKEND = "o365")
O365_CLIENT_ID     = os.environ.get("O365_CLIENT_ID", "")
O365_CLIENT_SECRET = os.environ.get("O365_CLIENT_SECRET", "")
O365_TENANT_ID     = os.environ.get("O365_TENANT_ID", "")

THROTTLE_MIN = 5    # seconds between sends (min)
THROTTLE_MAX = 10   # seconds between sends (max)

LOG_FILE   = "email_agent.log"
SENT_LOG   = "sent_contacts.json"    # tracks successfully sent emails (idempotency)
DATA_FILE  = "contacts.csv"          # set to None to use INLINE_CONTACTS below

# ─────────────────────────────────────────────
# INLINE CONTACT LIST (used when DATA_FILE is None)
# ─────────────────────────────────────────────

INLINE_CONTACTS = [
    {
        "Firm_Name": "Goldberg & Cohen Law",
        "Contact_Person": "Adv. Sarah Cohen",
        "Email": "s.cohen@goldbergcohen.co.il",
        "Category": "Real Estate",
    },
    {
        "Firm_Name": "Levi Urban Partners",
        "Contact_Person": "",
        "Email": "info@leviurban.co.il",
        "Category": "Urban Renewal",
    },
    {
        "Firm_Name": "Mizrahi & Associates",
        "Contact_Person": "Adv. Daniel Mizrahi",
        "Email": "d.mizrahi@mizrahilaw.co.il",
        "Category": "Urban Renewal",
    },
]

# ─────────────────────────────────────────────
# LOGGING SETUP
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
    tags:           list = field(default_factory=list)


# ─────────────────────────────────────────────
# PERSONALIZATION ENGINE
# ─────────────────────────────────────────────

SUBJECT_MAP = {
    "real estate": "Resolving Complex Real Estate Disputes Faster — DOM Mediation",
    "urban renewal": "Unblocking Urban Renewal Projects Through Expert Mediation",
}

CATEGORY_BLURB = {
    "real estate": (
        "In complex real estate transactions — multi-party disputes, title conflicts, "
        "contractor claims — prolonged litigation erodes asset value and client trust. "
        "DOM Mediation brings structured, confidential resolution that protects timelines "
        "and preserves business relationships."
    ),
    "urban renewal": (
        "Urban Renewal (Tama 38 / Pinui-Binui) projects are uniquely vulnerable to "
        "stakeholder deadlocks between developers, tenants, and municipalities. "
        "DOM Mediation specialises in breaking these deadlocks efficiently — "
        "keeping projects on track without costly court intervention."
    ),
}


def build_salutation(contact: Contact) -> str:
    if contact.contact_person.strip():
        return f"Dear {contact.contact_person},"
    return "Dear Partner / שותף נכבד,"


def build_email(contact: Contact) -> tuple[str, str]:
    """Returns (subject, html_body)."""
    cat_key = contact.category.lower()
    subject = SUBJECT_MAP.get(cat_key, "Introducing DOM Mediation Services")
    blurb   = CATEGORY_BLURB.get(cat_key, "")

    salutation = build_salutation(contact)

    html_body = f"""\
<html>
<body style="font-family: Georgia, serif; color: #1B1B1B; max-width: 640px; margin: auto;">

  <p>{salutation}</p>

  <p>
    My name is {SENDER_NAME}, and I am reaching out on behalf of
    <strong>DOM Mediation</strong> — a boutique dispute-resolution practice
    focused exclusively on the legal and real-estate sectors in Israel.
  </p>

  <p>{blurb}</p>

  <p>
    I believe that <strong>{contact.firm_name}</strong> and its clients stand
    to benefit from a faster, more cost-effective alternative to prolonged
    litigation. Our process is fully confidential, enforceable, and typically
    resolves matters <em>3–6× faster</em> than court proceedings.
  </p>

  <p>
    I would welcome a brief 20-minute call to explore whether there is a fit.
    Please reply to this email or book directly via the link below.
  </p>

  <p>
    <a href="https://dom-mediation.co.il/schedule" style="
        background:#D4AF37; color:#1B1B1B; padding:10px 20px;
        text-decoration:none; border-radius:4px; font-weight:bold;">
      Schedule a Call
    </a>
  </p>

  <br>
  <p>With respect,<br>
  <strong>{SENDER_NAME}</strong><br>
  DOM Mediation<br>
  <a href="mailto:{SENDER_EMAIL}">{SENDER_EMAIL}</a>
  </p>

  <hr style="border:none; border-top:1px solid #D4AF37; margin-top:32px;">
  <p style="font-size:11px; color:#888;">
    You are receiving this message because {contact.firm_name} practices in areas
    where mediation may serve your clients. To unsubscribe, reply with "Unsubscribe".
  </p>

</body>
</html>"""

    return subject, html_body


# ─────────────────────────────────────────────
# SENT-LOG (idempotency guard)
# ─────────────────────────────────────────────

def load_sent_log() -> set:
    if not Path(SENT_LOG).exists():
        return set()
    with open(SENT_LOG, encoding="utf-8") as f:
        data = json.load(f)
    return set(data.get("sent", []))


def record_sent(email_address: str, sent_set: set) -> None:
    sent_set.add(email_address)
    with open(SENT_LOG, "w", encoding="utf-8") as f:
        json.dump({"sent": sorted(sent_set)}, f, indent=2)


# ─────────────────────────────────────────────
# EMAIL BACKENDS
# ─────────────────────────────────────────────

def send_via_win32(contact: Contact, subject: str, body: str) -> None:
    """Send using the locally installed Outlook desktop client."""
    import win32com.client  # type: ignore
    outlook = win32com.client.Dispatch("Outlook.Application")
    mail = outlook.CreateItem(0)
    mail.To      = contact.email
    mail.Subject = subject
    mail.HTMLBody = body
    mail.Send()


def send_via_o365(contact: Contact, subject: str, body: str,
                  _account_cache: dict = {}) -> None:
    """Send via Microsoft Graph / O365 library."""
    from O365 import Account  # type: ignore

    if "account" not in _account_cache:
        credentials = (O365_CLIENT_ID, O365_CLIENT_SECRET)
        account = Account(
            credentials,
            auth_flow_type="credentials",
            tenant_id=O365_TENANT_ID,
        )
        if not account.authenticate():
            raise RuntimeError("O365 authentication failed — check credentials.")
        _account_cache["account"] = account

    account = _account_cache["account"]
    mailbox = account.mailbox(resource=SENDER_EMAIL)
    message = mailbox.new_message()
    message.to.add(contact.email)
    message.subject = subject
    message.body    = body
    message.body_type = "HTML"
    message.send()


# ─────────────────────────────────────────────
# DATA LOADING
# ─────────────────────────────────────────────

def load_contacts() -> list[Contact]:
    if DATA_FILE and Path(DATA_FILE).exists():
        log.info(f"Loading contacts from {DATA_FILE}")
        contacts = []
        with open(DATA_FILE, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                contacts.append(Contact(
                    firm_name      = row.get("Firm_Name", "").strip(),
                    contact_person = row.get("Contact_Person", "").strip(),
                    email          = row.get("Email", "").strip(),
                    category       = row.get("Category", "").strip(),
                ))
        return contacts

    log.info("DATA_FILE not found — using INLINE_CONTACTS")
    return [
        Contact(
            firm_name      = c["Firm_Name"],
            contact_person = c["Contact_Person"],
            email          = c["Email"],
            category       = c["Category"],
        )
        for c in INLINE_CONTACTS
    ]


# ─────────────────────────────────────────────
# MAIN SEND LOOP
# ─────────────────────────────────────────────

def run() -> None:
    contacts = load_contacts()
    sent_set = load_sent_log()

    mode_label = "DRY-RUN" if DRY_RUN else "LIVE"
    log.info(f"Starting email agent — mode={mode_label}  backend={EMAIL_BACKEND}  contacts={len(contacts)}")

    stats = {"sent": 0, "skipped": 0, "errors": 0}

    for i, contact in enumerate(contacts, start=1):
        prefix = f"[{i}/{len(contacts)}] {contact.email}"

        # skip already-sent (idempotency)
        if contact.email in sent_set:
            log.info(f"{prefix}  → SKIPPED (already sent)")
            stats["skipped"] += 1
            continue

        subject, body = build_email(contact)

        if DRY_RUN:
            print("\n" + "═" * 72)
            print(f"  TO      : {contact.email}")
            print(f"  FIRM    : {contact.firm_name}")
            print(f"  CATEGORY: {contact.category}")
            print(f"  SUBJECT : {subject}")
            print(f"  SALUTE  : {build_salutation(contact)}")
            print("  BODY    : [HTML — see build_email() for full content]")
            print("═" * 72)
            stats["sent"] += 1
            continue

        try:
            if EMAIL_BACKEND == "win32":
                send_via_win32(contact, subject, body)
            else:
                send_via_o365(contact, subject, body)

            record_sent(contact.email, sent_set)
            log.info(f"{prefix}  → SENT ✓")
            stats["sent"] += 1

        except Exception as exc:
            log.error(f"{prefix}  → ERROR: {exc}")
            stats["errors"] += 1

        # throttle — only between real sends
        if i < len(contacts):
            delay = random.uniform(THROTTLE_MIN, THROTTLE_MAX)
            log.info(f"Throttle: waiting {delay:.1f}s before next send…")
            time.sleep(delay)

    log.info(
        f"\nRun complete — sent={stats['sent']}  "
        f"skipped={stats['skipped']}  errors={stats['errors']}"
    )


if __name__ == "__main__":
    run()
