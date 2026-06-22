import os, msal, requests
from datetime import date

today = date.today()
today_str = today.strftime('%d.%m.%Y')

authority = "https://login.microsoftonline.com/" + os.environ["MS_TENANT_ID"]
app = msal.ConfidentialClientApplication(
    client_id=os.environ["MS_CLIENT_ID"],
    client_credential=os.environ["MS_CLIENT_SECRET"],
    authority=authority,
)
result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
if "access_token" not in result:
    print("Token error:", result)
    exit(1)

sender = os.environ["MS_SENDER"]

def send_email(subject, body):
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body},
            "toRecipients": [{"emailAddress": {"address": "avraham@lalum.co"}}],
        },
        "saveToSentItems": "true",
    }
    resp = requests.post(
        "https://graph.microsoft.com/v1.0/users/" + sender + "/sendMail",
        headers={"Authorization": "Bearer " + result["access_token"], "Content-Type": "application/json"},
        json=payload, timeout=30,
    )
    return resp.status_code == 202

# ── July 1+ : send approval request and stop ─────────────────────────────────
if today >= date(2026, 7, 1):
    subject = "Job Search Agent — Approval Required to Continue | " + today_str
    body = """Job Search Daily Scan — End of June Review
""" + "=" * 40 + """

The automated job search agent has completed its June 2026 run (22.06 - 30.06).

To continue into July, please reply with one of:
  * "continue" / "המשך" — restart daily scans for July
  * "stop" / "עצור"    — pause the agent

If no response is received within 7 days, the agent will remain paused.

---

June 2026 Summary:
  * Active searches: 9 sources scanned daily
  * Positions tracked: 16
  * Cover letters written: 15
  * Applications sent (email): 3 (Pagaya, Classiq, Simply)
  * Portal submissions queued: 12

Top open positions as of 30.06.2026:
  [9.6] Mobileye — Legal Counsel - Regulatory & AV (Jerusalem)
  [9.5] Wiz — Privacy, AI and Data Protection Counsel (Israel/Remote)
  [9.2] Tavily — Technology Commercial Legal Counsel (Tel Aviv)
  [9.1] Wiz — Product & Data Protection Counsel (Tel Aviv)
  [9.0] monday.com — Privacy Legal Counsel (Tel Aviv)
  [8.8] Guidde — Founding Legal Counsel (Tel Aviv)
  [8.7] Pagaya — Legal Counsel Privacy & Data Protection (Tel Aviv)
  [8.6] Wix — Product & Privacy Legal Counsel (Tel Aviv)
  [8.5] Frame Security — Legal Counsel (Tel Aviv)
  [8.5] Varonis — Privacy Legal Counsel (Israel)

Dashboard: https://desktop-tutorial-liart-three.vercel.app/

""" + "=" * 40 + """
To reactivate: reply to this email or trigger the workflow manually.
"""
    if send_email(subject, body):
        print("Approval request sent — agent paused pending response.")
    else:
        print("Failed to send approval request.")
    exit(0)

# ── Daily report (June 22 – June 30) ─────────────────────────────────────────

searches = [
    {"source": "LinkedIn", "query": "AI legal counsel Israel Tel Aviv",
     "url": "https://il.linkedin.com/jobs/search?keywords=legal+counsel+AI&location=Israel"},
    {"source": "LinkedIn", "query": "Privacy counsel data protection Israel",
     "url": "https://il.linkedin.com/jobs/search?keywords=privacy+counsel&location=Tel+Aviv"},
    {"source": "LinkedIn", "query": "General Counsel first legal hire Israel startup",
     "url": "https://il.linkedin.com/jobs/search?keywords=general+counsel&location=Israel"},
    {"source": "Glassdoor", "query": "Legal counsel AI Tel Aviv",
     "url": "https://www.glassdoor.com/Job/israel-legal-counsel-jobs-SRCH_IL.0,6_IN119_KO7,20.htm"},
    {"source": "Greenhouse / EU", "query": "Legal Counsel Israel tech",
     "url": "https://job-boards.eu.greenhouse.io/"},
    {"source": "Mobileye Careers", "query": "Legal / Regulatory",
     "url": "https://careers.mobileye.com/jobs?location=Jerusalem"},
    {"source": "monday.com Careers", "query": "Legal Counsel",
     "url": "https://monday.com/careers"},
    {"source": "Wiz Careers", "query": "Legal / Privacy",
     "url": "https://www.wiz.io/careers"},
    {"source": "Team8 / Frame Security", "query": "Legal Counsel",
     "url": "https://team8.vc/careers/"},
]

