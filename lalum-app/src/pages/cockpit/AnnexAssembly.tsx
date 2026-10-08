import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { callPipeline, errorText } from "../../lib/cockpit/shared";
import type { MatterDoc } from "../../lib/cockpit/shared";

// Annex assembly (הכנת נספחים). Compose a matter's main document with an ordered set of
// appendices and produce one RTL deliverable (Word or PDF): a cover index, the main document,
// then each annex on its own page. An annex is either another document already in the matter
// (its masked content is fetched and, in the uploading session, un-masked client side, exactly
// like the single-document export) or a named placeholder for an item attached physically
// outside the system. Only organisational metadata (label, order, status) is stored; the PII
// shield and the per-document sign-off gate are unchanged, so an annex document that is not yet
// signed off cannot be exported in full and is represented by a notice page instead of being
// dropped silently.

interface Annex {
  id: string; parent_document_id: string; annex_document_id: string | null;
  label: string; title: string; sort_order: number; status: string; note: string | null;
}

const STATUS: Record<string, [string, string]> = {
  INCLUDED: ["green", "נכלל"],
  PENDING: ["yellow", "ממתין"],
  WAIVED: ["", "לא נדרש"],
};

// Hebrew ordinal label: נספח א׳, נספח ב׳ ... with a geresh on a single letter and gershayim on
// a pair (נספח י״א). Beyond the table it falls back to a numeral.
const HEB = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב", "יג", "יד", "טו", "טז", "יז", "יח", "יט", "כ", "כא", "כב"];
function annexLabel(i: number): string {
  const h = HEB[i - 1];
  if (!h) return `נספח ${i}`;
  return h.length === 1 ? `נספח ${h}׳` : `נספח ${h.slice(0, -1)}״${h.slice(-1)}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function AnnexAssembly({
  matterId, firmId, parent, docs, canRestore, restore,
}: {
  matterId: string; firmId: string; parent: MatterDoc; docs: MatterDoc[];
  canRestore: (id: string) => boolean; restore: (id: string, text: string) => string;
}) {
  const [rows, setRows] = useState<Annex[]>([]);
  const [rev, setRev] = useState(0);
  const [pickId, setPickId] = useState("");
  const [phTitle, setPhTitle] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("lalum_doc_annexes")
        .select("id, parent_document_id, annex_document_id, label, title, sort_order, status, note")
        .eq("parent_document_id", parent.id).order("sort_order");
      if (live) setRows((data as Annex[] | null) ?? []);
    })();
    return () => { live = false; };
  }, [parent.id, rev]);

  // Documents in the matter that can still be added as an annex (not the parent, not already used).
  const available = useMemo(() => {
    const used = new Set(rows.map((r) => r.annex_document_id).filter(Boolean));
    return docs.filter((d) => d.id !== parent.id && !used.has(d.id));
  }, [docs, rows, parent.id]);

  const docName = (id: string | null) => docs.find((d) => d.id === id)?.file_name ?? "";
  const nextOrder = () => (rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 1);

  async function addDoc() {
    if (!supabase || !pickId) return;
    const d = docs.find((x) => x.id === pickId);
    const { error } = await supabase.from("lalum_doc_annexes").insert({
      firm_id: firmId, matter_id: matterId, parent_document_id: parent.id, annex_document_id: pickId,
      title: d?.file_name ?? "", sort_order: nextOrder(), status: "INCLUDED",
    });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setPickId(""); setMsg(null); setRev((n) => n + 1);
  }

  async function addPlaceholder() {
    if (!supabase || !phTitle.trim()) return;
    const { error } = await supabase.from("lalum_doc_annexes").insert({
      firm_id: firmId, matter_id: matterId, parent_document_id: parent.id, annex_document_id: null,
      title: phTitle.trim(), sort_order: nextOrder(), status: "PENDING",
    });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setPhTitle(""); setMsg(null); setRev((n) => n + 1);
  }

  async function patch(id: string, fields: Partial<Annex>) {
    if (!supabase) return;
    const { error } = await supabase.from("lalum_doc_annexes").update(fields).eq("id", id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setRev((n) => n + 1);
  }

  async function remove(id: string) {
    if (!supabase) return;
    await supabase.from("lalum_doc_annexes").delete().eq("id", id);
    setRev((n) => n + 1);
  }

  // Swap sort_order with the neighbour in the given direction.
  async function move(idx: number, dir: -1 | 1) {
    const a = rows[idx]; const b = rows[idx + dir];
    if (!a || !b) return;
    await patch(a.id, { sort_order: b.sort_order });
    await patch(b.id, { sort_order: a.sort_order });
  }

  // Fetch one document's export-ready (masked) content, un-masking in session where possible.
  async function bodyFor(docId: string, restoreNames: boolean): Promise<{ ok: boolean; text: string }> {
    const r = await callPipeline("/api/v1/documents/export", { document_id: docId });
    if (!r.ok || r.content == null) return { ok: false, text: errorText(r) };
    const text = restoreNames && canRestore(docId) ? restore(docId, r.content) : r.content;
    return { ok: true, text };
  }

  async function compose(kind: "word" | "pdf", restoreNames: boolean) {
    if (!supabase) return;
    setBusy(true); setMsg(null);
    try {
      const included = rows.filter((r) => r.status !== "WAIVED");
      const parts: string[] = [];

      // Cover index of the annexes.
      const indexItems = rows.map((r, i) => {
        const tag = STATUS[r.status]?.[1] ?? r.status;
        return `<li><b>${esc(annexLabel(i + 1))}</b> — ${esc(r.title || docName(r.annex_document_id))} <span class="tag">(${esc(tag)})</span></li>`;
      }).join("");
      parts.push(`<section><h1>${esc(parent.file_name)}</h1>${rows.length ? `<h2>רשימת נספחים</h2><ol class="idx">${indexItems}</ol>` : ""}</section>`);

      // Main document body.
      const main = await bodyFor(parent.id, restoreNames);
      if (!main.ok) { setMsg({ ok: false, text: `המסמך הראשי: ${main.text}` }); setBusy(false); return; }
      parts.push(`<section class="pb"><div class="body">${esc(main.text)}</div></section>`);

      // Each annex on its own page.
      let i = 0;
      for (const r of rows) {
        i += 1;
        const heading = `${annexLabel(i)} — ${r.title || docName(r.annex_document_id)}`;
        if (r.status === "WAIVED") continue;
        if (!r.annex_document_id) {
          // Placeholder: a page that marks where the externally supplied annex belongs.
          parts.push(`<section class="pb"><h2>${esc(heading)}</h2><p class="note">${esc(r.note || "מצורף בנפרד.")}</p></section>`);
          continue;
        }
        const b = await bodyFor(r.annex_document_id, restoreNames);
        parts.push(b.ok
          ? `<section class="pb"><h2>${esc(heading)}</h2><div class="body">${esc(b.text)}</div></section>`
          : `<section class="pb"><h2>${esc(heading)}</h2><p class="note">הנספח אינו זמין לייצוא כעת: ${esc(b.text)}</p></section>`);
      }

      const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${esc(parent.file_name)}</title><style>
        body{font-family:David,'Times New Roman',serif;font-size:13pt;line-height:1.8;direction:rtl}
        h1{font-size:19pt;text-align:center;margin:0 0 12pt}h2{font-size:15pt;border-bottom:1px solid #999;padding-bottom:4pt}
        .pb{page-break-before:always}.body{white-space:pre-wrap}.idx{margin:0 0 0 0}.idx li{margin:4pt 0}
        .note{color:#444;font-style:italic}.tag{color:#666;font-size:11pt}
      </style></head><body>${parts.join("")}</body></html>`;

      if (kind === "word") {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
        a.download = `${parent.file_name.replace(/\.[^.]+$/, "") || "document"}-עם-נספחים.doc`;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        const w = window.open("", "_blank");
        if (!w) { setMsg({ ok: false, text: "הדפדפן חסם את חלון ההדפסה." }); setBusy(false); return; }
        w.document.write(html); w.document.close(); w.focus(); window.setTimeout(() => w.print(), 300);
      }
      await supabase.rpc("lalum_log_annex_export", { p_matter: matterId, p_parent: parent.id, p_annexes: included.length });
      setMsg({ ok: true, text: `הופק מסמך עם ${included.length} נספחים.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details>
      <summary className="ck-btn" style={{ display: "inline-flex" }}>הכנת נספחים{rows.length ? ` (${rows.length})` : ""}</summary>
      <div className="ck-stack" style={{ marginTop: 10 }}>
        <div className="ck-meta">הרכבת מסמך אחד מהמסמך הראשי (<b>{parent.file_name}</b>) ומנספחים, לפי סדר. נספח יכול להיות מסמך אחר בתיק, או שורת מקום לפריט שמצורף פיזית בנפרד. התוכן נותר מוסתר, והייצוא כפוף לאישור המסמך כרגיל.</div>

        {rows.length === 0 && <div className="ck-meta">לא הוגדרו נספחים.</div>}
        {rows.map((r, i) => (
          <div key={r.id} className="ck-card ck-stack" style={{ gap: 6 }}>
            <div className="ck-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className="ck-title">{annexLabel(i + 1)}</span>
              <span className="ck-row" style={{ gap: 4 }}>
                <button className="ck-btn" disabled={i === 0} onClick={() => void move(i, -1)} aria-label="העלאה">↑</button>
                <button className="ck-btn" disabled={i === rows.length - 1} onClick={() => void move(i, 1)} aria-label="הורדה">↓</button>
                <button className="ck-btn danger" onClick={() => void remove(r.id)} aria-label="הסרה">הסרה</button>
              </span>
            </div>
            <input className="ck-input" value={r.title} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x)))} onBlur={(e) => void patch(r.id, { title: e.target.value })} placeholder="כותרת הנספח" />
            <div className="ck-row" style={{ gap: 8, alignItems: "center" }}>
              {r.annex_document_id
                ? <span className="ck-chip">מסמך בתיק: {docName(r.annex_document_id)}</span>
                : <span className="ck-chip">שורת מקום (מצורף בנפרד)</span>}
              <select className="ck-select" value={r.status} onChange={(e) => void patch(r.id, { status: e.target.value })} style={{ maxWidth: 140 }}>
                {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l[1]}</option>)}
              </select>
            </div>
            {!r.annex_document_id && (
              <input className="ck-input" value={r.note ?? ""} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, note: e.target.value } : x)))} onBlur={(e) => void patch(r.id, { note: e.target.value })} placeholder="הערה (למשל: נסח טאבו מצורף בנפרד)" />
            )}
          </div>
        ))}

        <div className="ck-label">הוספת נספח</div>
        <div className="ck-row" style={{ gap: 6 }}>
          <select className="ck-select" value={pickId} onChange={(e) => setPickId(e.target.value)} disabled={!available.length}>
            <option value="">{available.length ? "מסמך מהתיק..." : "אין מסמכים נוספים בתיק"}</option>
            {available.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}
          </select>
          <button className="ck-btn" disabled={!pickId} onClick={() => void addDoc()}>הוספת מסמך</button>
        </div>
        <div className="ck-row" style={{ gap: 6 }}>
          <input className="ck-input" value={phTitle} onChange={(e) => setPhTitle(e.target.value)} placeholder="שורת מקום: כותרת (נסח טאבו, תעודת זהות...)" />
          <button className="ck-btn" disabled={!phTitle.trim()} onClick={() => void addPlaceholder()}>הוספת שורת מקום</button>
        </div>

        <div className="ck-label">הפקה</div>
        <div className="ck-row" style={{ gap: 6 }}>
          <button className="ck-btn primary" disabled={busy} onClick={() => void compose("word", true)}>הפקת Word עם נספחים</button>
          <button className="ck-btn primary" disabled={busy} onClick={() => void compose("pdf", true)}>הפקת PDF עם נספחים</button>
          {busy && <span className="ck-meta">מרכיב...</span>}
          {msg && <span className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite" style={{ padding: "6px 12px" }}>{msg.text}</span>}
        </div>
        <div className="ck-meta">כל מסמך הנכלל חייב לעבור את אישור הייצוא שלו. מסמך שטרם אושר יופיע כעמוד הודעה במקום להישמט. שחזור הפרטים המזהים אפשרי רק בסשן שבו הועלה המסמך.</div>
      </div>
    </details>
  );
}
