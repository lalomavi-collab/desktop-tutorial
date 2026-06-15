"""
auth_step1.py — generates simple auth URL (no PKCE)
"""
import json, secrets, urllib.parse, os

CLIENT_ID    = os.environ.get("O365_CLIENT_ID", "")
TENANT_ID    = os.environ.get("O365_TENANT_ID", "")
REDIRECT_URI = "https://login.microsoftonline.com/common/oauth2/nativeclient"
SCOPES       = "Mail.Send Mail.ReadWrite offline_access"

state = secrets.token_urlsafe(16)
with open("auth_state.json", "w") as f:
    json.dump({"state": state}, f)

params = {
    "client_id": CLIENT_ID,
    "response_type": "code",
    "redirect_uri": REDIRECT_URI,
    "scope": SCOPES,
    "state": state,
    "response_mode": "query",
}

url = (
    f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize?"
    + urllib.parse.urlencode(params)
)

print("\n" + "="*70)
print("פתח את הקישור בדפדפן והתחבר עם avraham@lalum.co :")
print("="*70)
print(url)
print("="*70)
print("\nאחרי האישור — העתק את ה-URL מסרגל הכתובות ושלח אותו.")
