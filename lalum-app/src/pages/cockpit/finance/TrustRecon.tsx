import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { money } from "../../../lib/cockpit/shared";
import { trustError } from "../../../lib/cockpit/financeApi";
import { maskAccount, reconState, statementCorrectionProblems, statementProblems } from "../../../lib/cockpit/finance";
import type { TrustAccount, TrustRecon, TrustStatement } from "../../../lib/cockpit/finance";

const today = () => new Date().toISOString().slice(0, 10);
type Draft = { account_id: string; as_of: string; balance: string };
const STATE: Record<string, [string, string]> = { MATCHED: ["מותאם", "trust"], DIFFERENT: ["פער לבירור", "outflow"], NO_STATEMENT: ["אין דף בנק", ""] };

/**
 * Ledger against the bank statement, per account. The comparison is computed by lalum_trust_reconciliation (and each run is
 * written to the audit log), so it runs on request, not on every load. Statements are append only: a wrong figure is
 * answered with a new statement on another date, not an edit.
 */
export function TrustRecon({ firmId, accounts, onChange }: { firmId: string; accounts: TrustAccount[]; onChange: () => void }) {
  const [rows, setRows] = useState<TrustRecon[] | null>(null);
  const [stmts, setStmts] = useState<TrustStatement[]>([]);
  const [fix, setFix] = useState<{ id: string; balance: string; reason: string } | null>(null);
  const [f, setF] = useState<Draft | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const open = accounts.filter((a) => !a.closed_on);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => f && setF({ ...f, [k]: e.target.value });

  async function run() {
    if (!supabase || busy) return;
    setBusy(true); setMsg("");
    const { data, error } = await supabase.rpc("lalum_trust_reconciliation");
    setBusy(false);
    if (error) return setMsg(error.message.includes("FORBIDDEN") ? "אין הרשאה. התאמת נאמנות דורשת רמת מנהל." : "ההתאמה לא נטענה. נסו שוב.");
    const st = await supabase.from("lalum_trust_bank_statements").select("*").order("as_of", { ascending: false }).order("created_at", { ascending: false });
    setStmts(((st.data as TrustStatement[] | null) ?? []).map((x) => ({ ...x, balance: Number(x.balance) })));
    setRows(((data as TrustRecon[] | null) ?? []).map((r) => ({ ...r, ledger_balance: Number(r.ledger_balance), statement_balance: r.statement_balance == null ? null : Number(r.statement_balance), difference_at_statement_date: r.difference_at_statement_date == null ? null : Number(r.difference_at_statement_date) })));
  }

  async function save() {
    if (!supabase || !f || busy) return;
    const problems = statementProblems(f, today(), rows ?? []);
    if (problems.length) return setMsg(problems.join(". ") + ".");
    if (!window.confirm(`לשמור דף בנק ליום ${f.as_of} ביתרה ${money(Number(f.balance))}?\nהדף נשמר ואינו ניתן לעריכה.`)) return;
    setBusy(true);
    const { error } = await supabase.from("lalum_trust_bank_statements").insert({ firm_id: firmId, trust_account_id: f.account_id, as_of: f.as_of, balance: Number(f.balance) });
    setBusy(false);
    if (error) return setMsg(error.message.includes("duplicate") ? "כבר הוזן דף לחשבון הזה בתאריך הזה." : "השמירה נכשלה. ודאו שיש לכם הרשאת מנהל בהנהלת חשבונות.");
    setF(null); setMsg(""); onChange(); await run();
  }

  async function correct() {
    if (!supabase || !fix || busy) return;
    const cur = stmts.find((x) => x.id === fix.id);
    if (!cur) return;
    const problems = statementCorrectionProblems(fix, cur);
    if (problems.length) return setMsg(problems.join(". ") + ".");
    if (!window.confirm(`לתקן את דף הבנק ליום ${cur.as_of} מ-${money(cur.balance)} ל-${money(Number(fix.balance))}?\nהדף המקורי נשמר ברישום עם הסיבה שציינתם, והתיקון נרשם ביומן הביקורת.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("lalum_trust_statement_correct", { p_statement: fix.id, p_balance: Number(fix.balance), p_reason: fix.reason.trim() });
    setBusy(false);
    if (error) return setMsg(trustError(error.message));
    setFix(null); setMsg(""); onChange(); await run();
  }
  const acct = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? `${a.bank_name} ${a.branch} ${maskAccount(a.account_number)}` : ""; };

  return (
    <div className="ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-title">התאמת בנק</div>
        <div className="ck-row">
          <button className="ck-btn" disabled={!open.length} onClick={() => { setF({ account_id: open[0]?.id ?? "", as_of: today(), balance: "" }); setMsg(""); }}>הזנת דף בנק</button>
          <button className="ck-btn primary" disabled={busy || !accounts.length} onClick={() => void run()}>הצגת התאמה</button>
        </div>
      </div>
      <div className="ck-meta">הפער הוא יתרת הספר ביום הדף פחות יתרת הדף. הספר נספר לפי תאריך הערך של כל תנועה (בשרת שלא הופעלה בו מיגרציה 0033: לפי יום הרישום), ולכן צ'קים ותנועות בדרך עדיין יוצרים פער זמני שיש להסביר. הצגת ההתאמה נרשמת ביומן הביקורת.</div>
      {f && (
        <div className="ck-card ck-stack">
          <div className="ck-grid2">
            <label className="ck-field">חשבון<select className="ck-select" value={f.account_id} onChange={set("account_id")}>{open.map((a) => <option key={a.id} value={a.id}>{a.bank_name} {a.branch} {maskAccount(a.account_number)}</option>)}</select></label>
            <label className="ck-field">תאריך הדף<input className="ck-input" type="date" max={today()} value={f.as_of} onChange={set("as_of")} /></label>
            <label className="ck-field">יתרה בדף<input className="ck-input" dir="ltr" inputMode="decimal" value={f.balance} onChange={set("balance")} /></label>
          </div>
          <div className="ck-row"><button className="ck-btn primary" disabled={busy} onClick={() => void save()}>שמירה</button><button className="ck-btn" onClick={() => setF(null)}>ביטול</button></div>
        </div>
      )}
      {msg && <div className="ck-err" aria-live="polite">{msg}</div>}
      {rows && (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>חשבון</th><th className="fin-num">יתרת ספר</th><th>דף בנק</th><th className="fin-num">יתרה בדף</th><th className="fin-num">פער ביום הדף</th><th>מצב</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => {
            const [label, cls] = STATE[reconState(r)];
            return (
              <tr key={r.trust_account_id}><td className="fin-text">{r.bank_name} {r.branch} <bdi>{maskAccount(r.account_number)}</bdi></td>
                <td className="fin-num">{money(r.ledger_balance)}</td><td>{r.statement_as_of ?? ""}</td>
                <td className="fin-num">{r.statement_balance == null ? "" : money(r.statement_balance)}</td>
                <td className="fin-num">{r.difference_at_statement_date == null ? "" : money(r.difference_at_statement_date)}</td>
                <td><span className={`ck-badge ${cls}`}>{label}</span></td></tr>
            );
          }) : <tr><td colSpan={6}>אין חשבונות נאמנות</td></tr>}
        </tbody></table></div>
      )}
      {rows && (
        <>
          <div className="ck-title">דפי בנק שהוזנו</div>
          {fix && (
            <div className="ck-card ck-stack">
              <div className="ck-meta">תיקון דף יוצר גרסה חדשה לאותו חשבון ותאריך. הגרסה הקודמת נשארת ברישום, והסיבה נשמרת.</div>
              <div className="ck-grid2">
                <label className="ck-field">יתרה מתוקנת<input className="ck-input" dir="ltr" inputMode="decimal" value={fix.balance} onChange={(e) => setFix({ ...fix, balance: e.target.value })} /></label>
                <label className="ck-field">סיבת התיקון<input className="ck-input" value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} /></label>
              </div>
              <div className="ck-row"><button className="ck-btn primary" disabled={busy} onClick={() => void correct()}>תיקון</button><button className="ck-btn" onClick={() => setFix(null)}>ביטול</button></div>
            </div>
          )}
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>חשבון</th><th>תאריך הדף</th><th className="fin-num">יתרה</th><th>מצב</th><th></th></tr></thead><tbody>
            {stmts.length ? stmts.map((x) => (
              <tr key={x.id}><td className="fin-text">{acct(x.trust_account_id)}</td><td>{x.as_of}</td><td className="fin-num">{money(x.balance)}</td>
                <td>{x.superseded_at ? <span className="ck-meta">הוחלף בתיקון</span> : x.correction_reason ? <span className="ck-meta">תוקן: {x.correction_reason}</span> : "פעיל"}</td>
                <td className="fin-actions-cell">{!x.superseded_at && <div className="fin-actions"><button className="ck-btn sm" disabled={busy} onClick={() => { setFix({ id: x.id, balance: String(x.balance), reason: "" }); setMsg(""); }}>תיקון</button></div>}</td></tr>)) : <tr><td colSpan={5}>לא הוזנו דפי בנק</td></tr>}
          </tbody></table></div>
        </>
      )}
    </div>
  );
}
