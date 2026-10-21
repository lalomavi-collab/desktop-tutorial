import { useState } from "react";
import { useClientNames } from "../../../components/cockpit/ClientNames";
import type { DocType, FinCustomer } from "../../../lib/cockpit/finance";
import { archivePdfLink } from "../../../lib/cockpit/archivePdf";
import { logWhatsappSend, sendDocument, sendDocumentError } from "../../../lib/cockpit/financeApi";
import { defaultBody, defaultSubject, deliveryState, waNumber, waText, whatsappUrl } from "../../../lib/cockpit/financeSend";
import type { DocSend } from "../../../lib/cockpit/financeSend";
import { DOC_TYPE } from "../../../lib/cockpit/finance";

type Note = { ok: boolean; text: string } | null;
const CHANNEL: Record<DocSend["channel"], string> = { EMAIL: "דוא\"ל", WHATSAPP: "WhatsApp" };
const when = (iso: string) => new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });

/** What is being sent: a ledger document (its PDF link is stored on it) or a document of the history archive (its link is asked of the
 *  provider each time and is never stored). */
export interface SendTarget { kind: "document" | "archive"; id: string; docType: DocType | null; docNumber: number | null; pdfUrl: string | null; isTest: boolean }

/** Everything Invoice4U offers on a document row, in one place: view, e-mail (customer, extra addresses, own copy, editable text),
 *  WhatsApp, copy link, print, and the log of what was sent with its delivery state. */
