import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { DEFAULT_VAT_RATE, DOC_TYPE, NEEDS_PAYMENT, PAY_METHOD, computeTotals, draftProblems, openBalance } from "../../../lib/cockpit/finance";
import type { DocType, FinCustomer, FinDocument, FinPayment, PayMethod } from "../../../lib/cockpit/finance";
import { issueDocument, issueError, rpcError } from "../../../lib/cockpit/financeApi";

interface EditLine { name: string; qty: string; price: string }
interface Editor {
  id: string | null; customer_id: string; doc_type: DocType; subject: string; tax_included: boolean; vat_rate: string;
  lines: EditLine[]; issue_date: string; due_date: string; payment_method: PayMethod | ""; payment_ref: string;
  related_doc_id: string; send_email: boolean;
}
type Note = { ok: boolean; text: string } | null;

const today = () => new Date().toISOString().slice(0, 10);
const blankEditor = (): Editor => ({
  id: null, customer_id: "", doc_type: "INVOICE", subject: "", tax_included: false, vat_rate: String(DEFAULT_VAT_RATE),
  lines: [{ name: "", qty: "1", price: "" }], issue_date: today(), due_date: "", payment_method: "", payment_ref: "",
  related_doc_id: "", send_email: false,
});
const toLines = (e: Editor) => e.lines.map((l) => ({ name: l.name, qty: Number(l.qty), price: Number(l.price) }));
const uncertain = (d: FinDocument) => d.status === "DRAFT" && (d.last_error ?? "").startsWith("UNCERTAIN");

