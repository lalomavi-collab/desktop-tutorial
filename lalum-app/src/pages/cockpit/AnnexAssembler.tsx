import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { callPipeline, errorText } from "../../lib/cockpit/shared";
import type { MatterDoc } from "../../lib/cockpit/shared";
import { restore, tokenMap } from "../../lib/cockpit/originals";
import { annexLabel, buildAssemblyHtml, titleOf } from "../../lib/cockpit/annex";
import type { AssemblyItem } from "../../lib/cockpit/annex";

/** Builds one printable file from the matter's documents: the first chosen is the main document, the
 *  rest become annexes. Each document is fetched through the export route, so the server's sign-off
 *  gate decides what can be included. The popup opens synchronously: the browser blocks it otherwise. */
export function AnnexAssembler({ docs, matterTitle }: { docs: MatterDoc[]; matterTitle: string }) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [names, setNames] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open || !supabase) return;
    let live = true;
    (async () => {
      const entries = await Promise.all(docs.map(async (d): Promise<[string, boolean]> => {
        const { data } = await supabase!.rpc("lalum_doc_signoff_status", { p_doc: d.id });
        return [d.id, (data as { complete?: boolean } | null)?.complete === true];
      }));
      if (live) setSigned(Object.fromEntries(entries));
    })();
    return () => { live = false; };
  }, [open, docs]);

  const byId = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const chosen = order.filter((id) => byId.has(id));
  const anyRestorable = chosen.some((id) => tokenMap(id) !== null);
  const blocked = chosen.filter((id) => !signed[id]);

  const toggle = (id: string) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const move = (id: string, dir: -1 | 1) => setOrder((o) => {
    const i = o.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return o;
    const n = [...o]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const labelOf = (id: string): string => { const i = chosen.indexOf(id); return i < 0 ? "" : i === 0 ? "מסמך ראשי" : annexLabel(i - 1); };

  async function assemble() {
    if (!chosen.length || blocked.length) return;
    const w = window.open("", "_blank");
    if (!w) { setMsg("הדפדפן חסם את חלון ההדפסה. אשרו חלונות קופצים לאתר ונסו שוב."); return; }
    w.document.write('<p dir="rtl" style="font-family:Arial;padding:2em">מכין את המסמך...</p>');
    setBusy(true); setMsg("");
    try {
      const items: AssemblyItem[] = [];
      for (const id of chosen) {
        const d = byId.get(id)!;
        const r = await callPipeline("/api/v1/documents/export", { document_id: id });
        if (!r.ok || r.content == null) { w.close(); setMsg(`${titleOf(d.file_name)}: ${errorText(r)}`); return; }
        const map = names ? tokenMap(id) : null;
        items.push({ title: map ? restore(titleOf(r.file_name ?? d.file_name), map) : titleOf(r.file_name ?? d.file_name), content: map ? restore(r.content, map) : r.content });
      }
      const mainMap = names ? tokenMap(chosen[0]) : null;
      const html = buildAssemblyHtml({
        title: mainMap ? restore(matterTitle, mainMap) : matterTitle,
        dateLabel: new Date().toLocaleDateString("he-IL"),
        main: items[0], annexes: items.slice(1),
      });
      if (w.closed) return;
      w.document.open(); w.document.write(html); w.document.close(); w.focus();
      window.setTimeout(() => w.print(), 400);
      setMsg("נפתח חלון הדפסה. בחרו שמירה כ-PDF.");
    } finally { setBusy(false); }
  }

  return (
    <details onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>הרכבת מסמך עם נספחים (PDF)</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-meta">סמנו את המסמכים לפי הסדר: הראשון הוא המסמך הראשי והשאר נספחים. רק מסמך שאושר בשער האישור האנושי ניתן להכללה.</div>
        <div className="ck-stack">
          {docs.map((d) => {
            const on = order.includes(d.id), ok = signed[d.id] === true;
            return (
              <div key={d.id} className="ck-row">
                <label><input type="checkbox" checked={on} onChange={() => toggle(d.id)} /> {titleOf(d.file_name)}</label>
                {on && <b className="ck-meta">{labelOf(d.id)}</b>}
                {on && <><button className="ck-link" onClick={() => move(d.id, -1)} aria-label="הזזה למעלה">למעלה</button><button className="ck-link" onClick={() => move(d.id, 1)} aria-label="הזזה למטה">למטה</button></>}
                {on && !ok && <span className="ck-stale">(טרם אושר)</span>}
              </div>
            );
          })}
        </div>
        <label className="ck-meta"><input type="checkbox" checked={names && anyRestorable} disabled={!anyRestorable} onChange={(e) => setNames(e.target.checked)} /> שחזור פרטים מזהים (זמין רק בסשן שבו הועלה המקור)</label>
        {blocked.length > 0 && <div className="ck-warn">לא ניתן להרכיב: {blocked.length === 1 ? "מסמך אחד טרם אושר" : `${blocked.length} מסמכים טרם אושרו`} בארבעת שלבי האישור על הנוסח הנוכחי.</div>}
        <div className="ck-row">
          <button className="ck-btn primary" disabled={busy || !chosen.length || blocked.length > 0} onClick={() => void assemble()}>הכנת PDF</button>
          <span className="ck-meta" aria-live="polite">{msg}</span>
        </div>
      </div>
    </details>
  );
}
