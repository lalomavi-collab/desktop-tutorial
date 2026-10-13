import type { DemoMatter } from "../../lib/cockpit/crmDemo";

/** Case selector plus a plain-language status. No internal fields (bench, attorney notes) are shown to the client. */
export function ClientPortalHeader({ matters, selected, onSelect }: { matters: DemoMatter[]; selected: string; onSelect: (id: string) => void }) {
  const m = matters.find((x) => x.id === selected) ?? matters[0];
  return (
    <header className="ck-card" style={{ marginBottom: 14 }}>
      <label className="ck-field"><span className="ck-label">התיק שלי</span>
        <select className="ck-select" value={m.id} onChange={(e) => onSelect(e.target.value)}>{matters.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
      </label>
      <p style={{ margin: 0 }}>שלב נוכחי: <b>{m.stage}</b>. הצוות מעדכן כאן כל התקדמות שמחייבת אתכם.</p>
    </header>
  );
}
