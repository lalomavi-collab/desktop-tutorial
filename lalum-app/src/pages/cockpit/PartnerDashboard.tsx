// Partner executive view from the firm's real ledger: bank balance (manual input), receivables aging,
// 13 week forecast and overdue exceptions, using the same engines as the finance tabs. Trust appears only
// when the firm holds client money. Hours in progress come priced from the billing RPC (rate cards). The activity feed
// and the conflict queue have no real source here yet, so they are not shown rather than shown as demo figures.
import { ExecutiveKpiCards } from "../../components/partner/ExecutiveKpiCards";
import { RollingCashFlow13Weeks } from "../../components/partner/RollingCashFlow13Weeks";
import { ExceptionActionQueue } from "../../components/partner/ExceptionActionQueue";
import { CockpitFrame } from "./CockpitFrame";
import { useClientNames } from "../../components/cockpit/ClientNames";
import { useTrustSummary } from "../../lib/cockpit/crmTrust";
import { usePartnerFinance } from "../../lib/cockpit/crmFinance";
import { usePartnerOverview } from "../../lib/cockpit/billingWip";
import { fmtDay } from "../../lib/cockpit/arAging";
import "../../styles/crm.css";

export function PartnerView() {
  const fin = usePartnerFinance();
  const trust = useTrustSummary();
  const ov = usePartnerOverview();
  const cn = useClientNames();
  if (fin.state === "loading") return <div className="ck-meta">טוען...</div>;
  if (fin.state === "denied") return <div className="ck-card ck-empty">אין הרשאה לנתוני הכספים, או שהנתונים אינם זמינים כעת.</div>;
  const d = fin.data;
  const customerName = (id: string) => cn.customer({ id, name: d.aging.customers.find((c) => c.customerId === id)?.name });
  return (
    <>
      {d.balanceAsOf && <div className="ck-meta" style={{ marginBottom: 8 }}>יתרת הפתיחה הוזנה ידנית בתאריך {fmtDay(d.balanceAsOf)}.</div>}
      <ExecutiveKpiCards bankBalance={d.bankBalance} monthlyBurn={d.monthlyBurn} collected30={d.collected30} wip={ov.state === "ready" ? { hours: ov.data.wipHours, amount: ov.data.wipValue, withoutRate: ov.data.entriesWithoutRate, awaiting: ov.data.awaitingApproval, nonHourlyHours: ov.data.nonHourlyHours } : null} aging={{ total: d.aging.total, notYetDue: d.aging.notYetDue, buckets: d.aging.totals }} trust={trust.state === "ready" ? trust.held : null} />
      <RollingCashFlow13Weeks f={d.forecast} />
      <div style={{ marginTop: 14 }}>
        <ExceptionActionQueue overdue={d.overdue} lowRetainers={trust.state === "ready" && ov.state === "ready" ? ov.data.lowRetainers : []} conflicts={[]} customerName={customerName} />
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
