import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { useClientNames } from "../../components/cockpit/ClientNames";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../components/Icon";
import { useLang } from "../../context/LangContext";
import { accountingUrl, accountingDashboardEnabled } from "../../lib/content";

// Client billing console, moved out of the client portal into the cockpit. The
// firm issues a payment request (a billing milestone) to a client, then copies
// the payment link the provider returns, and sees every milestone with its
// status. This is distinct from the firm's own LALUM subscription, which lives
// on the subscription billing screen. The create/copy-link logic is unchanged
// from its former home; the screen now loads its own milestones and refreshes
// itself after each action.

type Milestone = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  client_email: string | null;
  hosted_url: string | null;
  created_at: string;
};

const fmtMoney = (amount: number, currency: string) => {
  const sym: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };
  return `${sym[currency] ?? ""}${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function PaymentsInner({ canView }: { canView: boolean }) {
  const { t } = useLang();
  const cn = useClientNames();
  const B = t.ui.portal.billing;

  const [allBills, setAllBills] = useState<Milestone[] | null>(null);
  const [billEmail, setBillEmail] = useState("");
  const [billName, setBillName] = useState("");
  const [billPhone, setBillPhone] = useState("");
  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCurrency, setBillCurrency] = useState("ILS");
  const [billBusy, setBillBusy] = useState(false);
  const [billMsg, setBillMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [payBusy, setPayBusy] = useState<string | undefined>();

  const loadBills = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("billing_milestones").select("*").order("created_at", { ascending: false });
    setAllBills((data as Milestone[] | null) ?? []);
  }, []);
  useEffect(() => { if (canView) void loadBills(); }, [canView, loadBills]);

  async function createMilestone(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !billTitle.trim() || !billAmount) return;
    setBillBusy(true);
    setBillMsg(null);
    try {
      const { error } = await supabase.from("billing_milestones").insert({ client_email: billEmail || null, client_name: billName || null, client_phone: billPhone || null, title: billTitle.trim(), amount: Number(billAmount), currency: billCurrency });
      if (error) throw error;
      setBillMsg({ tone: "ok", text: B.createdOk });
      setBillTitle(""); setBillAmount(""); setBillEmail(""); setBillName(""); setBillPhone("");
      await loadBills();
    } catch (err) {
      setBillMsg({ tone: "err", text: err instanceof Error ? err.message : B.err });
    } finally {
      setBillBusy(false);
    }
  }

  async function copyPayLink(id: string) {
    if (!supabase) return;
    setPayBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("lalum-pay-create", { body: { milestone_id: id } });
      if (error) throw error;
      if (data?.url) {
        try { await navigator.clipboard.writeText(data.url as string); } catch { window.prompt("Link", data.url as string); }
        await loadBills();
      }
    } catch {
      window.alert(B.payErr);
    } finally {
      setPayBusy(undefined);
    }
  }

  if (!canView) return <div className="ck-card"><div className="ck-title">אין הרשאה</div><div className="ck-meta">גביית לקוחות פתוחה למנהל הפירמה.</div></div>;
  if (allBills === null) return <div className="ck-meta">טוען...</div>;

  return (
    <div className="card" style={{ padding: 34, marginBottom: 28, borderColor: "var(--clay)" }}>
      {accountingDashboardEnabled && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <a className="btn btn-ghost btn-sm" href={accountingUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="file" size={15} /> {B.dashboard}
          </a>
        </div>
      )}
      <form onSubmit={createMilestone} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div>
            <div className="label">{B.clientEmail}</div>
            <input className="field" value={billEmail} onChange={(e) => setBillEmail(e.target.value)} placeholder={B.clientEmailPh} dir="ltr" />
          </div>
          <div>
            <div className="label">{B.itemTitle}</div>
            <input className="field" value={billTitle} onChange={(e) => setBillTitle(e.target.value)} placeholder={B.itemTitlePh} />
          </div>
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div>
            <div className="label">{B.clientName}</div>
            <input className="field" value={billName} onChange={(e) => setBillName(e.target.value)} placeholder={B.clientNamePh} />
          </div>
          <div>
            <div className="label">{B.clientPhone}</div>
            <input className="field" value={billPhone} onChange={(e) => setBillPhone(e.target.value)} placeholder={B.clientPhonePh} dir="ltr" inputMode="tel" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div className="label">{B.amount}</div>
            <input className="field" value={billAmount} onChange={(e) => setBillAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder={B.amountPh} dir="ltr" inputMode="decimal" />
          </div>
          <div style={{ width: 100 }}>
            <select className="field" value={billCurrency} onChange={(e) => setBillCurrency(e.target.value)} dir="ltr">
              <option value="ILS">ILS ₪</option>
              <option value="USD">USD $</option>
              <option value="EUR">EUR €</option>
            </select>
          </div>
          <button className="btn btn-clay btn-sm" disabled={billBusy || !billTitle.trim() || !billAmount} style={{ whiteSpace: "nowrap" }}>
            {billBusy ? B.creating : B.create}
          </button>
        </div>
      </form>
      {billMsg && <div className={`notice ${billMsg.tone === "ok" ? "notice-ok" : "notice-err"}`} style={{ marginBottom: 16 }}>{billMsg.text}</div>}

      {allBills.length > 0 && (
        <div>
          <div className="label">{B.allTitle}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {allBills.map((bl) => (
              <div key={bl.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{bl.title}</div>
                  <div className="muted" style={{ fontSize: 12 }} dir="ltr">{cn.text(bl.client_email)}</div>
                </div>
                <span dir="ltr" style={{ fontWeight: 700 }}>{fmtMoney(bl.amount, bl.currency)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: bl.status === "paid" ? "#2c6444" : "var(--clay)", textTransform: "uppercase" }}>{B.statusLabels[bl.status as keyof typeof B.statusLabels] ?? bl.status}</span>
                {bl.status !== "paid" && (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={payBusy === bl.id} onClick={() => void copyPayLink(bl.id)}>{payBusy === bl.id ? "…" : B.copyLink}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Client billing console (payment requests), framed for the cockpit. */
export function Payments() {
  return (
    <CockpitFrame title="גביית לקוחות" description="הפקת בקשות תשלום ללקוחות, העתקת קישור לתשלום ומעקב אחר סטטוס הגבייה." path="/workspace/payments">
      {({ member, platformAdmin }) => <PaymentsInner canView={platformAdmin || member?.role === "ADMIN"} />}
    </CockpitFrame>
  );
}
