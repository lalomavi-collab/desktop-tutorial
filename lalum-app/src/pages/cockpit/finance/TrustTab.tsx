import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { TrustAccounts } from "./TrustAccounts";
import { TrustRecon } from "./TrustRecon";
import { TrustHealth } from "./TrustHealth";
import { trustError } from "../../../lib/cockpit/financeApi";
import { TRUST_POST_TYPES, TRUST_TX, canReverse, maskAccount, openBalance, trustBreakdown, sharePct, trustHeld, trustNetSince, trustPostProblems, trustValueDate, valueDateProblems } from "../../../lib/cockpit/finance";
import type { FinCustomer, FinDocument, FinPayment, TrustAccount, TrustPostType, TrustTx } from "../../../lib/cockpit/finance";

/** Today in Israel as an ISO date; the database counts value dates on the Israel calendar. */
const today = (): string => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

/** A matter with the finance customer it is billed to. Only matters with a customer can hold trust money. */
export interface MatterRef { id: string; title: string; customer_id: string | null }
type Draft = { matter_id: string; account_id: string; type: TrustPostType; amount: string; value_date: string; counterparty: string; notes: string; doc_id: string };
const blank = (accountId: string): Draft => ({ matter_id: "", account_id: accountId, type: "DEPOSIT", amount: "", value_date: today(), counterparty: "", notes: "", doc_id: "" });

