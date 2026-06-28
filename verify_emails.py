"""
verify_emails.py — בודק כל כתובת מייל ברשימה לפני שליחה
בודק DNS (MX record) + חיבור SMTP — ללא שליחת מייל בפועל
"""
import csv, dns.resolver, smtplib, socket, json, time
from pathlib import Path

DATA_FILE   = "contacts.csv"
RESULT_FILE = "email_verify_results.json"
SENDER      = "avraham@lalum.co"  # שולח — לצורך בדיקת SMTP בלבד
THROTTLE    = 1  # שניה בין בדיקות

def check_mx(domain):
    try:
        records = dns.resolver.resolve(domain, 'MX')
        mx = sorted(records, key=lambda r: r.preference)[0].exchange.to_text().rstrip('.')
        return mx
    except Exception as e:
        return None

def check_smtp(email, mx_host):
    try:
        with smtplib.SMTP(timeout=8) as s:
            s.connect(mx_host, 25)
            s.ehlo_or_helo_if_needed()
            code, _ = s.mail(SENDER)
            if code != 250:
                return "SMTP_MAIL_FAIL"
            code, msg = s.rcpt(email)
            if code in (250, 251):
                return "OK"
            elif code == 550:
                return "USER_NOT_FOUND"
            else:
                return f"RCPT_{code}"
    except smtplib.SMTPConnectError:
        return "CONNECT_FAIL"
    except smtplib.SMTPServerDisconnected:
        return "DISCONNECTED"
    except socket.timeout:
        return "TIMEOUT"
    except Exception as e:
        return f"ERROR: {str(e)[:60]}"

contacts = []
with open(DATA_FILE, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        if row.get("Email", "").strip():
            contacts.append(row)

results = {}
total = len(contacts)

print(f"\nבודק {total} כתובות...\n")

for i, c in enumerate(contacts, 1):
    email  = c["Email"].strip()
    name   = c["Contact_Person"].strip()
    firm   = c["Firm_Name"].strip()

    if "@" not in email:
        status = "INVALID_FORMAT"
        mx     = None
    else:
        domain = email.split("@")[1]
        mx     = check_mx(domain)
        if not mx:
            status = "NO_MX_RECORD"
        else:
            status = check_smtp(email, mx)

    icon = "✅" if status == "OK" else ("❌" if status in ("USER_NOT_FOUND","NO_MX_RECORD","INVALID_FORMAT") else "⚠️")
    print(f"  [{i:02d}/{total}] {icon} {email:45s} → {status}")

    results[email] = {
        "firm": firm,
        "contact": name,
        "mx": mx,
        "status": status
    }
    time.sleep(THROTTLE)

with open(RESULT_FILE, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

# סיכום
ok       = sum(1 for v in results.values() if v["status"] == "OK")
no_mx    = sum(1 for v in results.values() if v["status"] == "NO_MX_RECORD")
not_found= sum(1 for v in results.values() if v["status"] == "USER_NOT_FOUND")
other    = total - ok - no_mx - not_found

print(f"\n{'='*60}")
print(f"✅ תקינות:        {ok}")
print(f"❌ דומיין לא קיים: {no_mx}")
print(f"❌ משתמש לא קיים: {not_found}")
print(f"⚠️  לא ניתן לבדוק: {other}")
print(f"{'='*60}")
print(f"\nתוצאות שמורות ב: {RESULT_FILE}")
print("עכשיו הרץ: python email_agent.py  (ישלח רק לכתובות תקינות)")
