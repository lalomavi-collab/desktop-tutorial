# מדריך התקנה מאובטחת של OpenClaw על VPS

> **מה זה OpenClaw?** סוכן אוטונומי המחובר למודל שפה (LLM), פועל ברקע תמיד, נגיש מהטלפון, ומשמש כעוזר אישי חכם. עם כוח גדול, האחריות להגנה על המערכת היא שלנו.

---

## שלב 1 – יצירת VPS בהוסטינגר

1. היכנסו לאתר **Hostinger** וצרו חשבון
2. רכשו VPS (מומלץ Ubuntu 22.04)
3. לאחר ההפעלה, שמרו את **כתובת ה-IP** וסיסמת ה-root שקיבלתם

---

## שלב 2 – התחברות ראשונית ב-SSH

```bash
ssh root@<SERVER_IP>
```

אם Windows – השתמשו ב-PowerShell או ב-PuTTY.

---

## שלב 3 – התקנה וחיבור ל-VPN (Tailscale)

Tailscale יוצר רשת פרטית מאובטחת בין המחשב שלכם לשרת, ומייתר חשיפה ישירה לאינטרנט.

```bash
# התקנת Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# הפעלה עם SSH מאובטח
tailscale up --ssh

# בדיקת סטטוס וקבלת כתובת ה-Tailscale IP
tailscale status
```

שמרו את ה-**Tailscale IP** שמוצג (נראה כמו `100.x.x.x`) – תשתמשו בו מעכשיו **במקום** ה-IP הציבורי.

---

## שלב 4 – הגבלת SSH לרשת ה-VPN בלבד

ערכו את קובץ ההגדרות של SSH:

```bash
vim /etc/ssh/sshd_config
```

שנו / הוסיפו את השורות הבאות:

```
# האזנה רק על ממשק ה-VPN
ListenAddress 100.x.x.x

# ביטול כניסה עם סיסמה
PasswordAuthentication no

# ביטול כניסה ישירה כ-root
PermitRootLogin no
```

> **החליפו** את `100.x.x.x` בכתובת ה-Tailscale IP האמיתית שלכם.

הפעילו מחדש את SSH:

```bash
systemctl restart ssh
```

**התנתקו:**

```bash
logout
```

---

## שלב 5 – יצירת משתמש חדש (לא root)

**חשוב:** לעולם אל תעבדו כ-root לאחר ההגדרה הראשונית.

```bash
# חיבור מחדש דרך Tailscale
ssh root@<TAILSCALE_IP>

# יצירת משתמש חדש
adduser punchy

# הוספה לקבוצת sudo
usermod -aG sudo punchy
```

---

## שלב 6 – בדיקת חיבור עם המשתמש החדש

פתחו טרמינל **חדש** ובדקו את החיבור לפני שתסגרו את הישן:

```bash
ssh punchy@<TAILSCALE_IP>
```

אם החיבור עובד – אפשר לסגור את הסשן כ-root.

---

## שלב 7 – הגדרת Firewall (UFW)

```bash
# התקנה
sudo apt install ufw -y

# חסימת הכל כברירת מחדל
sudo ufw default deny incoming
sudo ufw default allow outgoing

# אפשור SSH רק מ-Tailscale
sudo ufw allow in on tailscale0 to any port 22

# הפעלה
sudo ufw enable

# בדיקת סטטוס
sudo ufw status verbose
```

---

## שלב 8 – הורדת והתקנת OpenClaw

```bash
# עדכון המערכת
sudo apt update && sudo apt upgrade -y

# הורדת OpenClaw (עקבו אחרי ההוראות הרשמיות מהאתר)
# לדוגמה:
curl -fsSL https://get.openclaw.ai | bash

# בדיקת התקנה
openclaw --version
```

---

## שלב 9 – Onboarding וחיבור Telegram

לאחר ההתקנה, הפעילו את תהליך ה-Onboarding:

```bash
openclaw init
```

עקבו אחרי ההוראות:
1. **הפעלת הבוט בטלגרם** – חפשו את הבוט הרשמי של OpenClaw ב-Telegram
2. **העתיקו את ה-Token** שמתקבל
3. **הדביקו** אותו בתהליך ה-Onboarding בטרמינל
4. **בדקו** שהחיבור עובד על ידי שליחת הודעה בטלגרם

---

## שלב 10 – התקנת Skills

Skills מרחיבים את יכולות OpenClaw. להתקנה:

```bash
# רשימת Skills זמינים
openclaw skills list

# התקנת Skill ספציפי
openclaw skills install <skill-name>
```

---

## אזהרה: Prompt Injection

> **סכנה אמיתית!** Prompt Injection הוא מצב בו תוכן זדוני (מאתר, מייל, קובץ) מנסה "לשכנע" את הסוכן לבצע פעולות לא רצויות.

### כיצד להגן:

- **אל תתנו** ל-OpenClaw גישה ישירה לאינטרנט בלי פילטרים
- **הגבילו הרשאות** – תנו לסוכן רק מה שהוא צריך
- **סקרו לוגים** באופן קבוע
- **הגדירו allowlist** של פעולות מותרות בלבד

---

## סיכום – רשימת תיוג

- [ ] VPS נוצר ב-Hostinger עם Ubuntu 22.04
- [ ] Tailscale מותקן ומחובר
- [ ] SSH מוגבל לממשק ה-VPN בלבד
- [ ] כניסה בסיסמה מבוטלת
- [ ] כניסה כ-root מבוטלת
- [ ] משתמש חדש נוצר והוסף ל-sudo
- [ ] Firewall (UFW) מוגדר ומופעל
- [ ] OpenClaw מותקן
- [ ] Telegram מחובר
- [ ] Skills מותקנים לפי הצורך
- [ ] הוסבר סיכון Prompt Injection

---

## טיפים נוספים

| נושא | המלצה |
|------|--------|
| גיבויים | גבו את תצורת OpenClaw שבועית |
| עדכונים | עדכנו את OpenClaw וה-OS באופן קבוע |
| מפתחות SSH | השתמשו במפתחות ED25519 |
| ניטור | הגדירו התראות על פעולות חריגות |

---

*מדריך זה מבוסס על שיטות עבודה מומלצות לאבטחת שרתים Linux. תמיד בדקו את התיעוד הרשמי של OpenClaw לגרסה העדכנית ביותר.*
