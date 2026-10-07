import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Def { id: string; name: string; statute_ref: string; trigger_event: string; period_days: number }
interface Row { deadline_id: string; trigger_date: string; statutory_date: string; internal_date: string; short_window: boolean }
const he = (iso: string) => iso.split("-").reverse().join(".");

/** Statutory deadlines for a matter. The internal target is always the statutory date minus 30 days; periods of 30 days or less are flagged. Verified deadlines only. */
export function Deadlines({ matterId, practiceArea }: { matterId: string; practiceArea: string }) {
  const [defs, setDefs] = useState<Def[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
    const [d, r] = await Promise.all([
      supabase.from("lalum_statutory_deadlines").select("id, name, statute_ref, trigger_event, period_days").eq("practice_area", practiceArea).order("name"),
      supabase.from("lalum_matter_deadlines").select("deadline_id, trigger_date, statutory_date, internal_date, short_window").eq("matter_id", matterId),
    ]);
    setDefs((d.data as Def[] | null) ?? []);
    setRows(Object.fromEntries(((r.data as Row[] | null) ?? []).map((x) => [x.deadline_id, x])));
  }, [matterId, practiceArea]);
  useEffect(() => { void load(); }, [load]);
  async function set(id: string, date: string) {
    if (!supabase || !date) return;
    setErr(null);
    const { error } = await supabase.rpc("lalum_set_matter_deadline", { p_matter: matterId, p_deadline: id, p_trigger: date });
    if (error) setErr("השמירה נכשלה."); else await load();
  }
  return (
    <>
      <div className="ck-label">מועדים סטטוטוריים</div>
      {defs.length === 0 ? <span className="ck-meta">אין עדיין מועדים מאומתים לתחום זה.</span> : (
        <div className="ck-stack">
          {defs.map((d) => { const r = rows[d.id]; return (
            <div key={d.id} className="ck-card">
              <div className="ck-title">{d.name}</div>
              <div className="ck-meta">{d.statute_ref} · {d.period_days} ימים · מתחיל מ: {d.trigger_event}</div>
              <input className="field" type="date" aria-label={`תאריך האירוע: ${d.name}`} defaultValue={r?.trigger_date ?? ""} onChange={(e) => void set(d.id, e.target.value)} />
              {r && <div className="ck-meta">מועד חוקי: <b>{he(r.statutory_date)}</b> · יעד פנימי: <b>{he(r.internal_date)}</b>{r.short_window && <span className="ck-badge red">חריג: חלון של 30 ימים או פחות, פעל מיד</span>}</div>}
            </div>); })}
        </div>)}
      {err && <div className="ck-err" aria-live="polite">{err}</div>}
      <span className="ck-meta">מועדי עזר בימים קלנדריים, ללא פגרות, חגים והארכות. אינם תחליף לבדיקת עורך דין.</span>
    </>
  );
}
