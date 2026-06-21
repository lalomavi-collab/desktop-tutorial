import os, msal, requests
from datetime import date

today = date.today().strftime('%d.%m.%Y')

# Applications with verified direct email addresses
applications = [
    {
        "company": "Pagaya",
        "title": "Legal Counsel - Privacy & Data Protection",
        "to_email": "recruiting@pagaya.com",
        "subject": "Application: Legal Counsel - Privacy & Data Protection | Dr. Avraham Lalum",
        "body": """Dear Pagaya Legal Team,

I am writing to apply for the Legal Counsel - Privacy & Data Protection position at Pagaya.

Pagaya operates at an intersection I find genuinely compelling: machine learning applied to consumer credit and real estate at scale, with the data governance, privacy, and regulatory complexity that comes from operating in both Israeli and US markets simultaneously. The legal work here - across data protection, information security, financial regulation, and employment law - is substantive and multi-layered. That is exactly the kind of challenge I am looking for at this stage of my career.

I will be direct: I hold a doctorate in law and bring extensive experience across law firms and in-house technology roles, and I am making a deliberate choice about what comes next. Pagaya's combination of AI-driven product, global operations, and serious regulatory exposure represents the kind of environment where my background - including my doctoral research on AI regulatory frameworks - creates real value rather than just filling a seat.

My experience covers the scope of what this role requires: GDPR and CCPA compliance programs, data processing agreement review and negotiation, information security governance (ISO 27001, SOC 2 familiarity), employment law matters in cross-border contexts, and advising executive and cross-functional teams on complex regulatory risk. I am fluent in the Israeli Privacy Protection Law and its forthcoming amendments, and I have advised on cross-border data transfer mechanisms in SaaS and fintech environments.

I am Tel Aviv-based and available to start immediately. I would welcome the opportunity to speak with you.

Avraham Lalum, Ph.D.
avraham@lalum.co | +972-52-249-0420 | lalum.co

Application URL: https://job-boards.greenhouse.io/pagayais/jobs/7724324003""",
    },
    {
        "company": "Classiq Technologies",
        "title": "Legal Counsel",
        "to_email": "nir@classiq.io",
        "subject": "Application: Legal Counsel | Dr. Avraham Lalum, Ph.D.",
        "body": """Dear Nir and the Classiq Team,

I am writing to apply for the Legal Counsel position at Classiq.

I will be direct about my motivation: I have spent meaningful years in legal practice - at law firms and in-house - and I have reached a point where I am deliberately choosing the next chapter rather than drifting into it. I hold a doctorate in law, and I am drawn to environments where the technology itself raises genuinely new legal questions. Quantum computing, at its intersection with AI and enterprise software, is exactly that kind of environment. Classiq is building in a space where the legal frameworks are still being written, and that is precisely where I want to work.

As your sole legal counsel, I would bring the full range of skills this role requires: global commercial agreements with enterprise clients, SaaS and DPA negotiations, IP and open-source strategy, privacy compliance across GDPR and CCPA, and the corporate governance that supports a scaling company. My doctoral research gives me the analytical foundation to engage rigorously with novel regulatory questions - including those that will emerge as quantum computing becomes a regulated technology.

I am accustomed to operating independently, building trust across finance, product, R&D, and sales, and turning complex legal concepts into practical, actionable guidance. I understand what it means to be the only lawyer in the room, and I know how to make that role work for the business.

Classiq is doing something historically significant. I would like to be the legal counsel that helps you do it responsibly.

Avraham Lalum, Ph.D.
avraham@lalum.co | +972-52-249-0420 | lalum.co

Position: https://www.classiq.io/positions/position-49_B68""",
    },
    {
        "company": "Simply (JoyTunes)",
        "title": "Legal Counsel",
        "to_email": "info@hellosimply.com",
        "subject": "Application: Legal Counsel | Dr. Avraham Lalum, Ph.D.",
        "body": """Dear Simply / JoyTunes Team,

I am writing to apply for the Legal Counsel position at Simply.

After years of practice - in law firms and in-house roles - I have arrived at a deliberate turning point. I have a doctorate in law and a strong foundation in commercial, privacy, and IP matters, but what I am looking for now is a challenge that feels genuinely worth building toward. Simply, which is turning AI into a daily creative companion for millions of people, offers that kind of challenge.

The legal work here is layered in a way I find genuinely exciting: SaaS commercial agreements, global privacy and data compliance, music and content licensing, IP strategy, and the emerging questions that AI-generated creative content raises across jurisdictions. This is not routine in-house work - it requires someone who can hold multiple legal frameworks simultaneously and translate them into practical guidance for a fast-moving product team. That is what I have done throughout my career, and it is what I want to keep doing, at scale.

I have built legal infrastructure from scratch, negotiated complex licensing and partnership agreements, advised on privacy programs under GDPR and Israeli law, and served as a trusted partner to executive and product leadership. My doctoral background gives me the analytical depth to engage with novel legal questions - and there are many ahead for a company building AI-powered creative learning at this scale.

I would welcome the opportunity to speak with you.

Avraham Lalum, Ph.D.
avraham@lalum.co | +972-52-249-0420 | lalum.co""",
    },
]

