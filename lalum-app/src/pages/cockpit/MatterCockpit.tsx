import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as RPointerEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { callPipeline, CONFLICT, diffWords, errorText, fmt, KIND_HE, MATTER_STATUS, PRACTICE, RESPONSE, STEPS } from "../../lib/cockpit/shared";
import type { Finding, MatterDoc, Membership, Risk } from "../../lib/cockpit/shared";
import { originals } from "../../lib/cockpit/originals";
import { IntakeForm } from "./Intake";

interface Matter { id: string; title: string; practice_area: string; status: string; conflict_status: string; created_at: string }
interface Routing { partner_response: string; dispatched_at: string; first_viewed_at: string | null; responded_at: string | null }
interface SignoffStatus { complete: boolean; steps: Record<string, { valid: boolean }> }
const TOKEN_RE = /\[[A-Z_]+_\d+\]/g;

const Badge = ({ sev }: { sev: string }) =>
  sev === "RED" ? <span className="ck-badge red">🔴 סיכון גבוה</span> : sev === "YELLOW" ? <span className="ck-badge yellow">🟡 זהירות</span> : <span className="ck-badge green">🟢 תקין</span>;
const ConflictBadge = ({ c }: { c: string }) => { const [t, l] = CONFLICT[c] ?? ["yellow", c]; return <span className={`ck-badge ${t}`}>{l}</span>; };
const PiiBadge = () => <span className="ck-pii" title="מידע מזהה הוסתר לפני כל עיבוד חיצוני">🔒 PII Masked &amp; Secured</span>;

function tokenMap(docId: string): Map<string, string> | null {
  const o = originals.get(docId);
  if (!o) return null;
  const m = new Map<string, string>();
  for (const e of o.entities) if (!m.has(e.token)) m.set(e.token, o.text.slice(e.start, e.end));
  return m;
}
const restore = (text: string, map: Map<string, string>): string => text.replace(TOKEN_RE, (t) => map.get(t) ?? t);