/** Read side of the trust ledger. Posting goes through the lalum_trust_post RPC, which enforces zero overdraft. */
export function TrustTab({ firmId, customers, statementAccounts, matters, accounts, rows, docs, payments, onChange }: {
  firmId: string; customers: FinCustomer[]; matters: MatterRef[]; accounts: TrustAccount[]; rows: TrustTx[]; statementAccounts: string[]; docs: FinDocument[]; payments: FinPayment[]; onChange: () => void;
}) {
  const openAccounts = accounts.filter((a) => !a.closed_on);
  const [f, setF] = useState<Draft | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const billable = matters.filter((m) => m.customer_id);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => f && setF({ ...f, [k]: e.target.value });
  const matterCustomer = (id: string) => matters.find((m) => m.id === id)?.customer_id ?? null;
  // Open amount of an invoice as the database computes it: payments, receipts and credits, and earlier trust transfers.
  const docOpen = (d: FinDocument) => openBalance(d, docs, payments) + rows.filter((t) => t.reference_doc_id === d.id && (t.tx_type === "EARNED_FEE_TRANSFER" || t.tx_type === "REVERSAL")).reduce((a, t) => a + t.amount, 0);
  const invoicesFor = (matterId: string) => docs
    .filter((d) => d.customer_id === matterCustomer(matterId) && d.doc_type === "INVOICE" && d.status === "ISSUED" && !d.is_test)
    .map((d) => ({ d, open: docOpen(d) })).filter((x) => x.open > 0);

  async function save() {
    if (!supabase || !f || busy) return;
    const amount = Number(f.amount);
    const doc = f.type === "EARNED_FEE_TRANSFER" ? invoicesFor(f.matter_id).find((x) => x.d.id === f.doc_id) : undefined;
    const problems = trustPostProblems({ matter_id: f.matter_id, account_id: f.account_id, type: f.type, amount, doc_open: doc?.open ?? null, doc_id: f.doc_id || null }, rows);
    problems.push(...valueDateProblems(f.value_date, today(), accounts.find((a) => a.id === f.account_id)?.opened_on));
    if (problems.length) return setMsg(problems.join(". ") + ".");
    const label = `${TRUST_TX[f.type]} על סך ${money(amount)} בתיק ${matters.find((m) => m.id === f.matter_id)?.title ?? ""}`;
    if (!window.confirm(`לרשום ${label}?\nהרישום סופי: אי אפשר למחוק או לערוך אותו, רק לתקן בתנועת תיקון.`)) return;
    // Sent only when it differs from today, so a recording made today works even before migration 0033 is applied.
    const vd = f.value_date && f.value_date !== today() ? { p_value_date: f.value_date } : {};
    setBusy(true);
    const { error } = f.type === "EARNED_FEE_TRANSFER"
      ? await supabase.rpc("lalum_trust_apply_to_invoice", { p_matter: f.matter_id, p_account: f.account_id, p_doc: f.doc_id, p_amount: amount, ...vd })
      : await supabase.rpc("lalum_trust_post", { p_matter: f.matter_id, p_account: f.account_id, p_type: f.type, p_amount: amount, p_counterparty: f.counterparty.trim() || null, p_notes: f.notes.trim() || null, p_reverses: null, ...vd });
    setBusy(false);
    if (error) return setMsg(trustError(error.message));
    setF(null); setMsg(""); onChange();
  }

  async function reverse(t: TrustTx) {
    if (!supabase || busy) return;
    if (!window.confirm(`לתקן את התנועה ${t.receipt_no} (${TRUST_TX[t.tx_type]}, ${money(t.amount)}) בתנועת תיקון?\nהתנועה המקורית נשארת ברישום.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("lalum_trust_post", { p_matter: t.matter_id, p_account: t.trust_account_id, p_type: "REVERSAL", p_amount: 0, p_counterparty: null, p_notes: `תיקון לתנועה ${t.receipt_no}`, p_reverses: t.id });
    setBusy(false);
    if (error) return setMsg(trustError(error.message));
    setMsg(""); onChange();
  }

  const [since] = useState(() => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const cust = (id: string) => customers.find((c) => c.id === id)?.name ?? "";
  const matter = (id: string) => matters.find((m) => m.id === id)?.title ?? "";
  const byCustomer = trustBreakdown(rows, "customer_id");
  const byMatter = trustBreakdown(rows, "matter_id");
  const held = trustHeld(rows);
  const net30 = trustNetSince(rows, since);
  const share = (b: number) => { const p = sharePct(b, held); return <span className="fin-share"><span className="fin-bar" aria-hidden="true"><i style={{ width: `${p}%` }} /></span><span className="fin-pct">{p}%</span></span>; };

  return (
    <div className="ck-stack">
      <div className="ck-card fin-stat fin-trust">
        <div className="ck-meta">סה"כ כספי נאמנות מוחזקים</div>
        <div className="fin-figure">{money(held)}</div>
        <div className="fin-delta" data-dir={net30 > 0 ? "up" : net30 < 0 ? "down" : "flat"}>
          <span aria-hidden="true">{net30 > 0 ? "▲" : net30 < 0 ? "▼" : "■"}</span>{" "}
          {net30 === 0 ? "ללא שינוי ב-30 הימים האחרונים" : `${net30 > 0 ? "עלייה" : "ירידה"} של ${money(Math.abs(net30))} ב-30 הימים האחרונים`}
        </div>
        <div className="fin-note">כספי לקוחות. אינם הכנסת המשרד ואינם נכללים בסקירה, בדוח ההכנסות ובמע"מ. הרישום רק מוסיף שורות: טעות מתוקנת בתנועת תיקון.</div>
      </div>

      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-meta">הרישום סופי. העברת שכר טרחה למשרד אפשרית רק כנגד חשבונית מס שהופקה, וההכנסה מוכרת בחשבונית. המערכת דוחה תנועה שמורידה יתרה מתחת לאפס.</div>
        <button className="ck-btn primary" disabled={!openAccounts.length || !billable.length} onClick={() => { setF(blank(openAccounts[0]?.id ?? "")); setMsg(""); }}>תנועה חדשה</button>
      </div>
      {!openAccounts.length && <div className="ck-warn">לא הוגדר חשבון נאמנות פעיל. אי אפשר לרשום תנועה לפני שמגדירים חשבון.</div>}
      {openAccounts.length > 0 && !billable.length && <div className="ck-warn">אין תיק שמקושר ללקוח בכרטיס הכספי. קשרו לקוח לתיק כדי לרשום תנועה.</div>}
      {f && (
        <div className="ck-card ck-stack">
          <div className="ck-title">תנועת נאמנות חדשה</div>
          <div className="ck-grid2">
            <label className="ck-field">תיק<select className="ck-select" value={f.matter_id} onChange={(e) => setF({ ...f, matter_id: e.target.value, doc_id: "" })}><option value="">בחרו תיק</option>{billable.map((m) => <option key={m.id} value={m.id}>{m.title} · {cust(m.customer_id as string)}</option>)}</select></label>
            <label className="ck-field">חשבון נאמנות<select className="ck-select" value={f.account_id} onChange={set("account_id")}>{openAccounts.map((a) => <option key={a.id} value={a.id}>{a.bank_name} {a.branch} {maskAccount(a.account_number)}</option>)}</select></label>
            <label className="ck-field">סוג תנועה<select className="ck-select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as TrustPostType, doc_id: "" })}>{TRUST_POST_TYPES.map((k) => <option key={k} value={k}>{TRUST_TX[k]}</option>)}</select></label>
            <label className="ck-field">סכום<input className="ck-input" dir="ltr" inputMode="decimal" value={f.amount} onChange={set("amount")} /></label>
            <label className="ck-field">תאריך ערך<input className="ck-input" type="date" max={today()} min={accounts.find((a) => a.id === f.account_id)?.opened_on ?? undefined} value={f.value_date} onChange={set("value_date")} /></label>
            {f.type === "EARNED_FEE_TRANSFER" ? (
              <label className="ck-field">חשבונית מס לתשלום<select className="ck-select" value={f.doc_id} onChange={set("doc_id")}><option value="">בחרו חשבונית</option>{invoicesFor(f.matter_id).map(({ d, open }) => <option key={d.id} value={d.id}>{d.doc_number} · פתוח {money(open)}</option>)}</select></label>
            ) : (
              <label className="ck-field">{f.type === "DEPOSIT" ? "מקור הכסף" : "מוטב"}<input className="ck-input" value={f.counterparty} onChange={set("counterparty")} /></label>
            )}
          </div>
          {f.matter_id && <div className="ck-meta">יתרה מוחזקת בתיק: <bdi>{money(trustHeld(rows, { matter: f.matter_id }))}</bdi></div>}
          {f.type !== "EARNED_FEE_TRANSFER" && <label className="ck-field">הערה<input className="ck-input" value={f.notes} onChange={set("notes")} /></label>}
          {msg && <div className="ck-err" aria-live="polite">{msg}</div>}
          <div className="ck-row"><button className="ck-btn primary" disabled={busy} onClick={() => void save()}>רישום</button><button className="ck-btn" onClick={() => setF(null)}>ביטול</button></div>
        </div>
      )}
      {!f && msg && <div className="ck-err" aria-live="polite">{msg}</div>}

      <TrustAccounts firmId={firmId} accounts={accounts} rows={rows} statementAccounts={statementAccounts} onChange={onChange} />
      <TrustRecon firmId={firmId} accounts={accounts} onChange={onChange} />
      <TrustHealth accounts={accounts} matters={matters} rows={rows} statementAccounts={statementAccounts} />

      <div className="ck-grid2">
        <div className="ck-stack">
          <div className="ck-title">יתרה לפי לקוח</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>לקוח</th><th>חלק מהכלל</th><th className="fin-num">יתרה</th></tr></thead><tbody>
            {byCustomer.length ? byCustomer.map((r) => <tr key={r.id}><td className="fin-text">{cust(r.id)}</td><td>{share(r.balance)}</td><td className="fin-num">{money(r.balance)}</td></tr>) : <tr><td colSpan={3}>אין יתרות</td></tr>}
          </tbody></table></div>
        </div>
        <div className="ck-stack">
          <div className="ck-title">יתרה לפי תיק</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תיק</th><th>חלק מהכלל</th><th className="fin-num">יתרה</th></tr></thead><tbody>
            {byMatter.length ? byMatter.map((r) => <tr key={r.id}><td className="fin-text">{matter(r.id)}</td><td>{share(r.balance)}</td><td className="fin-num">{money(r.balance)}</td></tr>) : <tr><td colSpan={3}>אין יתרות</td></tr>}
          </tbody></table></div>
        </div>
      </div>

      <div className="ck-title">תנועות</div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>נרשם</th><th>תאריך ערך</th><th>קבלה</th><th>לקוח</th><th>תיק</th><th>סוג</th><th className="fin-num">סכום</th><th></th></tr></thead><tbody>
        {rows.length ? rows.map((t) => (
          <tr key={t.id}><td>{t.created_at.slice(0, 10)}</td><td>{trustValueDate(t)}</td><td className="fin-ltr">{t.receipt_no}</td><td className="fin-text">{cust(t.customer_id)}{t.notes ? <div className="ck-meta">{t.notes}</div> : null}</td>
            <td className="fin-text">{matter(t.matter_id)}</td>
            <td><span className={`ck-badge ${t.amount > 0 ? "trust" : "outflow"}`}>{TRUST_TX[t.tx_type]}</span></td>
            <td className="fin-num">{money(t.amount)}</td>
            <td className="fin-actions-cell">{canReverse(t, rows) && <div className="fin-actions"><button className="ck-btn sm" disabled={busy} onClick={() => void reverse(t)}>תיקון</button></div>}</td></tr>)) : <tr><td colSpan={8}>אין תנועות עדיין</td></tr>}
      </tbody></table></div>
    </div>
  );
}
