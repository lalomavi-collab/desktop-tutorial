import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { TRUST_TYPE, trustBalance, trustEffect, trustProblems } from "../../../lib/cockpit/finance";
import type { FinCustomer, FinDocument, TrustEntry, TrustType } from "../../../lib/cockpit/finance";

const today = () => new Date().toISOString().slice(0, 10);
type Draft = { customer_id: string; entry_type: TrustType; amount: string; entry_date: string; matter_ref: string; reference: string; note: string; document_id: string };
const blank = (): Draft => ({ customer_id: "", entry_type: "DEPOSIT", amount: "", entry_date: today(), matter_ref: "", reference: "", note: "", document_id: "" });
const DB_ERRORS: Record<string, string> = { TRUST_OVERDRAW: "הסכום גבוה מהיתרה המוחזקת עבור הלקוח.", BAD_CUSTOMER: "הלקוח לא נמצא.", BAD_DOCUMENT: "המסמך לא נמצא." };

export function TrustTab({ firmId, customers, docs, entries, onChange }: { firmId: string; customers: FinCustomer[]; docs: FinDocument[]; entries: TrustEntry[]; onChange: () => void }) {
  const [f, setF] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string>("");
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => f && setF({ ...f, [k]: e.target.value });
  const name = (id: string) => customers.find((c) => c.id === id)?.name ?? "";
  const held = [...new Set(entries.map((e) => e.customer_id))]
    .map((id) => ({ id, bal: trustBalance(entries, id) })).filter((r) => r.bal !== 0).sort((a, b) => b.bal - a.bal);
  const invoices = (cid: string) => docs.filter((d) => d.customer_id === cid && d.status === "ISSUED" && !d.is_test && (d.doc_type === "INVOICE" || d.doc_type === "INVOICE_RECEIPT"));

  async function save() {
    if (!supabase || !f) return;
    const row = { customer_id: f.customer_id, entry_type: f.entry_type, amount: Number(f.amount), entry_date: f.entry_date, document_id: f.document_id || null };
    const problems = trustProblems(row, entries);
    if (problems.length) return setMsg(problems.join(". ") + ".");
    const { error } = await supabase.from("lalum_fin_trust_entries").insert({
      ...row, firm_id: firmId, matter_ref: f.matter_ref.trim() || null, reference: f.reference.trim() || null, note: f.note.trim() || null,
    });
    if (error) return setMsg(DB_ERRORS[Object.keys(DB_ERRORS).find((k) => error.message.includes(k)) ?? ""] ?? error.message);
    setF(null); setMsg(""); onChange();
  }

  return (
    <div className="ck-stack">
      <div className="ck-card fin-stat fin-trust">
        <div className="ck-meta">סה"כ כספי נאמנות מוחזקים</div>
        <div className="fin-figure">{money(trustBalance(entries))}</div>
        <div className="fin-note">כספי לקוחות. אינם הכנסת המשרד ואינם נכללים בסקירה, בדוח ההכנסות ובמע"מ. תנועה אינה נמחקת ואינה נערכת: טעות מתוקנת בתנועה מתקנת.</div>
      </div>
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-meta">העברה למשרד נרשמת רק כנגד חשבונית מס שהופקה. ההכנסה מוכרת בחשבונית, לא בהעברה.</div>
        <button className="ck-btn primary" onClick={() => { setF(blank()); setMsg(""); }}>תנועה חדשה</button>
      </div>
      {f && (
        <div className="ck-card ck-stack">
          <div className="ck-title">תנועת נאמנות חדשה</div>
          <div className="ck-grid2">
            <label className="ck-field">לקוח<select className="ck-select" value={f.customer_id} onChange={(e) => setF({ ...f, customer_id: e.target.value, document_id: "" })}><option value="">בחרו לקוח</option>{customers.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="ck-field">סוג תנועה<select className="ck-select" value={f.entry_type} onChange={set("entry_type")}>{Object.entries(TRUST_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="ck-field">סכום<input className="ck-input" dir="ltr" inputMode="decimal" value={f.amount} onChange={set("amount")} /></label>
            <label className="ck-field">תאריך<input className="ck-input" type="date" value={f.entry_date} onChange={set("entry_date")} /></label>
            {f.entry_type === "RELEASE_FIRM" && (
              <label className="ck-field">חשבונית מס<select className="ck-select" value={f.document_id} onChange={set("document_id")}><option value="">בחרו חשבונית</option>{invoices(f.customer_id).map((d) => <option key={d.id} value={d.id}>{d.doc_number} · {money(d.total)}</option>)}</select></label>
            )}
            <label className="ck-field">תיק או עניין<input className="ck-input" value={f.matter_ref} onChange={set("matter_ref")} /></label>
            <label className="ck-field">אסמכתא<input className="ck-input" dir="ltr" value={f.reference} onChange={set("reference")} /></label>
          </div>
          <label className="ck-field">הערה<input className="ck-input" value={f.note} onChange={set("note")} /></label>
          {msg && <div className="ck-err" aria-live="polite">{msg}</div>}
          <div className="ck-row"><button className="ck-btn primary" onClick={() => void save()}>שמירה</button><button className="ck-btn" onClick={() => setF(null)}>ביטול</button></div>
        </div>
      )}
      <div className="ck-title">יתרה לפי לקוח</div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>לקוח</th><th className="fin-num">יתרה מוחזקת</th></tr></thead><tbody>
        {held.length ? held.map((r) => <tr key={r.id}><td className="fin-text">{name(r.id)}</td><td className="fin-num">{money(r.bal)}</td></tr>) : <tr><td colSpan={2}>אין כספי נאמנות מוחזקים</td></tr>}
      </tbody></table></div>
      <div className="ck-title">תנועות</div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תאריך</th><th>לקוח</th><th>סוג</th><th className="fin-num">סכום</th><th>תיק</th><th>אסמכתא</th></tr></thead><tbody>
        {entries.length ? entries.map((e) => (
          <tr key={e.id}><td>{e.entry_date}</td><td className="fin-text">{name(e.customer_id)}{e.note ? <div className="ck-meta">{e.note}</div> : null}</td>
            <td><span className={`ck-badge ${e.entry_type === "DEPOSIT" ? "trust" : "outflow"}`}>{TRUST_TYPE[e.entry_type]}</span></td>
            <td className="fin-num">{trustEffect(e) < 0 ? `-${money(e.amount)}` : money(e.amount)}</td><td>{e.matter_ref ?? ""}</td><td className="fin-ltr">{e.reference ?? ""}</td></tr>)) : <tr><td colSpan={6}>אין תנועות עדיין</td></tr>}
      </tbody></table></div>
    </div>
  );
}
