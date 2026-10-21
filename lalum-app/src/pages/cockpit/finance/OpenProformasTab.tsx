import { useMemo } from "react";
import { money } from "../../../lib/cockpit/shared";
import { isOpenProforma, I4U_TYPE } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinCustomer, FinDocument } from "../../../lib/cockpit/finance";
import { BUCKETS, BUCKET_LABEL, bucketOf, dueDateOf, fmtDay, todayIL } from "../../../lib/cockpit/arAging";
import { BarsH } from "../../../components/cockpit/CockpitCharts";

const dayMs = 86_400_000;
const daysBetween = (fromIso: string, toIso: string): number => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / dayMs);

/** Open pro formas (חשבונות עסקה פתוחים): under the cash basis an open pro forma is the customer's debt. */
export function OpenProformasTab({ customers, docs, archive, onOpenDocuments, onOpenArchive }: {
  customers: FinCustomer[]; docs: FinDocument[]; archive: ArchiveDoc[]; onOpenDocuments: () => void; onOpenArchive: () => void;
}) {
  const today = todayIL();
  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const rows = useMemo(() => docs.filter((d) => isOpenProforma(d, docs)).map((d) => {
    const late = Math.max(0, daysBetween(dueDateOf(d), today));
    return { d, late, bucket: bucketOf(late), overdue: dueDateOf(d) < today };
  }).sort((a, b) => b.late - a.late), [docs, today]);
  const total = rows.reduce((t, r) => t + r.d.total, 0);
  const overdue = rows.filter((r) => r.overdue);
  const overdueTotal = overdue.reduce((t, r) => t + r.d.total, 0);
  const oldest = rows.length ? Math.max(...rows.map((r) => daysBetween(r.d.issue_date, today))) : 0;
  const perBucket = BUCKETS.map((b) => ({ label: BUCKET_LABEL[b], value: rows.filter((r) => r.bucket === b).length, color: b === "CURRENT" ? undefined : "var(--ck-warn, #b45309)" }));
  const hist = useMemo(() => archive.filter((a) => a.i4u_doc_type === 5).sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1)), [archive]);

  return (
    <div className="ck-stack">
      <div className="fin-grid3">
        <div className="ck-card fin-stat"><div className="ck-meta">חשבונות עסקה פתוחים</div><div className="fin-figure">{rows.length}</div><div className="fin-note">שהופקו במערכת הזאת ועוד לא נסגרו בחשבונית מס או בחשבונית מס קבלה.</div></div>
        <div className="ck-card fin-stat fin-inflow"><div className="ck-meta">סך החוב הפתוח</div><div className="fin-figure">{money(total)}</div><div className="fin-note">כולל מע"מ.</div></div>
        <div className="ck-card fin-stat fin-outflow"><div className="ck-meta">עברו את מועד התשלום</div><div className="fin-figure">{money(overdueTotal)}</div><div className="fin-note">{overdue.length} חשבונות. הוותיק ביותר פתוח {oldest} ימים.</div></div>
      </div>
      {rows.length > 0 && <div className="ck-card"><div className="ck-title">פיזור לפי איחור</div><BarsH items={perBucket} /></div>}
      <div className="ck-card">
        <div className="ck-row" style={{ justifyContent: "space-between" }}>
          <div className="ck-title">רשימת החשבונות הפתוחים</div>
          <button className="ck-btn" onClick={onOpenDocuments}>פתיחה בלשונית מסמכים</button>
        </div>
        {rows.length === 0 ? <div className="ck-meta">אין חשבונות עסקה פתוחים.</div> : (
          <table className="ck-table">
            <thead><tr><th>מספר</th><th>לקוח</th><th>תאריך</th><th>מועד תשלום</th><th>סכום</th><th>איחור</th></tr></thead>
            <tbody>{rows.map(({ d, late, overdue: od }) => (
              <tr key={d.id}><td>{d.doc_number ?? ""}</td><td>{byId.get(d.customer_id)?.name ?? ""}</td><td>{fmtDay(d.issue_date)}</td><td>{fmtDay(dueDateOf(d))}</td><td><bdi>{money(d.total)}</bdi></td><td>{od ? `${late} ימים` : "במועד"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {hist.length > 0 && (
        <div className="ck-card">
          <div className="ck-row" style={{ justifyContent: "space-between" }}>
            <div className="ck-title">{I4U_TYPE[5]} מארכיון ההיסטוריה</div>
            <button className="ck-btn" onClick={onOpenArchive}>לארכיון</button>
          </div>
          <div className="ck-warn">אין בארכיון קשר בין חשבון עסקה למסמך שסגר אותו, ולכן הרשימה הזאת אינה נכללת בסך החוב הפתוח. הנתון "שולם" הוא מה שהמערכת הקודמת רשמה.</div>
          <table className="ck-table">
            <thead><tr><th>מספר</th><th>תאריך</th><th>נושא</th><th>סכום</th><th>שולם</th></tr></thead>
            <tbody>{hist.slice(0, 100).map((a) => (
              <tr key={a.id}><td>{a.doc_number}</td><td>{fmtDay(a.issue_date)}</td><td>{a.subject ?? a.gname ?? ""}</td><td><bdi>{money(a.total)}</bdi></td><td><bdi>{money(a.paid ?? 0)}</bdi></td></tr>
            ))}</tbody>
          </table>
          {hist.length > 100 && <div className="ck-meta">מוצגים 100 הראשונים מתוך {hist.length}. הרשימה המלאה בלשונית הארכיון.</div>}
        </div>
      )}
    </div>
  );
}
