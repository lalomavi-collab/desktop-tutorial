import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { diffWords, fmt } from "../../lib/cockpit/shared";

interface Version { id: string; version_no: number; content: string; reason: string; created_at: string }
const REASON: Record<string, string> = { CREATED: "נוצר", AUTO: "שמירה אוטומטית", MANUAL: "גרסה שנשמרה", RESTORE: "שחזור" };

/** Version history of one document. Content is already masked, so nothing here needs the originals. */
export function VersionHistory({ documentId, current, version, onRestored, onBeforeSnapshot }: {
  documentId: string; current: string; version: number; onRestored: () => void; onBeforeSnapshot: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("lalum_document_versions").select("id, version_no, content, reason, created_at").eq("document_id", documentId).order("version_no", { ascending: false }).limit(50);
      if (live) setVersions((data as Version[] | null) ?? []);
    })();
    return () => { live = false; };
  }, [documentId, version, tick]);
  const load = () => setTick((n) => n + 1);

  async function snapshot() {
    if (!supabase) return;
    await onBeforeSnapshot();
    const { error } = await supabase.rpc("lalum_snapshot_document", { p_doc: documentId });
    setMsg(error ? "השמירה נכשלה." : "הגרסה נשמרה.");
    load();
  }
  async function restore(v: Version) {
    if (!supabase) return;
    if (!window.confirm(`לשחזר את גרסה ${v.version_no}? הטקסט הנוכחי יישמר בהיסטוריה, וכל אישורי הבדיקה יבוטלו.`)) return;
    const { error } = await supabase.rpc("lalum_restore_version", { p_version: v.id });
    if (error) { setMsg("השחזור נכשל."); return; }
    setMsg(`גרסה ${v.version_no} שוחזרה.`);
    onRestored();
  }

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>היסטוריית גרסאות ({versions.length})</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-row"><button className="ck-btn" onClick={() => void snapshot()}>שמירת גרסה</button><span className="ck-meta" aria-live="polite">{msg}</span></div>
        <ul className="ck-tl">
          {versions.map((v) => (
            <li key={v.id}>
              <time>{fmt(v.created_at)}</time>
              <div className="ck-row">
                <b>גרסה {v.version_no}</b> <span className="ck-meta">{REASON[v.reason] ?? v.reason}</span>
                <button className="ck-link" onClick={() => setOpen(open === v.id ? null : v.id)}>{open === v.id ? "הסתרת השוואה" : "השוואה לנוכחי"}</button>
                {v.content !== current && <button className="ck-link" onClick={() => void restore(v)}>שחזור</button>}
              </div>
              {open === v.id && <div className="ck-editor" style={{ minHeight: 80, maxHeight: "30vh", overflow: "auto" }}>
                {diffWords(v.content, current).map(([o, t], i) => (o === "=" ? <span key={i}>{t}</span> : o === "+" ? <ins key={i}>{t}</ins> : <del key={i}>{t}</del>))}
              </div>}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
