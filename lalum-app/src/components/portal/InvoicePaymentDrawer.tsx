import { useState } from "react";
import { money } from "../../lib/cockpit/shared";
import { openBalance } from "../../lib/cockpit/finance";
import type { FinDocument, FinPayment } from "../../lib/cockpit/finance";

/** Open invoices for one client, with trust balance shown separately. "Pay now" is wired to the payment link once Invoice4U supplies one. */
export function InvoicePaymentDrawer({ docs, pays, customerId, trust }: { docs: FinDocument[]; pays: FinPayment[]; customerId: string; trust: number }) {
  const [sel, setSel] = useState<string | null>(null);
  const mine = docs.filter((d) => d.customer_id === customerId && openBalance(d, docs, pays) > 0);
  const cur = mine.find((d) => d.id === sel);
  return (
    <section aria-label="חשבונות ותשלום" className="ck-stack">
      <h3 className="ck-title">חשבונות ותשלומים</h3>
      <div className="ck-card"><span className="ck-meta">יתרת פיקדון בנאמנות</span> <b>{money(trust)}</b></div>
      {mine.length === 0 ? <div className="ck-card ck-empty">אין חשבונות פתוחים.</div> : mine.map((d) => (
        <article key={d.id} className="ck-card">
          <div className="ck-card-head"><b>חשבונית {d.doc_number}</b><b>{money(openBalance(d, docs, pays))}</b></div>
          <button type="button" className="ck-btn" aria-expanded={sel === d.id} onClick={() => setSel(sel === d.id ? null : d.id)}>פירוט</button>
        </article>
      ))}
      {cur && (
        <aside className="ck-card" aria-label="פירוט חשבונית">
          <table className="ck-table"><tbody>
            <tr><th>שירותים (לפני מע״מ)</th><td>{money(cur.subtotal)}</td></tr>
            <tr><th>מע״מ</th><td>{money(cur.vat_amount)}</td></tr>
            <tr><th>סה״כ חשבונית</th><td>{money(cur.total)}</td></tr>
            <tr><th>שולם עד כה</th><td>{money(cur.total - openBalance(cur, docs, pays))}</td></tr>
            <tr><th>יתרה לתשלום</th><td><b>{money(openBalance(cur, docs, pays))}</b></td></tr>
          </tbody></table>
          <button type="button" className="ck-btn primary" disabled title="קישור התשלום יופעל עם החיבור ל-Invoice4U">לתשלום מהיר</button>
        </aside>
      )}
    </section>
  );
}
