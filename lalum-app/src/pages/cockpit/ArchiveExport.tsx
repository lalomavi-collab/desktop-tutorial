import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { MatterDoc } from "../../lib/cockpit/shared";

interface Props {
  matter: { id: string; title: string; practice_area: string; retention_basis: string; client_consent_at: string | null; handling_ended_at: string | null; created_at: string };
  docs: MatterDoc[];
  canRestore: (docId: string) => boolean;
  restore: (docId: string, text: string) => string;
}

const sha256 = async (s: string): Promise<string> => {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    if (!window.confirm("לייצא את כל חומר התיק ללקוח? הפעולה נרשמת ביומן הביקורת.")) return;
    setBusy(true); setMsg(null);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const manifest: Array<Record<string, unknown>> = [];
      let unrestored = 0;
      for (const [i, d] of docs.entries()) {
        const useNames = names && canRestore(d.id);
        if (!useNames && /\[[A-Z_]+_\d+\]/.test(d.editor_content)) unrestored += 1;
        const current = useNames ? restore(d.id, d.editor_content) : d.editor_content;
        const intake = useNames ? restore(d.id, d.baseline_content) : d.baseline_content;
        const base = `documents/${String(i + 1).padStart(2, "0")}-${safe(d.file_name)}`;
        zip.file(`${base}-נוסח-עדכני.txt`, "﻿" + current);
        zip.file(`${base}-נוסח-כפי-שנקלט.txt`, "﻿" + intake);
        manifest.push({ file_name: d.file_name, uploaded_at: d.created_at, names_restored: useNames, current_sha256: await sha256(current), intake_sha256: await sha256(intake), entity_counts: d.entity_counts });
      }
      zip.file("manifest.json", JSON.stringify({ matter_id: matter.id, title: matter.title, practice_area: matter.practice_area, opened_at: matter.created_at, handling_ended_at: matter.handling_ended_at, retention_basis: matter.retention_basis, client_consent_at: matter.client_consent_at, exported_at: new Date().toISOString(), documents: manifest }, null, 2));
      zip.file("README.txt", "﻿" + [
        "חומר ארכיוני: העתק לבקשת הלקוח",
        "",
        `תיק: ${matter.title}`,
        `יוצא ב: ${new Date().toLocaleDateString("he-IL")}`,
        "",
        "מה כלול: כל מסמך שנשמר בפלטפורמה, בשני נוסחים (עדכני וכפי שנקלט), וקובץ manifest.json עם חתימות SHA-256 לאימות שלמות.",
        "מה לא כלול: המסמך המקורי כפי שהועלה. הפלטפורמה אינה שומרת אותו, ולכן המקור נמצא בתיק המשרד.",
        "שמות ופרטים מזהים: בקבצים שבהם שחזור השמות לא היה זמין, פרטים מזהים מופיעים כאסימונים כמו [CLIENT_NAME_1]. את המקור יש להשלים מתיק המשרד.",
        "",
        "העתק זה אינו מחליף את תיק המשרד ואינו חוות דעת משפטית.",
      ].join("\n"));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `חומר-תיק-${safe(matter.title)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      const { error } = await supabase.rpc("lalum_log_archive_export", { p_matter: matter.id, p_docs: docs.length });
      setMsg(error ? "הקובץ ירד, אך רישום הייצוא ביומן הביקורת נכשל. הפעולה זמינה לשותף בלבד." : unrestored > 0 ? `הקובץ ירד. ב-${unrestored} מסמכים נשארו אסימונים במקום שמות, ויש להשלים אותם מתיק המשרד.` : "הקובץ ירד, והייצוא נרשם ביומן הביקורת.");
    } catch {
      setMsg("הייצוא נכשל.");
    } finally { setBusy(false); }
  }

  return (
    <div className="ck-stack">
      <div className="ck-meta">לקוח רשאי לבקש את חומר התיק בתקופת השמירה. הייצוא כולל את כל המסמכים השמורים, חתימות לאימות, והסבר. המסמך המקורי אינו נשמר בפלטפורמה.</div>
      {anyRestorable && <label className="ck-meta"><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> שחזור שמות במסמכים שהועלו בסשן הנוכחי</label>}
      <button className="ck-btn" disabled={busy || docs.length === 0} onClick={() => void run()}>{busy ? "מכין..." : "ייצוא חומר התיק ללקוח (ZIP)"}</button>
      {msg && <div className="ck-meta" aria-live="polite">{msg}</div>}
    </div>
  );
}
