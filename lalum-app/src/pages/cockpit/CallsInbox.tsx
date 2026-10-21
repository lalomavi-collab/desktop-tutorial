import { useCallback, useEffect, useMemo, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../components/Icon";
import { useLang } from "../../context/LangContext";
import { bcp47For } from "../../lib/hreflang";
import { paymentsEnabled } from "../../lib/content";

// Incoming AI calls, moved out of the client portal into the cockpit. Each call
// the voice agent handled is grouped into a folder per caller, with its summary,
// any task the agent opened, and a one-click charge for a billable call (the
// amount the voice billing already computed). This is firm desk work, not a
// client surface. The data query, grouping and charge logic are unchanged from
// their former home in the portal; the screen now loads its own calls and
// refreshes itself after a charge.

type CallRow = {
  id: string;
  caller_phone: string;
  duration_seconds: number;
  client_intent: string | null;
  is_billable: boolean;
  is_processed: boolean;
  summary: string | null;
  created_at: string;
  lalum_crm_tasks: { title: string; priority: string; due_date: string; status: string }[] | null;
  lalum_billing_ledgers: { amount: number; currency: string; billed_hours: number }[] | null;
};

function CallsInboxInner({ canView }: { canView: boolean }) {
  const { t, lang } = useLang();
  const C = t.ui.portal.calls;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(bcp47For(lang), { day: "numeric", month: "short" });

  const [calls, setCalls] = useState<CallRow[] | null>(null);
  const [chargingId, setChargingId] = useState<string | undefined>();
  const [chargedIds, setChargedIds] = useState<Set<string>>(new Set());
  const [openCaller, setOpenCaller] = useState<string | undefined>();

  const loadCalls = useCallback(async () => {
    if (!supabase) return;
    const callRes = await supabase
      .from("lalum_calls_meta")
      .select(
        "id, caller_phone, duration_seconds, client_intent, is_billable, is_processed, summary, created_at, lalum_crm_tasks(title, priority, due_date, status), lalum_billing_ledgers(amount, currency, billed_hours)"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    setCalls((callRes.data as unknown as CallRow[] | null) ?? []);
  }, []);
  useEffect(() => { if (canView) void loadCalls(); }, [canView, loadCalls]);

  // One-click: turn a billable call into a payment request, reusing the amount
  // the voice billing already computed (gross, VAT included).
  async function chargeForCall(c: CallRow) {
    const bill = c.lalum_billing_ledgers?.[0];
    if (!supabase || !bill || chargingId) return;
    setChargingId(c.id);
    try {
      const title = `${C.chargeTitle} · ${c.caller_phone}`;
      const { error } = await supabase.from("billing_milestones").insert({
        title,
        amount: bill.amount,
        currency: bill.currency,
        client_email: null,
        client_phone: c.caller_phone,
        client_name: C.chargeTitle,
      });
      if (error) throw error;
      setChargedIds((s) => new Set(s).add(c.id));
      await loadCalls();
    } catch {
      window.alert(t.ui.portal.billing.err);
    } finally {
      setChargingId(undefined);
    }
  }

  const callGroups = useMemo(() => {
    const map = new Map<string, CallRow[]>();
    for (const c of calls ?? []) {
      const key = c.caller_phone || "ללא מספר";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    const groups = [...map.entries()].map(([phone, rows]) => ({ phone, rows, unprocessed: rows.filter((r) => !r.is_processed).length }));
    groups.sort((a, b) => (b.unprocessed > 0 ? 1 : 0) - (a.unprocessed > 0 ? 1 : 0) || (b.rows[0]?.created_at ?? "").localeCompare(a.rows[0]?.created_at ?? ""));
    return groups;
  }, [calls]);

  function renderCallCard(c: CallRow) {
    const task = c.lalum_crm_tasks?.[0];
    const bill = c.lalum_billing_ledgers?.[0];
    const intent = c.client_intent ? (C.intents[c.client_intent as keyof typeof C.intents] ?? c.client_intent) : null;
    const dueDays = task ? Math.max(0, Math.round((new Date(task.due_date).getTime() - Date.now()) / 86400000)) : null;
    return (
      <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 18, background: "var(--card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          {intent && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--clay)", textTransform: "uppercase", letterSpacing: ".06em" }}>{intent}</span>}
          {!c.is_processed && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{C.processing}</span>}
          {c.is_billable && <span style={{ fontSize: 11, fontWeight: 700, color: "#2c6444" }}>{C.billable}</span>}
          <span className="muted" style={{ fontSize: 12, marginInlineStart: "auto" }}>{fmtDate(c.created_at)}</span>
        </div>
        {c.summary && <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.6 }}>{c.summary}</p>}
        {task && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5, borderTop: "1px dashed var(--line)", paddingTop: 10 }}>
            <span style={{ fontWeight: 700, color: "var(--clay)" }}>{C.task}:</span>
            <span>{task.title}</span>
            <span className="muted">({C.priorities[task.priority as keyof typeof C.priorities] ?? task.priority})</span>
            {dueDays !== null && <span className="muted" style={{ marginInlineStart: "auto" }}>{C.due} {dueDays} {C.days}</span>}
          </div>
        )}
        {paymentsEnabled && c.is_billable && bill && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            {chargedIds.has(c.id) ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: "#2c6444" }}>{C.charged}</span>
            ) : (
              <button type="button" className="btn btn-clay btn-sm" disabled={chargingId === c.id} onClick={() => void chargeForCall(c)}>
                <Icon name="scale" size={15} /> {chargingId === c.id ? C.charging : C.charge} · {bill.amount} {bill.currency}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!canView) return <div className="ck-card"><div className="ck-title">אין הרשאה</div><div className="ck-meta">צפייה בשיחות הנכנסות פתוחה למנהל הפירמה.</div></div>;
  if (calls === null) return <div className="ck-meta">טוען...</div>;

  return (
    <div className="card" style={{ padding: 34, marginBottom: 28, borderColor: "var(--clay)" }}>
      {calls.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>{C.none}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {callGroups.map((g) => {
            const open = openCaller === g.phone;
            return (
              <div key={g.phone} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                <button type="button" onClick={() => setOpenCaller(open ? undefined : g.phone)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px", background: open ? "var(--clay-tint)" : "none", border: "none", cursor: "pointer", textAlign: "start", font: "inherit", color: "inherit" }}>
                  <Icon name="phone" size={17} />
                  <span dir="ltr" style={{ fontWeight: 600 }}>{g.phone}</span>
                  {g.unprocessed > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--clay)", borderRadius: 9999, padding: "2px 9px" }}>{g.unprocessed} {C.toProcess}</span>}
                  <span className="muted" style={{ fontSize: 12.5, marginInlineStart: "auto" }}>{g.rows.length} {C.callsWord}</span>
                  <span className={"faq-chevron" + (open ? " open" : "")} aria-hidden="true"><Icon name="chevron-d" size={16} /></span>
                </button>
                {open && (
                  <div style={{ borderTop: "1px solid var(--line)", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                    {g.rows.map((c) => renderCallCard(c))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Incoming AI calls, framed for the cockpit. */
export function CallsInbox() {
  return (
    <CockpitFrame title="שיחות נכנסות" description="שיחות שטיפל בהן סוכן הקול, מקובצות לפי מתקשר, עם סיכום, משימה וחיוב בלחיצה." path="/workspace/calls">
      {({ member, platformAdmin }) => <CallsInboxInner canView={platformAdmin || member?.role === "ADMIN"} />}
    </CockpitFrame>
  );
}
