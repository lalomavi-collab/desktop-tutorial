"""
auth_step2.py — exchanges code for token (no PKCE)
Run: python auth_step2.py "<redirect URL>"
"""
import sys, json, requests, urllib.parse, os

CLIENT_ID     = os.environ.get("O365_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("O365_CLIENT_SECRET", "")
TENANT_ID     = os.environ.get("O365_TENANT_ID", "")
REDIRECT_URI  = "https://login.microsoftonline.com/common/oauth2/nativeclient"
SCOPES        = "Mail.Send Mail.ReadWrite offline_access"

redirect_url = sys.argv[1] if len(sys.argv) > 1 else input("הדבק את ה-URL: ")
params = urllib.parse.parse_qs(urllib.parse.urlparse(redirect_url).query)
code = params.get("code", [None])[0]

if not code:
    print("שגיאה: לא נמצא code ב-URL.")
    sys.exit(1)

resp = requests.post(
    f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
    data={
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
    },
)

if resp.status_code != 200:
    print(f"שגיאה: {resp.json().get('error_description', resp.text)}")
    sys.exit(1)

with open("o365_token.txt", "w") as f:
    json.dump(resp.json(), f)

print("✅ אימות הצליח! מריץ מייל ניסיון...")
os.system("python send_test.py")
