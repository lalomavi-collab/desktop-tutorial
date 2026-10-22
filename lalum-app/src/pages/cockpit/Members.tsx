import { useCallback, useEffect, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { supabase } from "../../lib/supabase";
import { ROLE } from "../../lib/cockpit/shared";

// Firm roster administration. An admin sets each member's role; an admin or
// partner sets a member's department. Both changes are written to the audit
// chain with their exact time by the RPCs. New people are provisioned by
// LALUM, so this screen manages who is already in the firm, not sign-up.

interface Person { user_id: string; name: string; role: string; department: string | null }

const ROLE_ORDER = ["ADMIN", "FIRM_PARTNER", "ATTORNEY", "COMPLIANCE_OFFICER", "BOOKKEEPER"] as const;

// Turn an RPC error into Hebrew the firm can act on.
function errText(message: string): string {
  if (message.includes("last administrator")) return "לא ניתן להסיר את המנהל האחרון של הפירמה.";
  if (message.includes("not allowed")) return "אין לך הרשאה לפעולה זו.";
  if (message.includes("invalid role")) return "תפקיד לא חוקי.";
  if (message.includes("no e-mail")) return "לחשבון הזה אין כתובת דוא\"ל.";
  if (message.includes("not a firm member")) return "המשתמש אינו חבר בפירמה.";
  if (message.includes("role cannot be granted")) return "ניתן לאפשר חשיפת שמות רק לשותף או לעורך דין.";
  if (message.includes("no sign in")) return "אין חשבון עם הכתובת הזו. יש להזמין אותה קודם להתחברות, ואז להוסיף כאן.";
  if (message.includes("already a member")) return "הכתובת הזו כבר משויכת לפירמה.";
  if (message.includes("bad email")) return "כתובת דוא\"ל לא תקינה.";
  if (message.includes("name required")) return "יש להזין שם.";
  return "הפעולה נכשלה. נסו שוב.";
}

function MembersInner({ canAdmin, canManageDept }: { canAdmin: boolean; canManageDept: boolean }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rev, setRev] = useState(0);
  const [reveal, setReveal] = useState<Set<string>>(new Set());
  const [bkEmail, setBkEmail] = useState("");
  const [bkName, setBkName] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.rpc("lalum_firm_roster");
    const rows = ((data as Person[] | null) ?? []).slice();
    rows.sort((a, b) => ROLE_ORDER.indexOf(a.role as typeof ROLE_ORDER[number]) - ROLE_ORDER.indexOf(b.role as typeof ROLE_ORDER[number]) || a.name.localeCompare(b.name, "he"));
    setPeople(rows);
    // Who may reveal client names: the administrator sets it per partner or attorney (readable only to administrators and to the person).
    const g = await supabase.from("lalum_name_reveal_grants").select("user_id");
    setReveal(new Set(((g.data as Array<{ user_id: string }> | null) ?? []).map((x) => x.user_id)));
  }, []);

  useEffect(() => { void load(); }, [load, rev]);

  async function setRole(userId: string, role: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_set_member_role", { p_user: userId, p_role: role });
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return; }
    setMsg({ ok: true, text: "התפקיד נשמר." });
    setRev((n) => n + 1);
  }

  // Attaches an existing sign in (invited first in Supabase Auth, ideally a personal address with a second factor) as the
  // bookkeeping role. It creates no login and sets no password; her finance level stays 0 until set in the Permissions tab.
  async function addBookkeeper() {
    if (!supabase) return;
    setMsg(null);
    const { error } = await supabase.rpc("lalum_add_bookkeeper", { p_email: bkEmail, p_name: bkName });
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return; }
    setBkEmail(""); setBkName("");
    setMsg({ ok: true, text: "הוספה בתפקיד הנהלת חשבונות, עם צפייה והורדה של חומרים בלבד." });
    setRev((n) => n + 1);
  }

  async function setNameReveal(userId: string, allowed: boolean) {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_set_name_reveal", { p_user: userId, p_allowed: allowed });
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return; }
    setMsg({ ok: true, text: allowed ? "ההרשאה לחשוף שמות נשמרה ונרשמה ביומן." : "ההרשאה לחשוף שמות הוסרה ונרשמה ביומן." });
    setRev((n) => n + 1);
  }

  async function setDept(userId: string, value: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_set_member_department", { p_user: userId, p_dept: value });
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return; }
    setMsg({ ok: true, text: "המחלקה נשמרה." });
    setRev((n) => n + 1);
  }

  // The administrator never sees or sets a password: this asks Supabase Auth to
  // e-mail the member its own reset link and code, and the request is audited.
  async function sendReset(p: Person) {
    if (!supabase || !window.confirm(`לשלוח ל${p.name} מייל לאיפוס סיסמה? הסיסמה הנוכחית תישאר בתוקף עד שייקבע קוד חדש.`)) return;
    setMsg(null);
    const { data: email, error } = await supabase.rpc("lalum_member_reset_target", { p_user: p.user_id });
    if (error || typeof email !== "string") { setMsg({ ok: false, text: errText(error?.message ?? "") }); return; }
    const { error: sendErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (sendErr) { setMsg({ ok: false, text: "שליחת המייל נכשלה. המתינו דקה ונסו שוב." }); return; }
    const [name, domain] = email.split("@");
    setMsg({ ok: true, text: `נשלח מייל איפוס אל ${name.slice(0, 1)}***@${domain}.` });
  }

  if (people === null) return <div className="ck-meta">טוען...</div>;

  return (
    <div className="ck-stack" style={{ gap: 14 }}>
      <div className="ck-meta">
        מי רואה מה: אדמין רואה את כל התיקים וכל ההרשאות (כולל מחיקה), שותף רואה את תיקי המחלקה שלו, ועורך דין רואה רק תיקים שהוא משויך אליהם. הנהלת חשבונות (חיצונית) רואה את מערכת הנהלת החשבונות בלבד, לפי הרמה שנקבעה לה, ואינה רואה תיקים, מסמכים או חברי פירמה. חשיפת שמות לקוחות מותרת למנהל הפירמה בלבד, והוא יכול לאפשר אותה לשותף או לעורך דין מסוים.
        {canAdmin ? " כאן נקבעים תפקיד ומחלקה לכל חבר פירמה, וכל שינוי נרשם ביומן עם זמנו המדויק." : " תפקידים נקבעים על ידי מנהל הפירמה; כאן ניתן לעדכן מחלקות."}
      </div>

      {people.length === 0 ? <div className="ck-card"><div className="ck-meta">אין חברי פירמה להצגה.</div></div> : people.map((p) => (
        <div key={p.user_id} className="ck-card ck-stack" style={{ gap: 10 }}>
          <div className="ck-row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="ck-title" style={{ fontSize: 16 }}>{p.name}</span>
            <span className="ck-chip">{ROLE[p.role] ?? p.role}</span>
          </div>

          {canAdmin && (
            <label className="ck-row" style={{ gap: 8, alignItems: "center" }}>
              <span className="ck-meta" style={{ minWidth: 56 }}>תפקיד:</span>
              <select className="ck-input" value={p.role} onChange={(e) => void setRole(p.user_id, e.target.value)} style={{ maxWidth: 220 }}>
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
              </select>
            </label>
          )}

          <label className="ck-row" style={{ gap: 8, alignItems: "center" }}>
            <span className="ck-meta" style={{ minWidth: 56 }}>מחלקה:</span>
            {canManageDept ? (
              <input className="ck-input" defaultValue={p.department ?? ""} key={`${p.user_id}:${rev}`}
                onBlur={(e) => { if ((e.target.value.trim() || null) !== (p.department ?? null)) void setDept(p.user_id, e.target.value); }}
                placeholder='נדל"ן / מסחרי / ליטיגציה...' style={{ maxWidth: 220 }} />
            ) : <span className="ck-meta">{p.department || "—"}</span>}
          </label>
          {canAdmin && (
            <div><button type="button" className="ck-btn" onClick={() => void sendReset(p)}>שליחת מייל לאיפוס סיסמה</button></div>
          )}
          {canAdmin && (p.role === "FIRM_PARTNER" || p.role === "ATTORNEY") && (
            <label className="ck-row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={reveal.has(p.user_id)} onChange={(e) => void setNameReveal(p.user_id, e.target.checked)} />
              <span>מותר לחשוף שמות לקוחות (בסיבה שנרשמת ביומן)</span>
            </label>
          )}
          {p.role === "ADMIN" && <div className="ck-meta">מנהל הפירמה רשאי לחשוף שמות לקוחות מתוקף תפקידו.</div>}
          {p.role === "BOOKKEEPER" && <div className="ck-meta">צפייה והורדה של חומרי הנהלת החשבונות בלבד. אינה רשאית לחשוף שמות לקוחות.</div>}
          {p.role === "FIRM_PARTNER" && <div className="ck-meta">מחלקת השותף קובעת אילו תיקים הוא רואה אוטומטית.</div>}
        </div>
      ))}

      {msg && <span className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite" style={{ padding: "6px 12px" }}>{msg.text}</span>}
      {canAdmin && (
        <div className="ck-card ck-stack" style={{ gap: 10 }}>
          <div className="ck-title" style={{ fontSize: 16 }}>הוספת הנהלת חשבונות</div>
          <div className="ck-meta">
            קודם מזמינים את הכתובת להתחברות (הזמנת משתמש), עדיף כתובת אישית ולא תיבה משותפת, כדי שכל פעולה תיוחס לאדם אחד. הכניסה שלה בסיסמה בלבד, בלי אימות דו שלבי (החלטת הבעלים). ההרשאה שלה קבועה: צפייה והורדה של חומרים בלבד (רמה 1), ובלשונית ההרשאות אפשר רק להוריד אותה לרמה 0.
          </div>
          <div className="ck-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input className="ck-input" value={bkName} onChange={(e) => setBkName(e.target.value)} placeholder="שם מלא" style={{ maxWidth: 220 }} />
            <input className="ck-input" dir="ltr" type="email" value={bkEmail} onChange={(e) => setBkEmail(e.target.value)} placeholder="name@example.com" style={{ maxWidth: 280 }} />
            <button type="button" className="ck-btn primary" disabled={bkName.trim().length < 2 || !bkEmail.includes("@")} onClick={() => void addBookkeeper()}>הוספה</button>
          </div>
        </div>
      )}
      <div className="ck-meta">הוספת אדם חדש לפירמה נעשית על ידי LALUM. לאחר שהחשבון נוצר ושויך לפירמה, הוא יופיע כאן לקביעת תפקיד ומחלקה.</div>
    </div>
  );
}

/** Firm roster screen: view members, set roles (admin) and departments (admin or partner). */
export function Members() {
  return (
    <CockpitFrame title="חברי הפירמה" description="צוות הפירמה, התפקידים וההרשאות: מי רואה אילו תיקים, לפי שיוך ומחלקה." path="/settings/members">
      {({ member, platformAdmin }) => {
        const role = member?.role ?? "";
        const canAdmin = platformAdmin || role === "ADMIN";
        const canManageDept = platformAdmin || role === "FIRM_PARTNER" || role === "ADMIN";
        return <MembersInner canAdmin={canAdmin} canManageDept={canManageDept} />;
      }}
    </CockpitFrame>
  );
}
