import { useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Icon } from "../../../components/Icon";
import { money } from "../../../lib/cockpit/shared";
import type { FinExpense, FinExpenseDoc } from "../../../lib/cockpit/finance";
import { scanReceipt, scanReceiptError, uploadExpenseDoc, expenseDocError } from "../../../lib/cockpit/financeApi";
import { decideIntake, pickList, correctedNote, REVIEW_TEXT } from "../../../lib/cockpit/expenseIntake";
import type { IntakeDraft } from "../../../lib/cockpit/expenseIntake";
import { TAX_CATEGORY } from "../../../lib/cockpit/taxEngine";
import type { TaxCategory } from "../../../lib/cockpit/taxEngine";

const today = () => new Date().toISOString().slice(0, 10);
const dmy = (d: string) => d.split("-").reverse().join(".");
type Item = { key: string; name: string; kind: "reading" | "ok" | "warn" | "review" | "err"; text: string; draft?: IntakeDraft; file?: File; options?: FinExpense[]; pick?: string; busy?: boolean };

// Several invoices at once, each one read, then attached to its expense, booked as a new one, or left here for a person
// (rules in lib/cockpit/expenseIntake.ts). Files go one after another: a second copy of the same invoice in the batch then
// finds the row the first one created instead of booking it twice.
export function ExpenseIntake({ firmId, expenses, docs, onDone, onFillForm }: {
  firmId: string; expenses: FinExpense[]; docs: FinExpenseDoc[]; onDone: () => void;
  onFillForm: (draft: IntakeDraft, file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const patch = (key: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const label = (e: FinExpense) => `${e.supplier}, ${dmy(e.spent_on)}, ${money(e.total)}`;

  async function run(files: File[]) {
    if (!supabase || !files.length) return;
    const db = supabase;
    setRunning(true);
    const batch = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, kind: "reading" as const, text: "קוראים…" }));
    setItems(batch);
    const rows = [...expenses];
    const docsOf = new Map<string, FinExpenseDoc[]>();
    for (const d of docs) docsOf.set(d.expense_id, [...(docsOf.get(d.expense_id) ?? []), d]);
    let changed = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i], key = batch[i].key;
      const s = await scanReceipt(firmId, file);
      if (!s.ok || !s.draft) { patch(key, { kind: "err", text: scanReceiptError(s) }); continue; }
      const draft = s.draft as IntakeDraft;
      const dec = decideIntake(draft, s.low_confidence_fields ?? [], rows, docsOf, today());
      if (dec.kind === "review") {
        patch(key, { kind: "review", text: REVIEW_TEXT[dec.reason], draft, file, options: pickList(draft, dec.candidates, rows) });
        continue;
      }
      if (dec.kind === "attach") {
        const e = rows.find((x) => x.id === dec.expenseId) as FinExpense;
        const r = await uploadExpenseDoc(e.id, file, dec.supersedes ?? undefined);
        if (!r.ok) { patch(key, { kind: "err", text: `${expenseDocError(r)} (${label(e)})` }); continue; }
        changed = true;
        if (r.id && !r.duplicate) docsOf.set(e.id, [...(docsOf.get(e.id) ?? []).map((d) => (d.id === dec.supersedes ? { ...d, superseded_at: new Date().toISOString() } : d)), { id: r.id, expense_id: e.id, sha256: r.sha256 ?? "", mime: file.type, size_bytes: file.size, uploaded_at: new Date().toISOString(), superseded_at: null }]);
        let note = "";
        if (dec.corrected && !r.duplicate) {
          const description = `${e.description ?? ""}${correctedNote(today())}`;
          const { error } = await db.from("lalum_fin_expenses").update({ description }).eq("id", e.id);
          note = error ? " ההערה על החשבונית המתוקנת לא נשמרה." : " סומן שהתקבלה חשבונית מתוקנת.";
        }
        patch(key, { kind: "ok", text: r.duplicate ? `הקובץ כבר מצורף להוצאה ${label(e)}.` : `צורף להוצאה ${label(e)}${dec.supersedes ? ", במקום המסמך הקודם, שנשמר כגרסה קודמת" : ""}.${note}` });
        continue;
      }
      const row = dec.row;
      const { data, error } = await db.from("lalum_fin_expenses").insert({ firm_id: firmId, ...row, payment_method: null }).select("id").single();
      if (error || !data) { patch(key, { kind: "err", text: `ההוצאה לא נרשמה: ${error?.message ?? "שגיאה"}` }); continue; }
      changed = true;
      const id = (data as { id: string }).id;
      rows.push({ id, ...row, payment_method: null });
      const cls = TAX_CATEGORY[row.tax_category as TaxCategory]?.label ?? row.tax_category;
      const what = `נרשמה הוצאה חדשה: ${row.supplier}, ${dmy(row.spent_on)}, ${money(row.total)}. ${cls}, מס הכנסה ${row.income_tax_recognition_pct}%, מע"מ ${row.vat_recoverable_pct}%${dec.learnedFrom ? " (כמו ההוצאה הקודמת של הספק)" : ""}.`;
      const up = await uploadExpenseDoc(id, file);
      patch(key, up.ok ? { kind: "ok", text: what } : { kind: "warn", text: `${what} הקובץ לא צורף (${expenseDocError(up)}). אפשר לצרף אותו בשורה של ההוצאה.` });
    }
    setRunning(false);
    if (changed) onDone();
  }

  async function attachPicked(it: Item) {
    if (!it.file || !it.pick) return;
    patch(it.key, { busy: true });
    const r = await uploadExpenseDoc(it.pick, it.file);
    const e = expenses.find((x) => x.id === it.pick);
    if (!r.ok) { patch(it.key, { busy: false, text: `${expenseDocError(r)} ${REVIEW_TEXT.unsure}` }); return; }
    patch(it.key, { busy: false, kind: "ok", text: r.duplicate ? "הקובץ כבר היה מצורף להוצאה שנבחרה." : `צורף להוצאה ${e ? label(e) : "שנבחרה"}.`, options: undefined });
    onDone();
  }

  return (
    <>
      <input ref={ref} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }}
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; void run(fs); }} />
      <button className="ck-btn primary" disabled={running} onClick={() => ref.current?.click()} title="קבצי PDF או תמונות. כל חשבונית נקראת, מצורפת להוצאה שלה או נרשמת כהוצאה חדשה.">
        <Icon name="file" size={16} /> {running ? "קולטים חשבוניות…" : "העלאת חשבוניות"}
      </button>
      {items.length > 0 && (
        <div className="ck-card ck-stack" style={{ flexBasis: "100%" }} aria-live="polite">
          <div className="ck-row" style={{ justifyContent: "space-between" }}>
            <div className="ck-title">קליטת חשבוניות</div>
            {!running && <button className="ck-btn sm" onClick={() => setItems([])}>סגירה</button>}
          </div>
          {items.map((it) => (
            <div key={it.key} className="ck-stack" style={{ gap: 6 }}>
              <div className={it.kind === "ok" ? "ck-ok" : it.kind === "warn" || it.kind === "review" ? "ck-warn" : it.kind === "err" ? "ck-err" : "ck-meta"}>
                <strong dir="auto">{it.name}</strong>: {it.text}
              </div>
              {it.kind === "review" && it.file && (
                <div className="ck-row">
                  {it.draft && <span className="ck-meta">נקרא: {it.draft.supplier ?? "ספק לא ידוע"}, {it.draft.spent_on ? dmy(it.draft.spent_on) : "בלי תאריך"}, {money(it.draft.total)}</span>}
                  {it.options && it.options.length > 0 && (
                    <select className="ck-select" value={it.pick ?? ""} onChange={(e) => patch(it.key, { pick: e.target.value })} aria-label="בחירת ההוצאה שהחשבונית שייכת לה">
                      <option value="">לצרף להוצאה קיימת…</option>
                      {it.options.map((e) => <option key={e.id} value={e.id}>{label(e)}</option>)}
                    </select>
                  )}
                  <button className="ck-btn sm" disabled={!it.pick || it.busy} onClick={() => void attachPicked(it)}>{it.busy ? "…" : "צירוף"}</button>
                  {it.draft && <button className="ck-btn sm" onClick={() => onFillForm(it.draft as IntakeDraft, it.file as File)}>רישום כהוצאה חדשה בטופס</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
