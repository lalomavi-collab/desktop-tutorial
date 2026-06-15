# Azure App Setup — חיבור ישיר ל-Microsoft Graph

## שלב 1 — צור Azure App Registration

1. כנס ל: https://portal.azure.com
2. חפש **"App registrations"** בתפריט העליון → לחץ **+ New registration**
3. מלא:
   - **Name:** `LALUM Email Agent`
   - **Supported account types:** `Accounts in this organizational directory only`
   - **Redirect URI:** בחר `Web` → הכנס: `https://login.microsoftonline.com/common/oauth2/nativeclient`
4. לחץ **Register**

---

## שלב 2 — העתק את הפרטים

בדף ה-App שנוצר, העתק:

| שדה | היכן למצוא | שם משתנה בסקריפט |
|---|---|---|
| **Application (client) ID** | Overview → Application (client) ID | `O365_CLIENT_ID` |
| **Directory (tenant) ID** | Overview → Directory (tenant) ID | `O365_TENANT_ID` |

---

## שלב 3 — צור Client Secret

1. בתפריט השמאלי: **Certificates & secrets** → **+ New client secret**
2. Description: `lalum-agent`
3. Expires: `24 months`
4. לחץ **Add**
5. **העתק את ה-Value מיד** (יוצג פעם אחת בלבד!)

| שדה | שם משתנה בסקריפט |
|---|---|
| Secret **Value** | `O365_CLIENT_SECRET` |

---

## שלב 4 — הגדר הרשאות API

1. בתפריט השמאלי: **API permissions** → **+ Add a permission**
2. בחר **Microsoft Graph** → **Delegated permissions**
3. חפש והוסף:
   - `Mail.Send`
   - `Mail.ReadWrite`
4. לחץ **Add permissions**
5. לחץ **Grant admin consent for [שם הארגון]** ← חשוב!

---

## שלב 5 — הגדר את הסקריפט

ערוך את `email_agent.py`:

```python
EMAIL_BACKEND      = "o365"
SENDER_EMAIL       = "avraham@lalum.co"
O365_CLIENT_ID     = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # מ-שלב 2
O365_CLIENT_SECRET = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # מ-שלב 3
O365_TENANT_ID     = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # מ-שלב 2
O365_AUTH_FLOW     = "authorization"   # פותח דפדפן פעם אחת
```

**או** השתמש בקובץ `.env` (מומלץ — הסיסמאות לא בקוד):

```
O365_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
O365_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
O365_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

ואז הרץ: `pip install python-dotenv` ועדכן בתחילת הסקריפט:
```python
from dotenv import load_dotenv; load_dotenv()
```

---

## שלב 6 — הרצה ראשונה (אימות חד-פעמי)

```bash
pip install O365
python email_agent.py
```

בהרצה הראשונה:
1. הסקריפט יפתח קישור בדפדפן
2. התחבר עם חשבון `avraham@lalum.co`
3. אשר את ההרשאות
4. העתק את ה-URL שהדפדפן הופנה אליו (מתחיל ב-`https://login.microsoftonline.com/common/oauth2/nativeclient?...`)
5. הדבק אותו בטרמינל

**הטוקן נשמר ב-`o365_token.txt`** — בהרצות הבאות אין צורך בדפדפן.

---

## שלב 7 — מייל ניסיון

1. שנה ב-`email_agent.py`:
   ```python
   DRY_RUN   = False
   DATA_FILE = None   # ישתמש ב-INLINE_CONTACTS
   ```
2. ערוך `INLINE_CONTACTS` לרשומה אחת (עצמך)
3. הרץ: `python email_agent.py`

לאחר אישור — שנה בחזרה ל-`DATA_FILE = "contacts.csv"` ו-`DRY_RUN = False` לשליחת כל 200 המיילים.
