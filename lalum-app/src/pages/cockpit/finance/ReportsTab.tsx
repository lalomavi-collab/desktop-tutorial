import { useState } from "react";
import { money } from "../../../lib/cockpit/shared";
import { monthPeriod, summarize } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinCustomer, FinDocument, FinExpense, FinPayment } from "../../../lib/cockpit/finance";
import { supabase } from "../../../lib/supabase";
import { useClientNames } from "../../../components/cockpit/ClientNames";
import { casualLabel, customerLabel } from "../../../lib/cockpit/clientNames";
import { INCOME_KIND_LABEL, incomeByKind, incomeHtml, incomeRows, revenueByCustomer, toCsv } from "../../../lib/cockpit/financeReports";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/** The function answers with a JSON code on failure; the client library hides it inside the error context. */
async function errorCode(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== "function") return "";
  try { const j = (await ctx.json()) as { code?: string; status?: number }; return `${j.code ?? ""}${j.status ? ` ${j.status}` : ""}`.trim(); } catch { return ""; }
}

export function ReportsTab({ docs, archive, customers, payments, expenses }: { docs: FinDocument[]; archive: ArchiveDoc[]; customers: FinCustomer[]; payments: FinPayment[]; expenses: FinExpense[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 0 means the whole year
  // 0 is the whole year, 1 to 12 a month, 101 to 106 a two month VAT period (January and February, and so on).
  const period = month === 0 ? { from: `${year}-01-01`, to: `${year}-12-31` }
    : month > 100 ? { from: monthPeriod(year, (month - 100) * 2 - 1).from, to: monthPeriod(year, (month - 100) * 2).to }
    : monthPeriod(year, month);
  const cn = useClientNames();
  // While names are hidden every row carries a label (the invoicing number, or a hash for a casual customer); the screens and the exports read the same rows.
  const rows = incomeRows(docs, archive, customers, period, cn.revealed ? undefined : (c, name, key) => (c ? customerLabel(false, c) : key === "unknown" ? name : casualLabel(false, name)));
  const income = incomeByKind(rows);
  const byCustomer = revenueByCustomer(rows);
  const title = month === 0 ? `${year}` : month > 100 ? `${MONTHS[(month - 100) * 2 - 2]} עד ${MONTHS[(month - 100) * 2 - 1]} ${year}` : `${MONTHS[month - 1]} ${year}`;
  const vat = summarize(docs, payments, expenses, period, archive);

  const [mail, setMail] = useState<{ ok: boolean; text: string } | null>(null);
  async function sendTest() {
    if (!supabase) return;
    setMail(null);
    const csv = toCsv(["סוג", "תאריך", "מספר מסמך", "לקוח", "לפני מע\"מ", "מע\"מ", "כולל מע\"מ"],
      rows.map((r) => [INCOME_KIND_LABEL[r.kind], r.date, r.number != null ? String(r.number) : "", r.customer, r.net, r.vat, r.total]));
    const { data, error } = await supabase.functions.invoke("lalum-fin-report-mail", {
      body: { subject: `דוח הכנסות ${title}`, html: incomeHtml(`דוח הכנסות להנהלת חשבונות, ${title}`, income), csv_name: `income-${period.from}-${period.to}.csv`, csv_text: csv },
    });
    const code = await errorCode(error);
    setMail(error || !data?.ok ? { ok: false, text: `השליחה נכשלה${code ? ` (${code})` : ""}. אם הקוד הוא mail_not_configured, חסר RESEND_API_KEY בסודות הפונקציות. אם mail_failed, הכתובת השולחת לא אושרה אצל Resend.` } : { ok: true, text: `נשלחה הודעת בדיקה אל ${data.to}. לרואה החשבון לא נשלח דבר.` });
  }
  function download(name: string, csv: string) {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }
  const incomeCsv = () => download(`income-${period.from}-${period.to}.csv`, toCsv(
    ["סוג", "תאריך", "מספר מסמך", "לקוח", "לפני מע\"מ", "מע\"מ", "כולל מע\"מ", "מקור"],
    rows.map((r) => [INCOME_KIND_LABEL[r.kind], r.date, r.number != null ? String(r.number) : "", r.customer, r.net, r.vat, r.total, r.source === "ledger" ? "מערכת" : "ארכיון היסטוריה"]),
  ));
  const customerCsv = () => download(`revenue-by-customer-${period.from}-${period.to}.csv`, toCsv(
    ["לקוח", "מסמכים", "לפני מע\"מ", "מע\"מ", "כולל מע\"מ"], byCustomer.map((c) => [c.customer, String(c.documents), c.net, c.vat, c.total]),
  ));

  return (
    <div className="ck-stack">
      {!cn.revealed && <div className="fin-note">שמות הלקוחות מוסתרים: הדוחות, קובצי ה-CSV והדוא"ל מציגים תווית לקוח במקום שם. להצגת שמות, השתמשו בכפתור בראש המסך (נרשם ביומן עם הסיבה).</div>}
      <div className="ck-row">
        <select className="ck-select" aria-label="חודש" value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ maxWidth: 160 }}>
          <option value={0}>כל השנה</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}{[1, 2, 3, 4, 5, 6].map((k) => <option key={k} value={100 + k}>{MONTHS[k * 2 - 2]} עד {MONTHS[k * 2 - 1]}</option>)}
        </select>
        <select className="ck-select" aria-label="שנה" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ maxWidth: 120 }}>
          {[0, 1, 2, 3].map((k) => <option key={k} value={now.getFullYear() - k}>{now.getFullYear() - k}</option>)}
        </select>
        <button className="ck-btn" onClick={() => window.print()}>הדפסה או שמירה כ-PDF</button>
        <button className="ck-btn" onClick={() => void sendTest()} title="נשלח רק אליך">שליחת בדיקה אליי במייל</button>
      </div>

      {mail && <div className={mail.ok ? "ck-ok" : "ck-err"} aria-live="polite">{mail.text}</div>}
      <div className="ck-card ck-stack">
        <div className="ck-row" style={{ justifyContent: "space-between" }}>
          <div className="ck-title">דוח הכנסות להנהלת חשבונות, {title}</div>
          <button className="ck-btn sm" onClick={incomeCsv} disabled={!rows.length}>הורדה ל-Excel (CSV)</button>
        </div>
        {income.groups.map((g) => (
          <div key={g.kind} className="ck-stack">
            <div className="ck-meta">{INCOME_KIND_LABEL[g.kind]}: <bdi>{g.rows.length}</bdi> מסמכים, לפני מע"מ <bdi>{money(g.net)}</bdi>, מע"מ <bdi>{money(g.vat)}</bdi>, כולל מע"מ <bdi>{money(g.total)}</bdi></div>
            {g.rows.length > 0 && <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תאריך</th><th className="fin-num">מספר</th><th>לקוח</th><th className="fin-num">לפני מע"מ</th><th className="fin-num">מע"מ</th><th className="fin-num">כולל מע"מ</th></tr></thead><tbody>
              {g.rows.map((r, i) => <tr key={`${r.kind}-${r.number}-${i}`}><td><bdi>{r.date}</bdi></td><td className="fin-ltr">{r.number ?? ""}</td><td className="fin-text">{r.customer}</td><td className="fin-ltr">{money(r.net)}</td><td className="fin-ltr">{money(r.vat)}</td><td className="fin-ltr">{money(r.total)}</td></tr>)}
            </tbody></table></div>}
          </div>))}
        <div className="fin-figure">סה"כ הכנסות לפני מע"מ: {money(income.net)}</div>
        <div className="ck-meta">מע"מ עסקאות <bdi>{money(income.vat)}</bdi>, סה"כ כולל מע"מ <bdi>{money(income.total)}</bdi>. זיכויים מופחתים. לפי תאריך המסמך. מסמכי בדיקה לא נכללים. דוח לעיון, ושיטת ההכרה בהכנסה נקבעת מול רואה החשבון.</div>
      </div>

      <div className="ck-card ck-stack">
        <div className="ck-title">דוח מע"מ לתקופה, {title}</div>
        <div className="ck-table-wrap"><table className="ck-table"><tbody>
          <tr><td>עסקאות חייבות לפני מע"מ</td><td className="fin-ltr">{money(vat.revenueNet)}</td></tr>
          <tr><td>מע"מ עסקאות</td><td className="fin-ltr">{money(vat.vatOut)}</td></tr>
          <tr><td>מע"מ תשומות לניכוי</td><td className="fin-ltr">{money(vat.vatIn)}</td></tr>
          <tr><td><b>מע"מ לתשלום (או להחזר)</b></td><td className="fin-ltr"><b>{money(vat.vatPayable)}</b></td></tr>
        </tbody></table></div>
        <div className="ck-meta">נתוני עזר לרואה החשבון, לא דיווח. התשומות לפי ההוצאות שהוזנו ידנית ושיעור הניכוי שנקבע בכל הוצאה. כוללים את ארכיון ההיסטוריה. קובץ PCN874 עדיין לא מופק, והוא ייבנה רק אחרי שהרו"ח תאשר את המבנה.</div>
      </div>

      <div className="ck-card ck-stack">
        <div className="ck-row" style={{ justifyContent: "space-between" }}>
          <div className="ck-title">הכנסות לפי לקוח, {title}</div>
          <button className="ck-btn sm" onClick={customerCsv} disabled={!byCustomer.length}>הורדה ל-Excel (CSV)</button>
        </div>
        {byCustomer.length ? <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>לקוח</th><th className="fin-num">מסמכים</th><th className="fin-num">לפני מע"מ</th><th className="fin-num">כולל מע"מ</th></tr></thead><tbody>
          {byCustomer.map((c) => <tr key={c.key}><td className="fin-text">{c.customer}</td><td className="fin-ltr">{c.documents}</td><td className="fin-ltr">{money(c.net)}</td><td className="fin-ltr">{money(c.total)}</td></tr>)}
        </tbody></table></div> : <div className="ck-meta">אין הכנסות בתקופה.</div>}
      </div>

      <div className="ck-meta">גיול חובות וגבייה (חשבונות עסקה פתוחים, תזכורות, DSO) נמצאים בלשונית "גיול חובות".</div>
    </div>
  );
}
