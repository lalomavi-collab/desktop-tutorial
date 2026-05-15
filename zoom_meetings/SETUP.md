# הגדרת מערכת סיכומי הפגישות

## מה המערכת עושה

```
פגישת זום מסתיימת
        ↓
GitHub Action (כל 30 דקות)
        ↓
שולף מזום: סיכום AI + תמליל + משתתפים
        ↓
Claude מייצר 3 מסמכים:
  1. סיכום פנימי (עברית מקצועית)
  2. פרוטוקול מפורט (שולחן + משימות)
  3. טיוטת מייל למשתתפים (מוכן לשליחה)
        ↓
שמירה לGoogle Drive → LALUM / {שם תיק לקוח}
        ↓
מייל מרוכז → avraham@lalum.co עם:
  • הסיכום הפנימי
  • הטיוטה המוכנה למשתתפים
  • תצוגה מקדימה של הפרוטוקול
  • קישורים לGoogle Drive
```

---

## שלב 1 – הפעל Zoom AI Companion

1. היכנס ל: **zoom.us → Settings → AI Companion**
2. הפעל:
   - ✅ **Meeting Summary with AI Companion**
   - ✅ **Cloud Recording** (Recording Settings)
   - ✅ **Audio Transcript**
3. שמור שינויים

---

## שלב 2 – צור Zoom Server-to-Server App

1. היכנס ל: https://marketplace.zoom.us/develop/create
2. בחר **Server-to-Server OAuth**
3. שם: `meeting-summary-bot`
4. תחת **Scopes**, הוסף:
   - `recording:read:admin`
   - `meeting:read:admin`
   - `report:read:admin`
   - `meeting_summary:read:admin`
5. לחץ **Activate**
6. העתק: **Account ID**, **Client ID**, **Client Secret**

---

## שלב 3 – הגדר Google Drive (תיקיית LALUM)

### 3א. צור Service Account ב-Google Cloud

1. היכנס ל: https://console.cloud.google.com
2. **APIs & Services → Enable APIs** → הפעל:
   - **Google Drive API**
3. **IAM & Admin → Service Accounts → Create Service Account**
   - שם: `zoom-summary-bot`
   - לחץ **Create and Continue**
4. בדף Service Account → **Keys → Add Key → JSON**
   - הורד את קובץ ה-JSON — שמור אותו!

### 3ב. שתף את תיקיית LALUM עם ה-Service Account

1. פתח Google Drive
2. לחץ ימני על תיקיית **LALUM** → **Share**
3. הזן את כתובת ה-Service Account (נראה כמו `zoom-summary-bot@your-project.iam.gserviceaccount.com`)
4. הרשאה: **Editor**
5. לחץ **Send**

### 3ג. קבל את ה-Folder ID של LALUM

1. פתח את תיקיית LALUM ב-Drive
2. ה-URL נראה כך: `https://drive.google.com/drive/folders/`**1ABC123xyz...**
3. העתק את החלק הסמוי — זה ה-Folder ID

---

## שלב 4 – צור Gmail App Password

> הכרחי: Gmail עם אימות דו-שלבי (2FA) מופעל

1. היכנס ל: https://myaccount.google.com/apppasswords
2. שם: `Zoom Summary Bot`
3. לחץ **Create** → העתק הסיסמה (16 תווים)

---

## שלב 5 – הוסף Secrets לGitHub

**GitHub → repo → Settings → Secrets → Actions → New secret**

### סודות חובה

| שם | ערך |
|----|-----|
| `ZOOM_ACCOUNT_ID` | מזום (שלב 2) |
| `ZOOM_CLIENT_ID` | מזום (שלב 2) |
| `ZOOM_CLIENT_SECRET` | מזום (שלב 2) |
| `ANTHROPIC_API_KEY` | מפתח Claude API |
| `GMAIL_USER` | avraham@lalum.co |
| `GMAIL_APP_PASSWORD` | הסיסמה מGmail (שלב 4) |

### סודות לGoogle Drive (אופציונלי — אם רוצים שמירה אוטומטית)

| שם | ערך |
|----|-----|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | כל תוכן קובץ ה-JSON שהורדת (שלב 3א) |
| `GOOGLE_DRIVE_LALUM_FOLDER_ID` | ה-Folder ID של תיקיית LALUM (שלב 3ג) |

> **טיפ:** אם לא מגדירים Google Drive, המערכת עדיין עובדת ושולחת מייל — פשוט בלי שמירה ל-Drive.

---

## שלב 6 – בדיקה ראשונה

1. **GitHub → Actions → 📋 Zoom Meeting Summary Processor**
2. לחץ **Run workflow**
3. שדה `lookback_minutes`: הכנס `1440` (24 שעות אחורה)
4. לחץ **Run workflow**
5. בדוק מייל + Google Drive

---

## מה תקבל במייל אחרי כל פגישה

```
📋 סיכום פגישה — [שם הפגישה]
───────────────────────────────
📅 תאריך | ⏱ משך | 👥 משתתפים

📁 שמור בGoogle Drive → LALUM/[שם התיק]
   📄 פרוטוקול מפורט   ✉ טיוטת מייל

[ סיכום פנימי מפורט ]

[ ✉ טיוטת מייל — מוכן לשליחה למשתתפים ]

[ 📖 פרוטוקול — תצוגה מקדימה ]
```

---

## התאמת שמות תיקים לפגישות

המערכת מחפשת אוטומטית תיקייה ב-`LALUM/` ששמה דומה לנושא הפגישה.

**לדוגמה:**
- פגישה: `"ייעוץ לוי מול כהן"` → תיקייה: `"לוי"` או `"לוי כהן"`
- פגישה: `"תיק 2024-045 אביב"` → תיקייה: `"אביב"`

**אם לא נמצאה התאמה** — הקובץ ישמר ישירות בתיקיית LALUM הראשית.

---

## הערות

- פגישות ללא הקלטה/תמליל לא יסוכמו
- כל פגישה מסוכמת פעם אחת בלבד (המערכת שומרת רשימת מזהים ב-`processed.json`)
- אפשר להריץ ידנית מכל זמן דרך **Actions → Run workflow**
