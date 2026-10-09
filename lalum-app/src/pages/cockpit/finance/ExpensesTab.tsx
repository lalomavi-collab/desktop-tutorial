import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { EXPENSE_CATEGORY, PAY_METHOD, recoverableVat } from "../../../lib/cockpit/finance";
import type { FinExpense, PayMethod } from "../../../lib/cockpit/finance";

const today = () => new Date().toISOString().slice(0, 10);
type Draft = { spent_on: string; supplier: string; category: string; description: string; total: string; vat_amount: string; pct: string; ref: string; method: string };
const blank = (): Draft => ({ spent_on: today(), supplier: "", category: "OTHER", description: "", total: "", vat_amount: "", pct: "100", ref: "", method: "" });

export function ExpensesTab({ firmId, expenses, onChange }: { firmId: string; expenses: FinExpense[]; onChange: () => void }) {
  const [f, setF] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => f && setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!supabase || !f) return;
    const total = Number(f.total), vat = Number(f.vat_amount || 0), pct = Number(f.pct);
    if (!f.supplier.trim()) return setMsg({ ok: false, text: "שם הספק חובה." });
    if (!(total > 0)) return setMsg({ ok: false, text: "הסכום הכולל חייב להיות גדול מאפס." });
    if (vat < 0 || vat > total) return setMsg({ ok: false, text: 'סכום המע"מ חייב להיות בין אפס לסכום הכולל.' });
    if (!(pct >= 0 && pct <= 100)) return setMsg({ ok: false, text: 'שיעור המע"מ לניכוי הוא בין 0 ל-100.' });
    const { error } = await supabase.from("lalum_fin_expenses").insert({
      firm_id: firmId, spent_on: f.spent_on, supplier: f.supplier.trim(), category: f.category, description: f.description.trim() || null,
      total, vat_amount: vat, vat_recoverable_pct: pct, supplier_doc_ref: f.ref.trim() || null, payment_method: f.method || null,
    });
    if (error) return setMsg({ ok: false, text: error.message });
    setF(null); setMsg(null); onChange();
  }
  async function remove(id: string) {
    if (!supabase || !window.confirm("למחוק את ההוצאה?")) return;
    await supabase.from("lalum_fin_expenses").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-meta">שיעור המע"מ לניכוי נקבע לכל הוצאה בנפרד. המערכת אינה מנחשת אותו.</div>
        <button className="ck-btn primary" onClick={() => { setF(blank()); setMsg(null); }}>הוצאה חדשה</button>
      </div>
      {f && (
        <div className="ck-card ck-stack">
          <div className="ck-title">הוצאה חדשה</div>
          <div className="ck-grid2">
            <label className="ck-field">תאריך<input className="ck-input" type="date" value={f.spent_on} onChange={set("spent_on")} /></label>
            <label className="ck-field">ספק<input className="ck-input" value={f.supplier} onChange={set("supplier")} /></label>
            <label className="ck-field">קטגוריה<select className="ck-select" value={f.category} onChange={set("category")}>{Object.entries(EXPENSE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="ck-field">אמצעי תשלום<select className="ck-select" value={f.method} onChange={set("method")}><option value="">לא צוין</option>{Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="ck-field">סכום כולל כולל מע"מ<input className="ck-input" dir="ltr" inputMode="decimal" value={f.total} onChange={set("total")} /></label>
            <label className="ck-field">מתוכו מע"מ<input className="ck-input" dir="ltr" inputMode="decimal" value={f.vat_amount} onChange={set("vat_amount")} /></label>
            <label className="ck-field">אחוז המע"מ שניתן לנכות<input className="ck-input" dir="ltr" inputMode="decimal" value={f.pct} onChange={set("pct")} /></label>
            <label className="ck-field">מספר חשבונית הספק<input className="ck-input" dir="ltr" value={f.ref} onChange={set("ref")} /></label>
          </div>
          <label className="ck-field">תיאור<input className="ck-input" value={f.description} onChange={set("description")} /></label>
          {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
          <div className="ck-row"><button className="ck-btn primary" onClick={() => void save()}>שמירה</button><button className="ck-btn" onClick={() => setF(null)}>ביטול</button></div>
        </div>
      )}
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תאריך</th><th>ספק</th><th>קטגוריה</th><th>סה"כ</th><th>מע"מ</th><th>לניכוי</th><th></th></tr></thead><tbody>
        {expenses.length ? expenses.map((e) => (
          <tr key={e.id}><td>{e.spent_on}</td><td>{e.supplier}{e.description ? <div className="ck-meta">{e.description}</div> : null}</td>
            <td>{EXPENSE_CATEGORY[e.category] ?? e.category}</td><td>{money(e.total)}</td><td>{money(e.vat_amount)}</td>
            <td>{money(recoverableVat(e))}{e.payment_method ? <div className="ck-meta">{PAY_METHOD[e.payment_method as PayMethod]}</div> : null}</td>
            <td><button className="ck-btn danger" onClick={() => void remove(e.id)}>מחיקה</button></td></tr>)) : <tr><td colSpan={7}>אין הוצאות עדיין</td></tr>}
      </tbody></table></div>
    </div>
  );
}
