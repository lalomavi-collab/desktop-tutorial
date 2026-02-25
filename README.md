# SSH Remote Access - גישה מרחוק למחשב

## מה זה?
סקריפטים להתחברות מרחוק למחשב השני שלך דרך SSH.

---

## מדריך מהיר

### שלב 1: הגדרת המחשב המרוחק (שאליו רוצים להתחבר)

במחשב המרוחק, הורד והרץ:

```bash
sudo bash setup-ssh-server.sh
```

הסקריפט:
- מתקין את שרת OpenSSH
- מפעיל את השירות אוטומטית
- מגדיר הגדרות אבטחה בסיסיות
- פותח את פורט 22 בפיירוול
- מציג את כתובת ה-IP להתחברות

### שלב 2: התחברות מהמחשב המקומי (שממנו רוצים לשלוט)

במחשב המקומי שלך, הרץ:

```bash
bash ssh-connect.sh
```

הסקריפט:
- יוצר מפתח SSH (אם לא קיים)
- מעתיק את המפתח למחשב המרוחק
- מתחבר אוטומטית
- שומר alias לחיבור מהיר בעתיד

---

## התחברות ידנית (בלי הסקריפטים)

### על המחשב המרוחק:
```bash
# התקנה (Ubuntu/Debian)
sudo apt install openssh-server

# הפעלה
sudo systemctl enable ssh
sudo systemctl start ssh

# בדיקת IP
ip addr show | grep inet
```

### מהמחשב המקומי:
```bash
# התחברות בסיסית
ssh username@192.168.1.X

# יצירת מפתח (חד-פעמי)
ssh-keygen -t ed25519

# העתקת מפתח (חד-פעמי)
ssh-copy-id username@192.168.1.X

# מעכשיו - חיבור בלי סיסמה
ssh username@192.168.1.X
```

---

## פקודות שימושיות אחרי התחברות

```bash
# העתקת קובץ מהמחשב המקומי למרוחק
scp file.txt username@IP:/home/username/

# העתקת תיקייה שלמה
scp -r folder/ username@IP:/home/username/

# הרצת פקודה בלי להישאר מחובר
ssh username@IP "ls -la /home"

# מנהרת פורט (port forwarding)
ssh -L 8080:localhost:80 username@IP

# חיבור עם ממשק גרפי (X11 forwarding)
ssh -X username@IP
```

---

## פתרון בעיות

| בעיה | פתרון |
|------|-------|
| Connection refused | ודא ש-SSH רץ: `sudo systemctl status ssh` |
| Permission denied | בדוק שם משתמש וסיסמה |
| Network unreachable | ודא ששני המחשבים על אותה רשת |
| Timeout | בדוק פיירוול: `sudo ufw status` |
| Host key changed | מחק מפתח ישן: `ssh-keygen -R IP` |

## אבטחה

- הסקריפט חוסם גישת root ב-SSH
- מומלץ להשתמש במפתחות במקום סיסמאות
- אחרי הגדרת מפתחות, ניתן לבטל התחברות בסיסמה:
  ```bash
  # בקובץ /etc/ssh/sshd_config
  PasswordAuthentication no
  ```
