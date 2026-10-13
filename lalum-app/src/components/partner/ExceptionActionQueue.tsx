import { useState } from "react";
import { money } from "../../lib/cockpit/shared";
import type { OpenInvoice } from "../../lib/cockpit/crm";

export interface LowRetainer { matterId: string; title: string; balance: number }
export interface PendingConflict { matterId: string; title: string }

type Done = Record<string, string>;

/** Bottom tier. Buttons only record intent here; real actions (send request, lock billing) are wired when the backend exists. */
export function ExceptionActionQueue({ overdue, lowRetainers, conflicts, customerName }: {
  overdue: OpenInvoice[]; lowRetainers: LowRetainer[]; conflicts: PendingConflict[]; customerName: (id: string) => string;
}) {
  const [done, setDone] = useState<Done>({});
  const mark = (k: string, text: string) => setDone((d) => ({ ...d, [k]: text }));
  const risky = overdue.filter((i) => i.overdueDays > 60).sort((a, b) => b.overdueDays - a.overdueDays);
  const empty = !risky.length && !lowRetainers.length && !conflicts.length;
  return (
    <section className="ck-card" aria-label="חריגות ופעולות">
      <div className="ck-card-head"><h3 className="ck-title">חריגות הדורשות פעולה</h3></div>
      {empty && <div className="ck-empty">אין חריגות.</div>}
      <ul className="crm-list">
        {risky.map((i) => (
          <li key={i.doc.id}>
            <span><span className="ck-badge red">{i.overdueDays} ימי איחור</span> {customerName(i.doc.customer_id)}, חשבונית {i.doc.doc_number}: {money(i.open)}</span>
            <span className="crm-actions">
              {done[i.doc.id] ? <span className="ck-badge green">{done[i.doc.id]}</span> : (<>
                <button type="button" className="ck-btn" onClick={() => mark(i.doc.id, "הבקשה נרשמה")}>בקשת הסדרה</button>
                <button type="button" className="ck-btn" onClick={() => mark(i.doc.id, "החיוב ננעל")}>נעילת חיוב זמן</button>
              </>)}
            </span>
          </li>
        ))}
        {lowRetainers.map((r) => (
          <li key={r.matterId}>
            <span><span className="ck-badge yellow">פיקדון נמוך</span> {r.title}: נותרו {money(r.balance)}</span>
            <span className="crm-actions">
              {done[r.matterId] ? <span className="ck-badge green">{done[r.matterId]}</span> : <button type="button" className="ck-btn primary" onClick={() => mark(r.matterId, "בקשת חידוש נרשמה")}>בקשת חידוש פיקדון</button>}
            </span>
          </li>
        ))}
        {conflicts.map((c) => (
          <li key={c.matterId}>
            <span><span className="ck-badge yellow">ניגוד עניינים</span> {c.title}: ממתין להחלטת שותף</span>
            <a className="ck-btn" href="/workspace">לבדיקה</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
