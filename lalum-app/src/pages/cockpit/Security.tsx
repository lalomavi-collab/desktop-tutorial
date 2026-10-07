import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { verifyCode } from "../../lib/cockpit/mfa";
import { CockpitFrame } from "./CockpitFrame";

interface Factor { id: string; friendly_name?: string; status: string }

function Panel() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
    const f = await supabase.auth.mfa.listFactors();
    setFactors((f.data?.totp as Factor[] | undefined) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function start() {
    if (!supabase) return;
    setMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `LALUM ${new Date().toISOString().slice(0, 10)}` });
    if (error || !data) { setMsg({ ok: false, text: "לא ניתן להפעיל אימות דו-שלבי כרגע. ייתכן שהוא כבוי בהגדרות הפרויקט." }); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function confirm() {
    if (!enroll) return;
    const r = await verifyCode(enroll.id, code);
    if (r) { setMsg({ ok: false, text: r }); return; }
    setEnroll(null); setCode(""); setMsg({ ok: true, text: "האימות הדו-שלבי הופעל." }); await load();
  }
  async function remove(id: string) {
    if (!supabase || !window.confirm("להסיר את גורם האימות? החשבון יהיה פחות מוגן.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setMsg(error ? { ok: false, text: "ההסרה נכשלה. נדרש אימות דו-שלבי בתוקף." } : { ok: true, text: "הוסר." });
    await load();
  }
  const active = factors.filter((f) => f.status === "verified");
  return (
    <div className="ck-stack">
      <div className="ck-card">
        <div className="ck-title">אימות דו-שלבי (TOTP)</div>
        <div className="ck-meta">בנוסף לסיסמה, כל כניסה מחייבת קוד בן 6 ספרות מאפליקציית אימות (Google Authenticator, Microsoft Authenticator, 1Password ועוד). כך גם סיסמה שדלפה אינה מספיקה לגישה לחומר לקוחות.</div>
        {active.length === 0 ? <div className="ck-warn">האימות הדו-שלבי אינו מופעל בחשבון זה.</div> : <div className="ck-ok">מופעל. גורמי אימות: {active.length}</div>}
      </div>
      {!enroll && <div><button className="ck-btn primary" onClick={() => void start()}>{active.length ? "הוספת גורם אימות" : "הפעלת אימות דו-שלבי"}</button></div>}
      {enroll && (
        <div className="ck-card">
          <div className="ck-title">שלב 1: סריקה</div>
          <div className="ck-meta">סרקו את הקוד באפליקציית האימות. אם אי אפשר לסרוק, הזינו ידנית את המפתח.</div>
          <img src={enroll.qr} alt="קוד QR להגדרת אימות" width={180} height={180} />
          <code dir="ltr" style={{ wordBreak: "break-all" }}>{enroll.secret}</code>
          <div className="ck-title">שלב 2: אישור</div>
          <input className="field" inputMode="numeric" maxLength={6} dir="ltr" aria-label="קוד אימות" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <div className="ck-row"><button className="ck-btn primary" disabled={code.length !== 6} onClick={() => void confirm()}>אישור והפעלה</button><button className="ck-btn" onClick={() => setEnroll(null)}>ביטול</button></div>
        </div>
      )}
      {active.length > 0 && <div className="ck-card"><div className="ck-label">גורמי אימות</div>{active.map((f) => <div key={f.id} className="ck-row" style={{ justifyContent: "space-between" }}><span>{f.friendly_name ?? "TOTP"}</span><button className="ck-btn" onClick={() => void remove(f.id)}>הסרה</button></div>)}<div className="ck-meta">שמרו קוד גיבוי או הוסיפו גורם נוסף, כדי לא להינעל מחוץ לחשבון אם הטלפון אובד.</div></div>}
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
    </div>
  );
}

export function Security() {
  return (
    <CockpitFrame title="אבטחת חשבון" description="הפעלה וניהול של אימות דו-שלבי לחשבון." path="/settings/security" needsFirm={false} mfa={false}>
      {() => <Panel />}
    </CockpitFrame>
  );
}
