import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Client signing in the portal. A client sees the documents a firm sent them to
// sign, reads the exact text, and signs with a typed name and explicit consent,
// or declines. Row-level security returns only the requests addressed to the
// signed-in client's own login email, and signing goes through a validated
// server function, so a client can record a signature and nothing else. This is
// an ordinary electronic signature: a record of name, consent and time.

interface SigReq {
  id: string; title: string; content: string; status: string;
  sent_at: string | null; signed_at: string | null; signed_name: string | null; declined_at: string | null;
  provider: string; signed_document_url: string | null;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "");

export function PortalSigning() {
  const [rows, setRows] = useState<SigReq[]>([]);
  const [rev, setRev] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("lalum_signature_requests")
        .select("id, title, content, status, sent_at, signed_at, signed_name, declined_at, provider, signed_document_url")
        .order("created_at", { ascending: false });
      if (live) setRows((data as SigReq[] | null) ?? []);
    })();
    return () => { live = false; };
  }, [rev]);

  async function openReq(r: SigReq) {
    setActive(r.id); setName(""); setConsent(false); setDeclining(false); setReason(""); setMsg(null);
    if (r.status === "SENT" && supabase) await supabase.rpc("lalum_portal_mark_viewed", { p_request: r.id });
  }

  async function sign(id: string) {
    if (!supabase) return;
    if (!consent || !name.trim()) { setMsg({ ok: false, text: "יש להזין שם מלא ולאשר את ההסכמה." }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("lalum_portal_sign", { p_request: id, p_name: name, p_consent: true, p_user_agent: navigator.userAgent });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setActive(null); setMsg(null); setRev((n) => n + 1);
  }

  async function decline(id: string) {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("lalum_portal_sign", { p_request: id, p_name: "", p_consent: false, p_decline: true, p_reason: reason });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setActive(null); setMsg(null); setRev((n) => n + 1);
  }

  const pending = rows.filter((r) => r.status === "SENT" || r.status === "VIEWED");
  const done = rows.filter((r) => r.status === "SIGNED" || r.status === "DECLINED");
  if (rows.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 28 }}>
      <h2 className="h3" style={{ fontSize: 22 }}>מסמכים לחתימה</h2>
      <p className="muted" style={{ marginTop: 4 }}>מסמכים שהמשרד שלח אליכם לחתימה. קראו את הנוסח, ואם אתם מאשרים, חתמו בשמכם המלא. חתימה אלקטרונית זו מהווה רישום של שמכם, הסכמתכם ומועד החתימה.</p>

      {pending.map((r) => (
        <div key={r.id} className="card" style={{ marginTop: 16 }}>
          <div className="label">{r.title}</div>
          {r.provider === "DOCUSEAL" ? (
            <p className="muted" style={{ marginTop: 8 }}>מסמך זה נשלח לחתימה דרך DocuSeal. בדקו את תיבת הדוא״ל שלכם וחתמו דרך הקישור שנשלח אליכם.</p>
          ) : active === r.id ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto", padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 12, lineHeight: 1.8 }}>{r.content}</div>
              {!declining ? (
                <div style={{ marginTop: 14 }}>
                  <div className="field"><span className="label">שם מלא לחתימה</span><input value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <label className="muted" style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "10px 0" }}>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 4 }} />
                    <span>קראתי את הנוסח לעיל, אני מסכים לתוכנו, וחתימתי האלקטרונית מהווה את חתימתי על המסמך.</span>
                  </label>
                  <div className="grid grid-2" style={{ gap: 8 }}>
                    <button className="btn btn-clay btn-sm" disabled={busy} onClick={() => void sign(r.id)}>חתימה</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDeclining(true)}>סירוב לחתום</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <div className="field"><span className="label">סיבת הסירוב (רשות)</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                  <div className="grid grid-2" style={{ gap: 8 }}>
                    <button className="btn btn-ink btn-sm" disabled={busy} onClick={() => void decline(r.id)}>אישור הסירוב</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDeclining(false)}>חזרה</button>
                  </div>
                </div>
              )}
              {msg && <p className={msg.ok ? "muted" : "notice notice-warn"} style={{ marginTop: 10 }}>{msg.text}</p>}
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <p className="muted" style={{ margin: "0 0 10px" }}>ממתין לחתימתכם{r.sent_at ? ` · נשלח ${fmt(r.sent_at)}` : ""}.</p>
              <button className="btn btn-clay btn-sm" onClick={() => void openReq(r)}>קריאה וחתימה</button>
            </div>
          )}
        </div>
      ))}

      {done.map((r) => (
        <div key={r.id} className="card" style={{ marginTop: 12 }}>
          <div className="label">{r.title}</div>
          {r.status === "SIGNED"
            ? <p className="muted" style={{ margin: "6px 0 0" }}>נחתם{r.signed_name ? ` על ידי „${r.signed_name}"` : ""} בתאריך {fmt(r.signed_at)}.{r.signed_document_url ? <> <a href={r.signed_document_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>המסמך החתום</a></> : null}</p>
            : <p className="muted" style={{ margin: "6px 0 0" }}>סורב בתאריך {fmt(r.declined_at)}.</p>}
        </div>
      ))}
    </div>
  );
}
