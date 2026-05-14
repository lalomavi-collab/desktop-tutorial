import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def _build_html(topic: str, meeting_date: datetime, duration: int,
                participants_str: str, summary_text: str) -> str:
    date_str = meeting_date.strftime("%d/%m/%Y %H:%M")
    # Convert markdown-style bold to <strong> for the summary
    html_summary = summary_text.replace("**", "<strong>", 1)
    i = 0
    result = []
    toggle = False
    for chunk in summary_text.split("**"):
        if toggle:
            result.append(f"<strong>{chunk}</strong>")
        else:
            result.append(chunk.replace("\n", "<br>"))
        toggle = not toggle
    html_summary = "".join(result)

    return f"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>סיכום פגישה</title>
<style>
  body {{ margin:0; padding:0; background:#f0f0f0; font-family:'Segoe UI',Arial,sans-serif; }}
  .wrap {{ max-width:620px; margin:20px auto; background:#fff; border-radius:10px;
           overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.12); }}
  .header {{ background:#1B1B1B; padding:28px 32px; text-align:center; }}
  .header h1 {{ margin:0; color:#D4AF37; font-size:22px; letter-spacing:.5px; }}
  .header p {{ margin:6px 0 0; color:#FFFDD0; font-size:15px; }}
  .meta {{ background:#f8f6f0; padding:14px 32px; border-bottom:1px solid #e8e0cc;
           display:flex; gap:24px; flex-wrap:wrap; font-size:13px; color:#555; }}
  .meta span {{ display:flex; align-items:center; gap:6px; }}
  .body {{ padding:28px 32px; line-height:1.9; color:#2d2d2d; font-size:15px; }}
  .body strong {{ color:#1B1B1B; display:block; margin-top:18px; font-size:15px; }}
  .footer {{ background:#1B1B1B; padding:14px 32px; text-align:center;
             color:#666; font-size:12px; }}
  .footer span {{ color:#D4AF37; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>&#128203; סיכום פגישה</h1>
    <p>{topic}</p>
  </div>
  <div class="meta">
    <span>&#128197; {date_str}</span>
    <span>&#9201; {duration} דקות</span>
    <span>&#128101; {participants_str}</span>
  </div>
  <div class="body">{html_summary}</div>
  <div class="footer">
    נוצר אוטומטית על-ידי <span>מערכת סיכומי הפגישות</span>
  </div>
</div>
</body>
</html>"""


def send_summary_email(
    topic: str,
    meeting_date: datetime,
    duration_minutes: int,
    participants: list[dict],
    summary_text: str,
    to_email: str = "avraham@lalum.co",
) -> None:
    gmail_user = os.environ["GMAIL_USER"]
    gmail_password = os.environ["GMAIL_APP_PASSWORD"]

    participants_str = (
        ", ".join(p.get("name", "") for p in participants[:8]) or "לא ידוע"
    )

    subject = f"סיכום פגישה: {topic} | {meeting_date.strftime('%d/%m/%Y %H:%M')}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"סיכומי פגישות <{gmail_user}>"
    msg["To"] = to_email

    plain = f"סיכום פגישה: {topic}\nתאריך: {meeting_date.strftime('%d/%m/%Y %H:%M')}\n\n{summary_text}"
    html = _build_html(topic, meeting_date, duration_minutes, participants_str, summary_text)

    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, to_email, msg.as_bytes())

    print(f"  Email sent → {to_email}")
