import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { ROLE } from "../../../lib/cockpit/shared";

const LEVELS: Array<[string, string]> = [
  ["", "לפי התפקיד (שותף ומנהל: מלאה, הנהלת חשבונות: צפייה והורדה)"], ["0", "0 אין גישה"], ["1", "1 צפייה"], ["2", "2 טיוטות ולקוחות"], ["3", "3 הפקה, תשלומים והוצאות"], ["4", "4 ניהול מלא"],
];
const LEVEL_INFO: Array<{ n: number; title: string; text: string }> = [
  { n: 0, title: "אין גישה", text: "אין צפייה בנתוני הכספים." },
  { n: 1, title: "צפייה", text: "סקירה, דוחות, ארכיון וקובץ מבנה אחיד, לקריאה בלבד." },
  { n: 2, title: "טיוטות ולקוחות", text: "כל מה שברמה 1, וגם מסמכים וחשבונות עסקה פתוחים כטיוטות וניהול לקוחות, כולל הוספה וייבוא." },
  { n: 3, title: "הפקה, תשלומים והוצאות", text: "כל מה שברמה 2, וגם הפקת מסמכים, רישום תשלומים, הוצאות וגיול חובות. דורשת אימות דו שלבי." },
  { n: 4, title: "ניהול מלא", text: "כל מה שברמה 3, וגם כספי נאמנות, תזרים, הרשאות ויומן ביקורת. דורשת אימות דו שלבי." },
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
      <div className="ck-card ck-stack perm-legend">
        <div className="ck-title">מה כל רמה פותחת</div>
        <ol className="perm-levels">
          {LEVEL_INFO.map((l) => (
            <li key={l.n}><span className="perm-n" aria-hidden="true">{l.n}</span><div><b>{l.title}</b><span>{l.text}</span></div></li>
          ))}
        </ol>
        <ul className="perm-rules">
          <li><b>אימות דו שלבי:</b> רמה 3 ומעלה דורשת אימות דו שלבי בכל כניסה. הנהלת חשבונות חיצונית, המוגבלת לרמה 1, נכנסת בסיסמה בלבד.</li>
          <li><b>ברירת מחדל לפי תפקיד:</b> שותף ומנהל מקבלים רמה 4. הנהלת חשבונות חיצונית (תפקיד הנהלת חשבונות) מוגבלת לרמה 1: צפייה והורדה של חומרים בלבד, ואי אפשר לתת לה יותר. ניתן להוריד אותה לרמה 0. לקוח אינו מקבל גישה כאן.</li>
          <li><b>יומן ביקורת:</b> כל שינוי בהרשאה נרשם ביומן שאי אפשר לערוך, עם מי ומתי.</li>
          <li><b>מנהל אחרון:</b> אי אפשר להוריד את מנהל הכספים האחרון.</li>
        </ul>
      </div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
      <div className="ck-title">הרשאות לפי משתמש</div>
      <ul className="perm-members">
        {members.map((m) => (
          <li key={m.user_id} className="perm-member">
            <div className="perm-who"><b>{m.name}</b><span>{ROLE[m.role] ?? m.role}</span></div>
            <label className="perm-pick"><span>רמת גישה לכספים</span>
              <select className="ck-select" aria-label={`רמה עבור ${m.name}`} value={explicit[m.user_id] === undefined ? "" : String(explicit[m.user_id])} onChange={(e) => void change(m.user_id, e.target.value)}>
                {LEVELS.filter(([v]) => m.role !== "BOOKKEEPER" || v === "" || Number(v) <= 1).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
          </li>))}
        {!members.length && <li className="ck-meta">אין משתמשים להצגה</li>}
      </ul>
    </div>
  );
}
