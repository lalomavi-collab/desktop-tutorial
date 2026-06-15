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
    רציתי לשתף אותך באופן אישי בדרך חדשה שיצאתי אליה: אחרי 20 שנה בתחום,
    החלטתי להתרכז אך ורק במה שאני הכי אוהב ומרגיש בו סיפוק עצום –
    לסייע לצדדים להגיע להסכמות מהירות בפרויקטים מורכבים
    ולהביא את הניסיון שלי לידי ביטוי.
  </p>

  <p>
    לשם כך גיבשתי מודל של <strong>גישור נדל"ן מכוון הכרעה או בוררות</strong>.
    המטרה שלי היא לא לייצר הליכים ארוכים, אלא להפך: לסייע לרכבת שלכם לעצור
    עצירה קטנה ממש, לפתור את החסם או הסרבנות המקומית, ולהמשיך לדהור קדימה
    בלי להתעכב.
  </p>

  <p>
    מדובר בהליך מובנה ומתוחם בזמן, שמטרתו לסיים מחלוקות בטווח הקצר ביותר
    ובאופן המקצועי ביותר על בסיס ניסיון פרקטי מהשטח.
    המנגנון כולל שימוש בכלים חדשניים שיש בהם כדי לשפר, לייעל
    ולהביא להליכים יצירתיים ומהירים.
  </p>

  <p>
    אשמח מאוד להפנות אותך ל<a href="https://lalum.co.il" style="color:#800020;">אתר המשרד</a>,
    הכולל פירוט רחב יותר על שיטת גישור מכוון הכרעה ובכלל.
  </p>

  <p>
    מצ"ב למטה סעיף קצר שאשמח מאוד אם תעביר
    <strong>למחלקת הנדל"ן וההתחדשות העירונית</strong> אצלכם ב-<strong>{FIRM_NAME}</strong>.
    אפשר להטמיע אותו כבר בשלב ההסכמים כדי לייצר מנגנון קבוע ושוטף
    שיחלץ כל מחלוקת עתידית בפרויקטים.
  </p>

  <p>אשמח מאוד לשמוע מה דעתך עליו.</p>

  <p>
    ניתן לדבר איתי אישית בטלפון
    <a href="tel:0522490420" style="color:#800020;">052-2490420</a>
    או למשרד
    <a href="tel:0333104959" style="color:#800020;">03-3104959</a>.
  </p>

  <br>
  <p>
    בברכה קולגיאלית,<br><br>
    <strong>{SENDER_NAME}</strong><br>
    מייסד, LALUM<br>
    <a href="mailto:{SENDER_EMAIL}" style="color:#800020;">{SENDER_EMAIL}</a>
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
