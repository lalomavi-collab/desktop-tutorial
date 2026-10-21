import { useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Icon } from "../../../components/Icon";
import { money } from "../../../lib/cockpit/shared";
import { EXPENSE_CATEGORY, PAY_METHOD, recoverableVat } from "../../../lib/cockpit/finance";
import type { FinExpense, PayMethod } from "../../../lib/cockpit/finance";
import { scanReceipt, scanReceiptError } from "../../../lib/cockpit/financeApi";
import { HistoricalImport } from "./HistoricalImport";

const today = () => new Date().toISOString().slice(0, 10);
type Draft = { spent_on: string; supplier: string; category: string; description: string; total: string; vat_amount: string; pct: string; ref: string; method: string };
const blank = (): Draft => ({ spent_on: today(), supplier: "", category: "OTHER", description: "", total: "", vat_amount: "", pct: "100", ref: "", method: "" });
// Hebrew labels for the fields a scan can flag as unclear, so the review note below the form reads
// like the rest of the screen rather than echoing the API's own field names.
const FIELD_LABEL: Record<string, string> = {
  spent_on: "תאריך", supplier: "ספק", category: "קטגוריה", description: "תיאור",
  total: "סכום כולל", vat_amount: "מע\"מ", supplier_doc_ref: "מספר חשבונית הספק",
};

export function ExpensesTab({ firmId, expenses, onChange }: { firmId: string; expenses: FinExpense[]; onChange: () => void }) {
  const [f, setF] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lowConfidence, setLowConfidence] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => f && setF({ ...f, [k]: e.target.value });

  async function onScanFile(e: { target: { files: FileList | null; value: string } }) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true); setMsg(null); setLowConfidence([]);
    const r = await scanReceipt(firmId, file);
    setScanning(false);
    if (!r.ok || !r.draft) { setMsg({ ok: false, text: scanReceiptError(r) }); return; }
    const d = r.draft;
    setF({
      spent_on: d.spent_on ?? today(), supplier: d.supplier ?? "", category: d.category ?? "OTHER",
      description: d.description ?? "", total: d.total != null ? String(d.total) : "",
      vat_amount: d.vat_amount != null ? String(d.vat_amount) : "", pct: "100",
      ref: d.supplier_doc_ref ?? "", method: "",
    });
    setLowConfidence(r.low_confidence_fields ?? []);
    setMsg({ ok: true, text: "הטיוטה מולאה מהחשבונית. בדקו את הסכומים לפני השמירה." });
  }

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
    setF(null); setMsg(null); setLowConfidence([]); onChange();
  }
  async function remove(id: string) {
    if (!supabase || !window.confirm("למחוק את ההוצאה?")) return;
    await supabase.from("lalum_fin_expenses").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="ck-stack">
      <HistoricalImport firmId={firmId} onImported={onChange} />
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-meta">שיעור המע"מ לניכוי נקבע לכל הוצאה בנפרד. המערכת אינה מנחשת אותו.</div>
        <div className="ck-row">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" style={{ display: "none" }} onChange={(e) => void onScanFile(e)} />
          <button className="ck-btn" disabled={scanning} onClick={() => fileRef.current?.click()}>
            <Icon name="file" size={16} /> {scanning ? "קוראים את החשבונית…" : "סריקת חשבונית"}
          </button>
          <button className="ck-btn primary" onClick={() => { setF(blank()); setMsg(null); setLowConfidence([]); }}>
            <Icon name="plus" size={16} /> הוצאה חדשה
          </button>
        </div>
      </div>
      {f && (
        <div className="ck-card ck-stack">
          <div className="ck-title">הוצאה חדשה</div>
          {lowConfidence.length > 0 && (
            <div className="ck-warn" role="status">
              השדות הבאים לא היו ברורים מהתמונה, בדקו אותם לפני השמירה: {lowConfidence.map((k) => FIELD_LABEL[k] ?? k).join(", ")}
            </div>
          )}
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
          <div className="ck-row"><button className="ck-btn primary" onClick={() => void save()}>שמירה</button><button className="ck-btn" onClick={() => { setF(null); setLowConfidence([]); }}>ביטול</button></div>
        </div>
      )}
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תאריך</th><th>ספק</th><th>קטגוריה</th><th className="fin-num">סה"כ</th><th className="fin-num">מע"מ</th><th className="fin-num">לניכוי</th><th></th></tr></thead><tbody>
        {expenses.length ? expenses.map((e) => (
          <tr key={e.id}><td>{e.spent_on}</td><td className="fin-text">{e.supplier}{e.description ? <div className="ck-meta">{e.description}</div> : null}</td>
            <td>{EXPENSE_CATEGORY[e.category] ?? e.category}</td><td className="fin-num">{money(e.total)}</td><td className="fin-num">{money(e.vat_amount)}</td>
            <td className="fin-num">{money(recoverableVat(e))}{e.payment_method ? <div className="ck-meta">{PAY_METHOD[e.payment_method as PayMethod]}</div> : null}</td>
            <td className="fin-actions-cell"><div className="fin-actions"><button className="ck-btn sm danger" onClick={() => void remove(e.id)}>מחיקה</button></div></td></tr>)) : <tr><td colSpan={7}>אין הוצאות עדיין</td></tr>}
      </tbody></table></div>
    </div>
  );
}
