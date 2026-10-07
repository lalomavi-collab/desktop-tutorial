import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMfaState, verifyCode } from "../../lib/cockpit/mfa";

/** Second factor for partners and admins. Challenge when a factor exists; nudge (or block, when the firm requires it) when none is enrolled. */
export function MfaGate({ required, children }: { required: boolean; children: ReactNode }) {
  const { mfa, refresh } = useMfaState();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent, factorId: string) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await verifyCode(factorId, code);
    setBusy(false);
    if (r) setErr(r); else { setCode(""); await refresh(); }
  }
  if (mfa.state === "loading") return <div className="ck-meta">טוען...</div>;
  if (mfa.state === "challenge") return (
    <form className="ck-card" style={{ maxWidth: 420, margin: "40px auto" }} onSubmit={(e) => void submit(e, mfa.factorId)}>
      <div className="ck-title">אימות דו-שלבי</div>
      <div className="ck-meta">הזינו את הקוד בן 6 הספרות מאפליקציית האימות.</div>
      <input className="field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" aria-label="קוד אימות" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      {err && <div className="ck-err" aria-live="polite">{err}</div>}
      <button className="ck-btn primary" disabled={busy || code.length !== 6}>{busy ? "מאמת..." : "אימות"}</button>
    </form>
  );
  if (mfa.state === "enroll" && required) return (
    <div className="ck-card" style={{ maxWidth: 480, margin: "40px auto" }}>
      <div className="ck-title">נדרש אימות דו-שלבי</div>
      <div className="ck-meta">המשרד מחייב אימות דו-שלבי לשותפים. הפעילו אותו כדי להמשיך.</div>
      <Link className="ck-btn primary" to="/settings/security">להפעלת האימות</Link>
    </div>
  );
  return (
    <>
      {mfa.state === "enroll" && <div className="ck-warn">מומלץ להפעיל אימות דו-שלבי לחשבון. <Link to="/settings/security">להפעלה</Link></div>}
      {children}
    </>
  );
}
