import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { DOC_ORIGIN, DOC_TYPE } from "../../lib/cockpit/docMeta";
import type { MatterDoc } from "../../lib/cockpit/shared";

/** Shows how a document is classified; documents without a classification (older uploads) can be classified in place. */
export function DocMeta({ doc, canEdit, onSaved }: { doc: MatterDoc; canEdit: boolean; onSaved: () => void }) {
  const [type, setType] = useState("");
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState("");
  if (doc.doc_type && doc.doc_origin) {
    return <div className="ck-row"><span className="ck-chip">{DOC_TYPE[doc.doc_type]}</span><span className="ck-chip">מקור: {DOC_ORIGIN[doc.doc_origin]}</span>{doc.doc_date && <span className="ck-chip">{new Date(doc.doc_date).toLocaleDateString("he-IL")}</span>}</div>;
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

const DELETE_ERRORS: Array<[string, string]> = [
  ["legal hold", "התיק מוחזק בצו שימור משפטי ולא ניתן למחוק ממנו."],
  ["original is held", "למסמך יש מקור בכספת, והוא נשמר לפי חוק. מחיקה אפשרית רק במסגרת מחיקת התיק לפי כללי השמירה."],
  ["only an administrator", "המחיקה מותרת לאדמין בלבד."],
];

/** Visible to platform admins only. The same rule is enforced on the server by lalum_delete_document. */
export function DeleteDoc({ doc, onDeleted }: { doc: MatterDoc; onDeleted: () => void }) {
  const [msg, setMsg] = useState("");
  async function del() {
    if (!supabase) return;
    if (!window.confirm("למחוק את המסמך מהתיק? הפעולה אינה הפיכה ותירשם ביומן הביקורת.")) return;
    const { error } = await supabase.rpc("lalum_delete_document", { p_doc: doc.id });
    if (!error) { onDeleted(); return; }
    setMsg(DELETE_ERRORS.find(([k]) => error.message.includes(k))?.[1] ?? "המחיקה נכשלה.");
  }
  return <div className="ck-row"><button className="ck-btn danger" onClick={() => void del()}>מחיקת המסמך (אדמין)</button>{msg && <span className="ck-err" role="alert">{msg}</span>}</div>;
}
