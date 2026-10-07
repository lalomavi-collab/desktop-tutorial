import { useState } from "react";
import { supabase } from "../../lib/supabase";

interface Props {
  matterId: string;
  practiceArea: string;
  basis: string;
  consentAt: string | null;
  endedAt: string | null;
  canManage: boolean;
  onChange: () => void;
}
const he = (iso: string) => iso.split("-").reverse().join(".");
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const addYears = (iso: string, n: number) => { const d = new Date(iso); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10); };

/** Retention of the matter file under Advocates Law s.90A: 7 years from end of handling (25 for real estate documents) unless the client agreed in writing to another period. */
export function Retention({ matterId, practiceArea, basis, consentAt, endedAt, canManage, onChange }: Props) {
  const [consent, setConsent] = useState("");
  const [attest, setAttest] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const years = practiceArea === "REAL_ESTATE" ? 25 : 7;
  const isConsent = basis === "CLIENT_CONSENT_30D";
  async function call(fn: string, args: Record<string, unknown>) {
    if (!supabase) return;
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    if (error) setMsg("הפעולה נכשלה. הפעולה זמינה לשותף בלבד."); else onChange();
  }
  return (
    <>
      <div className="ck-label">שמירת חומרי התיק</div>
      <div className="ck-card">
        {!isConsent && <div className="ck-meta">לפי כללי השמירה בחוק לשכת עורכי הדין (סעיף 90א), חומר התיק נשמר <b>{years} שנים</b> מסיום הטיפול{years === 25 ? " (מסמכי מקרקעין: 25 שנה)" : ""}{endedAt ? <>, כלומר עד <b>{he(addYears(endedAt, years))}</b></> : null}. הפלטפורמה לא מוחקת אוטומטית חומר בתיק כזה.</div>}
        {isConsent && <div className="ck-meta">הסכמת לקוח בכתב מיום <b>{consentAt ? he(consentAt) : ""}</b>. {endedAt ? <>המסמכים יימחקו אוטומטית ב-<b>{he(addDays(endedAt, 30))}</b> (30 יום מסיום הטיפול).</> : <>המניין יתחיל בסיום הטיפול בתיק, ו-30 יום אחריו המסמכים יימחקו אוטומטית.</>}</div>}
        {!endedAt && <div className="ck-meta">הטיפול בתיק טרם הסתיים. מניין תקופת השמירה מתחיל בסיום הטיפול.</div>}
        {canManage && (
          <div className="ck-stack">
            {!endedAt && <button className="ck-btn" onClick={() => { if (window.confirm("לסמן שהטיפול בתיק הסתיים ולהעביר לארכיון?")) void call("lalum_end_matter_handling", { p_matter: matterId }); }}>סיום טיפול בתיק</button>}
            {!isConsent ? (
              <details><summary className="ck-btn" style={{ display: "inline-flex" }}>הסכמת לקוח בכתב לביעור אחרי 30 יום</summary>
                <div className="ck-stack" style={{ marginTop: 8 }}>
                  <div className="ck-meta">מותר רק אם הלקוח הסכים בכתב (למשל בהסכם שכר הטרחה) ויכול לבקש את החומר לפני כן. המחיקה סופית ואינה ניתנת לשחזור.</div>
                  <input className="field" type="date" aria-label="תאריך ההסכמה בכתב" value={consent} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setConsent(e.target.value)} />
                  <label className="ck-meta"><input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} /> אני מאשר שקיימת הסכמה בכתב של הלקוח וששמרתי עותק ממנה</label>
                  <button className="ck-btn primary" disabled={!consent || !attest} onClick={() => void call("lalum_set_matter_retention", { p_matter: matterId, p_basis: "CLIENT_CONSENT_30D", p_consent_date: consent })}>שמירת הסכמה</button>
                </div></details>
            ) : <button className="ck-btn" onClick={() => { if (window.confirm("לחזור לשמירה לפי חוק? המחיקה האוטומטית תבוטל.")) void call("lalum_set_matter_retention", { p_matter: matterId, p_basis: "STATUTORY" }); }}>חזרה לשמירה לפי חוק</button>}
          </div>
        )}
        {msg && <div className="ck-err" aria-live="polite">{msg}</div>}
      </div>
    </>
  );
}
