import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { money, ROLE } from "../../lib/cockpit/shared";
import type { Membership } from "../../lib/cockpit/shared";
import { CockpitFrame } from "./CockpitFrame";

interface Plan { tier: string; display_name: string; description: string; monthly_fee_ils: number | null; seat_limit: number | null }
interface Member { name: string; email: string; role: string }
interface Invoice { id: string; invoice_no: string; kind: string; period_start: string; period_end: string; net_amount: number; vat_amount: number; status: string }

function Panel({ member }: { member: Membership }) {
  const { user } = useAuth();
  const firm = member.lalum_firms;
  const canManage = ["FIRM_PARTNER", "ADMIN"].includes(member.role);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [token, setToken] = useState("");
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const [p, m, i] = await Promise.all([
        supabase.from("lalum_subscription_plans").select("*").order("sort_order"),
        supabase.from("lalum_firm_members").select("name, email, role").eq("firm_id", member.firm_id),
        canManage ? supabase.from("lalum_invoices").select("*").eq("firm_id", member.firm_id).order("issued_at", { ascending: false }) : Promise.resolve({ data: [] }),
      ]);
      setPlans((p.data as Plan[] | null) ?? []); setMembers((m.data as Member[] | null) ?? []); setInvoices((i.data as Invoice[] | null) ?? []);
    })();
  }, [member.firm_id, canManage]);
  async function request(tier: string) {
    if (!supabase || !user || !window.confirm("לשלוח בקשת מעבר מסלול? הבקשה תטופל מול LALUM ואינה משנה את החיוב מיד.")) return;
    const { error } = await supabase.from("lalum_tier_change_requests").insert({ firm_id: member.firm_id, requested_by: user.id, from_tier: firm.subscription_tier, to_tier: tier });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "הבקשה נשלחה. נחזור אליכם." });
  }
  async function rotate() {
    if (!supabase || !window.confirm("יצירת טוקן חדש תנתק כל חיבור קיים. להמשיך?")) return;
    const { data, error } = await supabase.rpc("lalum_rotate_intake_token", { p_firm: member.firm_id });
    if (error) setMsg({ ok: false, text: error.message }); else setToken(String(data));
  }
  const [phone, setPhone] = useState("");
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    (async () => {
      if (!supabase || !user) return;
      const { data } = await supabase.from("lalum_firm_members").select("phone").eq("user_id", user.id).maybeSingle();
      setPhone((data as { phone: string | null } | null)?.phone ?? "");
    })();
  }, [user]);
  async function savePhone() {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_set_my_phone", { p_phone: phone });
    setPhoneMsg(error ? { ok: false, text: "מספר לא תקין. הזינו מספר בפורמט 05X או 972..." } : { ok: true, text: "נשמר." });
  }
  const used = members.length;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-pipeline/api/v1/intake/webhook`;
  return (
    <div className="ck-stack">
      <div className="ck-card"><div className="ck-row" style={{ justifyContent: "space-between" }}><div><div className="ck-title">{firm.firm_name}</div><div className="ck-meta">מסלול נוכחי: <b>{firm.subscription_tier}</b> · {firm.status === "ACTIVE" ? "פעיל" : firm.status}</div></div>
        <div style={{ textAlign: "end" }}><div className="ck-title">{money(firm.monthly_fee)} לחודש</div><div className="ck-meta">דמי מנוי קבועים, ללא חלוקת שכר טרחה</div></div></div></div>
      <div className="ck-ok">LALUM גובה דמי מנוי קבועים בלבד. אין חלוקת שכר טרחה, אחוזים או שיתוף הכנסות, והלקוח מתקשר ישירות עם המשרד המטפל.</div>
      <div className="ck-label">התראות לשותף</div>
      <div className="ck-card"><div className="ck-meta">על כל תיק חדש נשלח דוא"ל עם תחום, רמת סיכון וקישור בלבד, ללא פרטים מזהים. להתראה גם ב-WhatsApp הזינו מספר נייד (דורש הפעלה של LALUM).</div>
        <div className="ck-row"><input className="field" dir="ltr" inputMode="tel" aria-label="טלפון נייד" placeholder="05X-XXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ maxWidth: 260 }} /><button className="ck-btn" onClick={() => void savePhone()}>שמירה</button></div>
        {phoneMsg && <div className={phoneMsg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{phoneMsg.text}</div>}</div>
      <div className="ck-label">מסלולי מנוי</div>
      <div className="ck-grid2">{plans.map((p) => (
        <div key={p.tier} className="ck-card"><div className="ck-row" style={{ justifyContent: "space-between" }}><span className="ck-title">{p.display_name}</span>{p.tier === firm.subscription_tier && <span className="ck-badge green">המסלול שלכם</span>}</div>
          <div className="ck-meta">{p.description}</div><div className="ck-meta">מחיר: {money(p.monthly_fee_ils)}{p.seat_limit ? ` · עד ${p.seat_limit} מושבים` : ""}</div>
          {canManage && p.tier !== firm.subscription_tier && <button className="ck-btn" onClick={() => void request(p.tier)}>בקשת מעבר למסלול</button>}</div>))}</div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
      <div className="ck-label">מושבים</div>
      <div className="ck-card"><div className="ck-meta">{used} מתוך {firm.seat_limit} מושבים בשימוש</div><div className="ck-bar"><div style={{ width: `${Math.min(100, (used / firm.seat_limit) * 100)}%` }} /></div>
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>שם</th><th>דוא"ל</th><th>תפקיד</th></tr></thead><tbody>{members.map((x) => <tr key={x.email}><td>{x.name}</td><td>{x.email}</td><td>{ROLE[x.role] ?? x.role}</td></tr>)}</tbody></table></div>
        {canManage && <div className="ck-meta">הוספת משתמשים והגדלת מושבים מתבצעות מול LALUM, וכל שינוי מופיע בחשבונית הבאה.</div>}</div>
      {canManage && <>
        <div className="ck-label">יומן חשבוניות</div>
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>מס'</th><th>סוג</th><th>תקופה</th><th>סכום</th><th>מע"מ</th><th>סטטוס</th></tr></thead><tbody>
          {invoices.length ? invoices.map((i) => <tr key={i.id}><td>{i.invoice_no}</td><td>{i.kind === "SUBSCRIPTION" ? "מנוי" : "מושבים נוספים"}</td><td>{i.period_start} עד {i.period_end}</td><td>{money(i.net_amount)}</td><td>{money(i.vat_amount)}</td><td>{({ ISSUED: "הופקה", PAID: "שולמה", VOID: "מבוטלת" } as Record<string, string>)[i.status] ?? i.status}</td></tr>) : <tr><td colSpan={6}>אין חשבוניות עדיין</td></tr>}
        </tbody></table></div>
        <div className="ck-label">חיבור קליטה אוטומטית (Webhook)</div>
        <div className="ck-card"><div className="ck-meta">כתובת: <code dir="ltr">{url}</code><br />כותרות: <code dir="ltr">Authorization: Bearer &lt;token&gt;</code> ו-<code dir="ltr">x-lalum-firm: {member.firm_id}</code><br />גוף: JSON עם <code dir="ltr">text</code>, ואופציונלית <code dir="ltr">parties</code>.</div>
          <div className="ck-row"><button className="ck-btn" onClick={() => void rotate()}>יצירת טוקן חדש (מבטל את הקודם)</button></div>
          {token && <><div className="ck-warn">הטוקן מוצג פעם אחת בלבד. שמרו אותו עכשיו:</div><code dir="ltr" style={{ wordBreak: "break-all", display: "block", padding: 8 }}>{token}</code></>}</div>
      </>}
    </div>
  );
}

export function Billing() {
  return (
    <CockpitFrame title="חיוב והגדרות משרד" description="מסלול המנוי הקבוע של המשרד, הקצאת מושבים, יומן חשבוניות וחיבור קליטה אוטומטית." path="/settings/billing">
      {({ member }) => (member ? <Panel member={member} /> : null)}
    </CockpitFrame>
  );
}