# Portal-only positions (cannot be sent automatically)
portal_only = [
    {"company": "Mobileye", "portal": "https://careers.mobileye.com/jobs?location=Jerusalem"},
    {"company": "Wiz (Privacy+AI)", "portal": "https://www.wiz.io/careers/job/4624101006"},
    {"company": "Wiz (Product+Data)", "portal": "https://www.wiz.io/careers/job/4588700006"},
    {"company": "Tavily", "portal": "https://jobs.ashbyhq.com/tavily"},
    {"company": "monday.com", "portal": "https://monday.com/careers"},
    {"company": "Guidde", "portal": "https://job-boards.eu.greenhouse.io/guiddelinkedin/jobs/4853322101"},
    {"company": "Varonis", "portal": "https://jobs.jobvite.com/varonis-internal/job/o91lAfwP"},
    {"company": "Wix", "portal": "https://careers.wix.com/positions"},
    {"company": "Frame Security", "portal": "https://team8.vc/career/frame-security/legal-counsel/"},
    {"company": "Eon", "portal": "https://job-boards.eu.greenhouse.io/eonio/jobs/4832322101"},
    {"company": "Mixtiles", "portal": "https://il.linkedin.com/jobs/view/legal-partner-at-mixtiles-4413471009"},
    {"company": "Hypernative", "portal": "https://builtin.com/job/legal-counsel/9598621"},
    {"company": "Classiq (also)", "portal": "https://www.classiq.io/positions/position-49_B68"},
]

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
sent = 0
failed = 0

for app_data in applications:
    payload = {
        "message": {
            "subject": app_data["subject"],
            "body": {"contentType": "Text", "content": app_data["body"]},
            "toRecipients": [{"emailAddress": {"address": app_data["to_email"]}}],
            "ccRecipients": [{"emailAddress": {"address": "avraham@lalum.co"}}],
        },
        "saveToSentItems": "true",
    }
    resp = requests.post(
        "https://graph.microsoft.com/v1.0/users/" + sender + "/sendMail",
        headers={"Authorization": "Bearer " + result["access_token"], "Content-Type": "application/json"},
        json=payload, timeout=30,
    )
    if resp.status_code == 202:
        print("SENT: " + app_data["company"] + " -> " + app_data["to_email"])
        sent += 1
    else:
        print("FAILED: " + app_data["company"] + " | " + str(resp.status_code) + ": " + resp.text[:200])
        failed += 1

print("\n--- Summary ---")
print("Sent: " + str(sent) + " | Failed: " + str(failed))
print("\nPortal-only (manual submission required):")
for p in portal_only:
    print("  * " + p["company"] + ": " + p["portal"])
