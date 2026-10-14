// Client portal preview, partner only: what a client sees of their account for a chosen matter, from the real ledger.
// Messages, uploaded documents and milestones are not shown: they have no matter-level source yet, and the live
// client area (/portal) is untouched.
import { useEffect, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { ClientPortalHeader } from "../../components/portal/ClientPortalHeader";
import { InvoicePaymentDrawer } from "../../components/portal/InvoicePaymentDrawer";
import { supabase } from "../../lib/supabase";
import { loadLedgerRaw } from "../../lib/cockpit/crmFinance";
import type { LedgerRaw } from "../../lib/cockpit/crmFinance";
import { useTrustSummary } from "../../lib/cockpit/crmTrust";
import { MATTER_STATUS } from "../../lib/cockpit/shared";
import "../../styles/crm.css";

interface PreviewData { ledger: LedgerRaw; matters: Array<{ id: string; title: string; status: string; customerId: string | null }>; trustByMatter: Map<string, number> }

async function load(): Promise<PreviewData | null> {
  if (!supabase) return null;
  const ledger = await loadLedgerRaw();
  if (!ledger) return null;
  const [m, f, t] = await Promise.all([
    supabase.from("lalum_cockpit_matters").select("id, title, status").is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    supabase.from("lalum_matter_fees").select("matter_id, fin_customer_id"),
    supabase.from("lalum_trust_ledger").select("matter_id, amount"),
  ]);
  const cust = new Map(((f.data as Array<{ matter_id: string; fin_customer_id: string | null }> | null) ?? []).map((x) => [x.matter_id, x.fin_customer_id]));
  const trustByMatter = new Map<string, number>();
  for (const r of (t.data as Array<{ matter_id: string; amount: number | string }> | null) ?? []) trustByMatter.set(r.matter_id, Math.round(((trustByMatter.get(r.matter_id) ?? 0) + Number(r.amount)) * 100) / 100);
  const matters = ((m.data as Array<{ id: string; title: string; status: string }> | null) ?? []).map((x) => ({ ...x, customerId: cust.get(x.id) ?? null }));
  return { ledger, matters, trustByMatter };
}

function Preview() {
  const trust = useTrustSummary();
  const [data, setData] = useState<PreviewData | null | undefined>(undefined);
  const [sel, setSel] = useState<string>("");
  useEffect(() => { void load().then(setData); }, []);
  if (data === undefined) return <div className="ck-meta">טוען...</div>;
  if (data === null) return <div className="ck-card ck-empty">אין הרשאה לנתוני הכספים, או שהנתונים אינם זמינים כעת.</div>;
  if (data.matters.length === 0) return <div className="ck-card ck-empty">אין תיקים להצגה.</div>;
  const m = data.matters.find((x) => x.id === sel) ?? data.matters[0];
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="crm-demo" role="note">תצוגה מקדימה של אזור הלקוח: החשבונות כפי שהלקוח רואה אותם. הודעות, מסמכים שהועלו ואבני דרך אינם מוצגים כאן, ואזור הלקוחות החי ב-<a href="/portal">/portal</a> לא שונה.</div>
      <ClientPortalHeader matters={data.matters.map((x) => ({ id: x.id, title: x.title, stage: MATTER_STATUS[x.status] ?? x.status }))} selected={m.id} onSelect={setSel} />
      {m.customerId
        ? <InvoicePaymentDrawer docs={data.ledger.docs} pays={data.ledger.pays} customerId={m.customerId} trust={trust.state === "ready" ? (data.trustByMatter.get(m.id) ?? 0) : null} />
        : <div className="ck-card ck-empty">לא שויך לקוח לתיק, ולכן אין חשבונות להצגה.</div>}
    </div>
  );
}

export function PortalPreviewPage() {
  return <CockpitFrame title="תצוגת פורטל לקוח" description="כך הלקוח רואה את התיק." path="/workspace/portal-preview">{() => <Preview />}</CockpitFrame>;
}