export function MatterCockpit({ matterId, member }: { matterId: string; member: Membership }) {
  const [matter, setMatter] = useState<Matter | null>(null);
  const [routing, setRouting] = useState<Routing | null>(null);
  const [docs, setDocs] = useState<MatterDoc[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"edit" | "redline">("edit");
  const [saveMsg, setSaveMsg] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [area, setArea] = useState("");
  const [analyzed, setAnalyzed] = useState("");
  const [anMsg, setAnMsg] = useState("");
  const [signoff, setSignoff] = useState<SignoffStatus | null>(null);
  const [gateMsg, setGateMsg] = useState("");
  const [highlight, setHighlight] = useState<Finding | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [showOrig, setShowOrig] = useState(false);
  const [tab, setTab] = useState(1);
  const [timeline, setTimeline] = useState<Array<[string, string]>>([]);
  const [loaded, setLoaded] = useState(false);
  const [rev, setRev] = useState(0);
  const prefer = useRef<string | null>(null);
  const [widths, setWidths] = useState<{ w1: number; w3: number }>(() => {
    try { return { w1: Number(localStorage.getItem("ck-w1")) || 300, w3: Number(localStorage.getItem("ck-w3")) || 380 }; } catch { return { w1: 300, w3: 380 }; }
  });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const dirty = useRef(false);
  const doc = useMemo(() => docs.find((d) => d.id === docId) ?? null, [docs, docId]);
  const role = member.role;

  const refreshSignoff = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data } = await supabase.rpc("lalum_doc_signoff_status", { p_doc: id });
    setSignoff((data as SignoffStatus | null) ?? null);
  }, []);

  const selectDoc = useCallback((d: MatterDoc, m: Matter) => {
    setDocId(d.id); setText(d.editor_content); setMode("edit"); dirty.current = false; setSaveMsg("");
    setFindings(d.analysis.findings ?? []); setRisk(d.analysis.risk ?? null); setArea(m.practice_area); setAnalyzed(d.editor_content); setHighlight(null);
    void refreshSignoff(d.id);
  }, [refreshSignoff]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return;
      const [mr, rr, dr] = await Promise.all([
        supabase.from("lalum_cockpit_matters").select("*").eq("id", matterId).maybeSingle(),
        supabase.from("lalum_intake_routings").select("*").eq("matter_id", matterId).maybeSingle(),
        supabase.from("lalum_matter_documents").select("id, file_name, baseline_content, editor_content, entity_counts, analysis, created_at").eq("matter_id", matterId).order("created_at"),
      ]);
      if (!live) return;
      const m = mr.data as Matter | null;
      setMatter(m); setRouting(rr.data as Routing | null);
      const list = (dr.data as MatterDoc[] | null) ?? [];
      setDocs(list); setLoaded(true);
      if (m) {
        void supabase.rpc("lalum_mark_matter_viewed", { p_matter: matterId }); // starts and stops the SLA clock
        const keep = list.find((d) => d.id === prefer.current) ?? list.find((d) => originals.has(d.id)) ?? list[0];
        if (keep) selectDoc(keep, m);
      }
    })();
    return () => { live = false; window.clearTimeout(timer.current); };
  }, [matterId, selectDoc, rev]);

  useEffect(() => {
    if (!supabase || !doc || !matter) return;
    let live = true;
    (async () => {
      const { data } = await supabase!.from("lalum_doc_checklist").select("step, checked_at").eq("document_id", doc.id);
      if (!live) return;
      const ev: Array<[string, string]> = [[matter.created_at, "התיק נקלט וסונן אוטומטית"]];
      docs.forEach((x) => ev.push([x.created_at, `מסמך נוסף: ${x.file_name}`]));
      if (routing) {
        ev.push([routing.dispatched_at, "נשלחה התראה לשותף ועותק ביקורת למנהל (בתור שליחה)"]);
        if (routing.first_viewed_at) ev.push([routing.first_viewed_at, "נפתח לראשונה על ידי עורך דין"]);
        if (routing.responded_at) ev.push([routing.responded_at, `תגובת שותף: ${RESPONSE[routing.partner_response]}`]);
      }
      for (const c of (data as Array<{ step: string; checked_at: string }> | null) ?? []) { const s = STEPS.find((x) => x[0] === c.step); if (s) ev.push([c.checked_at, `סומן: ${s[1]}`]); }
      ev.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
      setTimeline(ev);
    })();
    return () => { live = false; };
  }, [doc, docs, matter, routing, signoff]);

  async function save() {
    window.clearTimeout(timer.current);
    if (!doc || !dirty.current) { setSaveMsg("נשמר"); return; }
    setSaveMsg("שומר...");
    const sent = text;
    const r = await callPipeline("/api/v1/documents/draft", { document_id: doc.id, content: sent });
    if (!r.ok) { setSaveMsg(errorText(r)); return; }
    const saved = r.saved_text ?? sent;
    if (r.changed) { setText(saved); setSaveMsg("נשמר. זוהה מידע מזהה בטקסט שהוקלד והוסתר."); } else setSaveMsg("נשמר");
    dirty.current = false;
    setDocs((ds) => ds.map((d) => (d.id === doc.id ? { ...d, editor_content: saved } : d)));
    await refreshSignoff(doc.id);
  }
  function onEdit(v: string) {
    setText(v); dirty.current = true; setSaveMsg("יש שינויים שלא נשמרו");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void saveRef.current(); }, 2500);
  }
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });

  function insertClause(clause: string) {
    setMode("edit");
    const ta = taRef.current;
    const pos = ta && ta.selectionStart > 0 ? ta.selectionStart : text.length;
    onEdit(`${text.slice(0, pos)}${pos ? "\n\n" : ""}${clause}\n\n${text.slice(pos)}`);
    setSaveMsg("הסעיף נוסף. בדקו את ההשלמות בסוגריים [__] ושמרו.");
  }
  function jump(f: Finding) {
    if (!f.span) return;
    setMode("edit");
    const needle = analyzed.slice(f.span.start, f.span.end);
    window.setTimeout(() => {
      const ta = taRef.current; if (!ta) return;
      let i = text.indexOf(needle); if (i < 0) i = f.span!.start;
      ta.focus(); ta.setSelectionRange(i, i + needle.length);
    }, 0);
  }
  async function reanalyze(next: string) {
    if (!doc) return;
    setAnMsg("מנתח...");
    const r = await callPipeline("/api/v1/documents/analyze", { text, practice_area: next });
    if (!r.ok) { setAnMsg(errorText(r)); return; }
    setArea(next); setFindings(r.findings ?? []); setRisk(r.risk ?? null); setAnalyzed(text); setAnMsg("");
  }
  async function toggleStep(step: string, on: boolean) {
    if (!supabase || !doc) return;
    if (dirty.current) await save();
    const { error } = await supabase.rpc(on ? "lalum_check_step" : "lalum_uncheck_step", { p_doc: doc.id, p_step: step });
    setGateMsg(error ? error.message : "");
    await refreshSignoff(doc.id);
  }
  async function doExport(kind: "word" | "pdf", restoreNames: boolean) {
    if (!doc) return;
    const r = await callPipeline("/api/v1/documents/export", { document_id: doc.id });
    if (!r.ok || r.content == null) { setGateMsg(errorText(r)); return; }
    const map = tokenMap(doc.id);
    const content = map && restoreNames ? restore(r.content, map) : r.content;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${esc(r.file_name ?? "document")}</title><style>body{font-family:David,'Times New Roman',serif;font-size:13pt;line-height:1.8;direction:rtl;white-space:pre-wrap}</style></head><body>${esc(content)}</body></html>`;
    if (kind === "word") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
      a.download = `${(r.file_name ?? "document").replace(/\.[^.]+$/, "") || "document"}.doc`;
      document.body.appendChild(a); a.click(); a.remove();
    } else {
      const w = window.open("", "_blank");
      if (!w) { setGateMsg("הדפדפן חסם את חלון ההדפסה."); return; }
      w.document.write(html); w.document.close(); w.focus(); window.setTimeout(() => w.print(), 300);
    }
  }
  async function setResponse(v: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("lalum_set_partner_response", { p_matter: matterId, p_response: v });
    if (!error) setRouting((r) => (r ? { ...r, partner_response: v } : r));
  }

  function drag(e: RPointerEvent<HTMLDivElement>, which: "w1" | "w3") {
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const startX = e.clientX; const start = widths[which]; const dir = which === "w1" ? -1 : 1;
    const move = (ev: PointerEvent) => {
      const v = Math.max(220, Math.min(640, start + dir * (ev.clientX - startX)));
      setWidths((w) => { const n = { ...w, [which]: v }; try { localStorage.setItem(`ck-${which}`, String(v)); } catch { /* storage blocked */ } return n; });
    };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  }

  if (!loaded) return <div className="ck-meta">טוען תיק...</div>;
  if (!matter) return <div className="ck-stack"><div className="ck-err">התיק לא נמצא או שאין הרשאה.</div><Link className="ck-btn" to="/workspace">חזרה לרשימה</Link></div>;

  const tokens = doc ? [...new Set(text.match(TOKEN_RE) ?? [])] : [];
  const map = doc ? tokenMap(doc.id) : null;
  const counts = doc?.entity_counts ?? {};
  const complete = signoff?.complete === true;
  const open = (n: number) => (tab === n ? " on" : "");
  const gridStyle = { "--cp1": `${widths.w1}px`, "--cp3": `${widths.w3}px` } as CSSProperties;
  const groups: Array<Finding[]> = [findings.filter((f) => f.severity !== "GREEN"), findings.filter((f) => f.severity === "GREEN")];
  const FindingCard = ({ f }: { f: Finding }) => (
    <div className={`ck-finding ${f.severity.toLowerCase()}`}>
      <div className="ck-row"><Badge sev={f.severity} /><b style={{ fontSize: 13.5 }}>{f.ruleName}</b></div>
      <div className="ck-meta">{f.description}</div>
      <div className="ck-row">
        <button className="ck-link" onClick={() => setHighlight(f)}>{f.citation ? `מקור: ${f.citation}` : "הצג מקור וקטע"}</button>
        {f.fallbackClause && <button className="ck-btn" onClick={() => insertClause(f.fallbackClause!)}>הוספת סעיף חלופי</button>}
      </div>
    </div>
  );

  return (
    <div className="ck-stack">
      <div className="ck-card">
        <div className="ck-row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="ck-title">{matter.title}</div>
            <div className="ck-row" style={{ marginTop: 6 }}>{PRACTICE[matter.practice_area]} <ConflictBadge c={matter.conflict_status} /> <span className="ck-meta">{MATTER_STATUS[matter.status]}</span></div>
          </div>
          <div className="ck-row"><PiiBadge /><button className="ck-btn" onClick={() => setDrawer(true)}>בודק PII</button><Link className="ck-btn" to="/workspace">לרשימה</Link></div>
        </div>
        {role === "FIRM_PARTNER" && routing && (
          <div className="ck-row"><label className="ck-meta" htmlFor="resp">תגובה לתיק:</label>
            <select id="resp" className="ck-select" style={{ width: "auto" }} value={routing.partner_response} onChange={(e) => void setResponse(e.target.value)}>
              {Object.entries(RESPONSE).map(([k, v]) => <option key={k} value={k} disabled={k === "PENDING_REVIEW"}>{v}</option>)}
            </select></div>
        )}
      </div>

      <div className="ck-tabs" role="tablist" aria-label="חלוניות">
        {[[1, "כספת"], [2, "עורך"], [3, "סוכן ואישור"]].map(([n, l]) => <button key={n} className={`ck-btn${tab === n ? " primary" : ""}`} onClick={() => setTab(n as number)}>{l}</button>)}
      </div>

      <div className="ck-cp" style={gridStyle}>
        <section className={`ck-panel${open(1)}`} aria-label="כספת תיק">
          <h2>כספת תיק ומרכז ראיות</h2>
          <div className="ck-row"><PiiBadge /></div>
          <div className="ck-label">מסמכים</div>
          <div className="ck-stack">{docs.map((d) => <button key={d.id} className={`ck-btn${d.id === docId ? " primary" : ""}`} style={{ justifyContent: "flex-start" }} onClick={() => selectDoc(d, matter)}>{d.file_name}</button>)}</div>
          <details><summary className="ck-btn" style={{ display: "inline-flex" }}>העלאת מסמך נוסף</summary>
            <div style={{ marginTop: 10 }}><IntakeForm matterId={matter.id} onDone={(_m, d) => { prefer.current = d; setRev((n) => n + 1); }} /></div></details>
          <div className="ck-label">מפת ישויות</div>
          {Object.keys(counts).length ? <div className="ck-row">{Object.entries(counts).map(([k, v]) => <span key={k} className="ck-chip">{KIND_HE[k] ?? k}: {v}</span>)}</div> : <span className="ck-meta">לא זוהו ישויות</span>}
          {tokens.length > 0 && <div className="ck-row">{tokens.map((t) => <code key={t} className="ck-chip" dir="ltr">{t}</code>)}</div>}
          <div className="ck-label">ציר זמן</div>
          <ul className="ck-tl">{timeline.map(([t, s], i) => <li key={i}><time>{fmt(t)}</time>{s}</li>)}</ul>
        </section>
        <div className="ck-handle" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="שינוי רוחב" onPointerDown={(e) => drag(e, "w1")} />

        <section className={`ck-panel${open(2)}`} aria-label="עורך חכם">
          <h2>עורך חכם ומרחב מסמכים</h2>
          {!doc ? <span className="ck-meta">אין מסמך בתיק.</span> : <>
            <div className="ck-row">
              <button className={`ck-btn${mode === "edit" ? " primary" : ""}`} onClick={() => setMode("edit")}>עריכה</button>
              <button className={`ck-btn${mode === "redline" ? " primary" : ""}`} onClick={() => setMode("redline")}>מעקב שינויים (Redline)</button>
              <button className="ck-btn" onClick={() => void save()}>שמירה</button>
              <button className="ck-btn danger" onClick={() => { if (window.confirm("לשחזר את המסמך לגרסה שנקלטה? השינויים יימחקו.")) onEdit(doc.baseline_content); }}>שחזור למסמך המקורי המוסתר</button>
              <span className="ck-meta" aria-live="polite">{saveMsg}</span>
            </div>
            {highlight && (
              <div className="ck-card">
                <div className="ck-title">{highlight.ruleName}</div>
                {highlight.excerpt ? <div className="ck-meta">קטע בטקסט: <mark>{highlight.excerpt}</mark></div> : <div className="ck-meta">הכלל מסמן היעדר סעיף, ולכן אין קטע להצגה.</div>}
                <div className="ck-meta"><b>בסיס משפטי:</b> {highlight.citationUrl ? <a href={highlight.citationUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>{highlight.citation ?? highlight.citationUrl}</a> : highlight.citation ?? "אין אסמכתה מוגדרת לכלל זה"}</div>
                <div className="ck-row">{highlight.span && <button className="ck-btn" onClick={() => jump(highlight)}>קפיצה לקטע בעורך</button>}<button className="ck-btn" onClick={() => setHighlight(null)}>סגירה</button></div>
              </div>
            )}
            {mode === "edit"
              ? <textarea ref={taRef} className="ck-editor" dir="rtl" aria-label="עורך המסמך" spellCheck={false} value={text} onChange={(e) => onEdit(e.target.value)} />
              : <div className="ck-editor" tabIndex={0} aria-label="תצוגת שינויים">{diffWords(doc.baseline_content, text).map(([o, t], i) => (o === "=" ? <span key={i}>{t}</span> : o === "+" ? <ins key={i}>{t}</ins> : <del key={i}>{t}</del>))}</div>}
            <div className="ck-meta">הטקסט המוצג מוסתר מפרטים מזהים. כל שמירה עוברת שוב הסתרה אוטומטית. שינוי בטקסט מבטל אישורים קודמים.</div>
          </>}
        </section>
        <div className="ck-handle" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="שינוי רוחב" onPointerDown={(e) => drag(e, "w3")} />

        <section className={`ck-panel${open(3)}`} aria-label="אולפן סוכני תחום ושער אישור">
          <h2>אולפן סוכני תחום</h2>
          <label className="ck-field">פלייבוק מקצועי
            <select className="ck-select" value={area} onChange={(e) => void reanalyze(e.target.value)}>{Object.entries(PRACTICE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          <div className="ck-row"><button className="ck-btn" onClick={() => void reanalyze(area)}>ניתוח מחדש על הטקסט הנוכחי</button><span className="ck-meta" aria-live="polite">{anMsg}</span></div>
          {risk ? <div className="ck-stack">
            <div className="ck-row"><Badge sev="RED" /> <b>{risk.red}</b> <Badge sev="YELLOW" /> <b>{risk.yellow}</b> <Badge sev="GREEN" /> <b>{risk.green}</b></div>
            <div className="ck-meta">ציון בטיחות: {risk.score}/100</div><div className="ck-bar"><div style={{ width: `${risk.score}%` }} /></div>
          </div> : <span className="ck-meta">אין ניתוח</span>}
          <div className="ck-stack">
            {groups[0].length ? groups[0].map((f) => <FindingCard key={f.ruleId} f={f} />) : <span className="ck-meta">לא נמצאו ממצאים בסיכון.</span>}
            {groups[1].length > 0 && <details><summary className="ck-meta">כללים שהתקיימו ({groups[1].length})</summary><div className="ck-stack" style={{ marginTop: 8 }}>{groups[1].map((f) => <FindingCard key={f.ruleId} f={f} />)}</div></details>}
          </div>
          <ExportGate complete={complete} role={role} signoff={signoff} canRestore={!!map} msg={gateMsg} onToggle={toggleStep} onExport={doExport} />
        </section>
      </div>

      {drawer && (
        <aside className="ck-drawer" aria-label="בודק PII">
          <div className="ck-row" style={{ justifyContent: "space-between" }}><h2 className="serif" style={{ margin: 0, fontSize: 17 }}>בודק PII</h2><button className="ck-btn" onClick={() => setDrawer(false)}>סגירה</button></div>
          <div className="ck-meta">{map ? "המקור זמין בזיכרון הדפדפן בלבד, מהסשן שבו הועלה המסמך. הוא לא נשמר בשרת וייעלם ברענון." : "מיפוי הזהויות נמחק בהתאם ל-Zero Data Retention ואינו זמין בשרת. ניתן לראות את המקור רק בסשן שבו הועלה המסמך."}</div>
          <div className="ck-row"><button className={`ck-btn${showOrig ? "" : " primary"}`} onClick={() => setShowOrig(false)}>מוסתר</button><button className={`ck-btn${showOrig ? " primary" : ""}`} disabled={!map} onClick={() => setShowOrig(true)}>מקור</button></div>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>אסימון</th><th>סוג</th><th>ערך</th></tr></thead><tbody>
            {tokens.length ? tokens.map((t) => <tr key={t}><td dir="ltr">{t}</td><td>{KIND_HE[(/^\[([A-Z_]+)_\d+\]$/.exec(t) ?? [])[1] ?? ""] ?? ""}</td><td>{showOrig && map?.has(t) ? map.get(t) : "••••••"}</td></tr>) : <tr><td colSpan={3}>אין אסימונים</td></tr>}
          </tbody></table></div>
          <div className="ck-label">המסמך</div>
          <div className="ck-editor" style={{ minHeight: 120, maxHeight: "40vh", overflow: "auto" }}>{showOrig && map ? restore(text, map) : text}</div>
        </aside>
      )}
    </div>
  );
}

function ExportGate({ complete, role, signoff, canRestore, msg, onToggle, onExport }: {
  complete: boolean; role: string; signoff: SignoffStatus | null; canRestore: boolean; msg: string;
  onToggle: (step: string, on: boolean) => void; onExport: (k: "word" | "pdf", restore: boolean) => void;
}) {
  const [restoreNames, setRestoreNames] = useState(true);
  return (
    <div className={`ck-gate${complete ? " done" : ""}`} role="group" aria-label="שער אישור אנושי">
      <b>אישור אנושי חובה לפני ייצוא</b>
      {STEPS.map(([k, t]) => {
        const s = signoff?.steps?.[k];
        const disabled = !["FIRM_PARTNER", "ATTORNEY"].includes(role) || (k === "PARTNER_APPROVAL" && role !== "FIRM_PARTNER");
        return (
          <label key={k}>
            <input type="checkbox" checked={!!s?.valid} disabled={disabled} onChange={(e) => onToggle(k, e.target.checked)} /> {t}
            {s && !s.valid && <span className="ck-stale">(בוטל: הטקסט שונה)</span>}
            {k === "PARTNER_APPROVAL" && role !== "FIRM_PARTNER" && <span className="ck-meta">(שותף בלבד)</span>}
          </label>
        );
      })}
      {msg && <div className="ck-err" aria-live="polite">{msg}</div>}
      <label className="ck-meta"><input type="checkbox" checked={restoreNames && canRestore} disabled={!canRestore} onChange={(e) => setRestoreNames(e.target.checked)} /> שחזור פרטים מזהים בקובץ המיוצא (זמין רק בסשן שבו הועלה המקור)</label>
      <div className="ck-row"><button className="ck-btn primary" disabled={!complete} onClick={() => onExport("word", restoreNames && canRestore)}>ייצוא Word</button><button className="ck-btn primary" disabled={!complete} onClick={() => onExport("pdf", restoreNames && canRestore)}>ייצוא PDF</button></div>
      {!complete && <div className="ck-meta">הייצוא נחסם עד שכל ארבעת השלבים מסומנים על הטקסט הנוכחי.</div>}
    </div>
  );
}
