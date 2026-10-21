import { useState } from "react";
import { useClientNames } from "../../../components/cockpit/ClientNames";
import { DOC_TYPE } from "../../../lib/cockpit/finance";
import type { FinCustomer, FinDocument } from "../../../lib/cockpit/finance";
import { logWhatsappSend, sendDocument, sendDocumentError } from "../../../lib/cockpit/financeApi";
import { defaultBody, defaultSubject, waNumber, waText, whatsappUrl } from "../../../lib/cockpit/financeSend";
import type { DocSend } from "../../../lib/cockpit/financeSend";

type Note = { ok: boolean; text: string } | null;
const STATUS: Record<DocSend["status"], string> = { SENT: "נשלח", FAILED: "נכשל", PENDING: "בשליחה" };
const CHANNEL: Record<DocSend["channel"], string> = { EMAIL: "דוא\"ל", WHATSAPP: "WhatsApp" };
const when = (iso: string) => new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });

/** Everything Invoice4U offers on a document row, in one place: view, e-mail (customer, extra addresses, own copy, editable text),
 *  WhatsApp, copy link, print, and the log of what was sent. A document that was not issued cannot be sent. */
export function DocSendPanel({ doc, customer, sends, level, onClose, onChange }: {
  doc: FinDocument; customer: FinCustomer | undefined; sends: DocSend[]; level: number; onClose: () => void; onChange: () => void;
}) {
  const cn = useClientNames();
  const [includeCustomer, setIncludeCustomer] = useState(!!customer?.email);
  const [extra, setExtra] = useState("");
  const [copyToMe, setCopyToMe] = useState(true);
  const [subject, setSubject] = useState(defaultSubject(doc));
  const [body, setBody] = useState(defaultBody(doc));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const canSendNow = level >= 3;
  const hasEmail = !!customer?.email;
  const mobile = waNumber(customer?.phone);
  const label = `${DOC_TYPE[doc.doc_type]} ${doc.doc_number ?? ""}`;

  async function sendMail() {
    setBusy(true); setNote(null);
    const r = await sendDocument({ document_id: doc.id, include_customer: includeCustomer, extra, copy_to_me: copyToMe, subject, body });
    setBusy(false); onChange();
    if (r.ok) setNote({ ok: true, text: `${label} נשלח ל-${r.count} נמענים${r.attached ? " עם קובץ PDF מצורף" : ". הקובץ לא צורף (לא ניתן היה להוריד אותו), ההודעה כוללת קישור"}.${r.warning ? " יומן השליחות לא עודכן במלואו." : ""}${doc.is_test ? " זהו מסמך בדיקה, ולכן נשלח לכתובת שלכם בלבד." : ""}` });
    else setNote({ ok: false, text: sendDocumentError(r) });
  }
  async function openWhatsapp() {
    const text = waText(doc);
    window.open(whatsappUrl(customer?.phone, text), "_blank", "noopener,noreferrer");
    const ok = await logWhatsappSend(doc.id, mobile ? `+${mobile}` : "", text);
    setNote({ ok, text: ok ? "WhatsApp נפתח עם ההודעה מוכנה. השליחה עצמה נעשית אצלכם, והרישום ביומן הוא רישום של הפתיחה." : "WhatsApp נפתח, אך הרישום ביומן השליחות נכשל." });
    onChange();
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(doc.pdf_url ?? ""); setNote({ ok: true, text: "הקישור למסמך הועתק." }); }
    catch { setNote({ ok: false, text: "ההעתקה נחסמה בדפדפן. פתחו את המסמך והעתיקו את הכתובת משם." }); }
  }

  return (
    <div className="ck-card ck-stack" role="region" aria-label={`שליחת ${label}`}>
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-title">שליחת {label}</div>
        <div className="ck-row">
          <a className="ck-btn sm" href={doc.pdf_url ?? undefined} target="_blank" rel="noopener noreferrer">צפייה</a>
          <a className="ck-btn sm" href={doc.pdf_url ?? undefined} target="_blank" rel="noopener noreferrer" title="נפתח בלשונית חדשה, משם אפשר להדפיס">הדפסה</a>
          <button className="ck-btn sm" onClick={() => void copyLink()}>העתקת קישור</button>
        </div>
      </div>
      {doc.is_test && <div className="ck-warn">זהו מסמך בדיקה מסביבת הניסוי. אפשר לשלוח אותו רק לכתובת שלכם.</div>}
      {!canSendNow && <div className="ck-warn">שליחה דורשת הרשאת הפקה. צפייה, הדפסה והעתקת קישור זמינות לכם.</div>}

      <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={includeCustomer && hasEmail} disabled={!hasEmail || doc.is_test} onChange={(e) => setIncludeCustomer(e.target.checked)} />
        ללקוח {cn.customer(customer ?? { id: doc.customer_id })}{hasEmail && cn.revealed ? <bdi dir="ltr"> ({customer?.email})</bdi> : null}
      </label>
      {!hasEmail && <div className="ck-meta">אין ללקוח כתובת דוא"ל בכרטיס. אפשר להזין כתובת ידנית למטה, או לעדכן את כרטיס הלקוח.</div>}
      <label className="ck-field">כתובות נוספות (מופרדות בפסיק)<input className="ck-input" dir="ltr" value={extra} disabled={doc.is_test} onChange={(e) => setExtra(e.target.value)} placeholder="name@example.com, other@example.com" /></label>
      <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={copyToMe} onChange={(e) => setCopyToMe(e.target.checked)} />עותק אליי (הלקוח לא רואה אותו)</label>
      <label className="ck-field">נושא<input className="ck-input" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="ck-field">תוכן ההודעה<textarea className="ck-input" rows={6} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <div className="ck-meta">הקובץ מצורף להודעה, והקישור למסמך נוסף אוטומטית בסופה. ההערה הפנימית של המסמך לעולם לא נשלחת.</div>

      {note && <div className={note.ok ? "ck-ok" : "ck-err"} aria-live="polite">{note.text}</div>}
      <div className="ck-row">
        <button className="ck-btn primary" disabled={busy || !canSendNow || (!includeCustomer && !extra.trim() && !copyToMe)} onClick={() => void sendMail()}>{busy ? "שולח..." : "שליחה בדוא\"ל"}</button>
        <button className="ck-btn" disabled={!canSendNow} title={mobile ? "פותח WhatsApp עם הודעה מוכנה ללקוח" : "אין נייד תקין בכרטיס: WhatsApp ייפתח לבחירת איש קשר"} onClick={() => void openWhatsapp()}>שליחה ב-WhatsApp</button>
        <button className="ck-btn" onClick={onClose}>סגירה</button>
      </div>

      <div className="ck-label">יומן שליחות</div>
      {sends.length ? (
        <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>מתי</th><th>ערוץ</th><th>נמען</th><th>סטטוס</th></tr></thead><tbody>
          {sends.map((s) => (
            <tr key={s.id}>
              <td>{when(s.created_at)}</td><td>{CHANNEL[s.channel]}</td>
              <td className="fin-text">{cn.revealed ? <bdi dir="ltr">{s.recipient}</bdi> : "מוסתר"}</td>
              <td><span className={`ck-badge ${s.status === "SENT" ? "green" : s.status === "FAILED" ? "red" : "yellow"}`}>{STATUS[s.status]}</span>{s.channel === "WHATSAPP" && s.status === "SENT" ? <div className="ck-meta">נפתח אצל השותף</div> : null}</td>
            </tr>
          ))}
        </tbody></table></div>
      ) : <div className="ck-meta">המסמך עדיין לא נשלח מהמערכת.</div>}
    </div>
  );
}
