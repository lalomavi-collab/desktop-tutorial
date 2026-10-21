// Calls from the finance screens to the database and to the lalum-fin-issue edge function.
import { supabase } from "../supabase";

export interface IssueReply {
  ok?: boolean; code?: string; doc_number?: number; allocation_number?: string | null; pdf_url?: string | null;
  is_test?: boolean; total_mismatch?: boolean; hint?: string; detail?: string;
  errors?: Array<{ id?: number; error?: string }>; status?: string;
}

const ISSUE_ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.",
  not_found: "המסמך לא נמצא.",
  already_issued: "המסמך כבר הופק.",
  bad_related_document: "מסמך המקור חייב להיות מסמך שהופק לאותו לקוח, מהסוג המתאים ובאותה סביבה.",
  customer_not_found: "הלקוח לא נמצא.",
  customer_sync_failed: "פתיחת הלקוח במערכת ההנפקה נכשלה. אם הלקוח כבר קיים שם, הזינו את מספר הלקוח שלו בכרטיס הלקוח.",
  invoice4u_rejected: "מערכת ההנפקה דחתה את המסמך. הפרטים מופיעים בשורת המסמך.",
  invoice4u_not_configured: "החיבור למערכת ההנפקה לא הוגדר בשרת.",
  casual_not_allowed: "לקוח מזדמן אפשרי רק בחשבונית מס קבלה ובחשבונית זיכוי.",
  qa_key_missing: "לא הוגדר מפתח לסביבת הניסוי של מערכת ההנפקה (FIN_INVOICE4U_QA_KEY). הפקה בניסוי דורשת מפתח נפרד מהמפתח האמיתי.",
  outcome_uncertain: "לא התקבלה תשובה סופית. אל תפיקו שוב. לחצו על בדיקת סטטוס מול מערכת ההנפקה.",
  not_found_at_provider: "מערכת ההנפקה לא מכירה מסמך עם המזהה הזה. אפשר להפיק מחדש.",
  never_attempted: "לא בוצע ניסיון הפקה למסמך הזה.",
  fetch_failed: "שגיאת תקשורת. אל תפיקו שוב לפני בדיקת סטטוס מול מערכת ההנפקה.",
  network: "שגיאת רשת. אם ההפקה כבר נשלחה, בדקו סטטוס לפני ניסיון חוזר.",
};
export const issueError = (r: IssueReply): string => ISSUE_ERRORS[r.code ?? ""] ?? "הפעולה נכשלה. נסו שוב.";

const RPC_ERRORS: Record<string, string> = {
  FORBIDDEN: "אין הרשאה לפעולה.", BAD_TYPE: "סוג מסמך לא תקין.", BAD_CUSTOMER: "הלקוח לא נמצא.",
  DATE_IN_FUTURE: "אי אפשר להפיק מסמך בתאריך עתידי.", DATE_BEFORE_LAST: "התאריך מוקדם ממסמך שכבר הופק מאותו סוג. בחרו תאריך זהה או מאוחר ממנו.",
  BAD_SOURCE: "חשבון העסקה חייב להיות מסמך שהופק לאותו לקוח, וההמרה אפשרית רק לחשבונית מס או לחשבונית מס קבלה.",
  BAD_PERIOD: "חודש לא תקין.",
  CASUAL_NOT_ALLOWED: "לקוח מזדמן אפשרי רק בחשבונית מס קבלה ובחשבונית זיכוי.", BAD_LINES: "יש להזין בין שורה אחת ל-60 שורות.", BAD_LINE_NAME: "לכל שורה נדרש תיאור.",
  BAD_LINE_AMOUNT: "כמות ומחיר חייבים להיות גדולים מאפס.", NOT_A_DRAFT: "אפשר לערוך או למחוק טיוטה בלבד.",
  BILLING_LOCKED: "החיוב ללקוח הזה חסום בגלל חובות פתוחים מעל 60 יום. שותף יכול לאשר חריג מוגבל בזמן.",
  ISSUED_DOCUMENT_IMMUTABLE: "מסמך שהופק אינו ניתן לשינוי. לביטול הפיקו חשבונית זיכוי.",
};
export const rpcError = (message: string): string => RPC_ERRORS[Object.keys(RPC_ERRORS).find((k) => message.includes(k)) ?? ""] ?? message;

