import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const LEVELS: Array<[string, string]> = [
  ["", "לפי התפקיד (שותף ומנהל: מלאה, הנהלת חשבונות: אין גישה)"], ["0", "0 אין גישה"], ["1", "1 צפייה"], ["2", "2 טיוטות ולקוחות"], ["3", "3 הפקה, תשלומים והוצאות"], ["4", "4 ניהול מלא"],
];
const ERRORS: Record<string, string> = {
  LAST_ADMIN: "אי אפשר להוריד את מנהל הכספים האחרון.", FORBIDDEN: "אין הרשאה.", NOT_A_MEMBER: "המשתמש אינו חבר בפירמה.", BAD_LEVEL: "רמה לא תקינה.",
};
interface Member { user_id: string; name: string; role: string }

export function PermissionsTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [explicit, setExplicit] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [r, p] = await Promise.all([supabase.rpc("lalum_firm_roster"), supabase.from("lalum_fin_permissions").select("user_id, level")]);
    setMembers((r.data as Member[] | null) ?? []);
    setExplicit(Object.fromEntries(((p.data as Array<{ user_id: string; level: number }> | null) ?? []).map((x) => [x.user_id, x.level])));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function change(user: string, value: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_fin_set_level", { p_user: user, p_level: value === "" ? null : Number(value) });
    const key = Object.keys(ERRORS).find((k) => error?.message.includes(k));
    setMsg(error ? { ok: false, text: key ? ERRORS[key] : error.message } : { ok: true, text: "ההרשאה נשמרה ונרשמה ביומן הביקורת." });
    await load();
  }

  return (
    <div className="ck-stack">
      <div className="ck-meta">רמה 3 ומעלה דורשת אימות דו שלבי. כל שינוי נרשם ביומן ביקורת שאי אפשר לערוך. הנהלת חשבונות חיצונית (תפקיד הנהלת חשבונות) מקבלת גישה רק כאן, מרמה 0 עד שתקבע לה רמה: מומלץ 3 (הפקה, תשלומים והוצאות), ורמה 4 רק אם עליה לנהל הגדרות, הרשאות, נאמנות ויומן ביקורת. כניסתה דורשת אימות דו שלבי תמיד. לקוח אינו מקבל גישה כאן.</div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>שם</th><th>תפקיד</th><th>רמת גישה לכספים</th></tr></thead><tbody>
        {members.map((m) => (
          <tr key={m.user_id}>
            <td className="fin-text">{m.name}</td><td>{m.role}</td>
            <td><select className="ck-select" aria-label={`רמה עבור ${m.name}`} value={explicit[m.user_id] === undefined ? "" : String(explicit[m.user_id])} onChange={(e) => void change(m.user_id, e.target.value)}>
              {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
          </tr>))}
        {!members.length && <tr><td colSpan={3}>אין משתמשים להצגה</td></tr>}
      </tbody></table></div>
    </div>
  );
}
