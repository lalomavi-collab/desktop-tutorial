import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { extractText } from "../../lib/extractText";
import { originals } from "../../lib/cockpit/originals";
import { callPipeline, errorText, PRACTICE } from "../../lib/cockpit/shared";

export async function readFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx") || name.endsWith(".pdf")) {
    // The shared extractor truncates at 14k characters for prompts; a contract must not be cut silently.
    const text = await extractText(file, 400000);
    if (!text) throw new Error("לא נמצא טקסט בקובץ. ייתכן שזה PDF סרוק. הדביקו את הטקסט.");
    if (text.endsWith("…")) throw new Error("הקובץ ארוך מדי לעיבוד במסך אחד. פצלו אותו או הדביקו חלק ממנו.");
    return text;
  }
  const text = await file.text();
  if (name.endsWith(".html") || name.endsWith(".htm")) return new DOMParser().parseFromString(text, "text/html").body.textContent ?? "";
  return text;
}

export function IntakeForm({ matterId, onDone }: { matterId?: string; onDone: (matterId: string, documentId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "warn" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string): string => String(f.get(k) ?? "").trim();
    let text = str("text");
    let fileName: string | undefined;
    try {
      const file = fileRef.current?.files?.[0];
      if (file) { text = (await readFile(file)).trim(); fileName = file.name; }
    } catch (err) { setStatus({ kind: "err", text: (err as Error).message }); return; }
    if (!text) { setStatus({ kind: "err", text: "לא הוזן טקסט." }); return; }
    const parties: Array<{ role: string; name?: string; idNumber?: string }> = [];
    if (str("client_name") || str("client_id")) parties.push({ role: "CLIENT", name: str("client_name") || undefined, idNumber: str("client_id") || undefined });
    if (str("adverse_name") || str("adverse_id")) parties.push({ role: "ADVERSE", name: str("adverse_name") || undefined, idNumber: str("adverse_id") || undefined });
    setBusy(true);
    setStatus({ kind: "info", text: "מעבד: הסתרת מידע מזהה, ניגוד עניינים, ניתוח..." });
    const r = await callPipeline("/api/v1/documents/upload", {
      text, file_name: fileName, title: str("title") || undefined, practice_area: str("practice_area") || undefined, matter_id: matterId, parties,
    });
    setBusy(false);
    if (!r.ok || !r.matter_id || !r.document_id) { setStatus({ kind: r.code === "CONFLICT_HALT" ? "warn" : "err", text: errorText(r) }); return; }
    originals.set(r.document_id, { text, entities: r.entities ?? [] });
    onDone(r.matter_id, r.document_id);
  }

  return (
    <form className="ck-stack" onSubmit={submit}>
      <div className="ck-warn">הטקסט עובר הסתרת מידע מזהה (PII), בדיקת ניגוד עניינים וניתוח פלייבוק לפני שנשמר. המקור אינו נשמר בשרת.</div>
      {!matterId && (
        <div className="ck-grid2">
          <label className="ck-field">כותרת התיק (אופציונלי)<input className="ck-input" name="title" autoComplete="off" /></label>
          <label className="ck-field">תחום
            <select className="ck-select" name="practice_area" defaultValue="">
              <option value="">זיהוי אוטומטי</option>
              {Object.entries(PRACTICE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="ck-grid2">
        <label className="ck-field">שם הלקוח<input className="ck-input" name="client_name" autoComplete="off" /></label>
        <label className="ck-field">ת.ז. / ח.פ. של הלקוח<input className="ck-input" name="client_id" autoComplete="off" /></label>
        <label className="ck-field">שם הצד שכנגד<input className="ck-input" name="adverse_name" autoComplete="off" /></label>
        <label className="ck-field">ת.ז. / ח.פ. של הצד שכנגד<input className="ck-input" name="adverse_id" autoComplete="off" /></label>
      </div>
      <label className="ck-field">קובץ (DOCX, PDF, TXT, MD, HTML)<input className="ck-input" type="file" ref={fileRef} accept=".docx,.pdf,.txt,.md,.html,.htm" /></label>
      <label className="ck-field">או הדביקו טקסט<textarea className="ck-textarea" name="text" placeholder="הדביקו כאן חוזה, פנייה או הודעה" /></label>
      <div className="ck-row"><button className="ck-btn primary" type="submit" disabled={busy}>קליטה וניתוח</button></div>
      {status && <div className={status.kind === "info" ? "ck-meta" : status.kind === "warn" ? "ck-warn" : "ck-err"} aria-live="polite">{status.text}</div>}
    </form>
  );
}
