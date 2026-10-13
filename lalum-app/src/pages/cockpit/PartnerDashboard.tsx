// Partner executive view: KPIs, 13 week cash flow, exceptions, activity. Demo data until the ledger source is switched on.
import { useMemo } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { ExecutiveKpiCards } from "../../components/partner/ExecutiveKpiCards";
import { RollingCashFlow13Weeks } from "../../components/partner/RollingCashFlow13Weeks";
import { ExceptionActionQueue } from "../../components/partner/ExceptionActionQueue";
import { FirmActivityFeed } from "../../components/partner/FirmActivityFeed";
import { addDays, arAging, collected, forecast13, wip } from "../../lib/cockpit/crm";
import { useTrustSummary } from "../../lib/cockpit/crmTrust";
import { buildDemo, DEMO_NOTE } from "../../lib/cockpit/crmDemo";
import "../../styles/crm.css";

export function PartnerView() {
  const today = useMemo(() => new Date(), []);
  const d = useMemo(() => buildDemo(today), [today]);
  const aging = arAging(d.docs, d.payments, today);
  const f = forecast13({ docs: d.docs, pays: d.payments, obligations: d.obligations, openingCash: d.bankBalance, minThreshold: d.minThreshold, fallbackDso: 45 }, today);
  const w = wip(d.time);
  const burn = d.obligations.reduce((s, o) => s + (o.every === "WEEK" ? o.amount * 4.345 : o.amount), 0);
  // Trust is the one real figure here; the rest is still demo data. No trust account means no card.
  const trust = useTrustSummary();
  const lowRetainers: Array<{ matterId: string; title: string; balance: number }> = [];
  const name = (id: string) => d.customers.find((c) => c.id === id)?.name ?? "";
  return (
    <>
      <div className="crm-demo" role="note">{DEMO_NOTE}</div>
      <ExecutiveKpiCards bankBalance={d.bankBalance} monthlyBurn={burn} collected30={collected(d.payments, addDays(today, -30), today)} wipHours={w.hours} wipAmount={w.amount} aging={aging} trust={trust.state === "ready" ? trust.held : null} />
      <RollingCashFlow13Weeks f={f} />
      <div className="ck-grid2" style={{ marginTop: 14 }}>
        <ExceptionActionQueue overdue={aging.invoices} lowRetainers={lowRetainers} conflicts={[{ matterId: "m2", title: d.matters[1].title }]} customerName={name} />
        <FirmActivityFeed items={d.activity} />
      </div>
    </>
  );
}

export function PartnerDashboardPage() {
  return (
    <CockpitFrame title="תמונת מצב לשותף" description="מדדים פיננסיים, תזרים וחריגות." path="/workspace/partner">
      {({ member, platformAdmin }) => (platformAdmin || ["FIRM_PARTNER", "ADMIN"].includes(member?.role ?? ""))
        ? <PartnerView />
        : <div className="ck-card ck-empty">המסך זמין לשותפים בלבד.</div>}
    </CockpitFrame>
  );
}
