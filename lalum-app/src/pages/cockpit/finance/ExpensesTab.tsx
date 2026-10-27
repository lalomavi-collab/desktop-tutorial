import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Icon } from "../../../components/Icon";
import { money } from "../../../lib/cockpit/shared";
import { EXPENSE_CATEGORY, PAY_METHOD, recoverableVat } from "../../../lib/cockpit/finance";
import type { FinExpense, FinExpenseDoc, PayMethod } from "../../../lib/cockpit/finance";
import { scanReceipt, scanReceiptError, uploadExpenseDoc, getExpenseDocUrl, expenseDocError } from "../../../lib/cockpit/financeApi";
import { TAX_CATEGORY } from "../../../lib/cockpit/taxEngine";
import type { TaxCategory } from "../../../lib/cockpit/taxEngine";
import { advisorError, classifyExpense } from "../../../lib/cockpit/taxAdvisorAgent";
import { HistoricalImport } from "./HistoricalImport";
import { ExpensesChart } from "./ExpensesChart";

const today = () => new Date().toISOString().slice(0, 10);
type Draft = { spent_on: string; supplier: string; category: string; description: string; total: string; vat_amount: string; pct: string; ref: string; method: string; taxCat: TaxCategory; itPct: string };
const blank = (): Draft => ({ spent_on: today(), supplier: "", category: "OTHER", description: "", total: "", vat_amount: "", pct: "100", ref: "", method: "", taxCat: "OPERATIONAL_100", itPct: "100" });
// Hebrew labels for the fields a scan can flag as unclear, so the review note below the form reads
// like the rest of the screen rather than echoing the API's own field names.
const FIELD_LABEL: Record<string, string> = {
  spent_on: "תאריך", supplier: "ספק", category: "קטגוריה", description: "תיאור",
  total: "סכום כולל", vat_amount: "מע\"מ", supplier_doc_ref: "מספר חשבונית הספק",
};

// Why a deletion was refused, in words. A delete that fails silently looks like a screen that did not refresh.
function removeError(e: { code?: string; message?: string }): string {
  if (e.code === "23503") return "להוצאה מצורף מסמך מקור ולכן אי אפשר למחוק אותה. אם נרשמה בטעות, תקנו אותה.";
  if ((e.message ?? "").includes("TAX_RETENTION")) return "ההוצאה נשמרת עד סוף תקופת השמירה למס ואי אפשר למחוק אותה.";
  return "המחיקה נכשלה. נסו שוב.";
}