/** Issues a draft, or with action "reconcile" asks Invoice4U whether an uncertain attempt produced a document. */
export async function issueDocument(documentId: string, action: "issue" | "reconcile" = "issue"): Promise<IssueReply> {
  if (!supabase) return { ok: false, code: "network" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 55000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-issue`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify({ document_id: documentId, action }),
    });
    try { return (await res.json()) as IssueReply; } catch { return { ok: false, code: "fetch_failed" }; }
  } catch {
    // A timeout or dropped connection is NOT proof that nothing was issued.
    return { ok: false, code: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export interface ImportReply {
  ok?: boolean; code?: string; fetched?: number; inserted?: number; updated?: number; linked?: number; skipped?: number;
  doc_type?: number; errors?: string[]; per_type?: Record<string, number>;
}
const IMPORT_ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.", forbidden: "אין הרשאה. נדרש שותף בפירמה עם אימות דו שלבי.",
  invoice4u_not_configured: "החיבור למערכת ההנפקה לא הוגדר בשרת.", invoice4u_rejected: "מערכת ההנפקה דחתה את הבקשה. בדקו שמפתח ה-API תקף לסביבה שנבחרה.",
  archive_conflict: "מערכת ההיסטוריה מדווחת סכומים שונים ממה שכבר נשמר לאחד המספרים. הייבוא נעצר ודורש בדיקה ידנית.",
  bad_range: "טווח תאריכים לא תקין.", db_error: "שמירה למסד הנתונים נכשלה.", fetch_failed: "שגיאת תקשורת מול מערכת ההיסטוריה.",
};
export const importError = (r: ImportReply): string => `${IMPORT_ERRORS[r.code ?? ""] ?? "הייבוא נכשל."}${r.doc_type ? ` (סוג מסמך ${r.doc_type})` : ""}`;

/** Read-only import from Invoice4U. Never creates or changes anything there. */
export async function importFromInvoice4u(body: { action: "customers" } | { action: "documents"; from: string; to: string }): Promise<ImportReply> {
  if (!supabase) return { ok: false, code: "fetch_failed" };
  const { data } = await supabase.auth.getSession();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-import`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify(body),
    });
    try { return (await res.json()) as ImportReply; } catch { return { ok: false, code: "fetch_failed" }; }
  } catch {
    return { ok: false, code: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

const TRUST_ERRORS: Record<string, string> = {
  FORBIDDEN: "אין הרשאה לפעולה. כספי נאמנות דורשים רמת מנהל.",
  BAD_TYPE: "סוג התנועה לא תקין.", BAD_AMOUNT: "הסכום חייב להיות גדול מאפס.",
  MATTER_HAS_NO_CUSTOMER: "לתיק לא מקושר לקוח בכרטיס הכספי. קשרו לקוח לתיק לפני רישום תנועה.",
  REVERSAL_TARGET_MISSING: "התנועה לתיקון לא נמצאה.", REVERSAL_MISMATCH: "התיקון חייב להתאים לתנועה המקורית.",
  TRUST_OVERDRAFT_MATTER: "התנועה נדחתה: היא תוריד את יתרת התיק מתחת לאפס.",
  TRUST_OVERDRAFT_ACCOUNT: "התנועה נדחתה: היא תוריד את יתרת חשבון הנאמנות מתחת לאפס.",
  INVOICE_NOT_FOR_THIS_MATTER: "החשבונית אינה שייכת ללקוח של התיק.", INVOICE_NOT_PAYABLE: "אפשר לשלם מנאמנות רק חשבונית מס שהופקה, לא מסמך בדיקה.",
  STATEMENT_NOT_FOUND: "דף הבנק לא נמצא.", STATEMENT_ALREADY_SUPERSEDED: "הדף כבר תוקן. רעננו ותקנו את הגרסה העדכנית.",
  NO_CHANGE: "היתרה זהה לקיימת.", REASON_REQUIRED: "נדרשת סיבת התיקון.", BAD_BALANCE: "היתרה אינה תקינה.",
  "lalum_trust_statement_correct": "תיקון דפי בנק עדיין לא הופעל בשרת. יש להחיל את מיגרציה 0032.",
  VALUE_DATE_IN_FUTURE: "תאריך ערך לא יכול להיות עתידי.", VALUE_DATE_BEFORE_ACCOUNT_OPENED: "תאריך ערך מוקדם מפתיחת חשבון הנאמנות.",
  "p_value_date": "תאריך ערך עדיין לא הופעל בשרת. יש להחיל את מיגרציה 0033, או לרשום בלי תאריך ערך.",
  ACCOUNT_LOCKED_HAS_MOVEMENTS: "בחשבון יש תנועות או דפי בנק, ולכן פרטיו נעולים. סגרו אותו (ביתרה אפס) ופתחו חשבון חדש.",
  EXCEEDS_OPEN_AMOUNT: "הסכום גבוה מהיתרה הפתוחה בחשבונית.",
};
export const trustError = (message: string): string => TRUST_ERRORS[Object.keys(TRUST_ERRORS).find((k) => message.includes(k)) ?? ""] ?? message;


export interface SendReminderReply { ok?: boolean; code?: string; to?: string; warning?: string; detail?: string }
const SEND_ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.", forbidden: "אין הרשאה לשליחת תזכורות. נדרשת רמת הנפקה.",
  customer_not_found: "הלקוח לא נמצא.", customer_archived: "הלקוח בארכיון.", no_email: "אין ללקוח כתובת דוא\"ל.", no_own_email: "לא נמצאה כתובת דוא\"ל להתחברות שלכם.",
  no_whatsapp_consent: "אין ללקוח הסכמה רשומה לקבלת הודעות WhatsApp. רשמו הסכמה בכרטיס הלקוח לפני השליחה.",
  no_mobile: "אין ללקוח מספר נייד תקין בכרטיס. WhatsApp נשלח לנייד ישראלי בלבד.",
  template_not_configured: "לא הוגדרה תבנית WhatsApp מאושרת לדרגה הזו. הודעה יזומה ב-WhatsApp נשלחת רק כתבנית מאושרת.",
  whatsapp_not_configured: "החיבור ל-WhatsApp לא הוגדר בשרת.", mail_not_configured: "שליחת הדוא\"ל לא הוגדרה בשרת.",
  cooldown_active: "כבר נשלחה ללקוח תזכורת בשבעת הימים האחרונים.", bad_content: "תוכן ההודעה לא תקין. הטקסט צריך להיות בין 20 ל-2000 תווים.",
  send_failed: "השליחה נכשלה. התזכורת לא נספרה, אפשר לנסות שוב.", uncertain: "לא התקבלה תשובה סופית. בדקו ביומן התזכורות לפני ניסיון חוזר: ייתכן שההודעה נשלחה.", test_email_only: "בדיקה אפשרית בדוא\"ל בלבד.",
};
export const sendReminderError = (r: SendReminderReply): string => SEND_ERRORS[r.code ?? ""] ?? "הפעולה נכשלה. נסו שוב.";

/** Sends one reminder on a partner's click. The recipient comes from the customer record on the server. */
export async function sendReminder(body: { customer_id: string; tier: 1 | 2 | 3; channel: "EMAIL" | "WHATSAPP"; body?: string; test?: boolean; name?: string; amount?: number; days?: number }): Promise<SendReminderReply> {
  if (!supabase) return { ok: false, code: "send_failed" };
  const { data } = await supabase.auth.getSession();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-dunning-send`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify(body),
    });
    try { return (await res.json()) as SendReminderReply; } catch { return { ok: false, code: "send_failed" }; }
  } catch {
    // A timeout is not proof that nothing was sent: the server reserved the cooldown before sending.
    return { ok: false, code: "uncertain" };
  } finally {
    clearTimeout(timer);
  }
}

export interface ReceiptDraft {
  spent_on: string | null; supplier: string | null; category: string | null; description: string | null;
  total: number | null; vat_amount: number | null; supplier_doc_ref: string | null;
}
export interface ScanReceiptReply { ok: boolean; draft?: ReceiptDraft; low_confidence_fields?: string[]; code?: string }
const SCAN_ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.", forbidden: "אין הרשאה. סריקת חשבוניות דורשת שותף בפירמה עם אימות דו שלבי.",
  bad_media_type: "סוג הקובץ אינו נתמך. אפשר לסרוק תמונה (JPEG, PNG, WEBP).",
  image_too_small: "הקובץ קטן מדי. בחרו צילום ברור של החשבונית.", image_too_large: "הקובץ גדול מדי.",
  too_many_requests: "יותר מדי סריקות בשעה האחרונה. נסו שוב מאוחר יותר.",
  upstream_error: "קריאת החשבונית נכשלה. אפשר לנסות שוב, או למלא ידנית.", fetch_failed: "שגיאת תקשורת. אפשר לנסות שוב, או למלא ידנית.",
  not_configured: "סריקת חשבוניות לא הוגדרה בשרת.",
};
export const scanReceiptError = (r: ScanReceiptReply): string => SCAN_ERRORS[r.code ?? ""] ?? "קריאת החשבונית נכשלה. אפשר למלא ידנית.";

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const s = String(reader.result ?? "");
    resolve(s.slice(s.indexOf(",") + 1));
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

/** Reads a photographed or scanned receipt and returns a draft for the Expenses form to pre-fill. Never writes
 *  anything: the caller still reviews and saves through the ordinary form, same as a hand-typed entry. */
export async function scanReceipt(firmId: string, file: File): Promise<ScanReceiptReply> {
  if (!supabase) return { ok: false, code: "fetch_failed" };
  let imageBase64: string;
  try { imageBase64 = await fileToBase64(file); } catch { return { ok: false, code: "fetch_failed" }; }
  const { data } = await supabase.auth.getSession();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-receipt-scan`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify({ firm_id: firmId, image_base64: imageBase64, media_type: file.type }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.draft) return { ok: false, code: j?.code ?? "fetch_failed" };
    return { ok: true, draft: j.draft as ReceiptDraft, low_confidence_fields: Array.isArray(j.low_confidence_fields) ? j.low_confidence_fields : [] };
  } catch {
    return { ok: false, code: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export interface SendDocumentReply { ok?: boolean; code?: string; count?: number; attached?: boolean; warning?: string; detail?: string }
const DOC_SEND_ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.", forbidden: "אין הרשאה לשליחת מסמכים. נדרשת רמת הנפקה.",
  not_found: "המסמך לא נמצא.", not_issued: "אפשר לשלוח רק מסמך שהופק.", no_pdf: "אין קובץ PDF למסמך הזה, ולכן אי אפשר לשלוח אותו.",
  customer_not_found: "הלקוח לא נמצא.", no_email: "אין ללקוח כתובת דוא\"ל בכרטיס. הזינו כתובת בכרטיס הלקוח או הוסיפו כתובת ידנית.",
  no_own_email: "לא נמצאה כתובת דוא\"ל להתחברות שלכם.", no_recipient: "לא נבחר נמען.", bad_address: "אחת הכתובות אינה תקינה.",
  too_many: "יותר מדי נמענים. עד 6 כתובות בשליחה אחת.", bad_content: "טקסט ההודעה ארוך מדי (עד 2000 תווים).",
  duplicate_send: "המסמך כבר נשלח לנמען הזה בשתי הדקות האחרונות.", mail_not_configured: "שליחת הדוא\"ל לא הוגדרה בשרת.",
  send_failed: "השליחה נכשלה. אפשר לנסות שוב.", fetch_failed: "שגיאת תקשורת. בדקו ביומן השליחות לפני ניסיון חוזר: ייתכן שההודעה נשלחה.",
};
export const sendDocumentError = (r: SendDocumentReply): string => DOC_SEND_ERRORS[r.code ?? ""] ?? "הפעולה נכשלה. נסו שוב.";

/** Sends one issued document by e-mail on a partner's click. The customer's address comes from the customer record on the server. */
export async function sendDocument(body: { document_id: string; include_customer?: boolean; extra?: string; copy_to_me?: boolean; subject?: string; body?: string }): Promise<SendDocumentReply> {
  if (!supabase) return { ok: false, code: "fetch_failed" };
  const { data } = await supabase.auth.getSession();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lalum-fin-doc-send`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY) },
      body: JSON.stringify(body),
    });
    try { return (await res.json()) as SendDocumentReply; } catch { return { ok: false, code: "fetch_failed" }; }
  } catch {
    // A timeout is not proof that nothing was sent: the server reserved the record before sending.
    return { ok: false, code: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Records that the partner opened WhatsApp with the document message prepared. There is no delivery receipt on this path. */
export async function logWhatsappSend(documentId: string, recipient: string, text: string): Promise<boolean> {
  if (!supabase) return false;
  const { data: id, error } = await supabase.rpc("lalum_fin_doc_send_reserve", { p_document: documentId, p_channel: "WHATSAPP", p_recipient: recipient || "לא צוין נייד", p_subject: null, p_body: text });
  if (error || !id) return false;
  const { error: fe } = await supabase.rpc("lalum_fin_doc_send_finish", { p_id: id, p_ok: true, p_ref: null, p_error: null });
  return !fe;
}
