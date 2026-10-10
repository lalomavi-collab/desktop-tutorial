import { STAGES } from "../../lib/cockpit/crmDemo";
import type { DemoMatter } from "../../lib/cockpit/crmDemo";

export function MatterHeader360({ m }: { m: DemoMatter }) {
  return (
    <header className="ck-card" style={{ marginBottom: 14 }}>
      <div className="ck-card-head"><h2 className="ck-title">{m.title}</h2><span className="ck-badge green">{m.stage}</span></div>
      <div className="ck-grid2">
        <div><div className="ck-meta">מספר הליך</div><b dir="ltr">{m.number}</b></div>
        <div><div className="ck-meta">ערכאה</div><b>{m.court}</b></div>
        <div><div className="ck-meta">מותב</div><b>{m.bench}</b></div>
        <div><div className="ck-meta">עורך דין מטפל</div><b>{m.attorney}</b></div>
      </div>
      <div className="crm-pipe" role="list" aria-label="שלב דיוני" style={{ marginTop: 10 }}>
        {STAGES.map((s, i) => <span key={s} role="listitem" className={i === m.stageIndex ? "on" : ""} aria-current={i === m.stageIndex ? "step" : undefined}>{s}</span>)}
      </div>
    </header>
  );
}