// level: the signed in user's finance level (1 view, 3 writes expenses). Below 3 the tab is read only, a bookkeeper included:
// the source documents can be opened, nothing can be added, replaced or removed. The database and the function enforce the same.
export function ExpensesTab({ firmId, level, expenses, onChange }: { firmId: string; level: number; expenses: FinExpense[]; onChange: () => void }) {
  const canWrite = level >= 3;
  const [f, setF] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lowConfidence, setLowConfidence] = useState<string[]>([]);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [docMsg, setDocMsg] = useState<{ id: string; kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [docs, setDocs] = useState<FinExpenseDoc[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const docTargetRef = useRef<{ expenseId: string; supersedes: string | null } | null>(null);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => f && setF({ ...f, [k]: e.target.value });

  // Source documents (migration 20261027100000). The path is never selected: the browser only ever gets a 60 second link.
  const [docsTick, setDocsTick] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    void (async () => {
      const { data } = await supabase.from("lalum_fin_expense_docs").select("id, expense_id, sha256, mime, size_bytes, uploaded_at, superseded_at").eq("firm_id", firmId).order("uploaded_at");
      if (live) setDocs((data as FinExpenseDoc[] | null) ?? []);
    })();
    return () => { live = false; };
  }, [firmId, expenses, docsTick]);
  const docsOf = useMemo(() => {
    const m = new Map<string, FinExpenseDoc[]>();
    for (const d of docs) m.set(d.expense_id, [...(m.get(d.expense_id) ?? []), d]);
    return m;
  }, [docs]);

  function startDocUpload(expenseId: string, supersedes: string | null) {
    docTargetRef.current = { expenseId, supersedes };
    docFileRef.current?.click();
  }
  async function onDocFile(e: { target: { files: FileList | null; value: string } }) {
    const file = e.target.files?.[0];
    const target = docTargetRef.current;
    e.target.value = ""; docTargetRef.current = null;
    if (!file || !target) return;
    setDocBusy(target.expenseId); setDocMsg(null);
    const r = await uploadExpenseDoc(target.expenseId, file, target.supersedes ?? undefined);
    setDocBusy(null);
    if (!r.ok) { setDocMsg({ id: target.expenseId, kind: "err", text: expenseDocError(r) }); return; }
    const elsewhere = r.same_file_elsewhere ?? 0;
    if (r.duplicate) setDocMsg({ id: target.expenseId, kind: "ok", text: "הקובץ הזה כבר מצורף להוצאה." });
    else if (elsewhere > 0) setDocMsg({ id: target.expenseId, kind: "warn", text: `נשמר. אותו קובץ מצורף גם ל${elsewhere === 1 ? "הוצאה אחרת" : `-${elsewhere} הוצאות אחרות`}, ייתכן שזו הוצאה כפולה.` });
    setDocsTick((n) => n + 1);
  }
  async function viewDoc(expenseId: string, docId: string) {
    setDocBusy(expenseId); setDocMsg(null);
    const r = await getExpenseDocUrl(docId);
    setDocBusy(null);
    if (!r.ok || !r.url) { setDocMsg({ id: expenseId, kind: "err", text: expenseDocError(r) }); return; }
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

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
      ref: d.supplier_doc_ref ?? "", method: "", taxCat: "OPERATIONAL_100", itPct: "100",
    });
    setLowConfidence(r.low_confidence_fields ?? []);
    setMsg({ ok: true, text: "הטיוטה מולאה מהחשבונית. בדקו את הסכומים לפני השמירה." });
  }

  // Choosing a category fills in its suggested rates; both stay editable and are what is saved.
  function pickTaxCategory(c: TaxCategory) {
    if (!f) return;
    const r = TAX_CATEGORY[c];
    setF({ ...f, taxCat: c, pct: String(r.vatPct), itPct: String(r.itPct) });
  }
  const [advising, setAdvising] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  async function suggest() {
    if (!f) return;
    setAdvising(true); setAdvice(null);
    const r = await classifyExpense(firmId, { supplier: f.supplier, description: f.description, total: Number(f.total), vat_amount: Number(f.vat_amount || 0) });
    setAdvising(false);
    const c = r.ok ? r.data?.classification : null;
    if (!c) return setAdvice(r.ok ? "היועץ לא הצליח לסווג. בחרו קטגוריה ידנית." : advisorError(r.code));
    setF({ ...f, taxCat: c.expense_category, pct: String(c.vat_recognition_pct), itPct: String(c.income_tax_recognition_pct) });
    setAdvice(`${c.legal_reasoning_hebrew}${c.needs_review ? " מומלץ לאשר מול רואה החשבון." : ""}`);
  }

  async function save() {
    if (!supabase || !f) return;
    const total = Number(f.total), vat = Number(f.vat_amount || 0), pct = Number(f.pct);
    if (!f.supplier.trim()) return setMsg({ ok: false, text: "שם הספק חובה." });
    if (!(total > 0)) return setMsg({ ok: false, text: "הסכום הכולל חייב להיות גדול מאפס." });
    if (vat < 0 || vat > total) return setMsg({ ok: false, text: 'סכום המע"מ חייב להיות בין אפס לסכום הכולל.' });
    const itPct = Number(f.itPct);
    if (!(itPct >= 0 && itPct <= 100)) return setMsg({ ok: false, text: 'שיעור ההכרה למס הכנסה הוא בין 0 ל-100.' });
    if (!(pct >= 0 && pct <= 100)) return setMsg({ ok: false, text: 'שיעור המע"מ לניכוי הוא בין 0 ל-100.' });
    const { error } = await supabase.from("lalum_fin_expenses").insert({
      firm_id: firmId, spent_on: f.spent_on, supplier: f.supplier.trim(), category: f.category, description: f.description.trim() || null,
      total, vat_amount: vat, vat_recoverable_pct: pct, tax_category: f.taxCat, income_tax_recognition_pct: itPct, supplier_doc_ref: f.ref.trim() || null, payment_method: f.method || null,
    });
    if (error) return setMsg({ ok: false, text: error.message });
    setF(null); setMsg(null); setLowConfidence([]); onChange();
  }
  async function remove(id: string) {
    if (!supabase || !window.confirm("למחוק את ההוצאה?")) return;
    const { error } = await supabase.from("lalum_fin_expenses").delete().eq("id", id);
    if (error) { setDocMsg({ id, kind: "err", text: removeError(error) }); return; }
    onChange();
  }

  return (
    <div className="ck-stack">
      <ExpensesChart expenses={expenses} />
      {canWrite && <HistoricalImport firmId={firmId} onImported={onChange} />}
      {canWrite && <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-meta">שיעור המע"מ לניכוי נקבע לכל הוצאה בנפרד. המערכת אינה מנחשת אותו.</div>
        <div className="ck-row">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" style={{ display: "none" }} onChange={(e) => void onScanFile(e)} />
          <input ref={docFileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => void onDocFile(e)} />
          <button className="ck-btn" disabled={scanning} onClick={() => fileRef.current?.click()}>
            <Icon name="file" size={16} /> {scanning ? "קוראים את החשבונית…" : "סריקת חשבונית"}
          </button>
          <button className="ck-btn primary" onClick={() => { setF(blank()); setMsg(null); setLowConfidence([]); }}>
            <Icon name="plus" size={16} /> הוצאה חדשה
          </button>
        </div>
      </div>}
      {canWrite && f && (
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
            <label className="ck-field">סיווג למס<select className="ck-select" value={f.taxCat} onChange={(e) => pickTaxCategory(e.target.value as TaxCategory)}>{Object.entries(TAX_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            <label className="ck-field">אחוז ההכרה למס הכנסה<input className="ck-input" dir="ltr" inputMode="decimal" value={f.itPct} onChange={set("itPct")} /></label>
            <label className="ck-field">מספר חשבונית הספק<input className="ck-input" dir="ltr" value={f.ref} onChange={set("ref")} /></label>
          </div>
          <label className="ck-field">תיאור<input className="ck-input" value={f.description} onChange={set("description")} /></label>
          <div className="ck-row"><button className="ck-btn sm" disabled={advising || !f.supplier.trim()} onClick={() => void suggest()}>{advising ? "מסווגים…" : "הצעת סיווג מהיועץ"}</button>{TAX_CATEGORY[f.taxCat].review && <span className="ck-meta">הקטגוריה הזו דורשת אישור מול רואה החשבון.</span>}</div>
          {advice && <div className="ck-meta" aria-live="polite">{advice}</div>}
          {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
          <div className="ck-row"><button className="ck-btn primary" onClick={() => void save()}>שמירה</button><button className="ck-btn" onClick={() => { setF(null); setLowConfidence([]); }}>ביטול</button></div>
        </div>
      )}
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תאריך</th><th>ספק</th><th>קטגוריה</th><th className="fin-num">סה"כ</th><th className="fin-num">מע"מ</th><th className="fin-num">לניכוי</th><th>מסמך מקור</th><th></th></tr></thead><tbody>
        {expenses.length ? expenses.map((e) => (
          <tr key={e.id}><td>{e.spent_on}</td><td className="fin-text">{e.supplier}{e.description ? <div className="ck-meta">{e.description}</div> : null}</td>
            <td>{EXPENSE_CATEGORY[e.category] ?? e.category}</td><td className="fin-num">{money(e.total)}</td><td className="fin-num">{money(e.vat_amount)}</td>
            <td className="fin-num">{money(recoverableVat(e))}{e.payment_method ? <div className="ck-meta">{PAY_METHOD[e.payment_method as PayMethod]}</div> : null}</td>
            <td>{(() => {
              const all = docsOf.get(e.id) ?? [], live = all.filter((d) => !d.superseded_at), old = all.filter((d) => d.superseded_at);
              const busy = docBusy === e.id;
              return <>
                {live.map((d, i) => (
                  <div className="ck-row" key={d.id}>
                    <button className="ck-btn sm" disabled={busy} onClick={() => void viewDoc(e.id, d.id)}><Icon name="file" size={14} /> {busy ? "…" : live.length > 1 ? `מסמך ${i + 1}` : "צפייה"}</button>
                    {canWrite && <button className="ck-btn sm" disabled={busy} onClick={() => startDocUpload(e.id, d.id)} title="החלפת המסמך. הקודם נשמר ומסומן כמוחלף.">החלפה</button>}
                  </div>
                ))}
                {canWrite && <button className="ck-btn sm" disabled={busy} onClick={() => startDocUpload(e.id, null)}><Icon name="file" size={14} /> {live.length ? "מסמך נוסף" : "העלאה"}</button>}
                {!canWrite && !live.length && <span className="ck-meta">לא צורף</span>}
                {old.length > 0 && (
                  <details><summary className="ck-meta">גרסאות קודמות ({old.length})</summary>
                    {old.map((d) => <button key={d.id} className="ck-btn sm" disabled={busy} onClick={() => void viewDoc(e.id, d.id)}>{d.uploaded_at.slice(0, 10)}</button>)}
                  </details>
                )}
                {docMsg?.id === e.id && <div className={docMsg.kind === "ok" ? "ck-ok" : docMsg.kind === "warn" ? "ck-warn" : "ck-err"} aria-live="polite">{docMsg.text}</div>}
              </>;
            })()}</td>
            <td className="fin-actions-cell">{canWrite && <div className="fin-actions"><button className="ck-btn sm danger" onClick={() => void remove(e.id)}>מחיקה</button></div>}</td></tr>)) : <tr><td colSpan={8}>אין הוצאות עדיין</td></tr>}
      </tbody></table></div>
    </div>
  );
}
