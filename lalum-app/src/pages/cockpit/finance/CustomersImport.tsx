import { useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { importError, importFromInvoice4u } from "../../../lib/cockpit/financeApi";
import { CUSTOMER_TEMPLATE_CSV, mapCustomers, parseDelimited } from "../../../lib/cockpit/customerImport";
import type { ImportRow } from "../../../lib/cockpit/customerImport";
import { readXlsx } from "../../../lib/cockpit/xlsxRead";

type Method = "system" | "paste" | "file" | "manual";
const METHODS: Array<{ key: Method; title: string; hint: string }> = [
  { key: "system", title: "ממערכת ההנפקה", hint: "קריאה בלבד של הלקוחות שכבר קיימים שם" },
  { key: "paste", title: "הדבקת רשימה", hint: "שורה ללקוח, גם מהדבקה מאקסל" },
  { key: "file", title: "קובץ אקסל או CSV", hint: "xlsx או csv, עם שורת כותרות או בלעדיה" },
  { key: "manual", title: "הזנה ידנית", hint: "לקוח אחד בטופס" },
];
const STATUS: Record<ImportRow["status"], string> = { new: "חדש", duplicate: "קיים כבר, ידולג", invalid: "לא תקין, ידולג" };

export function CustomersImport({ firmId, existing, revealed, onManual, onChange }: {
  firmId: string; existing: Array<{ name: string; tax_id: string | null }>; revealed: boolean; onManual: () => void; onChange: () => void;
}) {
  const [method, setMethod] = useState<Method | null>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [usedHeader, setUsedHeader] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(m: Method) {
    setMsg(null); setRows(null);
    if (m === "manual") { setMethod(null); onManual(); return; }
    setMethod(m);
  }
  function review(cells: string[][]) {
    const r = mapCustomers(cells, existing);
    setRows(r.rows); setUsedHeader(r.usedHeader);
    setMsg(r.rows.length ? null : { ok: false, text: "לא נמצאו שורות לקריאה." });
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    setMsg(null); setRows(null);
    try {
      if (/\.xlsx$/i.test(f.name)) review(await readXlsx(await f.arrayBuffer()));
      else if (/\.xls$/i.test(f.name)) setMsg({ ok: false, text: "קובץ xls ישן אינו נתמך. שמרו אותו מאקסל כ-xlsx או כ-CSV." });
      else review(parseDelimited(await f.text()));
    } catch { setMsg({ ok: false, text: "לא הצלחנו לקרוא את הקובץ. ודאו שהוא xlsx או CSV תקין." }); }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function importSystem() {
    setBusy(true); setMsg(null);
    const r = await importFromInvoice4u({ action: "customers" });
    setBusy(false);
    if (r.ok) { onChange(); setMsg({ ok: true, text: `נמצאו ${r.fetched}, נוספו ${r.inserted}, קושרו ללקוחות קיימים לפי ת.ז. ${r.linked}, דולגו ${r.skipped}.` }); }
    else setMsg({ ok: false, text: importError(r) });
  }
  async function save() {
    if (!supabase || !rows) return;
    const fresh = rows.filter((r) => r.status === "new");
    if (!fresh.length) return;
    setBusy(true); setMsg(null);
    for (let i = 0; i < fresh.length; i += 200) {
      const { error } = await supabase.from("lalum_fin_customers").insert(fresh.slice(i, i + 200).map((r) => ({
        firm_id: firmId, name: r.name, tax_id: r.tax_id || null, email: r.email || null, phone: r.phone || null,
        address: r.address || null, city: r.city || null, is_casual: false,
      })));
      if (error) { setBusy(false); setMsg({ ok: false, text: `${i ? `נשמרו ${i} לקוחות לפני העצירה. ` : ""}${error.message}` }); onChange(); return; }
    }
    setBusy(false); setRows(null); setText(""); onChange();
    setMsg({ ok: true, text: `נוספו ${fresh.length} לקוחות. השלמות חסרות (דוא"ל, ת.ז.) מסומנות בכרטיס הלקוח.` });
  }
  function template() {
    const url = URL.createObjectURL(new Blob([CUSTOMER_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "lalum-customers-template.csv"; a.click(); URL.revokeObjectURL(url);
  }
  const counts = rows ? { fresh: rows.filter((r) => r.status === "new").length, dup: rows.filter((r) => r.status === "duplicate").length, bad: rows.filter((r) => r.status === "invalid").length } : null;

  return (
    <div className="ck-card ck-stack cust-import">
      <div className="ck-title">הוספת לקוחות</div>
      <div className="cust-methods" role="group" aria-label="דרך ההוספה">
        {METHODS.map((way) => (
          <button key={way.key} type="button" className="cust-method" aria-pressed={method === way.key} onClick={() => pick(way.key)}>
            <b>{way.title}</b><span>{way.hint}</span>
          </button>
        ))}
      </div>

      {method === "system" && (
        <div className="ck-stack">
          <div className="ck-meta">מקשר לקוחות קיימים לפי ת.ז. ומוסיף את החדשים. הפעולה לקריאה בלבד ואינה משנה דבר במערכת ההנפקה. אחרי זה הפקה חדשה לא תיצור לקוח כפול שם.</div>
          <div className="ck-row"><button className="ck-btn primary" disabled={busy} onClick={() => void importSystem()}>{busy ? "מייבאים..." : "ייבוא לקוחות מהמערכת"}</button></div>
        </div>
      )}

      {(method === "paste" || method === "file") && (
        <div className="ck-stack">
          {!revealed && <div className="ck-warn">ייבוא רשימה מציג שמות לקוחות. הציגו שמות (נרשם ביומן) כדי להמשיך.</div>}
          <div className="ck-meta">
            עמודות לפי הסדר: שם, ת.ז. או ח.פ., דוא"ל, טלפון, כתובת, עיר. אם השורה הראשונה היא כותרות, הסדר נקבע לפיהן. לקוח שכבר קיים (לפי ת.ז., או לפי שם כשאין ת.ז.) מדולג.{" "}
            <button type="button" className="cust-link" onClick={template}>הורדת קובץ לדוגמה</button>
          </div>
          {method === "paste" && (
            <>
              <textarea className="ck-input" dir="auto" rows={7} aria-label="רשימת לקוחות" placeholder={"ישראל ישראלי, 123456789, israel@example.com, 050-0000000\nחברת דוגמה בע\"מ, 514000000, office@example.com"} value={text} onChange={(e) => setText(e.target.value)} disabled={!revealed} />
              <div className="ck-row"><button className="ck-btn" disabled={!revealed || !text.trim()} onClick={() => review(parseDelimited(text))}>בדיקת הרשימה</button></div>
            </>
          )}
          {method === "file" && (
            <div className="ck-row">
              <input ref={fileRef} id="cust-file" type="file" accept=".xlsx,.csv,.txt,text/csv" className="cust-file" disabled={!revealed} onChange={(e) => void onFile(e.target.files?.[0])} />
              <label htmlFor="cust-file" className={`ck-btn${revealed ? "" : " is-disabled"}`}>בחירת קובץ</label>
            </div>
          )}
        </div>
      )}

      {rows && counts && rows.length > 0 && revealed && (
        <div className="ck-stack">
          <div className="ck-ok">{usedHeader ? "זוהו כותרות. " : "לא זוהו כותרות, נקרא לפי הסדר. "}נמצאו {rows.length} שורות: {counts.fresh} חדשות, {counts.dup} קיימות כבר, {counts.bad} לא תקינות.</div>
          <ul className="cust-preview">
            {rows.slice(0, 200).map((r, i) => (
              <li key={i} className={`cust-prow ${r.status}`}>
                <div className="cust-pname"><b>{r.name || "(ללא שם)"}</b><span className="cust-pstatus">{STATUS[r.status]}</span></div>
                <div className="cust-pmeta">
                  {r.tax_id && <bdi dir="ltr">{r.tax_id}</bdi>}{r.email && <bdi dir="ltr">{r.email}</bdi>}{r.phone && <bdi dir="ltr">{r.phone}</bdi>}
                </div>
                {r.problems.length > 0 && <div className="cust-pnote err">{r.problems.join(", ")}</div>}
                {r.status === "new" && r.gaps.length > 0 && <div className="cust-pnote">חסר: {r.gaps.join(", ")}</div>}
              </li>))}
          </ul>
          {rows.length > 200 && <div className="ck-meta">מוצגות 200 הראשונות. כל החדשות ייובאו.</div>}
          <div className="ck-row">
            <button className="ck-btn primary" disabled={busy || counts.fresh === 0} onClick={() => void save()}>{busy ? "שומרים..." : `ייבוא ${counts.fresh} לקוחות חדשים`}</button>
            <button className="ck-btn" onClick={() => setRows(null)}>ביטול</button>
          </div>
        </div>
      )}
      {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
    </div>
  );
}
