# הגדרת מערכת סיכומי הפגישות

## מה המערכת עושה

```
יומן (Google/Outlook)
        ↓
   פגישת זום
        ↓
   זום מקליט + AI Companion מסכם
        ↓
   GitHub Action (כל 30 דקות)
        ↓
   Claude מעשיר את הסיכום
        ↓
   מייל מעוצב → avraham@lalum.co
```

---

## שלב 1 – הפעל Zoom AI Companion

1. היכנס ל-**zoom.us → Settings → AI Companion**
2. הפעל:
   - ✅ **Meeting Summary with AI Companion**
   - ✅ **Cloud Recording** (בתוך Recording Settings)
   - ✅ **Audio Transcript**
3. שמור שינויים

---

## שלב 2 – צור Zoom Server-to-Server App

1. היכנס ל: https://marketplace.zoom.us/develop/create
2. בחר **Server-to-Server OAuth**
3. תן שם (למשל: `meeting-summary-bot`)
4. תחת **Scopes**, הוסף:
   - `recording:read:admin`
   - `meeting:read:admin`
   - `report:read:admin`
   - `meeting_summary:read:admin`
5. לחץ **Activate**
6. העתק את:
   - **Account ID**
   - **Client ID**
   - **Client Secret**

---

## שלב 3 – צור Gmail App Password

> הכרחי: חשבון Gmail עם אימות דו-שלבי (2FA) מופעל

1. היכנס ל: https://myaccount.google.com/apppasswords
2. שם האפליקציה: `Zoom Summary Bot`
3. לחץ **Create**
4. העתק את הסיסמה בת 16 התווים

---

## שלב 4 – הוסף Secrets לGitHub

היכנס ל: **GitHub → repo → Settings → Secrets → Actions → New secret**

| שם הסוד | ערך |
|---------|-----|
| `ZOOM_ACCOUNT_ID` | מה שהעתקת בשלב 2 |
| `ZOOM_CLIENT_ID` | מה שהעתקת בשלב 2 |
| `ZOOM_CLIENT_SECRET` | מה שהעתקת בשלב 2 |
| `ANTHROPIC_API_KEY` | מפתח Claude API שלך |
| `GMAIL_USER` | avraham@lalum.co |
| `GMAIL_APP_PASSWORD` | הסיסמה בת 16 תווים מהשלב 3 |

---

## שלב 5 – הפעל ידנית לבדיקה

1. היכנס ל: **GitHub → Actions → 📋 Zoom Meeting Summary Processor**
2. לחץ **Run workflow**
3. בשדה `lookback_minutes` הכנס `1440` (כדי לבדוק 24 שעות אחורה)
4. לחץ **Run workflow**
5. בדוק את תיבת המייל שלך

---

## איך זה עובד אחרי ההגדרה

- **GitHub Action רץ כל 30 דקות** אוטומטית
- בודק אם יש פגישות שהסתיימו בשעה האחרונה
- אם כן → שולח מייל ל-avraham@lalum.co עם סיכום מעוצב
- מסמן את הפגישה כ"טופלה" כדי לא לשלוח פעמיים

---

## פגישות שלא יסוכמו

- פגישות שבהן לא הפעלת הקלטה
- פגישות שלא היית בהן המארח (ואין לך הרשאה לסיכום)
- פגישות שהZoom AI Companion לא הופעל בזמן הפגישה
