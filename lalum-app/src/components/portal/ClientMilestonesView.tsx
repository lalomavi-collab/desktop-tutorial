import { clientMilestones } from "../../lib/cockpit/crm";
import type { Milestone } from "../../lib/cockpit/crmDemo";

export function ClientMilestonesView({ milestones }: { milestones: Milestone[] }) {
  const visible = clientMilestones(milestones).sort((a, b) => a.on.localeCompare(b.on));
  return (
    <section aria-label="מועדים קרובים" className="ck-stack">
      <h3 className="ck-title">מועדים קרובים</h3>
      {visible.length === 0 ? <div className="ck-card ck-empty">אין מועדים להצגה כרגע.</div> : visible.map((m) => (
        <article key={m.id} className="ck-card"><div className="ck-card-head"><b>{m.title}</b><span className="ck-badge green">{m.kind === "HEARING" ? "דיון" : "הגשה"}</span></div><div dir="ltr" style={{ textAlign: "end" }}>{m.on}</div></article>
      ))}
    </section>
  );
}