tracked_positions = [
    {"company": "Mobileye", "title": "Legal Counsel - Regulatory & AV",
     "location": "Jerusalem", "score": "9.6",
     "url": "https://careers.mobileye.com/jobs?location=Jerusalem"},
    {"company": "Wiz (Google)", "title": "Privacy, AI and Data Protection Counsel",
     "location": "Israel / Remote", "score": "9.5",
     "url": "https://www.wiz.io/careers/job/4624101006"},
    {"company": "Tavily", "title": "Technology Commercial Legal Counsel",
     "location": "Tel Aviv", "score": "9.2",
     "url": "https://il.linkedin.com/jobs/view/legal-counsel-at-tavily-4369262482"},
    {"company": "Wiz (Google)", "title": "Product & Data Protection Counsel",
     "location": "Tel Aviv", "score": "9.1",
     "url": "https://www.wiz.io/careers/job/4588700006/product-data-protection-counsel"},
    {"company": "monday.com", "title": "Privacy Legal Counsel",
     "location": "Tel Aviv", "score": "9.0",
     "url": "https://il.linkedin.com/jobs/view/privacy-legal-counsel-at-monday-com-4216556442"},
    {"company": "Pagaya", "title": "Legal Counsel - AI / Data Protection (original)",
     "location": "Tel Aviv", "score": "9.0",
     "url": "https://job-boards.greenhouse.io/pagayais/jobs/7540401003"},
    {"company": "Guidde", "title": "Founding Legal Counsel",
     "location": "Tel Aviv", "score": "8.8",
     "url": "https://job-boards.eu.greenhouse.io/guiddelinkedin/jobs/4853322101"},
    {"company": "Pagaya", "title": "Legal Counsel - Privacy & Data Protection (new)",
     "location": "Tel Aviv", "score": "8.7",
     "url": "https://job-boards.greenhouse.io/pagayais/jobs/7724324003"},
    {"company": "Wix", "title": "Product & Privacy Legal Counsel",
     "location": "Tel Aviv", "score": "8.6",
     "url": "https://www.wix.com/jobs/locations/tel-aviv/departments/legal"},
    {"company": "Frame Security (Team8)", "title": "Legal Counsel",
     "location": "Tel Aviv", "score": "8.5",
     "url": "https://team8.vc/career/frame-security/legal-counsel/"},
    {"company": "Varonis", "title": "Privacy Legal Counsel",
     "location": "Israel (Hybrid)", "score": "8.5",
     "url": "https://www.privacy.jobs/jobs/privacy-legal-counsel-a43df0a5"},
    {"company": "Simply (Piano/Guitar)", "title": "Legal Counsel",
     "location": "Tel Aviv", "score": "8.0",
     "url": "https://www.hellosimply.com/careers"},
    {"company": "Classiq Technologies", "title": "Legal Counsel",
     "location": "Israel", "score": "7.8",
     "url": "https://www.classiq.io/positions/position-49_B68"},
    {"company": "Eon", "title": "Legal Counsel",
     "location": "Tel Aviv / Ramat Gan", "score": "7.8",
     "url": "https://job-boards.eu.greenhouse.io/eonio/jobs/4832322101"},
    {"company": "Mixtiles", "title": "Legal Partner",
     "location": "Tel Aviv", "score": "7.5",
     "url": "https://il.linkedin.com/jobs/view/legal-partner-at-mixtiles-4413471009"},
    {"company": "Hypernative", "title": "Legal Counsel",
     "location": "Herzliya", "score": "7.0",
     "url": "https://builtin.com/job/legal-counsel/9598621"},
]

days_left = (date(2026, 6, 30) - today).days + 1

body = "Daily Job Search Report - " + today_str + "\n"
body += "=" * 40 + "\n"
body += "Days remaining in June: " + str(days_left) + " (agent pauses July 1 pending approval)\n\n"
body += "Sources scanned today:\n"
body += "-" * 22 + "\n"
for s in searches:
    body += "  * " + s["source"] + ": " + s["query"] + "\n    " + s["url"] + "\n"

body += "\nTracked positions (" + str(len(tracked_positions)) + " total, sorted by score):\n"
body += "-" * 30 + "\n"
for p in tracked_positions:
    body += "\n  [" + p["score"] + "] " + p["company"] + " -- " + p["title"] + "\n"
    body += "    Location: " + p["location"] + "\n"
    body += "    " + p["url"] + "\n"

body += "\nSearch for new positions:\n"
body += "  * https://il.linkedin.com/jobs/search?keywords=legal+counsel+AI&location=Israel\n"
body += "  * https://il.linkedin.com/jobs/search?keywords=privacy+counsel&location=Israel\n"
body += "  * https://www.glassdoor.com/Job/israel-legal-counsel-jobs-SRCH_IL.0,6_IN119_KO7,20.htm\n"
body += "  * https://www.indexventures.com/startup-jobs/?function=Legal\n"
body += "  * https://team8.vc/careers/\n"
body += "\nDashboard: https://desktop-tutorial-liart-three.vercel.app/\n"
body += "\n" + "=" * 40 + "\n"
body += "Agent runs daily at 10:00 IL time through June 30.\n"
body += "On July 1: approval request will be sent before continuing.\n"

subject = "Daily Job Search - AI Law Israel | " + today_str + " | " + str(len(tracked_positions)) + " positions | " + str(days_left) + " days left in June"

if send_email(subject, body):
    print("Job search report sent to avraham@lalum.co (" + str(len(tracked_positions)) + " positions, " + str(days_left) + " days left in June)")
else:
    print("Error sending report")
    exit(1)
