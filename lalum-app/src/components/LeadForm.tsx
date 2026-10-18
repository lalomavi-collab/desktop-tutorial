import { useState, type FormEvent } from "react";
import { Link } from "./AppLink";
import { useLang } from "../context/LangContext";
import { supabase } from "../lib/supabase";
import { leadCopy } from "../lib/leadStrings";

type Interest = "real-estate" | "ai-governance" | "other";
type Phase = "closed" | "form" | "sending" | "done";

const field = { width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 10, fontFamily: "var(--sans)", fontSize: 14, background: "var(--paper)", color: "var(--ink)", boxSizing: "border-box" } as const;
const label = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 5 } as const;

// Contact form for a visitor who is not a client yet. It sits in the signed-out chat panel. Consent is an
// unticked checkbox and is required; the server (functions/lalum-lead-submit) enforces that again.
export function LeadForm({ onOpenChange, startOpen = false, source = "chat" }: { onOpenChange?: (open: boolean) => void; startOpen?: boolean; source?: "chat" | "site" }) {
  const { lang } = useLang();
  const L = leadCopy(lang);
  const [phase, setPhase] = useState<Phase>(startOpen ? "form" : "closed");
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", phone: "", email: "", interest: "other" as Interest, note: "", website: "" });
  const [consent, setConsent] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!consent) { setErr(L.errConsent); return; }
    const email = f.email.trim();
    if (!f.name.trim() || (!f.phone.trim() && !email) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setErr(L.errContact); return; }
    setErr(""); setPhase("sending");
    try {
      if (supabase) {
        const { data, error } = await supabase.functions.invoke("lalum-lead-submit", {
          body: { name: f.name, phone: f.phone, email, interest: f.interest, note: f.note, website: f.website, lang, source, consent: true },
        });
        if (error || !data?.ok) { setErr(data?.code === "rate_limited" ? L.errRate : L.errGeneric); setPhase("form"); return; }
      }
      setPhase("done");
    } catch { setErr(L.errGeneric); setPhase("form"); }
  }

  if (phase === "closed") {
    return (
      <button type="button" onClick={() => { setPhase("form"); onOpenChange?.(true); }} style={{ border: 0, background: "none", color: "var(--clay)", textDecoration: "underline", cursor: "pointer", fontSize: 13.5, padding: 6, fontFamily: "var(--sans)" }}>
        {L.open}
      </button>
    );
  }

  if (phase === "done") {
    return (
      <div role="status" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <span style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--clay-tint)", color: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22 }} aria-hidden="true">✓</span>
        <div style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{L.thanksTitle}</div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--slate)", maxWidth: "34ch" }}>{L.thanksBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{ width: "100%", display: "flex", flexDirection: "column", gap: 11, textAlign: "start" }}>
      <div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.2 }}>{L.title}</div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--slate)", lineHeight: 1.5 }}>{L.lead}</p>
      </div>
      <div><label style={label} htmlFor="lead-name">{L.name}</label><input id="lead-name" style={field} value={f.name} onChange={set("name")} autoComplete="name" maxLength={120} required /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={label} htmlFor="lead-phone">{L.phone}</label><input id="lead-phone" style={field} dir="ltr" type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" maxLength={30} /></div>
        <div><label style={label} htmlFor="lead-email">{L.email}</label><input id="lead-email" style={field} dir="ltr" type="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={200} /></div>
      </div>
      <div style={{ fontSize: 12, color: "var(--slate)", marginTop: -6 }}>{L.contactHint}</div>
      <div>
        <label style={label} htmlFor="lead-interest">{L.interest}</label>
        <select id="lead-interest" style={field} value={f.interest} onChange={set("interest")}>
          {(Object.keys(L.interests) as Interest[]).map((k) => <option key={k} value={k}>{L.interests[k]}</option>)}
        </select>
      </div>
      <div>
        <label style={label} htmlFor="lead-note">{L.note}</label>
        <textarea id="lead-note" style={{ ...field, resize: "none" }} rows={2} value={f.note} onChange={set("note")} maxLength={500} />
        <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4, lineHeight: 1.45 }}>{L.noteHint}</div>
      </div>
      {/* Honeypot: hidden from people, filled by bots. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set("website")} style={{ position: "absolute", insetInlineStart: -9999, width: 1, height: 1, opacity: 0 }} />
      <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.55, color: "var(--ink)", cursor: "pointer" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, flex: "none", accentColor: "var(--clay)" }} />
        <span>{L.consentBefore}<Link to="/legal#privacy" style={{ color: "var(--clay)", textDecoration: "underline" }}>{L.consentLink}</Link>{L.consentAfter}</span>
      </label>
      {err && <div role="alert" style={{ fontSize: 13, color: "var(--danger)" }}>{err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={phase === "sending"} className="btn btn-clay btn-sm" style={{ flex: 1, justifyContent: "center" }}>{phase === "sending" ? L.sending : L.submit}</button>
        {!startOpen && <button type="button" onClick={() => { setPhase("closed"); onOpenChange?.(false); }} className="btn btn-sm" style={{ justifyContent: "center" }}>{L.back}</button>}
      </div>
    </form>
  );
}
