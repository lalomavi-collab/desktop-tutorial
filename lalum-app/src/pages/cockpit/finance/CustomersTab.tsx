import { useState } from "react";
import { useClientNames } from "../../../components/cockpit/ClientNames";
import { supabase } from "../../../lib/supabase";
import { CONSENT_BASIS, customerGaps, customerProblems, splitName, whatsappConsentActive } from "../../../lib/cockpit/finance";
import { rpcError } from "../../../lib/cockpit/financeApi";
import type { FinCustomer } from "../../../lib/cockpit/finance";

type Draft = { name: string; tax_id: string; email: string; phone: string; address: string; city: string; notes: string; i4u: string; casual: boolean; ret: boolean; retDesc: string; retAmt: string };
const blank: Draft = { name: "", tax_id: "", email: "", phone: "", address: "", city: "", notes: "", i4u: "", casual: false, ret: false, retDesc: "", retAmt: "" };

export function CustomersTab({ firmId, customers, onChange }: { firmId: string; customers: FinCustomer[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState<Draft>(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState("");
  const cn = useClientNames();
  const [withArchived, setWithArchived] = useState(false);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const isNew = editing === "new";

  function open(c?: FinCustomer) {
    setEditing(c?.id ?? "new"); setMsg(null);
    setF(c ? { name: c.name, tax_id: c.tax_id ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", city: c.city ?? "", notes: c.notes ?? "", i4u: c.i4u_customer_id ? String(c.i4u_customer_id) : "", casual: c.is_casual, ret: c.retainer_active, retDesc: c.retainer_description ?? "", retAmt: c.retainer_amount != null ? String(c.retainer_amount) : "" } : blank);
  }
  async function save() {
    if (!supabase) return;
    const problems = customerProblems({ name: f.name, email: f.email, tax_id: f.tax_id, i4u: f.i4u, casual: f.casual, isNew });
    if (problems.length) { setMsg({ ok: false, text: problems.join(". ") + "." }); return; }
    if (f.ret && (!f.retDesc.trim() || !(Number(f.retAmt) > 0))) { setMsg({ ok: false, text: "לריטיינר חודשי נדרשים תיאור וסכום גדול מאפס." }); return; }
    const row = {
      name: f.name.trim(), tax_id: f.tax_id || null, email: f.email.trim() || null, phone: f.phone.trim() || null,
      address: f.address.trim() || null, city: f.city.trim() || null, notes: f.notes.trim() || null,
      i4u_customer_id: f.casual ? null : f.i4u ? Number(f.i4u) : null,
      retainer_active: f.casual ? false : f.ret, retainer_description: f.ret ? f.retDesc.trim() : null, retainer_amount: f.ret ? Number(f.retAmt) : null,
    };
    const { error } = isNew
      ? await supabase.from("lalum_fin_customers").insert({ ...row, firm_id: firmId, is_casual: f.casual })
      : await supabase.from("lalum_fin_customers").update(row).eq("id", editing);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setEditing(null); onChange();
  }
  /** Records or withdraws the customer's consent to WhatsApp messages. The database enforces it when a reminder is sent. */
  async function consent(c: FinCustomer, given: boolean) {
    if (!supabase) return;
    let basis: string | null = null, note: string | null = null;
    if (given) {
      const keys = Object.keys(CONSENT_BASIS);
      const pick = window.prompt(`על מה מבוססת ההסכמה?\n${keys.map((k, i) => `${i + 1}. ${CONSENT_BASIS[k]}`).join("\n")}`, "1");
      if (pick === null) return;
      basis = keys[Number(pick) - 1] ?? null;
      if (!basis) return setMsg({ ok: false, text: "בחרו מספר מהרשימה." });
      note = window.prompt("הערה (אופציונלי), למשל איפה ההסכמה מתועדת:", "");
      if (note === null) return;
    } else if (!window.confirm("לבטל את ההסכמה? שליחת WhatsApp ללקוח תיחסם.")) return;
    const { error } = await supabase.rpc("lalum_fin_set_whatsapp_consent", { p_customer: c.id, p_given: given, p_basis: basis, p_note: note });
    if (error) return setMsg({ ok: false, text: rpcError(error.message) });
    setMsg({ ok: true, text: given ? "ההסכמה נרשמה." : "ההסכמה בוטלה." });
    onChange();
  }
  async function archive(c: FinCustomer) {
    if (!supabase) return;
    await supabase.from("lalum_fin_customers").update({ archived: !c.archived }).eq("id", c.id);
    onChange();
  }
  const archivedCount = customers.filter((c) => c.archived).length;
  const shown = customers.filter((c) => (withArchived || !c.archived) && (!q.trim() || (cn.revealed && c.name.includes(q.trim())) || cn.customer(c).includes(q.trim()) || (c.tax_id ?? "").includes(q.trim())));

  return (
    <div className="ck-stack">
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <input className="ck-input" aria-label="חיפוש לקוח" placeholder={cn.revealed ? "חיפוש לפי שם או ת.ז." : "חיפוש לפי מספר לקוח או ת.ז. (השמות מוסתרים)"} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        {archivedCount > 0 && <label className="ck-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={withArchived} onChange={(e) => setWithArchived(e.target.checked)} />הצגת לקוחות בארכיון (<bdi>{archivedCount}</bdi>)</label>}
        <button className="ck-btn primary" onClick={() => open()}>לקוח חדש</button>
      </div>
      {editing && cn.revealed && (
        <div className="ck-card ck-stack">
          <div className="ck-title">{isNew ? "לקוח חדש" : "עריכת לקוח"}</div>
          {isNew && (
            <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={f.casual} onChange={(e) => setF({ ...f, casual: e.target.checked })} />
              לקוח מזדמן (בלי כרטיס ב-Invoice4U, שם בלבד)
            </label>
          )}
          {f.casual && <div className="ck-meta">לקוח מזדמן אפשרי רק בחשבונית מס קבלה ובחשבונית זיכוי. לכל מסמך אחר פתחו לקוח רגיל.</div>}
          <div className="ck-grid2">
            <label className="ck-field">שם<input className="ck-input" value={f.name} onChange={set("name")} /></label>
            <label className="ck-field">ת.ז. / ח.פ.<input className="ck-input" dir="ltr" inputMode="numeric" value={f.tax_id} onChange={set("tax_id")} /></label>
            <label className="ck-field">דוא"ל{isNew && !f.casual ? " (חובה)" : ""}<input className="ck-input" dir="ltr" type="email" value={f.email} onChange={set("email")} /></label>
            <label className="ck-field">טלפון<input className="ck-input" dir="ltr" inputMode="tel" value={f.phone} onChange={set("phone")} /></label>
            <label className="ck-field">כתובת<input className="ck-input" value={f.address} onChange={set("address")} /></label>
            <label className="ck-field">עיר<input className="ck-input" value={f.city} onChange={set("city")} /></label>
            {!f.casual && <label className="ck-field">מספר לקוח ב-Invoice4U (אם הלקוח כבר קיים שם)<input className="ck-input" dir="ltr" inputMode="numeric" value={f.i4u} onChange={set("i4u")} /></label>}
            <label className="ck-field">הערות<input className="ck-input" value={f.notes} onChange={set("notes")} /></label>
          </div>
          {!f.casual && (
            <div className="ck-stack">
              <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={f.ret} onChange={(e) => setF({ ...f, ret: e.target.checked })} />ריטיינר חודשי (נוצרת טיוטה בלבד, לעולם לא הפקה אוטומטית)</label>
              {f.ret && (
                <div className="ck-grid2">
                  <label className="ck-field">תיאור השורה<input className="ck-input" maxLength={500} value={f.retDesc} onChange={set("retDesc")} /></label>
                  <label className="ck-field">סכום לפני מע"מ<input className="ck-input" dir="ltr" inputMode="decimal" value={f.retAmt} onChange={set("retAmt")} /></label>
                </div>
              )}
            </div>
          )}
          {!isNew && !f.casual && (() => {
            const c = customers.find((x) => x.id === editing);
            if (!c) return null;
            const on = whatsappConsentActive(c);
            return (
              <div className="ck-card ck-stack" data-testid="wa-consent">
                <div className="ck-label">הסכמה להודעות WhatsApp</div>
                <div className="ck-meta">
                  {on ? `ניתנה, ${CONSENT_BASIS[c.whatsapp_consent_basis ?? ""] ?? "בסיס לא ידוע"}${c.whatsapp_consent_note ? `: ${c.whatsapp_consent_note}` : ""}.`
                    : c.whatsapp_consent_revoked_at ? "בוטלה. שליחת WhatsApp חסומה." : "לא נרשמה. שליחת WhatsApp חסומה עד שתירשם הסכמה."}
                </div>
                <div className="ck-row">
                  {on ? <button className="ck-btn sm" onClick={() => void consent(c, false)}>ביטול הסכמה</button>
                    : <button className="ck-btn sm" onClick={() => void consent(c, true)}>רישום הסכמה</button>}
                </div>
              </div>);
          })()}
          {msg && <div className={msg.ok ? "ck-ok" : "ck-err"} aria-live="polite">{msg.text}</div>}
          <div className="ck-row"><button className="ck-btn primary" onClick={() => void save()}>שמירה</button><button className="ck-btn" onClick={() => setEditing(null)}>ביטול</button></div>
        </div>
      )}
      <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>שם</th><th className="fin-num">ת.ז. / ח.פ.</th><th className="fin-num">דוא"ל</th><th className="fin-num">טלפון</th><th>Invoice4U</th><th></th></tr></thead><tbody>
        {shown.length ? shown.map((c) => {
          const n = splitName(c.name), addr = n.address ?? c.address, gaps = customerGaps(c);
          return (
            <tr key={c.id} style={c.archived ? { opacity: 0.55 } : undefined}>
              <td className="fin-text">
                <span className="fin-name" title={cn.revealed ? c.name : undefined}>{cn.revealed ? n.name : cn.customer(c)}</span>{cn.revealed && addr && <span className="fin-sub" title={addr}>{addr}</span>}
                {c.is_casual && <span className="ck-badge yellow">מזדמן</span>}
                {gaps.length > 0 && <span className="fin-sub">חסר: {gaps.join(", ")}</span>}
              </td>
              <td className="fin-ltr">{c.tax_id ?? ""}</td><td className="fin-ltr">{c.email ?? ""}</td><td className="fin-ltr">{c.phone ?? ""}</td>
              <td>{c.is_casual ? "מזדמן, ללא כרטיס" : c.i4u_customer_id ? "מקושר" : "יפתח בהפקה ראשונה"}</td>
              <td className="fin-actions-cell"><div className="fin-actions"><button className="ck-btn sm" disabled={!cn.revealed} title={cn.revealed ? undefined : "עריכת כרטיס לקוח מציגה את שמו: הציגו שמות כדי לערוך (נרשם ביומן)."} onClick={() => open(c)}>עריכה</button><button className="ck-btn sm" onClick={() => void archive(c)}>{c.archived ? "שחזור" : "לארכיון"}</button></div></td>
            </tr>);
        }) : <tr><td colSpan={6}>אין לקוחות עדיין</td></tr>}
      </tbody></table></div>
    </div>
  );
}
