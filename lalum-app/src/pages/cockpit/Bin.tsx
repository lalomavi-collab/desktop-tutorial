import { useCallback, useEffect, useState } from "react";
import { CockpitFrame } from "./CockpitFrame";
import { binList, CONFIRM_TEXT, purge, restoreDoc, restoreMatter } from "../../lib/cockpit/bin";
import type { BinItem } from "../../lib/cockpit/bin";
import { fmt } from "../../lib/cockpit/shared";
import { TrashArt } from "../../components/cockpit/CockpitIllustrations";

function BinView({ isPartner }: { isPartner: boolean }) {
  const [rows, setRows] = useState<BinItem[] | null>(null);
  const [target, setTarget] = useState<BinItem | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => { if (isPartner) setRows(await binList()); else setRows([]); }, [isPartner]);
  useEffect(() => { void load(); }, [load]);

  async function restore(i: BinItem) {
    setBusy(true);
    const r = i.kind === "MATTER" ? await restoreMatter(i.id) : await restoreDoc(i.id);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? "שוחזר." : r.error ?? "הפעולה נכשלה." });
    if (r.ok) await load();
  }
  async function destroy() {
    if (!target) return;
    setBusy(true);
    setMsg({ ok: true, text: "מוחק..." });
    const r = await purge(target, typed);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? "נמחק לצמיתות." : r.error ?? "הפעולה נכשלה." });
    if (r.ok) { setTarget(null); setTyped(""); }
    await load();
  }

  if (!isPartner) return <div className="ck-card"><div className="ck-meta">סל המיחזור זמין לאדמין בלבד.</div></div>;
  return (
    <div className="ck-stack">
      <div className="ck-warn">פריט בסל מוסתר מכל המסכים וניתן לשחזור. מחיקה סופית מוחקת גם את הקובץ המקורי מהכספת ואינה ניתנת לביטול. היא נחסמת בתיק שיש עליו עיכוב משפטי, ובתיק שסיום הטיפול בו הוא בתוך תקופת השמירה החוקית. כל פעולה נרשמת ביומן הביקורת (כמות בלבד, ללא פרטים).</div>
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} role="status">{msg.text}</div>}
      {rows == null ? <div className="ck-meta">טוען...</div> : rows.length === 0 ? (
        <div className="ck-card ck-empty"><TrashArt size={104} /><div className="ck-meta">סל המיחזור ריק.</div></div>
      ) : (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>סוג</th><th>שם</th><th>הועבר לסל</th><th>סיבה</th><th>פריטים</th><th>מצב</th><th>פעולות</th></tr></thead><tbody>
          {rows.map((i) => (
            <tr key={`${i.kind}${i.id}`}>
              <td>{i.kind === "MATTER" ? "תיק" : "מסמך"}</td>
              <td style={{ whiteSpace: "normal", maxWidth: 320 }}>{i.label}</td>
              <td>{fmt(i.deleted_at)}</td><td style={{ whiteSpace: "normal", maxWidth: 220 }}>{i.reason ?? ""}</td><td>{i.items}</td>
              <td>{i.purge_requested ? <span className="ck-badge yellow">מחיקה בתהליך</span> : i.blocker ? <span className="ck-badge red">{i.blocker === "LEGAL_HOLD" ? "עיכוב משפטי" : "תקופת שמירה"}</span> : <span className="ck-badge green">ניתן למחיקה</span>}</td>
              <td><div className="ck-row">
                <button className="ck-btn" disabled={busy || i.purge_requested} onClick={() => void restore(i)}>שחזור</button>
                <button className="ck-btn danger" disabled={busy || !!i.blocker} onClick={() => { setTarget(i); setTyped(""); setMsg(null); }}>מחיקה סופית</button>
              </div></td>
            </tr>))}
        </tbody></table></div>
      )}

      {target && (
        <aside className="ck-drawer" aria-label="אישור מחיקה סופית">
          <div className="ck-title">מחיקה סופית של {target.kind === "MATTER" ? "תיק" : "מסמך"}</div>
          <div className="ck-card" style={{ whiteSpace: "normal" }}>{target.label}{target.kind === "MATTER" ? ` (${target.items} מסמכים)` : ""}</div>
          <div className="ck-err">הפעולה מוחקת את הטקסט וגם את הקובץ המקורי מהכספת, ואינה ניתנת לביטול. נשאר רק רישום ביומן הביקורת (מספר ופרט חתימה), והתיק הופך לרשומה ריקה. עותקי גיבוי של התשתית עשויים להישמר לפרק זמן מוגבל.</div>
          <label className="ck-field">להמשך הקלידו: {CONFIRM_TEXT}
            <input className="ck-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <div className="ck-row">
            <button className="ck-btn danger" disabled={busy || typed.trim() !== CONFIRM_TEXT} onClick={() => void destroy()}>מחיקה סופית</button>
            <button className="ck-btn" disabled={busy} onClick={() => setTarget(null)}>ביטול</button>
          </div>
        </aside>
      )}
    </div>
  );
}

export function BinPage() {
  return (
    <CockpitFrame title="סל מיחזור" description="תיקים ומסמכים שהועברו לסל, עם שחזור ומחיקה סופית." path="/workspace/bin">
      {({ member, platformAdmin }) => member && <BinView isPartner={platformAdmin && member.role === "FIRM_PARTNER"} />}
    </CockpitFrame>
  );
}
