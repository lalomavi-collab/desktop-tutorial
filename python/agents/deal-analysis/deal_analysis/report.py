"""דוח מסכם לעסקה: HTML מעוצב RTL בצבעי Prestige Executive.

הדוח מרכז את קליטת המסמכים, הסקירה התכנונית וניתוח הכדאיות
למסמך אחד שאפשר לשלוח ללקוח או לשותף. כולל הסתייגות קבועה.
"""

from datetime import datetime


def _fmt(n) -> str:
    try:
        return f"{n:,.0f}"
    except (TypeError, ValueError):
        return str(n)


def build_report(deal_name: str, intake: dict, planning: dict, feasibility: dict | None) -> str:
    today = datetime.now().strftime("%d.%m.%Y")

    docs_rows = "".join(
        f"<tr><td>{d['filename']}</td><td>{d['category']}</td>"
        f"<td>{'שגיאה: ' + d['error'] if d.get('error') else 'נקלט'}</td></tr>"
        for d in intake.get("documents", [])
    ) or "<tr><td colspan='3'>לא נקלטו מסמכים</td></tr>"

    checklist_rows = "".join(
        f"<tr><td>{c['item']}</td><td class=\"{'ok' if c['found'] else 'miss'}\">"
        f"{'נמצא' if c['found'] else 'חסר'}</td></tr>"
        for c in planning.get("checklist", [])
    )

    flags_html = "".join(
        f"<li>{f['warning']}</li>" for f in planning.get("red_flags", [])
    ) or "<li>לא אותרו דגלים אדומים במסמכים שנקלטו</li>"

    feas_html = ""
    if feasibility:
        sens_rows = "".join(
            f"<tr><td>{s['value_change_pct']}%</td><td>{_fmt(s['expected_value'])}</td>"
            f"<td>{_fmt(s['net_profit'])}</td><td>{s['roi_pct']}%</td></tr>"
            for s in feasibility["sensitivity"]
        )
        feas_html = f"""
  <h2>ניתוח כדאיות כלכלית</h2>
  <table>
    <tr><th>סעיף</th><th>סכום (ש"ח)</th></tr>
    <tr><td>מחיר רכישה</td><td>{_fmt(feasibility['inputs']['price'])}</td></tr>
    <tr><td>מס רכישה (אומדן)</td><td>{_fmt(feasibility['purchase_tax'])}</td></tr>
    <tr><td>השבחה ועלויות נלוות</td><td>{_fmt(feasibility['inputs']['renovation_cost'] + feasibility['inputs']['other_costs'])}</td></tr>
    <tr><td>עלות מימון</td><td>{_fmt(feasibility['finance_cost'])}</td></tr>
    <tr class="total"><td>סך השקעה</td><td>{_fmt(feasibility['total_investment'])}</td></tr>
    <tr><td>שווי צפוי</td><td>{_fmt(feasibility['inputs']['expected_value'])}</td></tr>
    <tr><td>מס שבח (אומדן)</td><td>{_fmt(feasibility['capital_gains_tax'])}</td></tr>
    <tr class="total"><td>רווח נקי צפוי</td><td>{_fmt(feasibility['net_profit'])}</td></tr>
    <tr><td>תשואה על ההון</td><td>{feasibility['roi_pct']}%</td></tr>
    <tr><td>תשואה שנתית</td><td>{feasibility['annual_roi_pct']}%</td></tr>
  </table>
  <p class="verdict">מסקנה ראשונית: העסקה <strong>{feasibility['verdict']}</strong> (תשואה שנתית {feasibility['annual_roi_pct']}%)</p>
  <h3>ניתוח רגישות</h3>
  <table>
    <tr><th>שינוי בשווי</th><th>שווי מכירה</th><th>רווח נקי</th><th>תשואה</th></tr>
    {sens_rows}
  </table>"""

    return f"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>דוח כדאיות: {deal_name}</title>
<style>
  body {{ font-family: Arial, "Frank Ruhl Libre", sans-serif; background: #FFFDD0; color: #1B1B1B;
         max-width: 860px; margin: 0 auto; padding: 32px; direction: rtl; }}
  h1 {{ color: #1B1B1B; border-bottom: 4px solid #D4AF37; padding-bottom: 12px; }}
  h2 {{ color: #800020; margin-top: 36px; }}
  h3 {{ color: #1B1B1B; }}
  table {{ width: 100%; border-collapse: collapse; margin: 14px 0; background: #fff; }}
  th {{ background: #1B1B1B; color: #D4AF37; padding: 10px; text-align: right; }}
  td {{ padding: 9px 10px; border-bottom: 1px solid #e5dfc0; text-align: right; }}
  tr.total td {{ font-weight: bold; background: #f7f2d8; border-top: 2px solid #D4AF37; }}
  td.ok {{ color: #1a7a1a; font-weight: bold; }}
  td.miss {{ color: #800020; font-weight: bold; }}
  .verdict {{ font-size: 1.15em; background: #fff; border-right: 6px solid #D4AF37; padding: 14px 18px; }}
  .flags li {{ color: #800020; margin: 6px 0; }}
  .meta {{ color: #555; }}
  .disclaimer {{ margin-top: 44px; font-size: 0.85em; color: #555; border-top: 1px solid #D4AF37; padding-top: 14px; }}
</style>
</head>
<body>
  <h1>דוח ניתוח עסקה: {deal_name}</h1>
  <p class="meta">הופק בתאריך {today} | LALUM חברת עורכי דין | מסמכים שנקלטו: {intake.get('count', 0)}</p>

  <h2>מסמכים שנקלטו</h2>
  <table>
    <tr><th>קובץ</th><th>סיווג</th><th>סטטוס</th></tr>
    {docs_rows}
  </table>

  <h2>סקירה תכנונית ומשפטית (שלמות: {planning.get('completeness_pct', 0)}%)</h2>
  <table>
    <tr><th>בדיקה</th><th>סטטוס</th></tr>
    {checklist_rows}
  </table>

  <h2>דגלים אדומים</h2>
  <ul class="flags">{flags_html}</ul>
  {feas_html}

  <p class="disclaimer">מסמך זה הופק באופן אוטומטי ככלי עזר לניתוח ראשוני בלבד.
  אין לראות בו ייעוץ משפטי, שמאי, מיסויי או מימוני, והוא אינו מחייב.
  יש להיוועץ בעורך דין, שמאי מקרקעין ויועץ מס לפני קבלת החלטה.</p>
</body>
</html>"""
