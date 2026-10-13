import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

// Hebrew labels for the actions this app actually writes (lalum_audit_write callers across the
// migrations). An action not in this map still renders, just with its raw code as the label.
const ACTION_LABELS: Record<string, string> = {
  FIN_PERMISSION_SET: "שינוי הרשאת כספים",
  FIN_DOCUMENT_SEALED: "הפקת מסמך (חסום לעריכה)",
  FIN_DOCUMENT_VOIDED: "ביטול מסמך",
  FIN_EXPORT: "ייצוא קובץ",
  CORRECTED: "תיקון יתרת פתיחה",
  VIEWED_FINANCIALS: "צפייה בדוחות כספיים",
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith("WIP_")) return `עדכון שעות לא מדווחות (${action.slice(4).toLowerCase()})`;
  return action;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "medium" });
}

interface AuditRow { id: number; actor_id: string | null; actor_role: string | null; action: string; entity: string; entity_id: string | null; payload: Record<string, unknown>; at: string }
interface Member { user_id: string; name: string; role: string }

export function AuditLogTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [a, r] = await Promise.all([
      supabase.from("lalum_audit_log").select("id, actor_id, actor_role, action, entity, entity_id, payload, at").order("at", { ascending: false }).limit(300),
      supabase.rpc("lalum_firm_roster"),
    ]);
    setRows((a.data as AuditRow[] | null) ?? []);
    setNames(Object.fromEntries(((r.data as Member[] | null) ?? []).map((m) => [m.user_id, m.name])));
    setLoaded(true);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const actor = r.actor_id ? names[r.actor_id] ?? r.actor_id : "";
      return [actionLabel(r.action), r.action, r.entity, r.entity_id ?? "", actor].some((f) => f.toLowerCase().includes(term));
    });
  }, [rows, q, names]);

  return (
    <div className="ck-stack">
      <div className="ck-meta">
        300 הרשומות האחרונות ביומן. היומן נכתב אוטומטית בכל פעולה רגישה (הרשאות, הפקה וביטול מסמכים, ייצוא) ולא ניתן לערוך או למחוק אותו ידנית.
      </div>
      <input
        className="ck-input"
        placeholder="חיפוש לפי פעולה, ישות או מבצע"
        aria-label="חיפוש ביומן הביקורת"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="ck-table-wrap">
        <table className="ck-table">
          <thead><tr><th>מתי</th><th>מי</th><th>פעולה</th><th>ישות</th><th>פרטים</th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="fin-text">{fmtWhen(r.at)}</td>
                <td className="fin-text">{r.actor_id ? names[r.actor_id] ?? r.actor_id : "מערכת"}</td>
                <td>{actionLabel(r.action)}</td>
                <td className="fin-text">{r.entity}{r.entity_id ? ` · ${r.entity_id}` : ""}</td>
                <td className="fin-text">{Object.keys(r.payload ?? {}).length ? JSON.stringify(r.payload) : ""}</td>
              </tr>
            ))}
            {loaded && !filtered.length && <tr><td colSpan={5}>אין רשומות להצגה</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
