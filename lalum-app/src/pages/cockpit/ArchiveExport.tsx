import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { MatterDoc } from "../../lib/cockpit/shared";
import { openOriginal, openOriginalEnabled } from "../../lib/cockpit/openOriginal";
import { originalsReadme, pullMatterOriginals } from "../../lib/cockpit/matterOriginalsCore";
import type { OriginalsPort, OriginalsResult } from "../../lib/cockpit/matterOriginalsCore";

interface Props {
  matter: { id: string; title: string; matter_code?: string | null; practice_area: string; retention_basis: string; client_consent_at: string | null; handling_ended_at: string | null; created_at: string };
  docs: MatterDoc[];
  canRestore: (docId: string) => boolean;
  restore: (docId: string, text: string) => string;
}

const sha256 = async (s: string): Promise<string> => {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const sha256Bytes = async (b: Uint8Array): Promise<string> => {
  const d = await crypto.subtle.digest("SHA-256", b as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
};
const originalsPort: OriginalsPort = {
  open: async (id) => { const r = await openOriginal(id); return r.ok ? { ok: true, url: r.url } : { ok: false }; },
  fetchBytes: async (url) => { const res = await fetch(url); if (!res.ok) throw new Error(String(res.status)); return new Uint8Array(await res.arrayBuffer()); },
  digestBytes: sha256Bytes,
};
const safe = (s: string): string => s.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60) || "document";

/** Client request for the file (Advocates Law s.90A(t)): a ZIP with every stored document, a manifest with hashes, and a plain explanation. Partner only, audited. */
export function ArchiveExport({ matter, docs, canRestore, restore }: Props) {
  const [names, setNames] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const anyRestorable = docs.some((d) => canRestore(d.id));

  async function run() {
    if (!supabase || docs.length === 0) return;
    const withOriginals = openOriginalEnabled();
    if (!window.confirm(withOriginals ? "לייצא את כל חומר התיק ללקוח, כולל קבצי המקור? הפעולה נרשמת ביומן הביקורת, ופתיחת כל קובץ מקור נרשמת בנפרד." : "לייצא את כל חומר התיק ללקוח? הפעולה נרשמת ביומן הביקורת.")) return;
    setBusy(true); setMsg(null);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const manifest: Array<Record<string, unknown>> = [];
      let unrestored = 0;
      const nameOf = (i: number, d: { fileName: string }) => `originals/${String(i + 1).padStart(2, "0")}-${safe(d.fileName)}`;
      const orig: OriginalsResult | null = withOriginals
        ? await pullMatterOriginals(docs.map((d) => ({ id: d.id, fileName: d.file_name, size: d.original_size == null ? null : Number(d.original_size), sha256: d.original_sha256 ?? null, mime: d.original_mime ?? null })), originalsPort, nameOf, (n, t) => setMsg(`פותח קבצי מקור ${n} מתוך ${t}...`))
        : null;
      setMsg(null);
      for (const f of orig?.files ?? []) zip.file(f.path, f.content, { binary: true, compression: "STORE" });
      const origRow = new Map((orig?.rows ?? []).map((r) => [r.document, r]));
      for (const [i, d] of docs.entries()) {
        const useNames = names && canRestore(d.id);
        if (!useNames && /\[[A-Z_]+_\d+\]/.test(d.editor_content)) unrestored += 1;
        const current = useNames ? restore(d.id, d.editor_content) : d.editor_content;
        const intake = useNames ? restore(d.id, d.baseline_content) : d.baseline_content;
        const base = `documents/${String(i + 1).padStart(2, "0")}-${safe(d.file_name)}`;
        zip.file(`${base}-נוסח-עדכני.txt`, "﻿" + current);
        zip.file(`${base}-נוסח-כפי-שנקלט.txt`, "﻿" + intake);
        manifest.push({ file_name: d.file_name, uploaded_at: d.created_at, names_restored: useNames, current_sha256: await sha256(current), intake_sha256: await sha256(intake), entity_counts: d.entity_counts, ...(orig ? { original: origRow.get(d.id) ?? null } : {}) });
      }
      zip.file("manifest.json", JSON.stringify({ matter_id: matter.id, title: matter.title, practice_area: matter.practice_area, opened_at: matter.created_at, handling_ended_at: matter.handling_ended_at, retention_basis: matter.retention_basis, client_consent_at: matter.client_consent_at, exported_at: new Date().toISOString(), originals: orig ? { requested: orig.requested, without_original: orig.without, verified: orig.verified, skipped: orig.skipped, complete: orig.complete } : { included: false }, documents: manifest }, null, 2));
      zip.file("README.txt", "﻿" + [
        "חומר ארכיוני: העתק לבקשת הלקוח",
        "",
        `תיק: ${matter.title}`, // archive-content: the exported copy is for the client file and does name the matter
        `יוצא ב: ${new Date().toLocaleDateString("he-IL")}`,
        "",
        "מה כלול: כל מסמך שנשמר בפלטפורמה, בשני נוסחים (עדכני וכפי שנקלט)" + (orig && !orig.skipped ? ", וקבצי המקור שהועלו" : "") + ", וקובץ manifest.json עם חתימות SHA-256 לאימות שלמות.",
        ...originalsReadme(orig),
        orig && orig.complete ? "שמות ופרטים מזהים: בקבצים שבהם שחזור השמות לא היה זמין, פרטים מזהים מופיעים כאסימונים כמו [CLIENT_NAME_1]. את השמות האמיתיים אפשר לקרוא בקבצי המקור שבתיקיית originals." : "שמות ופרטים מזהים: בקבצים שבהם שחזור השמות לא היה זמין, פרטים מזהים מופיעים כאסימונים כמו [CLIENT_NAME_1]. את הנוסח עם השמות יש להשלים מקובץ המקור, שהפירמה מוסרת בנפרד.",
        "",
        "העתק זה אינו מחליף את תיק הפירמה ואינו חוות דעת משפטית.",
      ].join("\n"));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `חומר-תיק-${safe(matter.matter_code ?? matter.id.slice(0, 8))}.zip`; // the code, not the client name: the file name sits in downloads lists and screens
      document.body.appendChild(a); a.click(); a.remove();
      const { error } = await supabase.rpc("lalum_log_archive_export", { p_matter: matter.id, p_docs: docs.length });
      const origNote = orig === null ? "" : orig.skipped ? " קבצי המקור לא נכללו (מספרם או נפחם גדולים מדי) ויש למסור אותם בנפרד." : !orig.complete ? ` ${orig.requested - orig.verified} מקבצי המקור לא נכללו או לא אומתו, והפירוט ב-manifest.json.` : "";
      setMsg(error ? "הקובץ ירד, אך רישום הייצוא ביומן הביקורת נכשל. הפעולה זמינה לשותף בלבד." + origNote : unrestored > 0 ? `הקובץ ירד. ב-${unrestored} מסמכים נשארו אסימונים במקום שמות, ויש להשלים אותם מתיק הפירמה.` + origNote : "הקובץ ירד, והייצוא נרשם ביומן הביקורת." + origNote);
    } catch {
      setMsg("הייצוא נכשל.");
    } finally { setBusy(false); }
  }

  return (
    <div className="ck-stack">
      <div className="ck-meta">לקוח רשאי לבקש את חומר התיק בתקופת השמירה. הייצוא כולל את כל המסמכים השמורים, חתימות לאימות, והסבר. {openOriginalEnabled() ? "הייצוא כולל גם את קבצי המקור שהועלו, מאומתים מול החתימה שנרשמה בקליטה. פתיחת כל קובץ נרשמת ביומן הביקורת, ונדרש אימות דו שלבי." : "הייצוא כולל את הנוסחים הטקסטואליים בלבד. קובץ המקור שהועלה, כשהוא שמור בכספת, אינו כלול בו וצריך למסור אותו ללקוח בנפרד."}</div>
      {anyRestorable && <label className="ck-meta"><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> שחזור שמות במסמכים שהועלו בסשן הנוכחי</label>}
      <button className="ck-btn" disabled={busy || docs.length === 0} onClick={() => void run()}>{busy ? "מכין..." : "ייצוא חומר התיק ללקוח (ZIP)"}</button>
      {msg && <div className="ck-meta" aria-live="polite">{msg}</div>}
    </div>
  );
}
