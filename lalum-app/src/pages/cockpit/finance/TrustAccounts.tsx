import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { maskAccount, trustAccountProblems, trustCloseProblem, trustHeld } from "../../../lib/cockpit/finance";
import type { TrustAccount, TrustTx } from "../../../lib/cockpit/finance";

type Draft = { bank_name: string; branch: string; account_number: string };
const blank = (): Draft => ({ bank_name: "", branch: "", account_number: "" });

/** Setup of the firm's client trust bank accounts. Accounts are never deleted: a closed account stays so its history keeps a home. */
export function TrustAccounts({ firmId, accounts, rows, onChange }: { firmId: string; accounts: TrustAccount[]; rows: TrustTx[]; onChange: () => void }) {
  const [f, setF] = useState<Draft | null>(null);
  // Id of the account being edited; null while adding a new one.
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => f && setF({ ...f, [k]: e.target.value });

  function startEdit(a: TrustAccount) { setEditId(a.id); setF({ bank_name: a.bank_name, branch: a.branch, account_number: a.account_number }); setMsg(""); }
  function cancel() { setF(null); setEditId(null); }

  async function save() {
    if (!supabase || !f || busy) return;
    const problems = trustAccountProblems(f, accounts, editId ?? undefined);
    if (problems.length) return setMsg(problems.join(". ") + ".");
    const row = { bank_name: f.bank_name.trim(), branch: f.branch.trim(), account_number: f.account_number.trim() };
    if (editId) {
      const cur = accounts.find((a) => a.id === editId);
      if (cur && cur.bank_name === row.bank_name && cur.branch === row.branch && cur.account_number === row.account_number) return setMsg("לא בוצע שינוי.");
      const used = rows.some((t) => t.trust_account_id === editId);
      if (!window.confirm(`לעדכן את פרטי חשבון הנאמנות?${used ? "\nבחשבון כבר יש תנועות. תקנו רק טעות הקלדה: חשבון בנק אחר דורש חשבון חדש, כדי שההיסטוריה תישאר מדויקת." : ""}\nהשינוי נרשם ביומן הביקורת.`)) return;
    }
    setBusy(true);
    const { error } = editId
      ? await supabase.from("lalum_trust_accounts").update(row).eq("id", editId)
      : await supabase.from("lalum_trust_accounts").insert({ firm_id: firmId, ...row });
    setBusy(false);
    if (error) return setMsg(error.message.includes("duplicate") ? "החשבון כבר קיים." : "השמירה נכשלה. ודאו שיש לכם הרשאת מנהל בהנהלת חשבונות.");
    setF(null); setEditId(null); setMsg(""); onChange();
  }

  async function close(a: TrustAccount) {
    if (!supabase || busy) return;
    const blocked = trustCloseProblem(a.id, rows);
    if (blocked) return setMsg(blocked);
    if (!window.confirm(`לסגור את חשבון הנאמנות ${a.bank_name} ${a.branch} ${maskAccount(a.account_number)}?\\nלא יהיה אפשר לרשום בו תנועות חדשות. ההיסטוריה נשמרת.`)) return;
    setBusy(true);
    const { error } = await supabase.from("lalum_trust_accounts").update({ closed_on: new Date().toISOString().slice(0, 10) }).eq("id", a.id);
    setBusy(false);
    if (error) return setMsg("הסגירה נכשלה. ודאו שיש לכם הרשאת מנהל בהנהלת חשבונות.");
    setMsg(""); onChange();
  }

  return (
    <div className="ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-title">חשבונות נאמנות</div>
        <button className="ck-btn" onClick={() => { setEditId(null); setF(blank()); setMsg(""); }}>חשבון חדש</button>
      </div>
      {f && (
        <div className="ck-card ck-stack">
          <div className="ck-meta">{editId ? "עריכת פרטי החשבון. סגירה וקביעת תאריך פתיחה אינן חלק מהעריכה." : "חשבון בנק ייעודי לכספי לקוחות, נפרד מחשבון המשרד. מספר החשבון נשמר מלא ומוצג בהסתרה."}</div>
          <div className="ck-grid2">
            <label className="ck-field">בנק<input className="ck-input" value={f.bank_name} onChange={set("bank_name")} /></label>
            <label className="ck-field">סניף<input className="ck-input" dir="ltr" inputMode="numeric" value={f.branch} onChange={set("branch")} /></label>
            <label className="ck-field">מספר חשבון<input className="ck-input" dir="ltr" inputMode="numeric" value={f.account_number} onChange={set("account_number")} /></label>
          </div>
          <div className="ck-row"><button className="ck-btn primary" disabled={busy} onClick={() => void save()}>{editId ? "עדכון" : "שמירה"}</button><button className="ck-btn" onClick={cancel}>ביטול</button></div>
        </div>
      )}
      {msg && <div className="ck-err" aria-live="polite">{msg}</div>}
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>בנק</th><th>סניף</th><th>חשבון</th><th>נפתח</th><th className="fin-num">יתרה בספר</th><th></th></tr></thead><tbody>
        {accounts.length ? accounts.map((a) => (
          <tr key={a.id}><td>{a.bank_name}</td><td className="fin-ltr">{a.branch}</td><td className="fin-ltr">{maskAccount(a.account_number)}</td>
            <td>{a.closed_on ? `נסגר ${a.closed_on}` : "פעיל"}</td><td className="fin-num">{money(trustHeld(rows, { account: a.id }))}</td>
            <td className="fin-actions-cell">{!a.closed_on && <div className="fin-actions"><button className="ck-btn sm" disabled={busy} onClick={() => startEdit(a)}>עריכה</button><button className="ck-btn sm danger" disabled={busy} onClick={() => void close(a)}>סגירה</button></div>}</td></tr>)) : <tr><td colSpan={6}>לא הוגדר חשבון נאמנות</td></tr>}
      </tbody></table></div>
    </div>
  );
}
