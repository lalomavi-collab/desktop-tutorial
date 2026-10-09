import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { verifyCode } from "../../lib/cockpit/mfa";
import { generateRecoveryCodes } from "../../lib/cockpit/recovery";

interface Pending { id: string; qr: string; secret: string; uri: string }

/**
 * Enrol an authenticator app, then hand out one-time recovery codes.
 * On a phone the QR cannot be scanned from the same screen, so the primary
 * action there is the otpauth link (opens the authenticator app directly) and
 * the secret can be copied; the QR stays for a second device.
 */
export function TotpEnroll({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  async function start() {
    if (!supabase) return;
    setErr(null); setBusy(true);
    // Drop an abandoned, never-verified factor first: Supabase refuses a second enrolment under the same name.
    const existing = await supabase.auth.mfa.listFactors();
    for (const f of (existing.data?.all ?? []).filter((x) => x.factor_type === "totp" && x.status === "unverified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `LALUM ${new Date().toISOString().slice(0, 16).replace("T", " ")}` });
    setBusy(false);
    if (error || !data) { setErr("לא ניתן להפעיל אימות דו-שלבי כרגע."); return; }
    setPending({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
  }

  async function confirm() {
    if (!pending) return;
    setErr(null); setBusy(true);
    const r = await verifyCode(pending.id, code);
    if (r) { setBusy(false); setErr(r); return; }
    // The fresh session is aal2 now, so recovery codes can be issued straight away.
    const res = await generateRecoveryCodes();
    setBusy(false);
    setPending(null); setCode("");
    if (res.codes) setCodes(res.codes); else onDone();
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* the text stays selectable */ }
  }

  if (codes) {
    return (
      <div className="ck-card" style={{ maxWidth: 480, margin: "24px auto" }}>
        <div className="ck-title">שמרו את קודי השחזור</div>
        <div className="ck-meta">כל קוד טוב לשימוש אחד, ומחליף את האפליקציה אם הטלפון אבד. הם מוצגים רק עכשיו. שמרו אותם במנהל סיסמאות או בהדפסה, לא באותו טלפון.</div>
        <div dir="ltr" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "monospace", fontSize: 16 }}>
          {codes.map((c) => <code key={c}>{c}</code>)}
        </div>
        <div className="ck-row">
          <button className="ck-btn" onClick={() => void copy(codes.join("\n"))}>{copied ? "הועתק" : "העתקת הקודים"}</button>
          <button className="ck-btn primary" onClick={onDone}>שמרתי, להמשך</button>
        </div>
      </div>
    );
  }

  if (!pending) {
    return (
      <div className="ck-card" style={{ maxWidth: 480, margin: "24px auto" }}>
        <div className="ck-title">הפעלת אימות דו-שלבי</div>
        <div className="ck-meta">תצטרכו אפליקציית אימות (Google Authenticator, Microsoft Authenticator, 1Password או סיסמאות של אפל). בסיום תקבלו קודי שחזור למקרה שהטלפון יאבד.</div>
        {err && <div className="ck-err" aria-live="polite">{err}</div>}
        <div className="ck-row">
          <button className="ck-btn primary" disabled={busy} onClick={() => void start()}>{busy ? "מכין..." : "התחלה"}</button>
          {onCancel && <button className="ck-btn" onClick={onCancel}>ביטול</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="ck-card" style={{ maxWidth: 480, margin: "24px auto" }}>
      <div className="ck-title">שלב 1: חיבור האפליקציה</div>
      <div className="ck-meta">בטלפון: לחצו על הכפתור, האפליקציה תיפתח ותוסיף את החשבון. במחשב: סרקו את הברקוד.</div>
      <a className="ck-btn primary" href={pending.uri}>פתיחה באפליקציית האימות</a>
      <img src={pending.qr} alt="ברקוד להגדרת אימות" width={200} height={200} style={{ alignSelf: "center", background: "#fff", padding: 8, borderRadius: 8 }} />
      <div className="ck-meta">אם אי אפשר לפתוח או לסרוק, הזינו ידנית את המפתח:</div>
      <div className="ck-row" style={{ alignItems: "center" }}>
        <code dir="ltr" style={{ wordBreak: "break-all", flex: 1 }}>{pending.secret}</code>
        <button className="ck-btn" onClick={() => void copy(pending.secret)}>{copied ? "הועתק" : "העתקה"}</button>
      </div>
      <div className="ck-title">שלב 2: אישור</div>
      <input className="field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" aria-label="קוד אימות" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      {err && <div className="ck-err" aria-live="polite">{err}</div>}
      <div className="ck-row">
        <button className="ck-btn primary" disabled={busy || code.length !== 6} onClick={() => void confirm()}>{busy ? "מאמת..." : "אישור והפעלה"}</button>
        <button className="ck-btn" onClick={() => { setPending(null); setCode(""); setErr(null); }}>חזרה</button>
      </div>
    </div>
  );
}
