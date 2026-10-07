import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CONFLICT, fmt, PRACTICE, RESPONSE } from "../../lib/cockpit/shared";
import { CockpitFrame } from "./CockpitFrame";

interface Row { matter_id: string; firm_id: string; firm_name: string; title: string; practice_area: string; conflict_status: string; partner_response: string; dispatched_at: string; first_viewed_at: string | null }
interface Check { id: string; created_at: string; firm_id: string; status: string; reason_codes: string[]; match_count: number; entity_count: number; source: string }
interface Firm { id: string; firm_name: string }
const SLA_MIN = 120;
const REASON: Record<string, string> = {
  ADVERSE_IS_ACTIVE_CLIENT: "הצד שכנגד הוא לקוח פעיל", CLIENT_IS_ACTIVE_ADVERSE: "הלקוח הוא צד שכנגד בתיק פעיל", OPPOSING_HISTORICAL_MATTER: "התנגשות מול תיק היסטורי",
  ROLE_UNKNOWN_MATCH: "התאמה עם תפקיד לא ידוע", PARTIAL_NAME_MATCH_OPPOSING: "התאמת שם חלקית מול צד מנוגד",
};
const waiting = (r: Row, now: number): number | null =>
  r.first_viewed_at || r.partner_response !== "PENDING_REVIEW" ? null : Math.floor((now - new Date(r.dispatched_at).getTime()) / 60000);

function Panel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [f, setF] = useState({ firm: "", area: "", resp: "" });
  const [now, setNow] = useState(() => Date.now());
  const [chain, setChain] = useState("");
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [a, b, c] = await Promise.all([
      supabase.from("lalum_v_admin_matters").select("*").order("dispatched_at", { ascending: false }).limit(500),
      supabase.from("lalum_conflict_checks").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("lalum_firms").select("id, firm_name"),
    ]);
    if (a.error) { setDenied(true); return; }
    setRows((a.data as Row[] | null) ?? []); setChecks((b.data as Check[] | null) ?? []); setFirms((c.data as Firm[] | null) ?? []);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    const ch = supabase?.channel("lalum-admin").on("postgres_changes", { event: "*", schema: "public", table: "lalum_intake_routings" }, () => { void load(); }).subscribe();
    return () => { window.clearInterval(tick); if (ch) void supabase?.removeChannel(ch); };
  }, [load]);

  const shown = rows.filter((r) => (!f.firm || r.firm_id === f.firm) && (!f.area || r.practice_area === f.area) && (!f.resp || r.partner_response === f.resp));
  const breached = shown.filter((r) => (waiting(r, now) ?? 0) > SLA_MIN).length;
  const firmName = (id: string) => firms.find((x) => x.id === id)?.firm_name ?? "";

  async function verify() {
    if (!supabase) return;
    setChain("בודק...");
    const out: string[] = [];
    for (const x of firms) {
      const { data, error } = await supabase.rpc("lalum_verify_audit_chain", { p_firm: x.id });
      out.push(`${x.firm_name}: ${error ? "שגיאה" : data === null ? "שרשרת תקינה" : `נשבר ברשומה ${String(data)}`}`);
    }
    setChain(out.join(" | ") || "אין משרדים");
  }
  if (denied) return <div className="ck-err">אין הרשאה לצפות בנתוני הניהול.</div>;
  const sel = (label: string, key: "firm" | "area" | "resp", opts: Array<[string, string]>) => (
    <label className="ck-field">{label}<select className="ck-select" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}><option value="">הכול</option>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
  );
  return (
    <div className="ck-stack">
      <div className="ck-grid2">{sel("משרד", "firm", firms.map((x) => [x.id, x.firm_name]))}{sel("תחום", "area", Object.entries(PRACTICE))}{sel("סטטוס תגובה", "resp", Object.entries(RESPONSE))}</div>
      <div className="ck-row"><span className={`ck-badge ${breached ? "red" : "green"}`}>{breached ? `${breached} תיקים חורגים מ-SLA (מעל שעתיים ללא צפייה)` : "אין חריגות SLA"}</span><span className="ck-meta">{shown.length} תיקים · מתעדכן אוטומטית</span></div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>משרד</th><th>תיק</th><th>תחום</th><th>ניגוד</th><th>תגובת שותף</th><th>נקלט</th><th>ממתין</th></tr></thead><tbody>
        {shown.length ? shown.map((r) => { const m = waiting(r, now); const [t, l] = CONFLICT[r.conflict_status] ?? ["yellow", r.conflict_status]; const h = m == null ? 0 : Math.floor(m / 60); return (
          <tr key={r.matter_id} className={(m ?? 0) > SLA_MIN ? "breach" : ""}>
            <td>{r.firm_name}</td><td>{r.title}</td><td>{PRACTICE[r.practice_area]}</td><td><span className={`ck-badge ${t}`}>{l}</span></td><td>{RESPONSE[r.partner_response]}</td><td>{fmt(r.dispatched_at)}</td>
            <td>{m == null ? <span className="ck-badge green">טופל</span> : <span className={`ck-badge ${m > SLA_MIN ? "red" : "yellow"}`}>{m > SLA_MIN ? "⚠ " : ""}{h ? `${h} שע' ${m % 60} דק'` : `${m} דק'`}</span>}</td>
          </tr>); }) : <tr><td colSpan={7}>אין תיקים להצגה</td></tr>}
      </tbody></table></div>
      <div className="ck-label">יומן ביקורת ניגוד עניינים</div>
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>מועד</th><th>משרד</th><th>תוצאה</th><th>סיבות</th><th>התאמות</th><th>ישויות</th><th>מקור</th></tr></thead><tbody>
        {checks.length ? checks.map((c) => { const [t, l] = CONFLICT[c.status] ?? ["yellow", c.status]; return (
          <tr key={c.id}><td>{fmt(c.created_at)}</td><td>{firmName(c.firm_id)}</td><td><span className={`ck-badge ${t}`}>{l}</span></td><td>{c.reason_codes.map((x) => REASON[x] ?? x).join(", ") || "-"}</td><td>{c.match_count}</td><td>{c.entity_count}</td><td>{c.source}</td></tr>); })
          : <tr><td colSpan={7}>אין רשומות. היומן מוצג רק לשותף, לממונה ציות, למנהל משרד ולמנהל הפלטפורמה.</td></tr>}
      </tbody></table></div>
      <div className="ck-meta">היומן אינו מכיל שמות או מספרי זהות, רק סטטוס, קודי סיבה ומספרים. מי שנדחה בשל ניגוד עניינים לא מקבל אף פרט מהיומן.</div>
      <div className="ck-row"><button className="ck-btn" onClick={() => void verify()}>אימות שרשרת הביקורת הקריפטוגרפית</button></div>
      <div className="ck-meta" aria-live="polite">{chain}</div>
    </div>
  );
}

export function AdminMatters() {
  return (
    <CockpitFrame title="ניהול תיקים" description="לוח בקרה למנהל: כל התיקים, מדדי SLA בזמן אמת ויומן ביקורת ניגוד עניינים." path="/admin/matters" needsFirm={false}>
      {() => <Panel />}
    </CockpitFrame>
  );
}
