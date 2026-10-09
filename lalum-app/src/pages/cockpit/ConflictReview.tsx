import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CONFLICT, KIND_HE } from "../../lib/cockpit/shared";

// Conflict-of-interest review. The intake pipeline already checks a new matter's
// parties against the firm's book and sets conflict_status; this panel surfaces
// the result for a human decision. It lists the other matters that share a party
// with this one (matched on stored blind indexes, so no name is shown) and lets
// a partner record a reasoned clearance or waiver, which goes to the audit chain.

interface Conflict { matter_id: string; title: string; role: string; kind: string; matter_active: boolean }

const ROLE_HE: Record<string, string> = { CLIENT: "לקוח", ADVERSE: "צד שכנגד", COUNTERPARTY: "צד נגדי", RELATED: "קשור", OTHER: "אחר" };
const STATUS_OPTS: Array<[string, string]> = [["CLEAN", "נקי"], ["POTENTIAL", "בבדיקה ידנית"], ["DIRECT_CONFLICT", "ניגוד ישיר"]];

export function ConflictReview({ matterId, conflictStatus, canDecide, onChange }: {
  matterId: string; conflictStatus: string; canDecide: boolean; onChange: () => void;
}) {
  const [rows, setRows] = useState<Conflict[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Seeded from the current status; the select is then the partner's working
  // choice. After a decision is saved the prop already matches, so no sync back.
  const [status, setStatus] = useState(conflictStatus);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.rpc("lalum_conflict_review", { p_matter: matterId });
      if (live) { setRows((data as Conflict[] | null) ?? []); setLoaded(true); }
    })();
    return () => { live = false; };
  }, [matterId]);

  async function save() {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_set_conflict_status", { p_matter: matterId, p_status: status, p_note: note });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "ההחלטה נרשמה ביומן הביקורת." });
    setNote("");
    onChange();
  }

  const cur = CONFLICT[conflictStatus] ?? ["yellow", conflictStatus];

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>בדיקת ניגוד עניינים{rows.length ? ` (${rows.length})` : ""}</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-row" style={{ gap: 8, alignItems: "center" }}>
          <span className="ck-meta">סטטוס נוכחי:</span><span className={`ck-badge ${cur[0]}`}>{cur[1]}</span>
        </div>
        <div className="ck-meta">הבדיקה משווה את הצדדים בתיק לצדדים בשאר תיקי המשרד לפי מפתח מוצפן, בלי לחשוף שמות. המערכת מסמנת תיקים שחולקים צד, וההכרעה אם קיים ניגוד ומה דינו היא של שותף במשרד.</div>

        {!loaded ? <div className="ck-meta">טוען...</div>
          : rows.length === 0 ? <div className="ck-ok">לא נמצאו תיקים נוספים החולקים צד עם תיק זה.</div>
          : (
            <div className="ck-stack" style={{ gap: 6 }}>
              <div className="ck-label">תיקים החולקים צד</div>
              {rows.map((r, i) => (
                <div key={`${r.matter_id}-${i}`} className="ck-card ck-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span className="ck-title" style={{ fontSize: 15 }}>{r.title}</span>
                  <span className="ck-row" style={{ gap: 6 }}>
                    <span className="ck-chip">{ROLE_HE[r.role] ?? r.role}</span>
                    {r.kind && <span className="ck-chip">{KIND_HE[r.kind] ?? r.kind}</span>}
                    <span className={`ck-badge ${r.matter_active ? "yellow" : ""}`}>{r.matter_active ? "פעיל" : "בארכיון"}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

        {canDecide ? (
          <div className="ck-card ck-stack">
            <div className="ck-label">רישום החלטה</div>
            <div className="ck-field">הכרעה<select className="ck-select" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="ck-field">נימוק (נשמר ביומן הביקורת)<textarea className="ck-textarea" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: אין חפיפה מהותית, או התקבל ויתור מדעת משני הלקוחות." /></div>
            <div className="ck-row">
              <button className="ck-btn primary" onClick={() => void save()}>רישום ההחלטה</button>
              {msg && <span className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite" style={{ padding: "6px 12px" }}>{msg.text}</span>}
            </div>
          </div>
        ) : <div className="ck-meta">רישום החלטת ניגוד עניינים שמור לשותף במשרד.</div>}
      </div>
    </details>
  );
}
