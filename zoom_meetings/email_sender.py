import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


# ── HTML helpers ───────────────────────────────────────────────────────────

def _md_to_html(text: str) -> str:
    """Minimal markdown → HTML: bold, bullet lines, line breaks."""
    result = []
    toggle = False
    for chunk in text.split("**"):
        result.append(f"<strong>{chunk}</strong>" if toggle else chunk.replace("\n", "<br>"))
        toggle = not toggle
    return "".join(result)


def _section(title: str, content_html: str, color: str = "#1B1B1B") -> str:
    return f"""
<div style="margin:24px 0 0;">
  <div style="background:{color};color:#D4AF37;padding:10px 20px;border-radius:6px 6px 0 0;
              font-weight:bold;font-size:14px;letter-spacing:.4px;">{title}</div>
  <div style="background:#fafafa;border:1px solid #e0d9c8;border-top:none;
              padding:18px 20px;border-radius:0 0 6px 6px;
              line-height:1.9;color:#2d2d2d;font-size:14px;white-space:pre-wrap;">
    {content_html}
  </div>
</div>"""


def _drive_links_html(drive_links: dict) -> str:
    if not drive_links:
        return ""
    folder = drive_links.get("folder_name", "LALUM")
    protocol_url = drive_links.get("protocol_url", "")
    email_url = drive_links.get("email_draft_url", "")
    links = []
    if protocol_url:
        links.append(f'<a href="{protocol_url}" style="color:#D4AF37;">&#128196; פרוטוקול מפורט</a>')
    if email_url:
        links.append(f'<a href="{email_url}" style="color:#D4AF37;">&#9993; טיוטת מייל</a>')
    if not links:
        return ""
    return f"""
<div style="background:#1B1B1B;padding:12px 20px;border-radius:6px;margin:20px 0;
            font-size:13px;color:#FFFDD0;">
  &#128193; שמור בGoogle Drive → <strong style="color:#D4AF37;">{folder}</strong>
  &nbsp;&nbsp;|&nbsp;&nbsp; {" &nbsp; ".join(links)}
</div>"""


def _build_html(
    topic: str,
    meeting_date: datetime,
    duration: int,
    participants_str: str,
    summary_text: str,
    protocol_text: str | None,
    participant_email_text: str | None,
    drive_links: dict,
) -> str:
    date_str = meeting_date.strftime("%d/%m/%Y %H:%M")

    sections = _section("&#128203; סיכום פנימי", _md_to_html(summary_text))

    if participant_email_text:
        sections += _section(
            "&#9993; טיוטת מייל למשתתפים — מוכן לשליחה",
            _md_to_html(participant_email_text),
            color="#2d4a1e",
        )

    if protocol_text:
        # Show first 1500 chars of protocol in email, full version is in Drive
        preview = protocol_text[:1500] + ("\n\n*[המשך בGoogle Drive...]*" if len(protocol_text) > 1500 else "")
        sections += _section(
            "&#128214; פרוטוקול מפורט (תצוגה מקדימה)",
            _md_to_html(preview),
            color="#1a2a4a",
        )

    return f"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>סיכום פגישה</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:680px;margin:20px auto;background:#fff;border-radius:10px;
            overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12);">

  <!-- Header -->
  <div style="background:#1B1B1B;padding:28px 32px;text-align:center;">
    <h1 style="margin:0;color:#D4AF37;font-size:22px;letter-spacing:.5px;">&#128203; סיכום פגישה</h1>
    <p style="margin:6px 0 0;color:#FFFDD0;font-size:15px;">{topic}</p>
  </div>

  <!-- Meta -->
  <div style="background:#f8f6f0;padding:14px 32px;border-bottom:1px solid #e8e0cc;
              font-size:13px;color:#555;display:flex;gap:24px;flex-wrap:wrap;">
    <span>&#128197; {date_str}</span>
    <span>&#9201; {duration} דקות</span>
    <span>&#128101; {participants_str}</span>
  </div>

  <!-- Body -->
  <div style="padding:24px 32px;">
    {_drive_links_html(drive_links)}
    {sections}
  </div>

  <!-- Footer -->
  <div style="background:#1B1B1B;padding:14px 32px;text-align:center;color:#666;font-size:12px;">
    נוצר אוטומטית על-ידי <span style="color:#D4AF37;">מערכת סיכומי הפגישות</span>
  </div>
</div>
</body>
</html>"""


# ── Public API ─────────────────────────────────────────────────────────────

def send_summary_email(
    topic: str,
    meeting_date: datetime,
    duration_minutes: int,
    participants: list[dict],
    summary_text: str,
    protocol_text: str | None = None,
    participant_email_text: str | None = None,
    drive_links: dict | None = None,
    to_email: str = "avraham@lalum.co",
) -> None:
    gmail_user = os.environ["GMAIL_USER"]
    gmail_password = os.environ["GMAIL_APP_PASSWORD"]
    drive_links = drive_links or {}

    participants_str = (
        ", ".join(p.get("name", "") for p in participants[:8]) or "לא ידוע"
    )
    subject = f"סיכום פגישה: {topic} | {meeting_date.strftime('%d/%m/%Y %H:%M')}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"סיכומי פגישות <{gmail_user}>"
    msg["To"] = to_email

    # Plain text fallback
    plain_parts = [f"סיכום פגישה: {topic}\nתאריך: {meeting_date.strftime('%d/%m/%Y %H:%M')}\n\n{summary_text}"]
    if participant_email_text:
        plain_parts.append(f"\n\n--- טיוטת מייל למשתתפים ---\n{participant_email_text}")
    if protocol_text:
        plain_parts.append(f"\n\n--- פרוטוקול מפורט ---\n{protocol_text[:3000]}")

    html = _build_html(
        topic, meeting_date, duration_minutes, participants_str,
        summary_text, protocol_text, participant_email_text, drive_links
    )

    msg.attach(MIMEText("".join(plain_parts), "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, to_email, msg.as_bytes())

    print(f"  Email sent → {to_email}")
