// Partner-only preview of the client portal on demo data. The live /portal is untouched until the backend rows exist.
import { useMemo, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { ClientPortalHeader } from "../../components/portal/ClientPortalHeader";
import { ClientMilestonesView } from "../../components/portal/ClientMilestonesView";
import { StagedDocumentUploader } from "../../components/portal/StagedDocumentUploader";
import { SecureCommsFeed } from "../../components/portal/SecureCommsFeed";
import { InvoicePaymentDrawer } from "../../components/portal/InvoicePaymentDrawer";
import { trustBalance } from "../../lib/cockpit/crm";
import { buildDemo, DEMO_NOTE } from "../../lib/cockpit/crmDemo";
import "../../styles/crm.css";

function Preview() {
  const d = useMemo(() => buildDemo(new Date()), []);
  const [sel, setSel] = useState("m1");
  const [docs, setDocs] = useState(d.staged);
  const [msgs, setMsgs] = useState(d.messages);
  const m = d.matters.find((x) => x.id === sel) ?? d.matters[0];
  const customerId = d.customers.find((c) => c.name === m.client)?.id ?? "c1";
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="crm-demo" role="note">תצוגה מקדימה של פורטל הלקוח. {DEMO_NOTE}</div>
      <ClientPortalHeader matters={d.matters} selected={sel} onSelect={setSel} />
      <div className="ck-stack">
        <ClientMilestonesView milestones={d.milestones} />
        <StagedDocumentUploader docs={docs} onChange={setDocs} />
        <SecureCommsFeed messages={msgs} onSend={(text) => setMsgs([...msgs, { id: `n${msgs.length}`, from: "CLIENT", at: new Date().toISOString(), text, internal: false }])} />
        <InvoicePaymentDrawer docs={d.docs} pays={d.payments} customerId={customerId} trust={trustBalance(d.trust, m.id)} />
      </div>
    </div>
  );
}
export function PortalPreviewPage() {
  return <CockpitFrame title="תצוגת פורטל לקוח" description="כך הלקוח רואה את התיק." path="/workspace/portal-preview">{() => <Preview />}</CockpitFrame>;
}