export function DocumentsTab({ firmId, customers, docs, payments, onChange }: {
  firmId: string; customers: FinCustomer[]; docs: FinDocument[]; payments: FinPayment[]; onChange: () => void;
}) {
  const [ed, setEd] = useState<Editor | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pay, setPay] = useState<{ doc: FinDocument; amount: string; date: string; method: PayMethod } | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);

  const totals = ed ? computeTotals(toLines(ed), Number(ed.vat_rate) || 0, ed.tax_included) : null;
  const problems = ed ? draftProblems({ customer_id: ed.customer_id, doc_type: ed.doc_type, lines: toLines(ed), payment_method: ed.payment_method || null, related_doc_id: ed.related_doc_id || null }) : [];
  const relatedChoices = ed ? docs.filter((d) => d.status === "ISSUED" && d.customer_id === ed.customer_id && (ed.doc_type === "RECEIPT" ? d.doc_type === "INVOICE" : d.doc_type === "INVOICE" || d.doc_type === "INVOICE_RECEIPT")) : [];
  const label = (d: FinDocument) => `${DOC_TYPE[d.doc_type]} ${d.doc_number ?? ""}${d.is_test ? " (בדיקה)" : ""} · ${money(d.total)}`;

  function editDraft(d: FinDocument) {
    setNote(null);
    setEd({
      id: d.id, customer_id: d.customer_id, doc_type: d.doc_type, subject: d.subject, tax_included: d.tax_included, vat_rate: String(d.vat_rate),
      lines: d.lines.map((l) => ({ name: l.name, qty: String(l.qty), price: String(l.price) })), issue_date: d.issue_date, due_date: d.due_date ?? "",
      payment_method: d.payment_method ?? "", payment_ref: d.payment_ref ?? "", related_doc_id: d.related_doc_id ?? "", send_email: d.send_email,
    });
  }
  function receiptFor(inv: FinDocument) {
    setNote(null);
    setEd({
      ...blankEditor(), doc_type: "RECEIPT", customer_id: inv.customer_id, related_doc_id: inv.id, tax_included: true, vat_rate: "0",
      lines: [{ name: `תשלום עבור חשבונית מס ${inv.doc_number ?? ""}`, qty: "1", price: String(openBalance(inv, docs, payments)) }],
    });
  }
  function creditFor(inv: FinDocument) {
    setNote(null);
    setEd({
      ...blankEditor(), doc_type: "CREDIT", customer_id: inv.customer_id, related_doc_id: inv.id, tax_included: inv.tax_included, vat_rate: String(inv.vat_rate),
      subject: `זיכוי לחשבונית ${inv.doc_number ?? ""}`, lines: inv.lines.map((l) => ({ name: l.name, qty: String(l.qty), price: String(l.price) })),
    });
  }
  function setType(t: DocType) {
    if (!ed) return;
    const receipt = t === "RECEIPT";
    setEd({ ...ed, doc_type: t, related_doc_id: "", tax_included: receipt ? true : ed.tax_included, vat_rate: receipt ? "0" : ed.vat_rate === "0" ? String(DEFAULT_VAT_RATE) : ed.vat_rate });
  }
  function setLine(i: number, k: keyof EditLine, v: string) {
    if (ed) setEd({ ...ed, lines: ed.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  }

  async function saveDraft(): Promise<string | null> {
    if (!supabase || !ed) return null;
    if (problems.length) { setNote({ ok: false, text: problems.join(". ") }); return null; }
    const { data, error } = await supabase.rpc("lalum_fin_save_draft", {
      p_id: ed.id,
      p: {
        customer_id: ed.customer_id, doc_type: ed.doc_type, subject: ed.subject, tax_included: ed.tax_included, vat_rate: Number(ed.vat_rate) || 0,
        lines: toLines(ed), issue_date: ed.issue_date, due_date: ed.due_date || null, payment_method: ed.payment_method, payment_ref: ed.payment_ref,
        related_doc_id: ed.related_doc_id || null, send_email: ed.send_email,
      },
    });
    if (error) { setNote({ ok: false, text: rpcError(error.message) }); return null; }
    return String(data);
  }
  async function onSave() {
    setBusy("save");
    const id = await saveDraft();
    setBusy(null);
    if (id) { setEd(null); setNote({ ok: true, text: "הטיוטה נשמרה." }); onChange(); }
  }
  async function onIssue() {
    if (!ed) return;
    const cust = byId.get(ed.customer_id)?.name ?? "";
    if (!window.confirm(`להפיק ${DOC_TYPE[ed.doc_type]} ללקוח ${cust} על סך ${money(totals?.total)}?\nהפקה היא סופית: המסמך מקבל מספר רץ ואינו ניתן לעריכה או למחיקה. לביטול יופק מסמך זיכוי.`)) return;
    setBusy("issue");
    const id = await saveDraft();
    if (!id) { setBusy(null); return; }
    const r = await issueDocument(id);
    setBusy(null); onChange();
    if (r.ok) {
      setEd(null);
      setNote({ ok: true, text: `${DOC_TYPE[ed.doc_type]} מספר ${r.doc_number} הופקה${r.allocation_number ? `. מספר הקצאה ${r.allocation_number}` : ""}.${r.is_test ? " זהו מסמך בדיקה מסביבת הניסוי, והוא לא נספר בדוחות." : ""}${r.total_mismatch ? " שימו לב: הסכום ב-Invoice4U שונה מהסכום במערכת. ראו את שורת המסמך." : ""}` });
    } else {
      setEd(null);
      setNote({ ok: false, text: r.code === "invoice4u_rejected" ? `${issueError(r)} ${(r.errors ?? []).map((x) => x.error).filter(Boolean).join(", ")}` : issueError(r) });
    }
  }
  async function reconcile(d: FinDocument) {
    setBusy(d.id);
    const r = await issueDocument(d.id, "reconcile");
    setBusy(null); onChange();
    setNote(r.ok ? { ok: true, text: `נמצא ב-Invoice4U: מסמך מספר ${r.doc_number}. הסטטוס עודכן.` } : { ok: false, text: issueError(r) });
  }
  async function removeDraft(d: FinDocument) {
    if (!supabase || !window.confirm("למחוק את הטיוטה?")) return;
    const { error } = await supabase.rpc("lalum_fin_delete_draft", { p_id: d.id });
    setNote(error ? { ok: false, text: rpcError(error.message) } : null); onChange();
  }
  async function recordPayment() {
    if (!supabase || !pay) return;
    const amount = Number(pay.amount);
    if (!(amount > 0)) { setNote({ ok: false, text: "הסכום חייב להיות גדול מאפס." }); return; }
    const { error } = await supabase.from("lalum_fin_payments").insert({
      firm_id: firmId, customer_id: pay.doc.customer_id, document_id: pay.doc.id, paid_on: pay.date, amount, method: pay.method,
    });
    if (error) { setNote({ ok: false, text: error.message }); return; }
    setPay(null); setNote({ ok: true, text: "התשלום נרשם. זהו רישום פנימי בלבד, לא מסמך מס. להפקת קבלה השתמשו ב\"הפקת קבלה\"." }); onChange();
  }

  const shown = docs.filter((d) => !typeFilter || d.doc_type === typeFilter);
  const receiptMode = ed?.doc_type === "RECEIPT";

  return (
    <div className="ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <select className="ck-select" aria-label="סינון לפי סוג" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">כל המסמכים</option>{Object.entries(DOC_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="ck-btn primary" disabled={!customers.length} onClick={() => { setNote(null); setEd(blankEditor()); }}>מסמך חדש</button>
      </div>
      {!customers.length && <div className="ck-warn">כדי להפיק מסמך יש להוסיף לקוח בלשונית "לקוחות".</div>}
      {note && <div className={note.ok ? "ck-ok" : "ck-err"} aria-live="polite">{note.text}</div>}

      {ed && totals && (
        <div className="ck-card ck-stack">
          <div className="ck-title">{ed.id ? "עריכת טיוטה" : "מסמך חדש"}</div>
          <div className="ck-grid2">
            <label className="ck-field">סוג מסמך<select className="ck-select" value={ed.doc_type} onChange={(e) => setType(e.target.value as DocType)}>{Object.entries(DOC_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="ck-field">לקוח<select className="ck-select" value={ed.customer_id} onChange={(e) => setEd({ ...ed, customer_id: e.target.value, related_doc_id: "" })}><option value="">בחירה</option>{customers.filter((c) => !c.archived || c.id === ed.customer_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="ck-field">תאריך המסמך<input className="ck-input" type="date" value={ed.issue_date} onChange={(e) => setEd({ ...ed, issue_date: e.target.value })} /></label>
            <label className="ck-field">לתשלום עד<input className="ck-input" type="date" value={ed.due_date} onChange={(e) => setEd({ ...ed, due_date: e.target.value })} /></label>
          </div>
          {(ed.doc_type === "RECEIPT" || ed.doc_type === "CREDIT") && (
            <label className="ck-field">מסמך מקור<select className="ck-select" value={ed.related_doc_id} onChange={(e) => setEd({ ...ed, related_doc_id: e.target.value })}><option value="">בחירה</option>{relatedChoices.map((d) => <option key={d.id} value={d.id}>{label(d)}</option>)}</select></label>
          )}
          <label className="ck-field">נושא<input className="ck-input" value={ed.subject} onChange={(e) => setEd({ ...ed, subject: e.target.value })} /></label>
          <div className="ck-label">שורות</div>
          {ed.lines.map((l, i) => (
            <div key={i} className="ck-row" style={{ alignItems: "flex-end" }}>
              <label className="ck-field" style={{ flex: 3 }}>תיאור<input className="ck-input" value={l.name} onChange={(e) => setLine(i, "name", e.target.value)} /></label>
              <label className="ck-field" style={{ flex: 1 }}>כמות<input className="ck-input" dir="ltr" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} /></label>
              <label className="ck-field" style={{ flex: 1 }}>{receiptMode ? "סכום ששולם" : "מחיר ליחידה"}<input className="ck-input" dir="ltr" inputMode="decimal" value={l.price} onChange={(e) => setLine(i, "price", e.target.value)} /></label>
              <button className="ck-btn" aria-label="הסרת שורה" disabled={ed.lines.length === 1} onClick={() => setEd({ ...ed, lines: ed.lines.filter((_, j) => j !== i) })}>הסרה</button>
            </div>
          ))}
          <div><button className="ck-btn" onClick={() => setEd({ ...ed, lines: [...ed.lines, { name: "", qty: "1", price: "" }] })}>שורה נוספת</button></div>
          {!receiptMode && (
            <div className="ck-row">
              <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={ed.tax_included} onChange={(e) => setEd({ ...ed, tax_included: e.target.checked })} />המחירים כוללים מע"מ</label>
              <label className="ck-field" style={{ maxWidth: 140 }}>שיעור מע"מ (%)<input className="ck-input" dir="ltr" inputMode="decimal" value={ed.vat_rate} onChange={(e) => setEd({ ...ed, vat_rate: e.target.value })} /></label>
            </div>
          )}
          {NEEDS_PAYMENT.includes(ed.doc_type) && (
            <div className="ck-grid2">
              <label className="ck-field">אמצעי תשלום<select className="ck-select" value={ed.payment_method} onChange={(e) => setEd({ ...ed, payment_method: e.target.value as PayMethod })}><option value="">בחירה</option>{Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="ck-field">אסמכתא (מספר שיק, 4 ספרות אחרונות)<input className="ck-input" dir="ltr" value={ed.payment_ref} onChange={(e) => setEd({ ...ed, payment_ref: e.target.value })} /></label>
            </div>
          )}
          <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={ed.send_email} onChange={(e) => setEd({ ...ed, send_email: e.target.checked })} />לשלוח את המסמך בדוא"ל ללקוח בעת ההפקה</label>
          <div className="ck-card">
            <div className="ck-row" style={{ justifyContent: "space-between" }}><span>לפני מע"מ</span><b>{money(totals.subtotal)}</b></div>
            {!receiptMode && <div className="ck-row" style={{ justifyContent: "space-between" }}><span>מע"מ</span><b>{money(totals.vat)}</b></div>}
            <div className="ck-row" style={{ justifyContent: "space-between" }}><span>סה"כ</span><b>{money(totals.total)}</b></div>
          </div>
          {problems.length > 0 && <div className="ck-warn">{problems.join(". ")}</div>}
          <div className="ck-row">
            <button className="ck-btn" disabled={busy !== null} onClick={() => void onSave()}>שמירה כטיוטה</button>
            <button className="ck-btn primary" disabled={busy !== null || problems.length > 0} onClick={() => void onIssue()}>{busy === "issue" ? "מפיק..." : "הפקה"}</button>
            <button className="ck-btn" onClick={() => setEd(null)}>סגירה</button>
          </div>
        </div>
      )}

      {pay && (
        <div className="ck-card ck-stack">
          <div className="ck-title">רישום תשלום לחשבונית {pay.doc.doc_number}</div>
          <div className="ck-grid2">
            <label className="ck-field">סכום<input className="ck-input" dir="ltr" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
            <label className="ck-field">תאריך<input className="ck-input" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
            <label className="ck-field">אמצעי<select className="ck-select" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PayMethod })}>{Object.entries(PAY_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className="ck-meta">רישום פנימי להתאמת יתרה. אינו מסמך מס ואינו מחליף קבלה.</div>
          <div className="ck-row"><button className="ck-btn primary" onClick={() => void recordPayment()}>רישום</button><button className="ck-btn" onClick={() => setPay(null)}>ביטול</button></div>
        </div>
      )}

      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>מס'</th><th>סוג</th><th>לקוח</th><th>תאריך</th><th className="fin-num">סה"כ</th><th className="fin-num">יתרה</th><th>סטטוס</th><th></th></tr></thead><tbody>
        {shown.length ? shown.map((d) => {
          const bal = openBalance(d, docs, payments);
          const src = d.related_doc_id ? docById.get(d.related_doc_id) : null;
          return (
            <tr key={d.id}>
              <td>{d.doc_number ?? ""}</td>
              <td>{DOC_TYPE[d.doc_type]}{src ? <div className="ck-meta">מול {src.doc_number}</div> : null}</td>
              <td>{byId.get(d.customer_id)?.name ?? ""}</td><td>{d.issue_date}</td>
              <td className="fin-num">{d.doc_type === "CREDIT" ? `-${money(d.total)}` : money(d.total)}</td>
              <td className="fin-num">{d.doc_type === "INVOICE" && d.status === "ISSUED" ? money(bal) : ""}</td>
              <td>
                {d.status === "DRAFT" ? <span className={`ck-badge ${uncertain(d) ? "red" : "yellow"}`}>{uncertain(d) ? "תוצאה לא ודאית" : "טיוטה"}</span>
                  : d.is_test ? <span className="ck-badge yellow">בדיקה</span> : <span className="ck-badge green">הופק</span>}
                {d.allocation_number && <div className="ck-meta" dir="ltr">הקצאה {d.allocation_number}</div>}
                {d.last_error && <div className="ck-meta" style={{ maxWidth: 260 }}>{d.last_error.slice(0, 120)}</div>}
              </td>
              <td className="fin-actions-cell"><div className="fin-actions" style={{ flexWrap: "wrap" }}>
                {d.status === "DRAFT" && !uncertain(d) && <><button className="ck-btn sm" onClick={() => editDraft(d)}>עריכה</button><button className="ck-btn sm danger" onClick={() => void removeDraft(d)}>מחיקה</button></>}
                {uncertain(d) && <button className="ck-btn sm" disabled={busy === d.id} onClick={() => void reconcile(d)}>בדיקת סטטוס מול Invoice4U</button>}
                {d.status === "ISSUED" && d.pdf_url && <a className="ck-btn sm" href={d.pdf_url} target="_blank" rel="noopener noreferrer">PDF</a>}
                {d.status === "ISSUED" && !d.allocation_number && d.doc_type !== "PROFORMA" && d.doc_type !== "RECEIPT" && <button className="ck-btn sm" disabled={busy === d.id} onClick={() => void reconcile(d)}>רענון מספר הקצאה</button>}
                {d.doc_type === "INVOICE" && d.status === "ISSUED" && bal > 0 && <>
                  <button className="ck-btn sm" onClick={() => receiptFor(d)}>הפקת קבלה</button>
                  <button className="ck-btn sm" onClick={() => setPay({ doc: d, amount: String(bal), date: today(), method: "TRANSFER" })}>רישום תשלום</button></>}
                {(d.doc_type === "INVOICE" || d.doc_type === "INVOICE_RECEIPT") && d.status === "ISSUED" && <button className="ck-btn sm" onClick={() => creditFor(d)}>זיכוי</button>}
              </div></td>
            </tr>);
        }) : <tr><td colSpan={8}>אין מסמכים עדיין</td></tr>}
      </tbody></table></div>
    </div>
  );
}
