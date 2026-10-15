import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { DOC_ORIGIN, DOC_TYPE } from "../../lib/cockpit/docMeta";
import type { MatterDoc } from "../../lib/cockpit/shared";
import { useClientNames } from "../../components/cockpit/ClientNames";

/** Shows how a document is classified; documents without a classification (older uploads) can be classified in place. */
export function DocMeta({ doc, canEdit, onSaved }: { doc: MatterDoc; canEdit: boolean; onSaved: () => void }) {
  const [type, setType] = useState("");
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState("");
  if (doc.doc_type && doc.doc_origin) {
    return <div className="ck-row"><span className="ck-chip">{DOC_TYPE[doc.doc_type]}</span><span className="ck-chip">מקור: {DOC_ORIGIN[doc.doc_origin]}</span>{doc.doc_date && <span className="ck-chip" dir="ltr">{new Date(doc.doc_date).toLocaleDateString("he-IL")}</span>}</div>;
  }
  if (!canEdit) return <span className="ck-badge yellow">לא סווג</span>;
  async function save() {
    if (!supabase || !type || !origin) { setMsg("בחרו סוג ומקור."); return; }
    const { error } = await supabase.rpc("lalum_set_document_meta", { p_doc: doc.id, p_type: type, p_origin: origin, p_date: null });
    if (error) setMsg("הסיווג לא נשמר."); else onSaved();
  }
  return (
    <div className="ck-row">
      <span className="ck-badge yellow">לא סווג</span>
      <select className="ck-select" style={{ width: "auto" }} aria-label="סוג המסמך" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">סוג</option>{Object.entries(DOC_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select className="ck-select" style={{ width: "auto" }} aria-label="מקור המסמך" value={origin} onChange={(e) => setOrigin(e.target.value)}>
        <option value="">מקור</option>{Object.entries(DOC_ORIGIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button className="ck-btn" onClick={() => void save()}>שמירת סיווג</button>
      {msg && <span className="ck-meta" aria-live="polite">{msg}</span>}
    </div>
  );
}

/** Whether a document counts toward the matter's risk level. A partner can leave out an earlier version, an annex or a
 *  summary, with a short reason (stored on the document, only its hash goes to the audit chain). The document keeps its
 *  own analysis and badge. Identical copies already count once without any action. */
export function RiskScope({ doc, canScope, onSaved }: { doc: MatterDoc; canScope: boolean; onSaved: () => void }) {
  const cn = useClientNames();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const typed = doc.doc_type == null || doc.doc_type === "CONTRACT" || doc.doc_type === "COURT_FILING";
  if (!typed || (!doc.risk_excluded && !canScope)) return null;
  async function save(excluded: boolean) {
    if (!supabase) return;
    if (excluded && reason.trim().length < 3) { setMsg("נדרשת סיבה קצרה."); return; }
    const { error } = await supabase.rpc("lalum_document_set_risk_scope", { p_doc: doc.id, p_excluded: excluded, p_reason: excluded ? reason.trim() : null });
    if (error) { setMsg("השינוי לא נשמר. נדרשת הרשאת שותף ואימות דו שלבי."); return; }
    setOpen(false); setReason(""); setMsg(""); onSaved();
  }
  if (doc.risk_excluded) {
    return (
      <div className="ck-row">
        <span className="ck-chip warn">לא נכלל בסיכון התיק</span>
        {doc.risk_excluded_reason && <span className="ck-meta"><bdi>{cn.text(doc.risk_excluded_reason)}</bdi></span>}
        {canScope && <button className="ck-btn" onClick={() => void save(false)}>החזרה לחישוב</button>}
        {msg && <span className="ck-meta" aria-live="polite">{msg}</span>}
      </div>
    );
  }
  if (!open) return <div className="ck-row"><button className="ck-btn" title="גרסה מוקדמת, נספח או תקציר: המסמך נשאר, אך לא קובע את רמת הסיכון של התיק" onClick={() => setOpen(true)}>לא לכלול בסיכון התיק</button></div>;
  return (
    <div className="ck-row">
      <input className="ck-input" style={{ flex: 1, minWidth: 180 }} maxLength={300} aria-label="סיבה להוצאת המסמך מחישוב הסיכון" placeholder="סיבה קצרה, בלי שמות לקוחות" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="ck-btn primary" onClick={() => void save(true)}>אישור</button>
      <button className="ck-btn" onClick={() => { setOpen(false); setMsg(""); }}>ביטול</button>
      {msg && <span className="ck-meta" aria-live="polite">{msg}</span>}
    </div>
  );
}
