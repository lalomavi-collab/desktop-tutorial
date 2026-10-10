import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ROLE } from "../../lib/cockpit/shared";

// Team and department for a matter. This is where role-based access is set: a
// matter's department (a partner sees their department's matters) and the
// attorneys assigned to it (an attorney sees only matters assigned to them).
// Admins see everything regardless. Managed by a firm partner or admin.

interface Person { user_id: string; name: string; role: string; department: string | null }

export function MatterAccess({ matterId, department, canManage, onChange }: {
  matterId: string; department: string | null; canManage: boolean; onChange: () => void;
}) {
  const [dept, setDept] = useState(department ?? "");
  const [people, setPeople] = useState<Person[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const [r, a] = await Promise.all([
        supabase.rpc("lalum_firm_roster"),
        supabase.rpc("lalum_matter_assignees", { p_matter: matterId }),
      ]);
      if (!live) return;
      setPeople((r.data as Person[] | null) ?? []);
      setAssigned(new Set(((a.data as { user_id: string }[] | null) ?? []).map((x) => x.user_id)));
    })();
    return () => { live = false; };
  }, [matterId, rev]);

  async function saveDept() {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_set_matter_department", { p_matter: matterId, p_dept: dept });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "המחלקה נשמרה." });
    if (!error) onChange();
  }

  async function toggle(userId: string, on: boolean) {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_matter_assign", { p_matter: matterId, p_user: userId, p_on: on });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setRev((n) => n + 1);
  }

  async function saveMemberDept(userId: string, value: string) {
    if (!supabase) return;
    await supabase.rpc("lalum_set_member_department", { p_user: userId, p_dept: value });
    setRev((n) => n + 1);
  }

  if (!canManage) return null;

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>צוות ומחלקה</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-meta">מי רואה את התיק: אדמין רואה הכול, שותף רואה את תיקי המחלקה שלו, ועורך דין רואה רק תיקים שהוא משויך אליהם. כאן נקבעים מחלקת התיק וצוות הטיפול.</div>

        <div className="ck-field">מחלקת התיק
          <div className="ck-row" style={{ gap: 6 }}>
            <input className="ck-input" value={dept} onChange={(e) => setDept(e.target.value)} placeholder="נדל״ן / מסחרי / ליטיגציה..." />
            <button className="ck-btn primary" onClick={() => void saveDept()}>שמירה</button>
          </div>
        </div>

        <div className="ck-label">צוות הטיפול בתיק</div>
        {people.length === 0 ? <div className="ck-meta">אין חברי משרד להצגה.</div> : people.map((p) => (
          <div key={p.user_id} className="ck-card ck-stack" style={{ gap: 6 }}>
            <label className="ck-row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={assigned.has(p.user_id)} onChange={(e) => void toggle(p.user_id, e.target.checked)} />
              <span className="ck-title" style={{ fontSize: 15 }}>{p.name}</span>
              <span className="ck-chip">{ROLE[p.role] ?? p.role}</span>
            </label>
            {p.role === "FIRM_PARTNER" && (
              <div className="ck-row" style={{ gap: 6 }}>
                <span className="ck-meta">מחלקה:</span>
                <input className="ck-input" defaultValue={p.department ?? ""} onBlur={(e) => void saveMemberDept(p.user_id, e.target.value)} placeholder="מחלקת השותף" style={{ maxWidth: 200 }} />
              </div>
            )}
          </div>
        ))}
        {msg && <span className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite" style={{ padding: "6px 12px" }}>{msg.text}</span>}
        <div className="ck-meta">שיוך עורך דין לתיק נותן לו גישה אליו. מחלקת השותף נקבעת פעם אחת לכל שותף ותקפה לכל תיקי אותה מחלקה.</div>
      </div>
    </details>
  );
}
