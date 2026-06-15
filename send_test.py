"""
send_test.py — שולח מייל ניסיון לעצמך
"""
import json, requests

with open("o365_token.txt") as f:
    token = json.load(f)

access_token = token["access_token"]

email_body = {
    "message": {
        "subject": "מייל ניסיון — גישור מכוון הכרעה",
        "body": {
            "contentType": "HTML",
            "content": """
<html>
<body dir="rtl" style="font-family: Arial; font-size:15px; color:#1B1B1B; max-width:660px; margin:auto; line-height:1.7;">
<p><strong>✅ מייל ניסיון — הכל עובד!</strong></p>
<p>עו"ד אברהם ללום יקר,</p>
<p>זהו מייל ניסיון לאימות מערכת השליחה האוטומטית.</p>
<p>אם קיבלת הודעה זו — המערכת מוכנה לשלוח את כל 200 המיילים.</p>
<hr style="border-top:2px solid #D4AF37; margin:24px 0;">
<p>בברכה קולגיאלית,<br>
<strong>ד"ר אברהם ללום, עו"ד</strong><br>
מייסד, LALUM</p>
</body>
</html>"""
        },
        "toRecipients": [
            {"emailAddress": {"address": "avraham@lalum.co"}}
        ]
    }
}

resp = requests.post(
    "https://graph.microsoft.com/v1.0/me/sendMail",
    headers={
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    },
    json=email_body,
)

if resp.status_code == 202:
    print("✅ מייל ניסיון נשלח בהצלחה ל-avraham@lalum.co")
else:
    print(f"❌ שגיאה: {resp.status_code} — {resp.text}")
