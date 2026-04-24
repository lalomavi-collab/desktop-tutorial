#!/usr/bin/env python3
"""
Add Spain PhD trip events directly to Outlook Calendar via Microsoft Graph API.
Uses Device Code Flow – no redirect URI needed, works in any environment.
"""

import os
import msal
import requests
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("AZURE_CLIENT_ID")
AUTHORITY = "https://login.microsoftonline.com/consumers"
SCOPES = ["https://graph.microsoft.com/Calendars.ReadWrite"]
GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0/me/events"
TOKEN_CACHE_FILE = ".token_cache.json"

EVENTS = [
    {
        "subject": "✈️ Flight to Madrid – EL AL LY395",
        "body": {"contentType": "Text", "content": "Flight: EL AL LY395\nDeparture from Ben Gurion Airport"},
        "start": {"dateTime": "2026-05-25T17:00:00", "timeZone": "Israel Standard Time"},
        "end":   {"dateTime": "2026-05-25T22:10:00", "timeZone": "Romance Standard Time"},
        "location": {"displayName": "TLV → MAD"},
    },
    {
        "subject": "🏨 NH Madrid Barajas Airport",
        "body": {"contentType": "Text", "content": "Hotel accommodation – arrival night"},
        "isAllDay": True,
        "start": {"dateTime": "2026-05-25T00:00:00", "timeZone": "UTC"},
        "end":   {"dateTime": "2026-05-26T00:00:00", "timeZone": "UTC"},
        "location": {"displayName": "Madrid, Spain"},
    },
    {
        "subject": "🚂 Train to Córdoba – AVE 2080",
        "body": {"contentType": "Text", "content": "High-speed AVE train\nMadrid Atocha → Córdoba"},
        "start": {"dateTime": "2026-05-26T08:00:00", "timeZone": "Romance Standard Time"},
        "end":   {"dateTime": "2026-05-26T10:30:00", "timeZone": "Romance Standard Time"},
        "location": {"displayName": "Madrid → Córdoba"},
    },
    {
        "subject": "🏨 NH Córdoba Califa",
        "body": {"contentType": "Text", "content": "Hotel accommodation – 2 nights (26–28 May)"},
        "isAllDay": True,
        "start": {"dateTime": "2026-05-26T00:00:00", "timeZone": "UTC"},
        "end":   {"dateTime": "2026-05-28T00:00:00", "timeZone": "UTC"},
        "location": {"displayName": "Córdoba, Spain"},
    },
    {
        "subject": "📚 PhD Defense – Final Preparation",
        "body": {"contentType": "Text", "content": "Final preparation before doctoral defense\nUniversidad de Córdoba"},
        "start": {"dateTime": "2026-05-27T08:00:00", "timeZone": "Romance Standard Time"},
        "end":   {"dateTime": "2026-05-27T10:00:00", "timeZone": "Romance Standard Time"},
        "location": {"displayName": "Universidad de Córdoba"},
    },
    {
        "subject": "🎓 PhD DEFENSE 🔒",
        "body": {"contentType": "Text", "content": "DOCTORAL DEFENSE EXAM\nCRITICAL EVENT – Closed session"},
        "start": {"dateTime": "2026-05-27T10:00:00", "timeZone": "Romance Standard Time"},
        "end":   {"dateTime": "2026-05-27T11:00:00", "timeZone": "Romance Standard Time"},
        "location": {"displayName": "Universidad de Córdoba"},
        "importance": "high",
    },
    {
        "subject": "🎉 Post-Defense Celebration",
        "body": {"contentType": "Text", "content": "Celebration following successful PhD defense"},
        "start": {"dateTime": "2026-05-27T12:00:00", "timeZone": "Romance Standard Time"},
        "end":   {"dateTime": "2026-05-27T15:00:00", "timeZone": "Romance Standard Time"},
        "location": {"displayName": "Córdoba, Spain"},
    },
    {
        "subject": "🚂 Train back to Madrid – AVE",
        "body": {"contentType": "Text", "content": "Return journey to Madrid by high-speed AVE train"},
        "start": {"dateTime": "2026-05-28T13:50:00", "timeZone": "Romance Standard Time"},
        "end":   {"dateTime": "2026-05-28T15:35:00", "timeZone": "Romance Standard Time"},
        "location": {"displayName": "Córdoba → Madrid"},
    },
    {
        "subject": "🍽️ Dinner in Madrid",
        "body": {"contentType": "Text", "content": "Dinner celebration in Madrid before return flight"},
        "start": {"dateTime": "2026-05-28T16:00:00", "timeZone": "Romance Standard Time"},
        "end":   {"dateTime": "2026-05-28T20:30:00", "timeZone": "Romance Standard Time"},
        "location": {"displayName": "Madrid, Spain"},
    },
    {
        "subject": "✈️ Flight home – EL AL LY396",
        "body": {"contentType": "Text", "content": "Return flight to Ben Gurion Airport\nFlight: EL AL LY396\nArrives May 29"},
        "start": {"dateTime": "2026-05-28T22:45:00", "timeZone": "Romance Standard Time"},
        "end":   {"dateTime": "2026-05-29T05:15:00", "timeZone": "Israel Standard Time"},
        "location": {"displayName": "MAD → TLV"},
    },
]


def load_cache():
    cache = msal.SerializableTokenCache()
    if os.path.exists(TOKEN_CACHE_FILE):
        cache.deserialize(open(TOKEN_CACHE_FILE).read())
    return cache


def save_cache(cache):
    if cache.has_state_changed:
        open(TOKEN_CACHE_FILE, "w").write(cache.serialize())


def get_token():
    cache = load_cache()
    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=AUTHORITY,
        token_cache=cache,
    )

    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])
        if result and "access_token" in result:
            save_cache(cache)
            return result["access_token"]

    flow = app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        raise SystemExit(f"Device flow failed: {flow.get('error_description', flow)}")

    print("\n" + "═" * 50)
    print(f"  1. פתח בדפדפן:  https://microsoft.com/devicelogin")
    print(f"  2. הזן את הקוד:  {flow['user_code']}")
    print("═" * 50 + "\n")

    result = app.acquire_token_by_device_flow(flow)
    save_cache(cache)

    if "access_token" not in result:
        raise SystemExit(f"Auth failed: {result.get('error_description', result)}")

    return result["access_token"]


def create_event(token, event):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    resp = requests.post(GRAPH_ENDPOINT, headers=headers, json=event)
    return resp.status_code, resp.json()


def main():
    print("🗓️  מחבר ל-Outlook Calendar...\n")
    token = get_token()
    print("✅ אימות הצליח!\n")

    ok = 0
    for i, event in enumerate(EVENTS, 1):
        status, result = create_event(token, event)
        if status == 201:
            print(f"✅ {i}/10  {event['subject']}")
            ok += 1
        else:
            msg = result.get("error", {}).get("message", str(status))
            print(f"❌ {i}/10  {event['subject']} – {msg}")

    print(f"\n{'🎉' if ok == 10 else '⚠️'}  {ok}/10 אירועים נוספו ל-Outlook Calendar.")


if __name__ == "__main__":
    main()