export function DocSendPanel({ target, customer, casualName, sends, level, onClose, onChange }: {
  target: SendTarget; customer: FinCustomer | undefined; casualName?: string; sends: DocSend[]; level: number; onClose: () => void; onChange: () => void;
}) {
  const cn = useClientNames();
  const subj = { doc_type: target.docType, doc_number: target.docNumber };
  const [includeCustomer, setIncludeCustomer] = useState(!!customer?.email);
  const [extra, setExtra] = useState("");
  const [copyToMe, setCopyToMe] = useState(true);
  const [subject, setSubject] = useState(defaultSubject(subj));
  const [body, setBody] = useState(defaultBody(subj));
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const canSendNow = level >= 3;
  const hasEmail = !!customer?.email;
  const mobile = waNumber(customer?.phone);
  const label = `${target.docType ? DOC_TYPE[target.docType] : "מסמך"} ${target.docNumber ?? ""}`.trim();

  /** The document's link: stored for a ledger document, asked of the provider for an archive document. Null with the reason on the screen. */
  async function link(): Promise<string | null> {
    if (target.pdfUrl) return target.pdfUrl;
    setBusy("link");
    const r = await archivePdfLink(target.id);
    setBusy(null);
    if (r.ok) return r.url;
    setNote({ ok: false, text: `מסמך ${target.docNumber ?? ""}: ${r.text}` });
    return null;
  }
  async function view() {
    const u = await link();
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  }
  async function sendMail() {
    setBusy("mail"); setNote(null);
    const r = await sendDocument({ ...(target.kind === "document" ? { document_id: target.id } : { archive_id: target.id }), include_customer: includeCustomer, extra, copy_to_me: copyToMe, subject, body });
    setBusy(null); onChange();
    if (r.ok) setNote({ ok: true, text: `${label} נשלח ל-${r.count} נמענים${r.attached ? " עם קובץ PDF מצורף" : ". הקובץ לא צורף (לא ניתן היה להוריד אותו), ההודעה כוללת קישור"}.${r.warning ? " יומן השליחות לא עודכן במלואו." : ""}${target.isTest ? " זהו מסמך בדיקה, ולכן נשלח לכתובת שלכם בלבד." : ""}` });
    else setNote({ ok: false, text: sendDocumentError(r) });
  }
  async function openWhatsapp() {
    const u = await link();
    if (!u) return;
    const text = waText(subj, u);
    window.open(whatsappUrl(customer?.phone, text), "_blank", "noopener,noreferrer");
    const ok = await logWhatsappSend({ kind: target.kind, id: target.id }, mobile ? `+${mobile}` : "", text);
    setNote({ ok, text: ok ? "WhatsApp נפתח עם ההודעה מוכנה. השליחה עצמה נעשית אצלכם, והרישום ביומן הוא רישום של הפתיחה." : "WhatsApp נפתח, אך הרישום ביומן השליחות נכשל." });
    onChange();
  }
  async function copyLink() {
    const u = await link();
    if (!u) return;
    try { await navigator.clipboard.writeText(u); setNote({ ok: true, text: "הקישור למסמך הועתק." }); }
    catch { setNote({ ok: false, text: "ההעתקה נחסמה בדפדפן. פתחו את המסמך והעתיקו את הכתובת משם." }); }
  }

  return (
    <div className="ck-card ck-stack" role="region" aria-label={`שליחת ${label}`}>
      <div className="ck-row" style={{ justifyContent: "space-between" }}>
        <div className="ck-title">שליחת {label}{target.kind === "archive" ? " (מהארכיון)" : ""}</div>
        <div className="ck-row">
          <button className="ck-btn sm" disabled={busy !== null} onClick={() => void view()}>צפייה</button>
          <button className="ck-btn sm" disabled={busy !== null} title="נפתח בלשונית חדשה, משם אפשר להדפיס" onClick={() => void view()}>הדפסה</button>
          <button className="ck-btn sm" disabled={busy !== null} onClick={() => void copyLink()}>העתקת קישור</button>
        </div>
      </div>
      {target.isTest && <div className="ck-warn">זהו מסמך בדיקה מסביבת הניסוי. אפשר לשלוח אותו רק לכתובת שלכם.</div>}
      {target.kind === "archive" && <div className="ck-meta">מסמך מהארכיון נשלח עם קישור שמערכת ההיסטוריה מחזירה ברגע השליחה. אם היא לא מחזירה קישור, השליחה נעצרת ולא נרשמת.</div>}
      {!canSendNow && <div className="ck-warn">שליחה דורשת הרשאת הפקה. צפייה, הדפסה והעתקת קישור זמינות לכם.</div>}

      <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={includeCustomer && hasEmail} disabled={!hasEmail || target.isTest} onChange={(e) => setIncludeCustomer(e.target.checked)} />
        ללקוח {customer ? cn.customer(customer) : cn.casual(casualName ?? "")}{hasEmail && cn.revealed ? <bdi dir="ltr"> ({customer?.email})</bdi> : null}
      </label>
      {!hasEmail && <div className="ck-meta">{customer ? 'אין ללקוח כתובת דוא"ל בכרטיס. אפשר להזין כתובת ידנית למטה, או לעדכן את כרטיס הלקוח.' : "אין כרטיס לקוח מקושר למסמך הזה (לקוח מזדמן או לקוח שלא יובא). הזינו כתובת ידנית למטה."}</div>}
      <label className="ck-field">כתובות נוספות (מופרדות בפסיק)<input className="ck-input" dir="ltr" value={extra} disabled={target.isTest} onChange={(e) => setExtra(e.target.value)} placeholder="name@example.com, other@example.com" /></label>
      <label className="ck-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={copyToMe} onChange={(e) => setCopyToMe(e.target.checked)} />עותק אליי (הלקוח לא רואה אותו)</label>
      <label className="ck-field">נושא<input className="ck-input" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="ck-field">תוכן ההודעה<textarea className="ck-input" rows={6} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <div className="ck-meta">הקובץ מצורף להודעה, והקישור למסמך נוסף אוטומטית בסופה. ההערה הפנימית של המסמך לעולם לא נשלחת.</div>

      {note && <div className={note.ok ? "ck-ok" : "ck-err"} aria-live="polite">{note.text}</div>}
      <div className="ck-row">
        <button className="ck-btn primary" disabled={busy !== null || !canSendNow || (!includeCustomer && !extra.trim() && !copyToMe)} onClick={() => void sendMail()}>{busy === "mail" ? "שולח..." : "שליחה בדוא\"ל"}</button>
        <button className="ck-btn" disabled={busy !== null || !canSendNow} title={mobile ? "פותח WhatsApp עם הודעה מוכנה ללקוח" : "אין נייד תקין בכרטיס: WhatsApp ייפתח לבחירת איש קשר"} onClick={() => void openWhatsapp()}>שליחה ב-WhatsApp</button>
        <button className="ck-btn" onClick={onClose}>סגירה</button>
      </div>

      <div className="ck-label">יומן שליחות</div>
      {sends.length ? (
        <>
          <div className="ck-table-wrap"><table className="ck-table"><thead><tr><th>מתי</th><th>ערוץ</th><th>נמען</th><th>מצב</th></tr></thead><tbody>
            {sends.map((s) => {
              const st = deliveryState(s);
              return (
                <tr key={s.id}>
                  <td>{when(s.created_at)}</td><td>{CHANNEL[s.channel]}</td>
                  <td className="fin-text">{cn.revealed ? <bdi dir="ltr">{s.recipient}</bdi> : "מוסתר"}</td>
                  <td><span className={`ck-badge ${st.tone}`}>{st.text}</span>{s.opened_at ? <div className="ck-meta">{when(s.opened_at)}</div> : null}</td>
                </tr>
              );
            })}
          </tbody></table></div>
          <div className="ck-meta">"נפתח" נקבע לפי טעינת תמונת מעקב בהודעה: הוא מופיע רק כשהוא ידוע. תוכנת דוא"ל שחוסמת תמונות לא תדווח פתיחה, ולכן היעדר "נפתח" אינו אומר שההודעה לא נקראה.</div>
        </>
      ) : <div className="ck-meta">המסמך עדיין לא נשלח מהמערכת.</div>}
    </div>
  );
}
