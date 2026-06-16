"""
send_test.py — שולח מייל ניסיון שנראה בדיוק כמו המיילים האמיתיים
הנמען: avraham@lalum.co
השם והמשרד: מהרשומה הראשונה ברשימה (הרצוג פוקס נאמן)
"""
import json, requests

with open("o365_token.txt") as f:
    token = json.load(f)

access_token = token["access_token"]

# דוגמה אמיתית — בדיוק כמו שעורך הדין יקבל
CONTACT_PERSON = 'עו"ד אברהם (אברמי) וול'
FIRM_NAME      = "הרצוג פוקס נאמן"
SENDER_NAME    = 'ד"ר אברהם ללום, עו"ד'
SENDER_EMAIL   = "avraham@lalum.co"

html_body = f"""
<html>
<body dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; color: #1B1B1B; max-width: 660px; margin: auto; line-height: 1.7;">

  <p>{CONTACT_PERSON} יקר,</p>

  <p>
    אחרי למעלה מ-20 שנה של עיסוק אינטנסיבי בנדל"ן, בוררות וגישור —
    החלטתי להתמקד אך ורק בזה.
  </p>

  <p>
    הקמתי מודל פרקטי של <strong>גישור ובוררות נדל"ן מכוון הכרעה</strong> -
    לא הליכים ארוכים, אלא כלי ממוקד שנועד לפתור חסם ספציפי,
    לשחרר פרויקט תקוע, ולאפשר לכם ולמרשיכם להמשיך קדימה.
  </p>

  <p>
    הניסיון מהשטח מלמד: רוב הסכסוכים בנדל"ן ובהתחדשות העירונית
    ניתנים לפתרון תוך שבועות.
  </p>

  <p>
    אשמח אם תעביר את הסעיף המצורף
    <strong>למחלקת הנדל"ן וההתחדשות העירונית</strong> אצלכם ב-<strong>{FIRM_NAME}</strong> -
    הוא מיועד להטמעה ישירה בהסכמים.
  </p>

  <p>אשמח לשמוע את דעתך.</p>

  <p>
    ניתן לדבר איתי אישית בטלפון
    <a href="tel:+97252490420" style="color:#800020;">052-2490420</a>
    או למשרד
    <a href="tel:+97233104959" style="color:#800020;">03-3104959</a>.
  </p>

  <br>
  <p>בברכה קולגיאלית,</p>

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
        <p style="margin:6px 0 2px 0;">
          📚 <a href="https://www.lalum.co/courses" style="color:#800020;">Master Course: Real Estate Transactions, AI &amp; Body Language</a>
        </p>
        <p style="margin:2px 0;">
          🔬 <a href="https://www.lalum.co" style="color:#800020;">Access my latest peer-reviewed research article</a>
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

  <p style="font-size:13px; color:#444;">
    <strong>הסעיף להטמעה — מנגנון יישוב סכסוכים (מודל DOM):</strong>
  </p>

  <blockquote style="border-right: 4px solid #D4AF37; margin: 0; padding: 12px 16px; background: #FFFDD0; font-size: 13px; color: #333; line-height: 1.8;">
    "כל מחלוקת או סכסוך שיתגלעו בין הצדדים בקשר עם הסכם זה, אשר לא יבואו
    על פתרונם תוך 14 ימים, יופנו באופן מיידי להליך גישור נדל"ן ממוקד
    ומכוון הכרעה או בוררות בפני ד"ר אברהם ללום, עו"ד (או מי מטעמו),
    המשלב כלים חדשניים ופתרונות יצירתיים, במטרה להביא לפתרון מהיר של
    החסם ולאפשר את המשך התקדמותו הרציפה של הפרויקט."
  </blockquote>

</body>
</html>"""

email_body = {
    "message": {
        "subject": "דרך חדשה / פתרון נקודתי לחסמים בתיקים שלכם",
        "body": {"contentType": "HTML", "content": html_body},
        "toRecipients": [{"emailAddress": {"address": "avraham@lalum.co"}}],
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
    print(f"✅ מייל ניסיון נשלח ל-avraham@lalum.co")
    print(f"   נושא: דרך חדשה / פתרון נקודתי לחסמים בתיקים שלכם")
    print(f"   נמען מדומה: {CONTACT_PERSON} / {FIRM_NAME}")
else:
    print(f"❌ שגיאה: {resp.status_code} — {resp.text}")
