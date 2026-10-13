import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { healthSummary, reconHealth, trustFlowCoverage, trustHealth } from "../../../lib/cockpit/finance";
import type { HealthCheck, HealthStatus, TrustAccount, TrustRecon, TrustTx } from "../../../lib/cockpit/finance";

const todayIL = (): string => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const BADGE: Record<HealthStatus, [string, string]> = { ok: ["תקין", "green"], fail: ["נכשל", "red"], warn: ["לבדיקה", "yellow"], info: ["מידע", ""] };

/**
 * Full-flow check of the trust funds. Read only: the ledger is append only and legally sensitive, so the check never posts a
 * test movement. It does two things: it re-derives, from the live ledger, every rule the database enforces on the way in and
 * flags any row that breaks one, and it shows which stages of the flow have really been run on live data. The bank
 * reconciliation is added on request, because each run of it is written to the audit log.
 */
export function TrustHealth({ accounts, matters, rows, statementAccounts }: {
  accounts: TrustAccount[]; matters: Array<{ id: string; customer_id: string | null }>; rows: TrustTx[]; statementAccounts: string[];
}) {
  const [ran, setRan] = useState(false);
  const [recon, setRecon] = useState<HealthCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const checks = ran ? trustHealth(rows, accounts, matters, todayIL()) : [];
  const all = recon ? [...checks, ...recon] : checks;
  const overall = healthSummary(all);
  const flow = trustFlowCoverage(rows, accounts, statementAccounts);

  async function run() {
    setRan(true); setMsg("");
    if (!supabase || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("lalum_trust_reconciliation");
    setBusy(false);
    if (error) { setRecon(null); return setMsg("התאמת הבנק לא נטענה, ושאר הבדיקות הוצגו."); }
    setRecon(reconHealth(((data as TrustRecon[] | null) ?? []).map((r) => ({ ...r, difference_at_statement_date: r.difference_at_statement_date == null ? null : Number(r.difference_at_statement_date) }))));
  }

  return (
    <div className="ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-title">בדיקת הזרימה המלאה</div>
        <button className="ck-btn primary" disabled={busy} onClick={() => void run()}>{ran ? "הרצה מחדש" : "הרצת בדיקה"}</button>
      </div>
      <div className="ck-meta">הבדיקה לקריאה בלבד ואינה רושמת תנועות: הספר לא ניתן למחיקה, ותנועת ניסיון הייתה נשארת בו לצמיתות. היא מוודאת בנתונים החיים שכל הכללים נשמרו, ומראה אילו שלבי זרימה כבר הורצו בפועל. התאמת הבנק נכללת בהרצה ונרשמת ביומן הביקורת.</div>

      <div className="ck-card ck-stack">
        <div className="ck-title">שלבי הזרימה שהורצו בפועל</div>
        <ol className="ck-stack" style={{ margin: 0, paddingInlineStart: 22 }}>
          {flow.map((st) => (
            <li key={st.id}>{st.done ? "בוצע" : "טרם בוצע"}: {st.label}</li>
          ))}
        </ol>
        <div className="ck-meta">{flow.every((x) => x.done) ? "כל שלבי הזרימה הורצו לפחות פעם אחת." : "שלב שטרם בוצע מסומן כאן. כדי להריץ אותו, רשמו תנועה אמיתית שמתאימה, או השאירו אותו לשימוש הראשון בפועל."}</div>
      </div>

      {msg && <div className="ck-warn" aria-live="polite">{msg}</div>}
      {ran && (
        <>
          <div className={overall === "ok" ? "ck-ok" : overall === "fail" ? "ck-err" : "ck-warn"} aria-live="polite">
            {overall === "ok" ? "כל הבדיקות עברו." : overall === "fail" ? "נמצאו כשלים. כל שורה אדומה פירטה מה שבור." : "אין כשל, אבל יש סעיפים לבדיקה."}
          </div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>בדיקה</th><th>תוצאה</th><th>פירוט</th></tr></thead><tbody>
            {all.map((c) => {
              const [label, cls] = BADGE[c.status];
              return <tr key={c.id}><td className="fin-text">{c.label}</td><td><span className={`ck-badge ${cls}`}>{label}</span></td><td className="fin-text">{c.detail}</td></tr>;
            })}
          </tbody></table></div>
        </>
      )}
    </div>
  );
}
