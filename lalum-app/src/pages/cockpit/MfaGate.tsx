import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMfaState, verifyCode } from "../../lib/cockpit/mfa";
import { redeemRecoveryCode } from "../../lib/cockpit/recovery";
import { TotpEnroll } from "./TotpEnroll";

/** Second factor for partners and admins. Challenge when a factor exists; nudge (or block, when the firm requires it) when none is enrolled. */
export function MfaGate({ required, children }: { required: boolean; children: ReactNode }) {
  const { mfa, refresh } = useMfaState();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  async function useRecovery(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await redeemRecoveryCode(recovery);
    setBusy(false);
    if (r) { setErr(r); return; }
    setRecovery(""); setLost(false); await refresh();
  }
  async function submit(e: FormEvent, factorId: string) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await verifyCode(factorId, code);
    setBusy(false);
    if (r) setErr(r); else { setCode(""); await refresh(); }
  }
  if (mfa.state === "loading") return <div className="ck-meta">טוען...</div>;
  if (mfa.state === "challenge" && lost) return (
    <form className="ck-card mfa-box" onSubmit={(e) => void useRecovery(e)}>
      <div className="ck-title">כניסה עם קוד שחזור</div>
      <div className="ck-meta">זו כניסה למי שאין לו גישה לאפליקציית האימות. אם האפליקציה בידיכם, לחצו "חזרה" והזינו את הקוד בן 6 הספרות ממנה.</div>
      <div className="ck-meta"><b>איפה הקוד?</b> קודי השחזור הוצגו לכם פעם אחת, ברגע שהפעלתם אימות דו-שלבי. כל קוד הוא 10 תווים בצורה XXXXX-XXXXX. חפשו אותם במנהל הסיסמאות או בהדפסה ששמרתם. המערכת לא שומרת אותם ולא יכולה להציג אותם שוב.</div>
      <div className="ck-meta">הקוד תקף לשימוש אחד, ואחרי הכניסה האפליקציה הישנה תוסר כדי שתוכלו לחבר אפליקציה חדשה.</div>
      <label className="mfa-label" htmlFor="mfa-recovery">קוד שחזור</label>
      <input id="mfa-recovery" className="field" autoComplete="off" autoCapitalize="characters" maxLength={11} dir="ltr" aria-label="קוד שחזור" placeholder="XXXXX-XXXXX" value={recovery} onChange={(e) => setRecovery(e.target.value)} />
      {err && <div className="ck-err" aria-live="polite">{err}</div>}
      <div className="ck-row">
        <button className="ck-btn primary" disabled={busy || recovery.replace(/[^A-Za-z0-9]/g, "").length !== 10}>{busy ? "בודק..." : "אימות"}</button>
        <button type="button" className="ck-btn" onClick={() => { setLost(false); setErr(null); }}>חזרה לקוד מהאפליקציה</button>
      </div>
    </form>
  );
  if (mfa.state === "challenge") {
    const active = factorId ?? mfa.factorId;
    return (
      <form className="ck-card mfa-box" onSubmit={(e) => void submit(e, active)}>
        <div className="ck-title">אימות דו-שלבי</div>
        <div className="ck-meta">הזינו את הקוד בן 6 הספרות מאפליקציית האימות.</div>
        {mfa.factors.length > 1 && (
          <>
            <div className="ck-meta">מחוברים לחשבון כמה גורמי אימות. אם הקוד לא תואם, נסו לבחור את הגורם הנכון:</div>
            <div className="ck-row" style={{ flexWrap: "wrap" }}>
              {mfa.factors.map((f) => (
                <button type="button" key={f.id} className={"ck-btn" + (f.id === active ? " primary" : "")} onClick={() => { setFactorId(f.id); setErr(null); }}>
                  {f.name}
                </button>
              ))}
            </div>
          </>
        )}
        <label className="mfa-label" htmlFor="mfa-code">קוד בן 6 ספרות</label>
        <input id="mfa-code" className="field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" aria-label="קוד אימות" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        {err && <div className="ck-err" aria-live="polite">{err}</div>}
        <button className="ck-btn primary" disabled={busy || code.length !== 6}>{busy ? "מאמת..." : "אימות"}</button>
        {mfa.factors.length > 1 && (
          <div className="ck-meta">גורם ישן שכבר לא בשימוש? אפשר להסיר אותו מ<Link to="/settings/security">אבטחת חשבון</Link> אחרי הכניסה, כדי שלא יבחר שוב בטעות.</div>
        )}
        <button type="button" className="mfa-lost" onClick={() => { setLost(true); setErr(null); }}>אין לי גישה לאפליקציה (כניסה עם קוד שחזור)</button>
      </form>
    );
  }
  if (mfa.state === "enroll" && required) return <TotpEnroll onDone={() => void refresh()} />;
  return (
    <>
      {mfa.state === "enroll" && <div className="ck-warn">מומלץ להפעיל אימות דו-שלבי לחשבון. <Link to="/settings/security">להפעלה</Link></div>}
      {children}
    </>
  );
}
