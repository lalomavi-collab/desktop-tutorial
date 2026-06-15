"""
auth_device.py — Microsoft device code flow (no redirect needed)
Run: python auth_device.py
Follow instructions printed to screen.
"""
import json, requests, time, os

CLIENT_ID = os.environ.get("O365_CLIENT_ID", "")
TENANT_ID = os.environ.get("O365_TENANT_ID", "")
SCOPES    = "Mail.Send Mail.ReadWrite offline_access"

# Step 1: request device code
resp = requests.post(
    f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/devicecode",
    data={"client_id": CLIENT_ID, "scope": SCOPES},
)
data = resp.json()

if "error" in data:
    print(f"שגיאה: {data.get('error_description', data)}")
    exit(1)

print("\n" + "="*60)
print("כנס לכתובת הבאה בדפדפן:")
print(f"\n  {data['verification_uri']}\n")
print(f"הכנס את הקוד:  {data['user_code']}")
print("="*60)
print("\nמחכה לאישור...")

# Step 2: poll for token
interval = data.get("interval", 5)
deadline = time.time() + data.get("expires_in", 900)

while time.time() < deadline:
    time.sleep(interval)
    token_resp = requests.post(
        f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
        data={
            "client_id": CLIENT_ID,
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "device_code": data["device_code"],
        },
    )
    token_data = token_resp.json()

    if "access_token" in token_data:
        with open("o365_token.txt", "w") as f:
            json.dump(token_data, f)
        print("\n✅ אימות הצליח! שולח מייל ניסיון...")
        os.system("python send_test.py")
        break
    elif token_data.get("error") == "authorization_pending":
        print(".", end="", flush=True)
    elif token_data.get("error") == "slow_down":
        interval += 5
    else:
        print(f"\nשגיאה: {token_data.get('error_description', token_data)}")
        break
