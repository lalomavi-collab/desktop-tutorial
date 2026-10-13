import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { generateRecoveryCodes } from "../../lib/cockpit/recovery";
import { TotpEnroll } from "./TotpEnroll";
import { CockpitFrame } from "./CockpitFrame";

interface Factor { id: string; friendly_name?: string; status: string }

function Panel() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
    const f = await supabase.auth.mfa.listFactors();
    setFactors((f.data?.totp as Factor[] | undefined) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function remove(id: string) {
    if (!supabase || !window.confirm("להסיר את גורם האימות? החשבון יהיה פחות מוגן.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setMsg(error ? { ok: false, text: "ההסרה נכשלה. נדרש אימות דו-שלבי בתוקף." } : { ok: true, text: "הוסר." });
    await load();
  }
  async function regenerate() {
    if (!window.confirm("קודי השחזור הקודמים יפסיקו לעבוד. להפיק קודים חדשים?")) return;
    const r = await generateRecoveryCodes();
    if (r.codes) { setNewCodes(r.codes); setMsg({ ok: true, text: "הקודים החדשים מוצגים רק עכשיו. שמרו אותם." }); } else setMsg({ ok: false, text: r.error ?? "ההפקה נכשלה." });
  }
  const active = factors.filter((f) => f.status === "verified");
  return (
    <div className="ck-stack">
      <div className="ck-card">
        <div className="ck-title">אימות דו-שלבי (TOTP)</div>
        <div className="ck-meta">בנוסף לסיסמה, כל כניסה מחייבת קוד בן 6 ספרות מאפליקציית אימות (Google Authenticator, Microsoft Authenticator, 1Password ועוד). כך גם סיסמה שדלפה אינה מספיקה לגישה לחומר לקוחות.</div>
        {active.length === 0 ? <div className="ck-warn">האימות הדו-שלבי אינו מופעל בחשבון זה.</div> : <div className="ck-ok">מופעל. גורמי אימות: {active.length}</div>}
      </div>
      {!enrolling && <div><button className="ck-btn primary" onClick={() => setEnrolling(true)}>{active.length ? "הוספת גורם אימות" : "הפעלת אימות דו-שלבי"}</button></div>}
      {enrolling && <TotpEnroll onDone={() => { setEnrolling(false); setMsg({ ok: true, text: "האימות הדו-שלבי הופעל." }); void load(); }} onCancel={() => setEnrolling(false)} />}
      {active.length > 0 && <div className="ck-card"><div className="ck-label">גורמי אימות</div>{active.map((f) => <div key={f.id} className="ck-row" style={{ justifyContent: "space-between" }}><span>{f.friendly_name ?? "TOTP"}</span><button className="ck-btn" onClick={() => void remove(f.id)}>הסרה</button></div>)}<div className="ck-meta">שמרו קודי שחזור או הוסיפו גורם נוסף, כדי לא להינעל מחוץ לחשבון אם הטלפון אובד.</div>
        <div><button className="ck-btn" onClick={() => void regenerate()}>הפקת קודי שחזור חדשים</button></div>
        {newCodes && <div dir="ltr" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "monospace" }}>{newCodes.map((c) => <code key={c}>{c}</code>)}</div>}</div>}
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
