// Matter 360 workspace on demo data. The existing /workspace/:matterId cockpit stays the document and review surface.
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CockpitFrame } from "./CockpitFrame";
import { MatterHeader360 } from "../../components/matter/MatterHeader360";
import { PartiesDirectory } from "../../components/matter/PartiesDirectory";
import { ProceduralDeadlinesTab } from "../../components/matter/ProceduralDeadlinesTab";
import { StagedSubmissionsQueue } from "../../components/matter/StagedSubmissionsQueue";
import { BillingAndTrustTab } from "../../components/matter/BillingAndTrustTab";
import { buildDemo, DEMO_NOTE } from "../../lib/cockpit/crmDemo";
import "../../styles/crm.css";

type Tab = "parties" | "deadlines" | "docs" | "billing";
const TABS: Array<[Tab, string]> = [["parties", "צדדים"], ["deadlines", "מועדים"], ["docs", "מסמכי לקוח"], ["billing", "חיוב ונאמנות"]];

function MatterView({ id }: { id: string }) {
  const d = useMemo(() => buildDemo(new Date()), []);
  const m = d.matters.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("parties");
  const [staged, setStaged] = useState(d.staged);
  const [time, setTime] = useState(d.time);
  const [trust, setTrust] = useState(d.trust);
  if (!m) return <div className="ck-card ck-empty">התיק לא נמצא. תיקי ההדגמה: m1, m2.</div>;
  return (
    <>
      <div className="crm-demo" role="note">{DEMO_NOTE}</div>
      <MatterHeader360 m={m} />
      <div className="crm-tabs" role="group" aria-label="לשוניות תיק">
        {TABS.map(([k, label]) => <button key={k} type="button" className="ck-btn" aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === "parties" && <PartiesDirectory parties={d.parties} />}
      {tab === "deadlines" && <ProceduralDeadlinesTab milestones={d.milestones} />}
      {tab === "docs" && <StagedSubmissionsQueue docs={staged} onChange={setStaged} />}
      {tab === "billing" && <BillingAndTrustTab matterId={m.id} rate={900} time={time} trust={trust} onTime={setTime} onTrust={setTrust} />}
    </>
  );
}

export function Matter360Page() {
  const { id = "m1" } = useParams();
  return <CockpitFrame title="תיק 360" description="מרכז הפעילות סביב התיק." path={`/workspace/matters/${id}`}>{() => <MatterView id={id} />}</CockpitFrame>;
}
