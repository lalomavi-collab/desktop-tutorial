import { useRef, useState } from "react";
import { money } from "../../../lib/cockpit/shared";
import { I4U_TYPE, archiveSummary, formatRanges, numberingGaps, splitName } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinCustomer } from "../../../lib/cockpit/finance";
import { importError, importFromInvoice4u } from "../../../lib/cockpit/financeApi";

const monthsBetween = (from: string, to: string): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4)), em = Number(to.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    const last = new Date(y, m, 0).getDate(), pad = (n: number) => String(n).padStart(2, "0");
    const a = `${y}-${pad(m)}-01`, b = `${y}-${pad(m)}-${pad(last)}`;
    out.push([a < from ? from : a, b > to ? to : b]);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
};

export function ArchiveTab({ docs, customers, onChange }: { docs: ArchiveDoc[]; customers: FinCustomer[]; onChange: () => void }) {
  const byI4u = new Map(customers.filter((c) => c.i4u_customer_id).map((c) => [Number(c.i4u_customer_id), c.name]));
  const who = (d: ArchiveDoc): string => (d.i4u_client_id ? splitName(byI4u.get(Number(d.i4u_client_id)) ?? "").name : "") || d.gname || "לקוח מזדמן";
  const [from, setFrom] = useState(`${new Date().getFullYear() - 1}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Array<{ ok: boolean; text: string }>>([]);
  const [q, setQ] = useState("");
  const stop = useRef(false);

  async function importCustomers() {
    setBusy(true);
    const r = await importFromInvoice4u({ action: "customers" });
    setBusy(false);
    if (r.ok) onChange();
    setLog((l) => [...l, r.ok ? { ok: true, text: `לקוחות: נמצאו ${r.fetched}, נוספו ${r.inserted}, קושרו ללקוחות קיימים לפי ת.ז. ${r.linked}, דולגו ${r.skipped}.` } : { ok: false, text: importError(r) }]);
  }
  async function importDocuments() {
    if (!window.confirm(`לייבא מסמכים מ-Invoice4U בין ${from} ל-${to}? הפעולה לקריאה בלבד ואינה משנה דבר ב-Invoice4U.`)) return;
    stop.current = false; setBusy(true); setLog([]);
    let total = 0;
    for (const [a, b] of monthsBetween(from, to)) {
      if (stop.current) { setLog((l) => [...l, { ok: false, text: `הייבוא נעצר לפני ${a}.` }]); break; }
      const r = await importFromInvoice4u({ action: "documents", from: a, to: b });
      if (!r.ok) { setLog((l) => [...l, { ok: false, text: `${a} עד ${b}: ${importError(r)}` }]); break; }
      total += r.fetched ?? 0;
      setLog((l) => [...l.slice(-11), { ok: true, text: `${a} עד ${b}: ${r.fetched} מסמכים (חדשים ${r.inserted}, עודכנו ${r.updated})` }]);
    }
    setBusy(false); onChange();
    setLog((l) => [...l, { ok: true, text: `סה"כ נקראו ${total} מסמכים בטווח.` }]);
  }

  const summary = archiveSummary(docs);
  const types = [...new Set(docs.map((d) => d.i4u_doc_type))].sort();
  const shown = docs.filter((d) => !q.trim() || String(d.doc_number).includes(q.trim())).slice(0, 100);

  return (
    <div className="ck-stack">
      <div className="ck-ok">ארכיון קריאה בלבד של מסמכים שהופקו ב-Invoice4U. הוא משמש להיסטוריה, להתאמת דוחות ולבדיקת רציפות המספור, ואינו מקור למסמך חדש.</div>
      <div className="ck-card ck-stack">
        <div className="ck-title">ייבוא מ-Invoice4U</div>
        <div className="ck-row">
          <button className="ck-btn" disabled={busy} onClick={() => void importCustomers()}>ייבוא לקוחות</button>
          <span className="ck-meta">מקשר לקוחות קיימים לפי ת.ז. ומוסיף את החדשים. אחרי זה הפקה חדשה לא תיצור לקוח כפול ב-Invoice4U.</span>
        </div>
        <div className="ck-grid2">
          <label className="ck-field">מתאריך<input className="ck-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="ck-field">עד תאריך<input className="ck-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="ck-row">
          <button className="ck-btn primary" disabled={busy || from > to} onClick={() => void importDocuments()}>{busy ? "מייבא..." : "ייבוא מסמכים"}</button>
          {busy && <button className="ck-btn" onClick={() => { stop.current = true; }}>עצירה</button>}
        </div>
        {log.map((l, i) => <div key={i} className={l.ok ? "ck-meta" : "ck-err"} aria-live="polite">{l.text}</div>)}
      </div>

      {(
        <>
          <div className="ck-label">התאמה לדוחות Invoice4U</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>שנה</th><th>סוג</th><th className="fin-num">כמות</th><th className="fin-num">לפני מע"מ</th><th className="fin-num">מע"מ</th><th className="fin-num">סה"כ</th></tr></thead><tbody>
            {summary.length ? summary.map((r) => <tr key={`${r.year}${r.type}`}><td>{r.year}</td><td>{I4U_TYPE[r.type] ?? r.type}</td><td className="fin-num">{r.count}</td><td className="fin-num">{r.type === 2 ? "ללא מע\"מ" : money(r.subtotal)}</td><td className="fin-num">{r.type === 2 ? "ללא מע\"מ" : money(r.vat)}</td><td className="fin-num">{money(r.total)}</td></tr>) : <tr><td colSpan={6}>עדיין לא יובאו מסמכים</td></tr>}
          </tbody></table></div>
          <div className="ck-meta">השוו שורות אלה לדוח ההכנסות של Invoice4U לאותה שנה. פער פירושו שחסר מסמך בייבוא או שהטווח לא מלא. קבלה אינה הכנסה בדוח, ולכן אין לה פירוט מע"מ. בכמה מסמכים הסה"כ מעוגל לשקל שלם ולכן שונה בעשרות אגורות מסכום לפני מע"מ ועוד מע"מ. זה העיגול של Invoice4U.</div>

          <div className="ck-label">רציפות מספור</div>
          <div className="ck-card ck-stack">
            {types.length ? types.map((t) => {
              const nums = docs.filter((d) => d.i4u_doc_type === t).map((d) => d.doc_number);
              const gaps = numberingGaps(nums);
              return (
                <div key={t} className="ck-row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <b>{I4U_TYPE[t] ?? t}</b>
                  <span className="ck-meta">מספרים <bdi>{Math.min(...nums)}</bdi> עד <bdi>{Math.max(...nums)}</bdi>, סה"כ <bdi>{nums.length}</bdi> מסמכים</span>
                  {gaps.length ? <span className="ck-badge yellow">חסרים: <bdi>{formatRanges(gaps)}</bdi></span> : <span className="ck-badge green">רציף בטווח שיובא</span>}
                </div>);
            }) : <div className="ck-meta">אין נתונים</div>}
            <div className="ck-meta">חוסר יכול לנבוע מטווח ייבוא חלקי. אם הטווח מלא, מספר חסר דורש הסבר מ-Invoice4U או מרואה החשבון, כי המספור צריך להיות רציף.</div>
          </div>

          <div className="ck-label">מסמכים אחרונים</div>
          <input className="ck-input" aria-label="חיפוש לפי מספר מסמך" placeholder="חיפוש לפי מספר מסמך" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>מס'</th><th>סוג</th><th>לקוח</th><th>תאריך</th><th className="fin-num">סה"כ</th><th className="fin-num">הקצאה</th></tr></thead><tbody>
            {shown.map((d) => <tr key={d.id}><td>{d.doc_number}</td><td>{I4U_TYPE[d.i4u_doc_type] ?? d.i4u_doc_type}</td><td className="fin-text"><span className="fin-name" title={who(d)}>{who(d)}</span></td><td>{d.issue_date}</td><td className="fin-num">{money(d.total)}</td><td className="fin-ltr">{d.allocation_number ?? ""}</td></tr>)}
          </tbody></table></div>
        </>
      )}
    </div>
  );
}
