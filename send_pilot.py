"""
send_pilot.py — שולח ל-2 הראשונים ברשימה בלבד
לבדיקה לפני שליחת כל 200.
"""
import csv, json, requests, time
from pathlib import Path

TOKEN_FILE = "o365_token.txt"
DATA_FILE  = "contacts.csv"
PILOT_COUNT = 2

with open(TOKEN_FILE) as f:
    token = json.load(f)
access_token = token["access_token"]

def build_html(contact_person, firm_name):
    salutation = f"{contact_person} יקר," if contact_person.strip() else 'עו"ד יקר,'
    return f"""
<html>
<body dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; color: #1B1B1B; max-width: 660px; margin: auto; line-height: 1.7;">

  <p>{salutation}</p>

  <p>
    אחרי למעלה מ-20 שנה של עיסוק אינטנסיבי בליטיגציה, נדל"ן מורכב ויישוב סכסוכים,
    בחרתי לזקק את הניסיון מהשטח ולהתמקד אך ורק בפתרון משברים ומבוי סתום בעסקאות מורכבות.
  </p>

  <p>
    פיתחתי מודל פרקטי של <strong>גישור ובוררות נדל"ן מכוון הכרעה (DOM)</strong>.
    לא עוד הליכים תיאורטיים ונמשכים, אלא מנגנון אופרטיבי, ממוקד ומהיר,
    שנועד לפתור חסמים ספציפיים, לשחרר פרויקטים תקועים,
    ולאפשר לכם ולמרשיכם להתקדם ליעד המשותף.
  </p>

  <p>
    הניסיון מוכיח כי רוב הסכסוכים המורכבים בנדל"ן ובהתחדשות עירונית
    ניתנים לפתרון יעיל ומסחרי בתוך שבועות בודדים.
  </p>

  <p>
    אודה לך אם תעביר את <strong>סעיף התנייה המצורף</strong>
    למחלקת הנדל"ן וההתחדשות העירונית אצלכם ב-<strong>{firm_name}</strong> -
    הוא מיועד להטמעה ישירה בהסכמים, ככלי לניהול סיכונים מראש.
  </p>

  <p>אשמח מאוד לשמוע את דעתך המקצועית.</p>

  <p>
    ניתן ליצור עמי קשר ישיר בנייד:
    <a href="tel:+97252490420" style="color:#800020;">052-2490420</a>
    | או במשרד:
    <a href="tel:+97233104959" style="color:#800020;">03-3104959</a>.
  </p>

  <br>
  <p>בברכה ובשלום,<br><strong>ד"ר ללום</strong></p>

  <table style="border-collapse:collapse; font-family: Arial, sans-serif; font-size:13px; color:#1B1B1B; margin-top:8px;">
    <tr>
      <td style="padding-right:16px; vertical-align:top;">
        <p style="margin:0;"><strong>Dr. Avraham Lalum, Adv.</strong></p>
        <p style="margin:2px 0; color:#555;">Attorney | Arbitrator &amp; Mediator | Expert in Law, Economics &amp; AI</p>
        <p style="margin:6px 0 2px 0;">Herzliya Business Park, Building G</p>
        <p style="margin:0;">85 Medinat HaYehudim St., 3rd Floor, Herzliya Pituach 4676670, Israel</p>
        <p style="margin:6px 0 2px 0;">
          Office: <a href="tel:+97233104959" style="color:#800020;">+972 3-3104959</a> &nbsp;|&nbsp;
          Cell: <a href="tel:+97252490420" style="color:#800020;">+972 52-2490420</a>
        </p>
        <p style="margin:2px 0;">
          ✉️ <a href="mailto:avraham@lalum.co" style="color:#800020;">avraham@lalum.co</a> &nbsp;|&nbsp;
          🌐 <a href="https://www.lalum.co" style="color:#800020;">www.lalum.co</a>
        </p>
      </td>
    </tr>
  </table>

  <hr style="border:none; border-top:1px solid #ccc; margin: 16px 0;">
  <p style="font-size:11px; color:#888; line-height:1.6;">
    <em>Email Confidentiality Notice:</em><br>
    This email and its attachments are confidential and intended solely for the named recipient(s).
    If you are not the intended recipient, any disclosure, copying, or distribution is strictly prohibited.
    If received in error, please notify us immediately and delete this email. Thank you.
  </p>

  <hr style="border:none; border-top:2px solid #D4AF37; margin: 32px 0 16px 0;">
  <p style="font-size:13px; color:#444;"><strong>הסעיף להטמעה - מנגנון יישוב סכסוכים (מודל DOM):</strong></p>
  <blockquote style="border-right: 4px solid #D4AF37; margin: 0; padding: 12px 16px; background: #FFFDD0; font-size: 13px; color: #333; line-height: 1.8;">
    "כל מחלוקת או סכסוך שיתגלעו בין הצדדים בקשר עם הסכם זה, אשר לא יבואו
    על פתרונם תוך 14 ימים, יופנו באופן מיידי להליך גישור נדל"ן ממוקד
    ומכוון הכרעה או בוררות בפני ד"ר אברהם ללום, עו"ד (או מי מטעמו),
    המשלב כלים חדשניים ופתרונות יצירתיים, במטרה להביא לפתרון מהיר של
    החסם ולאפשר את המשך התקדמותו הרציפה של הפרויקט."
  </blockquote>

</body>
</html>"""

contacts = []
with open(DATA_FILE, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        contacts.append(row)

pilot = contacts[:PILOT_COUNT]
print(f"\nשולח ל-{PILOT_COUNT} הראשונים בלבד:\n")

for i, c in enumerate(pilot, 1):
    name   = c["Contact_Person"].strip()
    firm   = c["Firm_Name"].strip()
    email  = c["Email"].strip()
    html   = build_html(name, firm)

    resp = requests.post(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        json={"message": {
            "subject": "דרך חדשה / פתרון נקודתי לחסמים בתיקים שלכם",
            "body": {"contentType": "HTML", "content": html},
            "toRecipients": [{"emailAddress": {"address": email}}],
        }}
    )

    if resp.status_code == 202:
        print(f"  [{i}] ✅ נשלח → {email} ({name} / {firm})")
    else:
        print(f"  [{i}] ❌ שגיאה → {email}: {resp.status_code} {resp.text[:100]}")

    if i < PILOT_COUNT:
        time.sleep(5)

print("\nסיום. בדוק את תיבת הדואר של הנמענים.")
print("אם יש טעות — מחק ידנית ואמור לי מה לתקן.")
