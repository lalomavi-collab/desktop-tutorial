import { money } from "../../../lib/cockpit/shared";
import { TRUST_TX, maskAccount, trustBreakdown, trustHeld } from "../../../lib/cockpit/finance";
import type { FinCustomer, TrustAccount, TrustTx } from "../../../lib/cockpit/finance";

export interface MatterRef { id: string; title: string }

/** Read side of the trust ledger. Posting goes through the lalum_trust_post RPC, which enforces zero overdraft. */
export function TrustTab({ customers, matters, accounts, rows }: { customers: FinCustomer[]; matters: MatterRef[]; accounts: TrustAccount[]; rows: TrustTx[] }) {
  const cust = (id: string) => customers.find((c) => c.id === id)?.name ?? "";
  const matter = (id: string) => matters.find((m) => m.id === id)?.title ?? "";
  const byCustomer = trustBreakdown(rows, "customer_id");
  const byMatter = trustBreakdown(rows, "matter_id");

  return (
    <div className="ck-stack">
      <div className="ck-card fin-stat fin-trust">
        <div className="ck-meta">סה"כ כספי נאמנות מוחזקים</div>
        <div className="fin-figure">{money(trustHeld(rows))}</div>
        <div className="fin-note">כספי לקוחות. אינם הכנסת המשרד ואינם נכללים בסקירה, בדוח ההכנסות ובמע"מ. הרישום רק מוסיף שורות: טעות מתוקנת בתנועת תיקון.</div>
      </div>

      <div className="ck-title">חשבונות נאמנות</div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>בנק</th><th>סניף</th><th>חשבון</th><th className="fin-num">יתרה בספר</th></tr></thead><tbody>
        {accounts.length ? accounts.map((a) => <tr key={a.id}><td>{a.bank_name}</td><td>{a.branch}</td><td className="fin-ltr">{maskAccount(a.account_number)}{a.closed_on ? " (סגור)" : ""}</td><td className="fin-num">{money(trustHeld(rows, { account: a.id }))}</td></tr>) : <tr><td colSpan={4}>לא הוגדר חשבון נאמנות</td></tr>}
      </tbody></table></div>

      <div className="ck-grid2">
        <div className="ck-stack">
          <div className="ck-title">יתרה לפי לקוח</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>לקוח</th><th className="fin-num">יתרה</th></tr></thead><tbody>
            {byCustomer.length ? byCustomer.map((r) => <tr key={r.id}><td className="fin-text">{cust(r.id)}</td><td className="fin-num">{money(r.balance)}</td></tr>) : <tr><td colSpan={2}>אין יתרות</td></tr>}
          </tbody></table></div>
        </div>
        <div className="ck-stack">
          <div className="ck-title">יתרה לפי תיק</div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תיק</th><th className="fin-num">יתרה</th></tr></thead><tbody>
            {byMatter.length ? byMatter.map((r) => <tr key={r.id}><td className="fin-text">{matter(r.id)}</td><td className="fin-num">{money(r.balance)}</td></tr>) : <tr><td colSpan={2}>אין יתרות</td></tr>}
          </tbody></table></div>
        </div>
      </div>

      <div className="ck-title">תנועות</div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>תאריך</th><th>קבלה</th><th>לקוח</th><th>תיק</th><th>סוג</th><th className="fin-num">סכום</th></tr></thead><tbody>
        {rows.length ? rows.map((t) => (
          <tr key={t.id}><td>{t.created_at.slice(0, 10)}</td><td className="fin-ltr">{t.receipt_no}</td><td className="fin-text">{cust(t.customer_id)}{t.notes ? <div className="ck-meta">{t.notes}</div> : null}</td>
            <td className="fin-text">{matter(t.matter_id)}</td>
            <td><span className={`ck-badge ${t.amount > 0 ? "trust" : "outflow"}`}>{TRUST_TX[t.tx_type]}</span></td>
            <td className="fin-num">{money(t.amount)}</td></tr>)) : <tr><td colSpan={6}>אין תנועות עדיין</td></tr>}
      </tbody></table></div>
    </div>
  );
}
