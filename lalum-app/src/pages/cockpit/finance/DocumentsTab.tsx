import { allocationShort } from "../../../lib/cockpit/financeAllocation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useClientNames } from "../../../components/cockpit/ClientNames";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { CASUAL_TYPES, DEFAULT_VAT_RATE, DOC_TYPE, NEEDS_PAYMENT, PAY_METHOD, computeTotals, draftProblems, openBalance } from "../../../lib/cockpit/finance";
import { isOpenProforma, splitName } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, DocType, FinCustomer, FinDocument, FinPayment, PayMethod } from "../../../lib/cockpit/finance";
import { checkProvider, issueDocument, issueError, logWhatsappSend, providerCheckText, rpcError, sendDocument, sendDocumentError, simulateIssue } from "../../../lib/cockpit/financeApi";
import { verifyCode } from "../../../lib/cockpit/mfa";
import { defaultBody, defaultSubject, deliveryText, waNumber, waText, whatsappUrl } from "../../../lib/cockpit/financeSend";
import type { DocSend } from "../../../lib/cockpit/financeSend";
import { archivePdfLink } from "../../../lib/cockpit/archivePdf";
import { buildDocRows, rowMatches, sentMark, typeMatches } from "../../../lib/cockpit/docList";
import type { DocRow } from "../../../lib/cockpit/docList";
import { DocSendPanel } from "./DocSendPanel";
import { DocIcon, IconButton } from "./DocIcons";
import "../../../styles/cockpit-doclist.css";

interface EditLine { name: string; qty: string; price: string }
interface Editor {
  id: string | null; customer_id: string; doc_type: DocType; subject: string; tax_included: boolean; vat_rate: string;
  lines: EditLine[]; issue_date: string; due_date: string; payment_method: PayMethod | ""; payment_ref: string;
  related_doc_id: string; send_email: boolean; internal_note: string; matter_ref: string; source_proforma_id: string;
}
type Note = { ok: boolean; text: string } | null;

const today = () => new Date().toISOString().slice(0, 10);
const blankEditor = (): Editor => ({
  id: null, customer_id: "", doc_type: "INVOICE", subject: "", tax_included: false, vat_rate: String(DEFAULT_VAT_RATE),
  lines: [{ name: "", qty: "1", price: "" }], issue_date: today(), due_date: "", payment_method: "", payment_ref: "",
  related_doc_id: "", send_email: false, internal_note: "", matter_ref: "", source_proforma_id: "",
});
const toLines = (e: Editor) => e.lines.map((l) => ({ name: l.name, qty: Number(l.qty), price: Number(l.price) }));
const uncertain = (d: FinDocument) => d.status === "DRAFT" && (d.last_error ?? "").startsWith("UNCERTAIN");
const PAGE = 100;

/** Every document in one list, ledger and history archive together, each row with the icon actions of the invoicing system's own list:
 *  view, print, mail to the customer in one click, WhatsApp, and every other option (extra addresses, edited text, copy link, the send log). */
