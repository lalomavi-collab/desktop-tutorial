import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { originals } from "../../lib/cockpit/originals";
import { callPipeline, errorText } from "../../lib/cockpit/shared";
import { extractFields, FIELD_LABEL, mergeTemplate, missingFields, partiesFrom, todayHe, UNMASKED_FIELDS } from "../../lib/cockpit/templates";
import type { DocTemplate } from "../../lib/cockpit/templates";

/** Creates a document in an existing matter from a firm template. The merged text goes through the
 *  upload route, so it is masked, conflict checked, analysed and stored in the matter in one step. */
export function TemplateGenerator({ matterId, practiceArea, onDone }: { matterId: string; practiceArea: string; onDone: (documentId: string) => void }) {
  const [templates, setTemplates] = useState<DocTemplate[] | null>(null);
  const [tplId, setTplId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ date: todayHe() });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "warn" | "err"; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("lalum_doc_templates").select("id, name, practice_area, body, version").eq("active", true).order("name");
      if (live) setTemplates((data as DocTemplate[] | null) ?? []);
    })();
    return () => { live = false; };
  }, []);

  const tpl = useMemo(() => templates?.find((t) => t.id === tplId) ?? null, [templates, tplId]);
  const fields = useMemo(() => (tpl ? extractFields(tpl.body) : []), [tpl]);
  const missing = tpl ? missingFields(tpl.body, values) : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!tpl) return;
    const text = mergeTemplate(tpl.body, values);
    setBusy(true);
    setStatus({ kind: "info", text: "מעבד: הסתרת מידע מזהה, ניגוד עניינים, ניתוח..." });
    const r = await callPipeline("/api/v1/documents/upload", {
      text, file_name: `${tpl.name}.txt`, matter_id: matterId, practice_area: practiceArea, parties: partiesFrom(values),
    });
    setBusy(false);
    if (!r.ok || !r.document_id) { setStatus({ kind: r.code === "CONFLICT_HALT" ? "warn" : "err", text: errorText(r) }); return; }
    originals.set(r.document_id, { text, entities: r.entities ?? [] });
    setStatus(null);
    onDone(r.document_id);
  }

  if (templates == null) return <div className="ck-meta">טוען תבניות...</div>;
  if (!templates.length) return <div className="ck-meta">אין תבניות פעילות במשרד.</div>;

  return (
    <form className="ck-stack" onSubmit={submit}>
      <label className="ck-field">תבנית
        <select className="ck-select" value={tplId} onChange={(e) => setTplId(e.target.value)}>
          <option value="">בחרו תבנית</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      {tpl && <>
        <div className="ck-warn">הזינו שמות ומספרי זיהוי רק בשדות הייעודיים. שדות חופשיים (כגון נושא) אינם מוסתרים אלא לפי זיהוי אוטומטי. כתובת אינה מזוהה על ידי מנגנון ההסתרה ולכן אינה נשמרת בשרת: משלימים אותה בקובץ המיוצא.</div>
        <div className="ck-grid2">
          {fields.map((k) => UNMASKED_FIELDS.has(k)
            ? <div key={k} className="ck-field"><span>{FIELD_LABEL[k] ?? k}</span><span className="ck-meta">לא נשמרת. תוצג כשדה ריק להשלמה.</span></div>
            : <label key={k} className="ck-field">{FIELD_LABEL[k] ?? k}
                <input className="ck-input" autoComplete="off" value={values[k] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
              </label>)}
        </div>
        {missing.length > 0 && <div className="ck-meta">שדות ריקים יופיעו כמקום להשלמה: {missing.map((k) => FIELD_LABEL[k] ?? k).join(", ")}.</div>}
        <div className="ck-row"><button className="ck-btn primary" type="submit" disabled={busy}>יצירת מסמך בתיק</button></div>
      </>}
      {status && <div className={status.kind === "info" ? "ck-meta" : status.kind === "warn" ? "ck-warn" : "ck-err"} aria-live="polite">{status.text}</div>}
    </form>
  );
}
