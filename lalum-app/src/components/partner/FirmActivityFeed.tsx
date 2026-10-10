import { Link } from "react-router-dom";
import { fmt } from "../../lib/cockpit/shared";
import type { Activity } from "../../lib/cockpit/crmDemo";

/** Stream of client portal messages and uploads, newest first. Live data will arrive through realtime on the same shape. */
export function FirmActivityFeed({ items }: { items: Activity[] }) {
  const sorted = items.slice().sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="ck-card" aria-label="פעילות במשרד">
      <div className="ck-card-head"><h3 className="ck-title">פעילות אחרונה בפורטל</h3></div>
      {sorted.length === 0 ? <div className="ck-empty">אין פעילות חדשה.</div> : (
        <ul className="crm-list">
          {sorted.map((a) => (
            <li key={a.id}>
              <span><span className={`ck-badge ${a.kind === "MESSAGE" ? "green" : "yellow"}`}>{a.kind === "MESSAGE" ? "הודעה" : "מסמך"}</span> {a.text}</span>
              <span className="ck-meta"><span dir="ltr">{fmt(a.at)}</span> <Link className="ck-link" to={`/workspace/matters/${a.matterId}`}>לתיק</Link></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