export function DocumentsTab({ level, firmId, customers, docs, archive, payments, sends, onOpenArchive, onChange }: {
  level: number; firmId: string; customers: FinCustomer[]; docs: FinDocument[]; archive: ArchiveDoc[]; payments: FinPayment[]; sends: DocSend[]; onOpenArchive: () => void; onChange: () => void;
}) {
  const cn = useClientNames();
  const [ed, setEd] = useState<Editor | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pay, setPay] = useState<{ doc: FinDocument; amount: string; date: string; method: PayMethod } | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [sendFor, setSendFor] = useState<string | null>(null);
  // Issuing is final, so it is confirmed on the page (a native dialog can be accepted by an automated browser) with a fresh 6 digit code (T04).
  const [ask, setAsk] = useState<{ text: string; factors: { id: string; name: string }[]; factorId: string; code: string; err: string | null } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const rows = useMemo(() => buildDocRows(docs, archive, sends, customers), [docs, archive, sends, customers]);
  const rowByKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  /** The customer as the screen may show it: the name while names are revealed, a neutral label while hidden. */
  const who = (r: DocRow): string => (r.customer ? (cn.revealed ? splitName(r.customer.name).name : cn.customer(r.customer)) : cn.casual(r.casualName));

  const totals = ed ? computeTotals(toLines(ed), Number(ed.vat_rate) || 0, ed.tax_included) : null;
  const edCustomer = ed ? byId.get(ed.customer_id) : undefined;
  const casual = edCustomer?.is_casual === true;
  const problems = ed ? draftProblems({ customer_id: ed.customer_id, doc_type: ed.doc_type, lines: toLines(ed), payment_method: ed.payment_method || null, related_doc_id: ed.related_doc_id || null, casual }) : [];
  const relatedChoices = ed ? docs.filter((d) => d.status === "ISSUED" && d.customer_id === ed.customer_id && (ed.doc_type === "RECEIPT" ? d.doc_type === "INVOICE" : d.doc_type === "INVOICE" || d.doc_type === "INVOICE_RECEIPT")) : [];
  const label = (d: FinDocument) => `${DOC_TYPE[d.doc_type]} ${d.doc_number ?? ""}${d.is_test ? " (בדיקה)" : ""} · ${money(d.total)}`;

  function editDraft(d: FinDocument) {
    setNote(null);
    setEd({
      id: d.id, customer_id: d.customer_id, doc_type: d.doc_type, subject: d.subject, tax_included: d.tax_included, vat_rate: String(d.vat_rate),
      lines: d.lines.map((l) => ({ name: l.name, qty: String(l.qty), price: String(l.price) })), issue_date: d.issue_date, due_date: d.due_date ?? "",
      payment_method: d.payment_method ?? "", payment_ref: d.payment_ref ?? "", related_doc_id: d.related_doc_id ?? "", send_email: d.send_email, internal_note: d.internal_note ?? "", matter_ref: d.matter_ref ?? "", source_proforma_id: d.source_proforma_id ?? "",
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
  function pickCustomer(id: string) {
    if (!ed) return;
    const c = byId.get(id);
    // A casual customer is only allowed on invoice-receipts and credits, so move a draft of another type there.
    const fix = c?.is_casual && !CASUAL_TYPES.includes(ed.doc_type) ? { doc_type: "INVOICE_RECEIPT" as DocType, tax_included: false, vat_rate: ed.vat_rate === "0" ? String(DEFAULT_VAT_RATE) : ed.vat_rate } : {};
    setEd({ ...ed, ...fix, customer_id: id, related_doc_id: "" });
  }
  /** A draft invoice or invoice-receipt that settles an issued pro forma. The pro forma closes when that draft is issued. */
  function convertProforma(p: FinDocument, to: "INVOICE" | "INVOICE_RECEIPT") {
    setNote(null);
    setEd({
      ...blankEditor(), doc_type: to, customer_id: p.customer_id, subject: p.subject, tax_included: p.tax_included, vat_rate: String(p.vat_rate),
      lines: p.lines.map((l) => ({ name: l.name, qty: String(l.qty), price: String(l.price) })), source_proforma_id: p.id, matter_ref: p.matter_ref ?? "",
    });
  }
  /** A new draft from an existing document of a repeating kind. Dates and payment reference start fresh. */
  function duplicateDoc(d: FinDocument) {
    setNote(null);
    setEd({
      ...blankEditor(), doc_type: d.doc_type, customer_id: d.customer_id, subject: d.subject, tax_included: d.tax_included, vat_rate: String(d.vat_rate),
      lines: d.lines.map((l) => ({ name: l.name, qty: String(l.qty), price: String(l.price) })), payment_method: d.payment_method ?? "", send_email: d.send_email,
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
        related_doc_id: ed.related_doc_id || null, send_email: ed.send_email, internal_note: ed.internal_note, matter_ref: ed.matter_ref, source_proforma_id: ed.source_proforma_id || null,
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
  /** Saves the draft and mails a rendered simulation to the partner. Nothing is issued, numbered or logged; deleting the draft leaves nothing. */
  async function onSimulate() {
    setBusy("sim");
    const id = await saveDraft();
    if (!id) { setBusy(null); return; }
    const r = await simulateIssue(id);
    setBusy(null); onChange();
    setNote(r.ok
      ? { ok: true, text: 'נשלחה אליכם סימולציה בדוא"ל, עם קובץ PDF לדוגמה מצורף. לא הופק מסמך, לא הוקצה מספר ולא נשלח דבר ללקוח. הטיוטה נשמרה, ואפשר למחוק אותה מהרשימה.' }
      : { ok: false, text: sendDocumentError(r) });
  }
  async function onIssue() {
    if (!ed || !supabase) return;
    const cust = cn.customer(byId.get(ed.customer_id) ?? { id: ed.customer_id });
    const f = await supabase.auth.mfa.listFactors();
    const factors = (f.data?.totp ?? []).filter((x) => x.status === "verified").map((x) => ({ id: x.id, name: x.friendly_name ?? "TOTP" }));
    if (!factors.length) { setNote({ ok: false, text: "הפקה דורשת אימות דו שלבי פעיל. יש להפעיל אותו באבטחת החשבון ולחזור לכאן." }); return; }
    setAsk({ text: `להפיק ${DOC_TYPE[ed.doc_type]} ללקוח ${cust} על סך ${money(totals?.total)}?\nהפקה היא סופית: המסמך מקבל מספר רץ ואינו ניתן לעריכה או למחיקה. לביטול יופק מסמך זיכוי.`, factors, factorId: factors[0].id, code: "", err: null });
  }
  async function confirmIssue(e: FormEvent) {
    e.preventDefault();
    if (!ed || !ask) return;
    setBusy("issue");
    const err = await verifyCode(ask.factorId, ask.code);
    if (err) { setBusy(null); setAsk({ ...ask, code: "", err }); return; }
    setAsk(null);
    const id = await saveDraft();
    if (!id) { setBusy(null); return; }
    const r = await issueDocument(id);
    setBusy(null); onChange();
    if (r.ok) {
      setEd(null);
      const dv = deliveryText(r.delivery);
      setNote({ ok: dv.ok, text: `${DOC_TYPE[ed.doc_type]} מספר ${r.doc_number} הופקה${r.allocation_number ? `. מספר הקצאה ${allocationShort(r.allocation_number)}` : ""}. ${dv.text}${dv.ok ? "" : " אפשר לשלוח שוב מהמסמך ברשימה."}${r.is_test ? " זהו מסמך בדיקה מסביבת הניסוי, והוא לא נספר בדוחות, ונשלח לכתובת שלכם בלבד." : ""}${r.total_mismatch ? " שימו לב: הסכום במערכת ההנפקה שונה מהסכום במערכת. ראו את שורת המסמך." : ""}` });
    } else {
      setEd(null);
      setNote({ ok: false, text: r.code === "invoice4u_rejected" ? `${issueError(r)} ${(r.errors ?? []).map((x) => x.error).filter(Boolean).join(", ")}` : issueError(r) });
    }
  }
  async function reconcile(d: FinDocument) {
    setBusy(d.id);
    const r = await issueDocument(d.id, "reconcile");
    setBusy(null); onChange();
    setNote(r.ok ? { ok: true, text: `נמצא במערכת ההנפקה: מסמך מספר ${r.doc_number}. הסטטוס עודכן. ${deliveryText(r.delivery).text}` } : { ok: false, text: issueError(r) });
  }
  async function checkConnection() {
    setBusy("check"); setNote(null);
    const r = await checkProvider(firmId);
    setBusy(null);
    setNote(providerCheckText(r));
  }
  async function retainerDrafts() {
    if (!supabase) return;
    const now = new Date(), period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setBusy("retainer");
    const { data, error } = await supabase.rpc("lalum_fin_generate_retainer_drafts", { p_period: period });
    setBusy(null);
    if (error) { setNote({ ok: false, text: rpcError(error.message) }); return; }
    const n = Number(data ?? 0);
    setNote({ ok: true, text: n ? `נוצרו ${n} טיוטות ריטיינר לחודש ${period.slice(5)}/${period.slice(0, 4)}. בדקו והפיקו כל אחת בנפרד.` : "אין טיוטות חדשות. כל לקוחות הריטיינר כבר קיבלו טיוטה לחודש הזה, או שלא הוגדר לקוח ריטיינר." }); onChange();
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

  const togglePick = (key: string) => setPicked((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const target = (r: DocRow) => (r.source === "ledger" ? { document_id: r.id } : { archive_id: r.id });
  const subj = (r: DocRow) => ({ doc_type: r.docType, doc_number: r.number });
  const name = (r: DocRow) => `${r.typeLabel} ${r.number ?? ""}`.trim();
  /** Bulk send, one mail per document, with the default text. Each document goes through the same server checks as a single send. */
  async function bulkSend(toCustomers: boolean) {
    const list = rows.filter((r) => picked.has(r.key) && r.sendable);
    if (!list.length) return;
    const whom = toCustomers ? "ללקוחות שלהם" : "אליכם";
    if (!window.confirm(`לשלוח ${list.length} מסמכים ${whom} בדוא"ל, עם נוסח ברירת המחדל?`)) return;
    setBusy("bulk");
    let ok = 0; const failed: string[] = [];
    for (const r of list) {
      const res = await sendDocument({ ...target(r), include_customer: toCustomers, copy_to_me: !toCustomers, subject: defaultSubject(subj(r)), body: defaultBody(subj(r)) });
      if (res.ok) ok += 1; else failed.push(`${name(r)}: ${sendDocumentError(res)}`);
    }
    setBusy(null); setPicked(new Set()); onChange();
    setNote({ ok: failed.length === 0, text: `נשלחו ${ok} מתוך ${list.length}.${failed.length ? ` לא נשלחו: ${failed.join(" | ")}` : ""}` });
  }

  function openPanel(r: DocRow) { setSendFor(r.key); window.scrollTo({ top: 0, behavior: "smooth" }); }
  /** The document's link: stored on a ledger document, asked of the history system for an archive document. Null with the reason shown. */
  async function linkOf(r: DocRow): Promise<string | null> {
    if (r.pdfUrl) return r.pdfUrl;
    if (r.source !== "archive") { setNote({ ok: false, text: `${name(r)}: למסמך אין עדיין קישור.` }); return null; }
    setBusy(`link:${r.key}`);
    const res = await archivePdfLink(r.id);
    setBusy(null);
    if (res.ok) return res.url;
    setNote({ ok: false, text: `${name(r)}: ${res.text}` });
    return null;
  }
  async function viewRow(r: DocRow) {
    setNote(null);
    const u = await linkOf(r);
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  }
  /** One click: the default text to the customer's card address, with a copy to the partner. Without an address, or for a test
   *  document, the full send window opens instead, where an address can be typed. */
  async function mailRow(r: DocRow) {
    setNote(null);
    if (r.isTest || !r.customer?.email) {
      openPanel(r);
      if (!r.isTest) setNote({ ok: false, text: `${name(r)}: אין בכרטיס הלקוח כתובת דוא"ל. הזינו כתובת בחלון השליחה, או עדכנו את כרטיס הלקוח.` });
      return;
    }
    if (!window.confirm(`לשלוח את ${name(r)} ללקוח ${who(r)} בדוא"ל, עם עותק אליכם?`)) return;
    setBusy(`mail:${r.key}`);
    const res = await sendDocument({ ...target(r), include_customer: true, copy_to_me: true, subject: defaultSubject(subj(r)), body: defaultBody(subj(r)) });
    setBusy(null); onChange();
    setNote(res.ok ? { ok: true, text: `${name(r)} נשלח ללקוח${res.attached ? " עם קובץ PDF מצורף" : ", עם קישור למסמך"}, ועותק אליכם.${res.warning ? " יומן השליחות לא עודכן במלואו." : ""}` } : { ok: false, text: sendDocumentError(res) });
  }
  /** Opens WhatsApp with the message ready. The sending itself happens there, so the log records the opening. */
  async function whatsappRow(r: DocRow) {
    setNote(null);
    const u = await linkOf(r);
    if (!u) return;
    const text = waText(subj(r), u);
    window.open(whatsappUrl(r.customer?.phone, text), "_blank", "noopener,noreferrer");
    const mobile = waNumber(r.customer?.phone);
    const ok = await logWhatsappSend({ kind: r.source === "ledger" ? "document" : "archive", id: r.id }, mobile ? `+${mobile}` : "", text);
    setNote({ ok, text: ok ? `WhatsApp נפתח עם ההודעה על ${name(r)}${mobile ? "" : ". אין בכרטיס נייד תקין, בחרו איש קשר"}.` : "WhatsApp נפתח, אך הרישום ביומן השליחות נכשל." });
    onChange();
  }

  const filtered = rows.filter((r) => typeMatches(r, typeFilter) && rowMatches(r, q, cn.revealed, who(r)));
  const shown = filtered.slice(0, limit);
  const pickable = shown.filter((r) => r.sendable);
  const allPicked = pickable.length > 0 && pickable.every((r) => picked.has(r.key));
  // A sum is only meaningful within one kind of document: an invoice and the receipt for it would count the same money twice.
  const oneKind = typeFilter !== "";
  const sign = (r: DocRow) => (r.docType === "CREDIT" ? -1 : 1);
  const sumNet = filtered.reduce((t, r) => t + sign(r) * (r.docType === "RECEIPT" ? 0 : r.subtotal), 0);
  const sumTotal = filtered.reduce((t, r) => t + sign(r) * r.total, 0);
  const panelRow = sendFor ? rowByKey.get(sendFor) : undefined;
  const receiptMode = ed?.doc_type === "RECEIPT";

  return (
    <div className="ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="doc-tools">
          <select className="ck-select" aria-label="סינון לפי סוג" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setLimit(PAGE); }} style={{ maxWidth: 220 }}>
            <option value="">כל המסמכים</option><option value="OPEN_PROFORMA">חשבונות עסקה פתוחים</option>{Object.entries(DOC_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="ck-input" type="search" aria-label="חיפוש מסמך" placeholder={cn.revealed ? "מספר מסמך, הקצאה, לקוח או נושא" : "מספר מסמך או מספר הקצאה"} value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        </div>
        <div className="ck-row">
          {level >= 3 && <button className="ck-btn" disabled={busy !== null} title="קריאה בלבד: שואל את מערכת ההנפקה אם היא מקבלת את המפתח שבשרת. לא מפיק ולא שומר דבר." onClick={() => void checkConnection()}>{busy === "check" ? "בודק..." : "בדיקת חיבור למערכת ההנפקה"}</button>}
          <button className="ck-btn" disabled={busy !== null || !customers.some((c) => c.retainer_active)} title="יוצר טיוטות בלבד, ללא הפקה" onClick={() => void retainerDrafts()}>טיוטות ריטיינר לחודש הנוכחי</button>
          <button className="ck-btn primary" disabled={!customers.length} onClick={() => { setNote(null); setEd(blankEditor()); }}>מסמך חדש</button>
        </div>
      </div>
      {!customers.length && <div className="ck-warn">כדי להפיק מסמך יש להוסיף לקוח בלשונית "לקוחות".</div>}
      {note && <div className={note.ok ? "ck-ok" : "ck-err"} aria-live="polite">{note.text}</div>}
      {archive.length > 0 && (
        <div className="ck-meta">הרשימה כוללת גם את המסמכים שהופקו במערכת ההיסטוריה (<bdi>{archive.length}</bdi>). ייבוא, גיבוי ובדיקת רציפות המספור נמצאים בלשונית "ארכיון היסטוריה". <button className="ck-link" onClick={onOpenArchive}>מעבר לארכיון</button></div>
      )}

      {ed && totals && (
        <div className="ck-card ck-stack">
          <div className="ck-title">{ed.id ? "עריכת טיוטה" : "מסמך חדש"}</div>
          <div className="ck-grid2">
            <label className="ck-field">סוג מסמך<select className="ck-select" value={ed.doc_type} onChange={(e) => setType(e.target.value as DocType)}>{Object.entries(DOC_TYPE).filter(([k]) => !casual || CASUAL_TYPES.includes(k as DocType)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="ck-field">לקוח<select className="ck-select" value={ed.customer_id} onChange={(e) => pickCustomer(e.target.value)}><option value="">בחירה</option>{customers.filter((c) => !c.archived || c.id === ed.customer_id).map((c) => <option key={c.id} value={c.id}>{cn.revealed ? splitName(c.name).name : cn.customer(c)}{c.is_casual ? " (מזדמן)" : ""}</option>)}</select></label>
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
          <label className="ck-field">הערה פנימית (לא מודפסת ולא נשלחת)<textarea className="ck-input" rows={2} maxLength={5000} value={ed.internal_note} onChange={(e) => setEd({ ...ed, internal_note: e.target.value })} /></label>
          <label className="ck-field">הפניה לתיק (אופציונלי, פנימי)<input className="ck-input" maxLength={100} value={ed.matter_ref} onChange={(e) => setEd({ ...ed, matter_ref: e.target.value })} /></label>
          <div className="ck-meta" data-testid="auto-send-note">בעת ההפקה המסמך נשלח ללקוח אוטומטית בדוא"ל, וגם ב-WhatsApp כשבכרטיס יש נייד תקין והסכמה רשומה. אין צורך לסמן דבר.</div>
          {edCustomer && !edCustomer.email && <div className="ck-warn">בכרטיס הלקוח אין כתובת דוא"ל, ולכן אי אפשר להפיק. הזינו כתובת בלשונית הלקוחות.</div>}
          <div className="ck-card">
            <div className="ck-row" style={{ justifyContent: "space-between" }}><span>לפני מע"מ</span><b>{money(totals.subtotal)}</b></div>
            {!receiptMode && <div className="ck-row" style={{ justifyContent: "space-between" }}><span>מע"מ</span><b>{money(totals.vat)}</b></div>}
            <div className="ck-row" style={{ justifyContent: "space-between" }}><span>סה"כ</span><b>{money(totals.total)}</b></div>
          </div>
          {problems.length > 0 && <div className="ck-warn">{problems.join(". ")}</div>}
          {ed.customer_id && !casual && !customers.find((c) => c.id === ed.customer_id)?.tax_id && <div className="ck-meta">ללקוח הזה אין ת.ז. או ח.פ. בכרטיס. אם הוא עוסק מורשה, מסמך מעל הסף ידרוש אותם לצורך מספר הקצאה.</div>}
          <div className="ck-row">
            <button className="ck-btn" disabled={busy !== null} onClick={() => void onSave()}>שמירה כטיוטה</button>
            <button className="ck-btn" disabled={busy !== null || problems.length > 0 || level < 3} title="שומר טיוטה ושולח אליכם סימולציה בדוא&quot;ל. לא מפיק, לא ממספר ולא פונה למערכת ההנפקה." onClick={() => void onSimulate()}>{busy === "sim" ? "שולח..." : "סימולציה אליי"}</button>
            <button className="ck-btn primary" disabled={busy !== null || problems.length > 0 || level < 3 || (!!edCustomer && !edCustomer.email)} title={level < 3 ? "הפקה דורשת הרשאת הפקה" : edCustomer && !edCustomer.email ? 'אין בכרטיס הלקוח כתובת דוא"ל' : undefined} onClick={() => void onIssue()}>{busy === "issue" ? "מפיק..." : "הפקה"}</button>
            <button className="ck-btn" onClick={() => { setAsk(null); setEd(null); }}>סגירה</button>
          </div>
          {ask && (
            <form className="ck-card mfa-box" onSubmit={(e) => void confirmIssue(e)}>
              <div className="ck-title">אישור הפקה</div>
              <div className="ck-meta" style={{ whiteSpace: "pre-line" }}>{ask.text}</div>
              {ask.factors.length > 1 && (
                <div className="ck-row" style={{ flexWrap: "wrap" }}>
                  {ask.factors.map((f) => (
                    <button type="button" key={f.id} className={"ck-btn" + (f.id === ask.factorId ? " primary" : "")} onClick={() => setAsk({ ...ask, factorId: f.id, err: null })}>{f.name}</button>
                  ))}
                </div>
              )}
              <label className="mfa-label" htmlFor="issue-code">קוד בן 6 ספרות מאפליקציית האימות</label>
              <input id="issue-code" className="field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" aria-label="קוד אימות" value={ask.code} onChange={(e) => setAsk({ ...ask, code: e.target.value.replace(/\D/g, ""), err: null })} />
              {ask.err && <div className="ck-err" aria-live="polite">{ask.err}</div>}
              <div className="ck-row">
                <button className="ck-btn primary" disabled={busy !== null || ask.code.length !== 6}>{busy === "issue" ? "מפיק..." : "אימות והפקה"}</button>
                <button type="button" className="ck-btn" autoFocus disabled={busy !== null} onClick={() => setAsk(null)}>ביטול</button>
              </div>
            </form>
          )}
        </div>
      )}

      {panelRow && (
        <DocSendPanel key={panelRow.key} target={{ kind: panelRow.source === "ledger" ? "document" : "archive", id: panelRow.id, docType: panelRow.docType, docNumber: panelRow.number, pdfUrl: panelRow.pdfUrl, isTest: panelRow.isTest }}
          customer={panelRow.customer} casualName={panelRow.casualName} sends={sends.filter((x) => (panelRow.source === "ledger" ? x.document_id : x.archive_id) === panelRow.id)}
          level={level} onClose={() => setSendFor(null)} onChange={onChange} />
      )}

      {picked.size > 0 && (
        <div className="ck-card ck-row" style={{ justifyContent: "space-between" }}>
          <span>נבחרו <bdi>{picked.size}</bdi> מסמכים</span>
          <div className="ck-row">
            <button className="ck-btn sm" disabled={busy !== null || level < 3} onClick={() => void bulkSend(true)}>שליחה ללקוחות</button>
            <button className="ck-btn sm" disabled={busy !== null || level < 3} onClick={() => void bulkSend(false)}>שליחה אליי</button>
            <button className="ck-btn sm" onClick={() => setPicked(new Set())}>ניקוי בחירה</button>
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

      <div className="ck-table-wrap"><table className="ck-table"><thead><tr>
        <th>{pickable.length ? <input type="checkbox" aria-label="בחירת כל המסמכים המוצגים" checked={allPicked} onChange={() => setPicked((p) => { const n = new Set(p); for (const r of pickable) { if (allPicked) n.delete(r.key); else n.add(r.key); } return n; })} /> : null}</th>
        <th>לקוח</th><th>סוג לקוח</th><th>מס'</th><th>סוג</th><th>תאריך</th><th>נושא</th><th className="fin-num">לפני מע"מ</th><th className="fin-num">סה"כ</th><th>הערה</th><th>מצב</th><th>פעולות</th>
      </tr></thead><tbody>
        {shown.length ? shown.map((r) => {
          const d = r.doc;
          const bal = d ? openBalance(d, docs, payments) : 0;
          const src = d?.related_doc_id ? docById.get(d.related_doc_id) : null;
          const mark = sentMark(r);
          const rowBusy = busy !== null && busy.endsWith(`:${r.key}`);
          return (
            <tr key={r.key}>
              <td>{r.sendable ? <input type="checkbox" aria-label={`בחירת ${name(r)}`} checked={picked.has(r.key)} onChange={() => togglePick(r.key)} /> : null}</td>
              <td className="fin-text"><span className="fin-name" title={who(r)}>{who(r)}</span></td>
              <td>{r.casual ? "מזדמן" : "קיים"}</td>
              <td>{r.number ?? ""}</td>
              <td>{r.typeLabel}{src ? <span className="doc-kind">מול <bdi>{src.doc_number}</bdi></span> : null}{r.source === "archive" ? <span className="doc-kind">מערכת ההיסטוריה</span> : null}</td>
              <td>{r.date}</td>
              <td className="fin-text"><span className="doc-subject" title={cn.text(r.subject)}>{cn.text(r.subject)}</span></td>
              <td className="fin-num">{r.docType === "RECEIPT" ? "" : r.docType === "CREDIT" ? `-${money(r.subtotal)}` : money(r.subtotal)}</td>
              <td className="fin-num">{r.docType === "CREDIT" ? `-${money(r.total)}` : money(r.total)}{d?.doc_type === "INVOICE" && d.status === "ISSUED" && bal > 0 ? <span className="doc-kind">יתרה <bdi>{money(bal)}</bdi></span> : null}</td>
              <td>
                {r.note && <span className={`ck-badge ${r.note.tone}`} title={r.note.title}>{r.note.text}</span>}
                {d?.source_proforma_id && <span className="doc-kind">נוצר מחשבון עסקה</span>}
                {d?.last_error && <div className="ck-meta" style={{ maxWidth: 260 }}>{d.last_error.slice(0, 120)}</div>}
              </td>
              <td><span className="doc-marks">
                {mark.ticks > 0 && <span className={`doc-mark${mark.bounced ? " bounced" : ""}`} title={mark.title} role="img" aria-label={mark.title}><DocIcon name={mark.ticks === 2 ? "checks" : "check"} /></span>}
                {mark.bounced && <span className="ck-badge red">חזר</span>}
                {r.allocation && <span className="doc-mark" title={`מספר הקצאה ${r.allocation}`} role="img" aria-label={`מספר הקצאה ${allocationShort(r.allocation)}`}><DocIcon name="hash" /></span>}
              </span></td>
              <td className="fin-actions-cell">
                {r.sendable && <div className="doc-icons">
                  <IconButton name="eye" label={`צפייה ב-${name(r)}`} busy={busy === `link:${r.key}`} disabled={busy !== null && !rowBusy} onClick={() => void viewRow(r)} />
                  <IconButton name="print" label={`הדפסת ${name(r)} (נפתח בלשונית חדשה, משם מדפיסים)`} disabled={busy !== null} onClick={() => void viewRow(r)} />
                  <IconButton name="mail" label={r.customer?.email && !r.isTest ? `שליחת ${name(r)} ללקוח בדוא"ל, עם עותק אליי` : `שליחת ${name(r)} בדוא"ל (אין כתובת בכרטיס: הזנה ידנית)`} busy={busy === `mail:${r.key}`} disabled={level < 3 || (busy !== null && !rowBusy)} onClick={() => void mailRow(r)} />
                  <IconButton name="whatsapp" tone="wa" label={`שליחת ${name(r)} ב-WhatsApp`} disabled={level < 3 || busy !== null} onClick={() => void whatsappRow(r)} />
                  <IconButton name="more" label={`כל אפשרויות השליחה של ${name(r)}: כתובות נוספות, עריכת הנוסח, העתקת קישור, יומן שליחות`} onClick={() => { setNote(null); openPanel(r); }} />
                </div>}
                {d && <div className={`fin-actions${r.sendable ? " doc-row-more" : ""}`}>
                  {d.status === "DRAFT" && !uncertain(d) && <><button className="ck-btn sm" onClick={() => editDraft(d)}>עריכה</button><button className="ck-btn sm danger" onClick={() => void removeDraft(d)}>מחיקה</button></>}
                  {uncertain(d) && <button className="ck-btn sm" disabled={busy === d.id} onClick={() => void reconcile(d)}>בדיקת סטטוס מול מערכת ההנפקה</button>}
                  {d.status === "ISSUED" && !d.allocation_number && d.doc_type !== "PROFORMA" && d.doc_type !== "RECEIPT" && <button className="ck-btn sm" disabled={busy === d.id} onClick={() => void reconcile(d)}>רענון מספר הקצאה</button>}
                  {d.doc_type === "INVOICE" && d.status === "ISSUED" && bal > 0 && <>
                    <button className="ck-btn sm" onClick={() => receiptFor(d)}>הפקת קבלה</button>
                    <button className="ck-btn sm" onClick={() => setPay({ doc: d, amount: String(bal), date: today(), method: "TRANSFER" })}>רישום תשלום</button></>}
                  {isOpenProforma(d, docs) && <>
                    <button className="ck-btn sm" onClick={() => convertProforma(d, "INVOICE")}>המרה לחשבונית מס</button>
                    <button className="ck-btn sm" onClick={() => convertProforma(d, "INVOICE_RECEIPT")}>המרה לחשבונית מס קבלה</button></>}
                  {(d.doc_type === "INVOICE" || d.doc_type === "INVOICE_RECEIPT" || d.doc_type === "PROFORMA") && <button className="ck-btn sm" onClick={() => duplicateDoc(d)}>שכפול</button>}
                  {(d.doc_type === "INVOICE" || d.doc_type === "INVOICE_RECEIPT") && d.status === "ISSUED" && <button className="ck-btn sm" onClick={() => creditFor(d)}>זיכוי</button>}
                </div>}
              </td>
            </tr>);
        }) : <tr><td colSpan={12}>{rows.length ? "אין מסמכים שמתאימים לסינון" : "אין מסמכים עדיין"}</td></tr>}
      </tbody>
      {oneKind && filtered.length > 0 && (
        <tfoot><tr><td colSpan={7}>סה"כ <bdi>{filtered.length}</bdi> מסמכים בסינון</td><td className="fin-num">{money(sumNet)}</td><td className="fin-num">{money(sumTotal)}</td><td colSpan={3}></td></tr></tfoot>
      )}
      </table></div>
      {filtered.length > shown.length && (
        <div className="ck-row"><span className="ck-meta">מוצגים <bdi>{shown.length}</bdi> מתוך <bdi>{filtered.length}</bdi>.</span><button className="ck-btn" onClick={() => setLimit((n) => n + PAGE)}>הצגת עוד {Math.min(PAGE, filtered.length - shown.length)}</button></div>
      )}
      <div className="ck-meta">✓ נשלח מהמערכת. ✓✓ נפתח אצל הלקוח: לפי מעקב הפתיחה שלנו, או לפי מערכת ההיסטוריה. היעדר סימון אינו אומר שלא נשלח: שליחות שנעשו במערכת ההיסטוריה עצמה אינן ביומן שלנו. # ירוק: יש מספר הקצאה (המספר המלא בריחוף).</div>
    </div>
  );
}
