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
  customer_sync_failed: "פתיחת הלקוח ב-Invoice4U נכשלה. אם הלקוח כבר קיים שם, הזינו את מספר הלקוח שלו בכרטיס הלקוח.",
  invoice4u_rejected: "Invoice4U דחה את המסמך. הפרטים מופיעים בשורת המסמך.",
  invoice4u_not_configured: "החיבור ל-Invoice4U לא הוגדר בשרת.",
  casual_not_allowed: "לקוח מזדמן אפשרי רק בחשבונית מס קבלה ובחשבונית זיכוי.",
  qa_key_missing: "לא הוגדר מפתח לסביבת הניסוי של Invoice4U (FIN_INVOICE4U_QA_KEY). הפקה בניסוי דורשת מפתח נפרד מהמפתח האמיתי.",
  outcome_uncertain: "לא התקבלה תשובה סופית. אל תפיקו שוב. לחצו על בדיקת סטטוס מול Invoice4U.",
  not_found_at_provider: "Invoice4U לא מכיר מסמך עם המזהה הזה. אפשר להפיק מחדש.",
  never_attempted: "לא בוצע ניסיון הפקה למסמך הזה.",
  fetch_failed: "שגיאת תקשורת. אל תפיקו שוב לפני בדיקת סטטוס מול Invoice4U.",
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
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.", forbidden: "אין הרשאה. נדרש שותף במשרד עם אימות דו שלבי.",
  invoice4u_not_configured: "החיבור ל-Invoice4U לא הוגדר בשרת.", invoice4u_rejected: "Invoice4U דחה את הבקשה. בדקו שמפתח ה-API תקף לסביבה שנבחרה.",
  archive_conflict: "Invoice4U מדווח סכומים שונים ממה שכבר נשמר לאחד המספרים. הייבוא נעצר ודורש בדיקה ידנית.",
  bad_range: "טווח תאריכים לא תקין.", db_error: "שמירה למסד הנתונים נכשלה.", fetch_failed: "שגיאת תקשורת מול Invoice4U.",
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
  EXCEEDS_OPEN_AMOUNT: "הסכום גבוה מהיתרה הפתוחה בחשבונית.",
};
export const trustError = (message: string): string => TRUST_ERRORS[Object.keys(TRUST_ERRORS).find((k) => message.includes(k)) ?? ""] ?? message;


export interface SendReminderReply { ok?: boolean; code?: string; to?: string; warning?: string; detail?: string }
const SEND_ERRORS: Record<string, string> = {
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.", forbidden: "אין הרשאה לשליחת תזכורות. נדרשת רמת הנפקה.",
  customer_not_found: "הלקוח לא נמצא.", customer_archived: "הלקוח בארכיון.", no_email: "אין ללקוח כתובת דוא\"ל.", no_own_email: "לא נמצאה כתובת דוא\"ל להתחברות שלכם.",
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
