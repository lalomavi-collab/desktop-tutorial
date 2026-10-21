import { useState } from "react";
import { money } from "../../lib/cockpit/shared";
import { receivable } from "../../lib/cockpit/finance";
import type { FinDocument, FinPayment } from "../../lib/cockpit/finance";

/** What one client still owes (open pro formas on the cash basis, as the finance tabs count it), with trust balance shown separately. "Pay now" is wired to the payment link once Invoice4U supplies one. */
export function InvoicePaymentDrawer({ docs, pays, customerId, trust }: { docs: FinDocument[]; pays: FinPayment[]; customerId: string; /** null: no client money held, nothing to show. */ trust: number | null }) {
  const [sel, setSel] = useState<string | null>(null);
  const mine = docs.filter((d) => d.customer_id === customerId && receivable(d, docs, pays) > 0);
  const cur = mine.find((d) => d.id === sel);
  return (
    <section aria-label="חשבונות ותשלום" className="ck-stack">
      <h3 className="ck-title">חשבונות ותשלומים</h3>
      {trust != null && <div className="ck-card"><span className="ck-meta">יתרת פיקדון בנאמנות</span> <b>{money(trust)}</b></div>}
      {mine.length === 0 ? <div className="ck-card ck-empty">אין חשבונות פתוחים.</div> : mine.map((d) => (
        <article key={d.id} className="ck-card">
          <div className="ck-card-head"><b>{d.doc_type === "PROFORMA" ? "חשבון עסקה" : "חשבונית"} {d.doc_number}</b><b>{money(receivable(d, docs, pays))}</b></div>
          <button type="button" className="ck-btn" aria-expanded={sel === d.id} onClick={() => setSel(sel === d.id ? null : d.id)}>פירוט</button>
        </article>
      ))}
      {cur && (
        <aside className="ck-card" aria-label="פירוט החשבון">
          <table className="ck-table"><tbody>
            <tr><th>שירותים (לפני מע״מ)</th><td>{money(cur.subtotal)}</td></tr>
            <tr><th>מע״מ</th><td>{money(cur.vat_amount)}</td></tr>
            <tr><th>סה״כ לתשלום</th><td><b>{money(receivable(cur, docs, pays))}</b></td></tr>
          </tbody></table>
          <button type="button" className="ck-btn primary" disabled title="קישור התשלום יופעל עם החיבור למערכת ההנפקה">לתשלום מהיר</button>
        </aside>
      )}
    </section>
  );
}
