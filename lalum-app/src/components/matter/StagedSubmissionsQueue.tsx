import { useState } from "react";
import type { StagedDoc } from "../../lib/cockpit/crmDemo";

const CATEGORIES = ["כתבי טענות", "ראיות", "תכתובת", "מסמכי זהות", "אחר"];

/** Gate between a client upload and the official case file. Reject requires a reason; approve requires a category. */
export function StagedSubmissionsQueue({ docs, onChange }: { docs: StagedDoc[]; onChange: (d: StagedDoc[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [reason, setReason] = useState("");
  const pending = docs.filter((d) => d.status === "PENDING_REVIEW");
  const act = (id: string, patch: Partial<StagedDoc>) => { onChange(docs.map((d) => (d.id === id ? { ...d, ...patch } : d))); setOpenId(null); setReason(""); };
  return (
    <section className="ck-card" aria-label="מסמכים ממתינים לאישור">
      <div className="ck-card-head"><h3 className="ck-title">מסמכי לקוח ממתינים</h3><span className="ck-badge yellow">{pending.length}</span></div>
      {pending.length === 0 ? <div className="ck-empty">אין מסמכים ממתינים.</div> : (
        <ul className="crm-list">
          {pending.map((d) => (
            <li key={d.id}>
              <span>{d.name} <span className="ck-meta" dir="ltr">{d.uploadedOn}</span></span>
              <button type="button" className="ck-btn" onClick={() => setOpenId(openId === d.id ? null : d.id)} aria-expanded={openId === d.id}>בדיקה</button>
              {openId === d.id && (
                <div className="ck-card" style={{ flexBasis: "100%" }}>
                  <div className="ck-meta">תצוגה מקדימה זמינה כשמחברים אחסון מסמכים. במצב הדגמה אין קובץ אמיתי.</div>
                  <label className="ck-field"><span className="ck-label">קטגוריה לאישור</span>
                    <select className="ck-select" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                  </label>
                  <label className="ck-field"><span className="ck-label">סיבת דחייה (חובה בדחייה)</span><textarea className="ck-textarea" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                  <div className="crm-actions">
                    <button type="button" className="ck-btn primary" onClick={() => act(d.id, { status: "APPROVED", category })}>אישור ואינדוקס</button>
                    <button type="button" className="ck-btn" disabled={!reason.trim()} onClick={() => act(d.id, { status: "REVISION", note: reason.trim() })}>דחייה</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
