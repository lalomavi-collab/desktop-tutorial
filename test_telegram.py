"""
בדיקת חיבור טלגרם — שתי שיטות
הרץ: python test_telegram.py
"""

import asyncio
import json
import urllib.request
import urllib.error

# ============================================================
# הגדר כאן את הפרטים שלך
# ============================================================

BOT_TOKEN = "הכנס-כאן-את-הbot-token"   # דוגמה: 123456789:ABCdefGHI...
CHAT_ID   = "הכנס-כאן-את-ה-chat-id"    # דוגמה: -1001234567890 או 123456789

ZAPIER_WEBHOOK_URL = "הכנס-כאן-את-ה-zapier-url"  # https://hooks.zapier.com/...

MESSAGE = "🔔 הודעת בדיקה — החג מתקרב! פסח שמח! 🎉"

# ============================================================


def test_bot_token():
    """בדיקה 1: שליחה ישירה דרך Telegram Bot API"""
    print("\n--- בדיקה 1: Telegram Bot API ---")
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = json.dumps({"chat_id": CHAT_ID, "text": MESSAGE}).encode()
    req = urllib.request.Request(url, data=data,
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if result.get("ok"):
                print("✅ Bot API: הודעה נשלחה בהצלחה!")
            else:
                print(f"❌ Bot API שגיאה: {result}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ Bot API HTTP {e.code}: {body}")
    except Exception as e:
        print(f"❌ Bot API שגיאה: {e}")


def test_zapier_webhook():
    """בדיקה 2: שליחה דרך Zapier Webhook"""
    print("\n--- בדיקה 2: Zapier Webhook ---")
    data = json.dumps({"message": MESSAGE}).encode()
    req = urllib.request.Request(ZAPIER_WEBHOOK_URL, data=data,
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            body = resp.read().decode()
            if 200 <= status < 300:
                print(f"✅ Zapier Webhook: נשלח! (HTTP {status})")
                print(f"   תגובה: {body[:200]}")
            else:
                print(f"❌ Zapier Webhook HTTP {status}: {body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ Zapier Webhook HTTP {e.code}: {body}")
    except Exception as e:
        print(f"❌ Zapier Webhook שגיאה: {e}")


if __name__ == "__main__":
    print("=" * 50)
    print("בדיקת חיבור טלגרם")
    print("=" * 50)

    # בדיקת Bot Token
    if "הכנס" not in BOT_TOKEN:
        test_bot_token()
    else:
        print("\n⚠️  Bot Token לא הוגדר — דלג על בדיקה 1")

    # בדיקת Zapier
    if "הכנס" not in ZAPIER_WEBHOOK_URL:
        test_zapier_webhook()
    else:
        print("\n⚠️  Zapier URL לא הוגדר — דלג על בדיקה 2")

    print("\n" + "=" * 50)
    print("סיום בדיקה")
