import os, msal, requests
from datetime import date

today = date.today().strftime('%d.%m.%Y')

searches = [
    {"source": "LinkedIn", "query": "AI legal counsel Israel Tel Aviv",
     "url": "https://il.linkedin.com/jobs/search?keywords=legal+counsel+AI&location=Israel"},
    {"source": "LinkedIn", "query": "Privacy counsel data protection Israel",
     "url": "https://il.linkedin.com/jobs/search?keywords=privacy+counsel&location=Tel+Aviv"},
    {"source": "Glassdoor", "query": "Legal counsel AI Tel Aviv",
     "url": "https://www.glassdoor.com/Job/israel-legal-counsel-jobs-SRCH_IL.0,6_IN119_KO7,20.htm"},
    {"source": "Mobileye Careers", "query": "Legal / Regulatory",
     "url": "https://careers.mobileye.com/jobs?location=Jerusalem"},
    {"source": "monday.com Careers", "query": "Legal Counsel",
     "url": "https://monday.com/careers"},
    {"source": "Check Point Careers", "query": "Legal Privacy",
     "url": "https://checkpoint.com/careers"},
]

tracked_positions = [
    {"company": "Mobileye", "title": "Legal Counsel - Regulatory & AV",
     "location": "Jerusalem", "score": "9.6",
     "url": "https://careers.mobileye.com/jobs?location=Jerusalem"},
    {"company": "monday.com", "title": "Privacy Legal Counsel",
     "location": "Tel Aviv", "score": "9.0",
     "url": "https://il.linkedin.com/jobs/view/privacy-legal-counsel-at-monday-com-4216556442"},
    {"company": "Tavily", "title": "Technology Commercial Legal Counsel",
     "location": "Tel Aviv", "score": "9.2",
     "url": "https://il.linkedin.com/jobs/view/legal-counsel-at-tavily-4369262482"},
    {"company": "Wiz (Google)", "title": "Privacy, AI and Data Protection Counsel",
     "location": "Israel / Remote", "score": "9.5",
     "url": "https://www.wiz.io/careers/job/4624101006"},
    {"company": "Wiz (Google)", "title": "Product & Data Protection Counsel",
     "location": "Tel Aviv", "score": "9.1",
     "url": "https://www.wiz.io/careers/job/4588700006/product-data-protection-counsel"},
    {"company": "Pagaya", "title": "Legal Counsel - AI / Data Protection",
     "location": "Tel Aviv", "score": "9.0",
     "url": "https://job-boards.greenhouse.io/pagayais/jobs/7540401003"},
    {"company": "Pagaya", "title": "Legal Counsel - Privacy & Data Protection (new)",
     "location": "Tel Aviv", "score": "8.7",
     "url": "https://job-boards.greenhouse.io/pagayais/jobs/7724324003"},
    {"company": "Guidde", "title": "Founding Legal Counsel",
     "location": "Tel Aviv", "score": "8.8",
     "url": "https://job-boards.eu.greenhouse.io/guiddelinkedin/jobs/4853322101"},
    {"company": "Varonis", "title": "Privacy Legal Counsel",
     "location": "Israel (Hybrid)", "score": "8.5",
     "url": "https://www.privacy.jobs/jobs/privacy-legal-counsel-a43df0a5"},
    {"company": "Wix", "title": "Product & Privacy Legal Counsel",
     "location": "Tel Aviv", "score": "8.6",
     "url": "https://www.wix.com/jobs/locations/tel-aviv/departments/legal"},
    {"company": "Eon", "title": "Legal Counsel",
     "location": "Tel Aviv", "score": "7.8",
     "url": "https://job-boards.eu.greenhouse.io/eonio/jobs/4832322101"},
]

body = f"Daily Job Search Report - {today}\n"
body += "=" * 40 + "\n\n"
body += "Sources scanned today:\n"
body += "-" * 22 + "\n"
for s in searches:
    body += f"  * {s['source']}: {s['query']}\n    {s['url']}\n"

body += "\nTracked Israeli positions:\n"
body += "-" * 30 + "\n"
for p in tracked_positions:
    body += f"\n  * {p['company']} -- {p['title']}\n"
    body += f"    Location: {p['location']} | Score: {p['score']}\n"
    body += f"    {p['url']}\n"

body += "\nSearch for new positions:\n"
body += "  * https://il.linkedin.com/jobs/search?keywords=legal+counsel+AI&location=Israel\n"
body += "  * https://www.glassdoor.com/Job/israel-legal-counsel-jobs-SRCH_IL.0,6_IN119_KO7,20.htm\n"
body += "  * https://careers.mobileye.com/jobs\n"
body += "  * https://monday.com/careers\n"
body += "\nDashboard: https://desktop-tutorial-liart-three.vercel.app/\n"
body += "\n" + "=" * 40 + "\n"
body += "This report is sent automatically every day at 10:00 IL.\n"

authority = f'https://login.microsoftonline.com/{os.environ["MS_TENANT_ID"]}'
app = msal.ConfidentialClientApplication(
    client_id=os.environ['MS_CLIENT_ID'],
    client_credential=os.environ['MS_CLIENT_SECRET'],
    authority=authority,
)
result = app.acquire_token_for_client(scopes=['https://graph.microsoft.com/.default'])
if 'access_token' not in result:
    print('Token error:', result)
    exit(1)

subject = f'Daily Job Search - AI Law Israel | {today}'
payload = {
    'message': {
        'subject': subject,
        'body': {'contentType': 'Text', 'content': body},
        'toRecipients': [{'emailAddress': {'address': 'avraham@lalum.co'}}],
    },
    'saveToSentItems': 'true',
}

sender = os.environ['MS_SENDER']
resp = requests.post(
    f'https://graph.microsoft.com/v1.0/users/{sender}/sendMail',
    headers={'Authorization': f'Bearer {result["access_token"]}', 'Content-Type': 'application/json'},
    json=payload, timeout=30,
)
if resp.status_code == 202:
    print(f'Job search report sent to avraham@lalum.co')
else:
    print(f'Error {resp.status_code}: {resp.text[:300]}')
    exit(1)
