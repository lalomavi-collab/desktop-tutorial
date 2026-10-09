import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { fmt } from "../../lib/cockpit/shared";

// Client signing from the firm side. The firm prepares a document for a client
// to sign through the portal: a title, the exact text the client will see, and
// the client's login email. Sending pins a hash of the content, so a later edit
// cannot change what was signed. This is the one firm-to-client hand-off in the
// system: the client and the firm are otherwise separate worlds that share only
// the login email, which is how a sent request reaches the right client.
//
// The content here is the real, client-facing text and is firm-authored. It is
// not pulled from the masked working document (that stays firm-only), so the
// firm pastes or writes the final text it wants the client to sign.

interface SigReq {
  id: string; title: string; content: string; signer_name: string; signer_email: string;
  status: string; sent_at: string | null; viewed_at: string | null; signed_at: string | null;
  signed_name: string | null; declined_at: string | null; decline_reason: string | null;
}

const STATUS: Record<string, [string, string]> = {
  DRAFT: ["", "טיוטה"],
  SENT: ["yellow", "נשלח"],
  VIEWED: ["yellow", "נצפה"],
  SIGNED: ["green", "נחתם"],
  DECLINED: ["red", "סורב"],
  CANCELLED: ["", "בוטל"],
};

const blank = { title: "", content: "", signer_name: "", signer_email: "" };

export function SignatureRequests({ matterId, firmId, documentId, canManage }: {
  matterId: string; firmId: string; documentId: string | null; canManage: boolean;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SigReq[]>([]);
  const [rev, setRev] = useState(0);
  const [form, setForm] = useState({ ...blank });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("lalum_signature_requests")
        .select("id, title, content, signer_name, signer_email, status, sent_at, viewed_at, signed_at, signed_name, declined_at, decline_reason")
        .eq("matter_id", matterId).order("created_at", { ascending: false });
      if (live) setRows((data as SigReq[] | null) ?? []);
    })();
    return () => { live = false; };
  }, [matterId, rev]);

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function create() {
    if (!supabase || !user) return;
    if (!form.title.trim() || !form.content.trim() || !form.signer_email.trim()) {
      setMsg({ ok: false, text: "יש למלא כותרת, תוכן ודוא״ל של החותם." }); return;
    }
    const { error } = await supabase.from("lalum_signature_requests").insert({
      firm_id: firmId, matter_id: matterId, document_id: documentId,
      title: form.title.trim(), content: form.content, signer_name: form.signer_name.trim(),
      signer_email: form.signer_email.trim(), created_by: user.id,
    });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setForm({ ...blank }); setOpen(false); setMsg({ ok: true, text: "נוצרה טיוטת בקשת חתימה." }); setRev((n) => n + 1);
  }

  async function send(id: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_signature_send", { p_request: id });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "הבקשה נשלחה ללקוח." });
    setRev((n) => n + 1);
  }

  async function removeDraft(id: string) {
    if (!supabase) return;
    await supabase.from("lalum_signature_requests").delete().eq("id", id);
    setRev((n) => n + 1);
  }

  if (!canManage) return null;

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>החתמת לקוח{rows.length ? ` (${rows.length})` : ""}</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-meta">הכנת מסמך לחתימת לקוח דרך הפורטל. הלקוח נכנס לאזור האישי, קורא את הנוסח וחותם בשמו ובאישור מפורש. התוכן כאן הוא הנוסח הסופי שהלקוח יראה, והוא באחריות המשרד (אינו נשלף מהמסמך המוסתר).</div>

        {rows.map((r) => {
          const st = STATUS[r.status] ?? ["", r.status];
          return (
            <div key={r.id} className="ck-card ck-stack" style={{ gap: 6 }}>
              <div className="ck-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span className="ck-title">{r.title}</span>
                <span className={`ck-badge ${st[0]}`}>{st[1]}</span>
              </div>
              <div className="ck-meta">חותם: {r.signer_name || "—"} · <span dir="ltr">{r.signer_email}</span></div>
              {r.status === "SIGNED" && <div className="ck-ok">נחתם על ידי „{r.signed_name}" בתאריך {fmt(r.signed_at)}.</div>}
              {r.status === "DECLINED" && <div className="ck-err">סורב {fmt(r.declined_at)}{r.decline_reason ? `: ${r.decline_reason}` : "."}</div>}
              {(r.status === "SENT" || r.status === "VIEWED") && <div className="ck-meta">נשלח {fmt(r.sent_at)}{r.viewed_at ? ` · נצפה ${fmt(r.viewed_at)}` : ""}. ממתין לחתימת הלקוח.</div>}
              {r.status === "DRAFT" && (
                <div className="ck-row" style={{ gap: 6 }}>
                  <button className="ck-btn primary" onClick={() => void send(r.id)}>שליחה ללקוח</button>
                  <button className="ck-btn danger" onClick={() => void removeDraft(r.id)}>מחיקה</button>
                </div>
              )}
            </div>
          );
        })}

        {open ? (
          <div className="ck-card ck-stack">
            <div className="ck-field">כותרת המסמך<input className="ck-input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="הסכם שכר טרחה" /></div>
            <div className="ck-grid2">
              <div className="ck-field">שם החותם<input className="ck-input" value={form.signer_name} onChange={(e) => set("signer_name", e.target.value)} /></div>
              <div className="ck-field">דוא״ל החותם (כפי שמופיע בהתחברות לפורטל)<input className="ck-input" dir="ltr" value={form.signer_email} onChange={(e) => set("signer_email", e.target.value)} /></div>
            </div>
            <div className="ck-field">נוסח לחתימה<textarea className="ck-textarea" style={{ minHeight: 160 }} value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="הדביקו או כתבו כאן את הנוסח הסופי שהלקוח יקרא ויחתום עליו." /></div>
            <div className="ck-row" style={{ gap: 6 }}>
              <button className="ck-btn primary" onClick={() => void create()}>יצירת טיוטה</button>
              <button className="ck-btn" onClick={() => { setOpen(false); setForm({ ...blank }); }}>ביטול</button>
              {msg && <span className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite" style={{ padding: "6px 12px" }}>{msg.text}</span>}
            </div>
          </div>
        ) : (
          <div className="ck-row" style={{ gap: 6 }}>
            <button className="ck-btn" onClick={() => { setOpen(true); setMsg(null); }}>בקשת חתימה חדשה</button>
            {msg && <span className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite" style={{ padding: "6px 12px" }}>{msg.text}</span>}
          </div>
        )}
        <div className="ck-meta">זוהי חתימה אלקטרונית רגילה: רישום של שם, אישור ומועד. אין בה כדי לקבוע את מעמדה המשפטי של החתימה בכל הקשר, והתאמת אופן החתימה לדרישות הדין היא באחריות המשרד.</div>
      </div>
    </details>
  );
}
